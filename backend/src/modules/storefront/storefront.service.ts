import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SalesService } from '../sales/sales.service';
import { CheckoutFormConfig, normalizeCheckoutForm } from './checkout-form';

export type CreateOrderInput = {
  businessId: string;
  items: { productId: string; variantId?: string; quantity: number }[];
  values: Record<string, unknown>;
  deliveryMethod?: 'PICKUP' | 'DELIVERY';
  /** Honeypot: real buyers never see or fill it. */
  website?: string;
  source?: 'buy_now' | 'cart';
};

const MAX_LINES = 50;
const ORDERS_PER_WINDOW = 5;
const WINDOW_MINUTES = 10;

const digits = (v: string) => v.replace(/\D/g, '');

@Injectable()
export class StorefrontService {
  private readonly logger = new Logger(StorefrontService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly sales: SalesService,
  ) {}

  // ── Public: checkout configuration ─────────────────────────────────────────

  async getPublicCheckout(businessId: string) {
    const { profile } = await this.getActiveVendor(businessId);
    return {
      form: normalizeCheckoutForm(profile?.checkoutForm),
      delivery: this.deliveryOptions(profile),
    };
  }

  // ── Public: create order (guest, cash on delivery) ─────────────────────────

  async createOrder(input: CreateOrderInput, ipAddress: string | null) {
    if (input.website)
      throw new BadRequestException('No se pudo procesar el pedido');
    if (!input.businessId)
      throw new BadRequestException('Falta la tienda del pedido');

    const { business, profile, taxRate } = await this.getActiveVendor(
      input.businessId,
    );
    const form = normalizeCheckoutForm(profile?.checkoutForm);
    const delivery = this.deliveryOptions(profile);

    // Delivery method
    const deliveryMethod =
      input.deliveryMethod === 'DELIVERY' ? 'DELIVERY' : 'PICKUP';
    if (deliveryMethod === 'DELIVERY' && !delivery.deliveryEnabled)
      throw new BadRequestException('Esta tienda no hace delivery');
    if (deliveryMethod === 'PICKUP' && !delivery.pickupEnabled)
      throw new BadRequestException('Esta tienda no tiene retiro en tienda');

    // Form values
    const values =
      input.values && typeof input.values === 'object' ? input.values : {};
    const customer = this.validateValues(form, values, deliveryMethod);

    // Abuse limit per phone and per IP
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
    const recent = await this.prisma.shopOrder.count({
      where: {
        createdAt: { gte: since },
        OR: [
          { customerPhone: customer.phone },
          ...(ipAddress ? [{ ipAddress }] : []),
        ],
      },
    });
    if (recent >= ORDERS_PER_WINDOW) {
      throw new HttpException(
        'Recibimos varios pedidos seguidos desde este teléfono. Espera unos minutos e intenta de nuevo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Items: price and stock always come from the database
    const lines = await this.resolveLines(
      input.businessId,
      input.items,
      taxRate,
    );
    const subtotal = round(lines.reduce((sum, l) => sum + l.subtotal, 0));
    if (delivery.minOrderAmount > 0 && subtotal < delivery.minOrderAmount) {
      throw new BadRequestException(
        `El pedido mínimo en esta tienda es de $${delivery.minOrderAmount.toFixed(2)}`,
      );
    }
    const deliveryCost =
      deliveryMethod === 'DELIVERY' && delivery.deliveryCostMode === 'FIXED'
        ? delivery.freeDeliveryFrom && subtotal >= delivery.freeDeliveryFrom
          ? 0
          : delivery.deliveryCost
        : 0;

    const customFields = Object.fromEntries(
      form.fields
        .filter(
          (f) =>
            !f.builtin &&
            f.enabled &&
            values[f.id] !== undefined &&
            values[f.id] !== '',
        )
        .map((f) => [f.label, normalizeCustomValue(f.type, values[f.id])]),
    );

    const order = await this.createWithUniqueCode((code) =>
      this.prisma.shopOrder.create({
        data: {
          code,
          businessId: input.businessId,
          status: 'PENDIENTE',
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          address: customer.address,
          city: customer.city,
          reference: customer.reference,
          notes: customer.notes,
          deliveryMethod,
          customFields: Object.keys(customFields).length
            ? customFields
            : undefined,
          subtotal,
          deliveryCost,
          total: round(subtotal + deliveryCost),
          taxRate,
          ipAddress,
          statusHistory: [
            {
              status: 'PENDIENTE',
              at: new Date().toISOString(),
              note:
                input.source === 'cart'
                  ? 'Pedido desde el carrito'
                  : 'Pedido con "Comprar ahora"',
            },
          ],
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              variantId: l.variantId,
              branchId: l.branchId,
              productName: l.productName,
              variantName: l.variantName,
              image: l.image,
              quantity: l.quantity,
              price: l.price,
              subtotal: l.subtotal,
            })),
          },
        },
        include: { items: true },
      }),
    );

    // The POS bell and websocket of the branch the stock comes from
    try {
      await this.notifications.create({
        type: 'SYNCRO_SHOP_ORDER',
        title: 'Nuevo pedido en Syncro Shop',
        message: `${order.code} · ${customer.name} · $${order.total.toFixed(2)} · ${deliveryMethod === 'DELIVERY' ? 'Delivery' : 'Retiro en tienda'}`,
        branchId: lines.find((l) => l.branchId)?.branchId ?? undefined,
      });
    } catch (err: any) {
      this.logger.error(
        `No se pudo notificar el pedido ${order.code}: ${err.message}`,
      );
    }

    return {
      code: order.code,
      status: order.status,
      subtotal: order.subtotal,
      deliveryCost: order.deliveryCost,
      total: order.total,
      deliveryMethod: order.deliveryMethod,
      storeName: profile?.displayName || business.name,
      storeWhatsapp: profile?.whatsapp || null,
      successMessage: form.successMessage,
      whatsappAfterOrder: form.whatsappAfterOrder,
      items: order.items.map((i) => ({
        productName: i.productName,
        variantName: i.variantName,
        quantity: i.quantity,
        price: i.price,
        subtotal: i.subtotal,
      })),
    };
  }

  /** Order status for the buyer; the phone number works as the password. */
  async getPublicOrder(code: string, phone: string) {
    const order = await this.prisma.shopOrder.findUnique({
      where: { code: code.toUpperCase() },
      include: { items: true, business: { include: { storeProfile: true } } },
    });
    const given = digits(phone || '');
    if (
      !order ||
      given.length < 7 ||
      !digits(order.customerPhone).endsWith(given.slice(-7))
    ) {
      throw new NotFoundException(
        'No encontramos un pedido con ese código y teléfono',
      );
    }
    return {
      code: order.code,
      status: order.status,
      createdAt: order.createdAt,
      customerName: order.customerName,
      deliveryMethod: order.deliveryMethod,
      address: order.address,
      subtotal: order.subtotal,
      deliveryCost: order.deliveryCost,
      total: order.total,
      rejectionReason: order.rejectionReason,
      statusHistory: order.statusHistory,
      storeName:
        order.business.storeProfile?.displayName || order.business.name,
      storeSlug: order.business.storeProfile?.slug || null,
      storeWhatsapp: order.business.storeProfile?.whatsapp || null,
      items: order.items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        variantName: i.variantName,
        image: i.image,
        quantity: i.quantity,
        price: i.price,
        subtotal: i.subtotal,
      })),
    };
  }

  // ── Merchant: checkout form builder ────────────────────────────────────────

  async getCheckoutFormForMerchant(businessId?: string) {
    if (!businessId)
      throw new BadRequestException('Falta el negocio del usuario');
    const profile = await this.ensureStoreProfile(businessId);
    return {
      form: normalizeCheckoutForm(profile.checkoutForm),
      delivery: this.deliveryOptions(profile),
      slug: profile.slug,
    };
  }

  async saveCheckoutForm(businessId: string | undefined, value: unknown) {
    if (!businessId)
      throw new BadRequestException('Falta el negocio del usuario');
    const profile = await this.ensureStoreProfile(businessId);
    const form: CheckoutFormConfig = normalizeCheckoutForm(value);
    await this.prisma.storeProfile.update({
      where: { id: profile.id },
      data: { checkoutForm: form as any },
    });
    return { form };
  }

  // ── Merchant: orders (phase 5) ─────────────────────────────────────────────

  async listOrders(businessId: string | undefined, status?: string) {
    if (!businessId)
      throw new BadRequestException('Falta el negocio del usuario');
    return this.prisma.shopOrder.findMany({
      where: { businessId, ...(status && status !== 'ALL' ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { items: true },
    });
  }

  async getOrder(businessId: string | undefined, id: string) {
    const order = await this.prisma.shopOrder.findFirst({
      where: { id, businessId },
      include: {
        items: { include: { branch: { select: { name: true } } } },
        client: { select: { id: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado');
    return order;
  }

  async getStats(businessId?: string) {
    if (!businessId)
      throw new BadRequestException('Falta el negocio del usuario');
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const sold = { in: ['APROBADO', 'EN_CAMINO', 'ENTREGADO'] };

    const [pending, monthAgg, totalAgg, published, featured] =
      await Promise.all([
        this.prisma.shopOrder.count({
          where: { businessId, status: 'PENDIENTE' },
        }),
        this.prisma.shopOrder.aggregate({
          where: { businessId, status: sold, createdAt: { gte: monthStart } },
          _sum: { total: true },
          _count: { _all: true },
        }),
        this.prisma.shopOrder.aggregate({
          where: { businessId, status: sold },
          _sum: { total: true },
          _count: { _all: true },
        }),
        this.prisma.product.count({
          where: { businessId, isPublishedOnSyncroShop: true },
        }),
        this.prisma.product.count({
          where: {
            businessId,
            isPublishedOnSyncroShop: true,
            isFeaturedOnSyncroShop: true,
          },
        }),
      ]);
    const monthCount = monthAgg._count._all;
    const monthTotal = monthAgg._sum.total ?? 0;
    return {
      pendingOrders: pending,
      monthSales: round(monthTotal),
      monthOrders: monthCount,
      averageTicket: monthCount ? round(monthTotal / monthCount) : 0,
      totalSales: round(totalAgg._sum.total ?? 0),
      totalOrders: totalAgg._count._all,
      publishedProducts: published,
      featuredProducts: featured,
      maxFeatured: 5,
    };
  }

  /**
   * Approves an order: registers it as a POS sale (one per stock branch), which
   * discounts inventory, records the movement, the shift and accounting (R12).
   */
  async approveOrder(
    businessId: string | undefined,
    id: string,
    userId: string,
    paymentMethod: string,
  ) {
    if (!businessId)
      throw new BadRequestException('Falta el negocio del usuario');
    const METHODS = [
      'CASH',
      'CARD',
      'TRANSFER',
      'PAGO_MOVIL',
      'BINANCE',
      'ZINLI',
      'PAYPAL',
    ];
    if (!METHODS.includes(paymentMethod))
      throw new BadRequestException('Elige cómo te pagará el cliente');

    // Lock: only one approval can move the order out of PENDIENTE.
    const locked = await this.prisma.shopOrder.updateMany({
      where: { id, businessId, status: 'PENDIENTE' },
      data: { status: 'PROCESANDO' },
    });
    if (locked.count === 0)
      throw new BadRequestException('Este pedido ya no está pendiente');

    const order = await this.prisma.shopOrder.findUniqueOrThrow({
      where: { id },
      include: { items: { include: { variant: true } } },
    });
    const saleIds: string[] = [];
    try {
      const mainBranch = await this.prisma.branch.findFirst({
        where: { businessId },
        orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
      });
      const clientId = await this.findOrCreateClient(businessId, order);

      // Check every line first so we do not create half the sales and then fail.
      const groups = new Map<string, typeof order.items>();
      for (const item of order.items) {
        if (!item.variantId || !item.variant)
          throw new BadRequestException(
            `"${item.productName}" ya no existe en tu inventario`,
          );
        const branchId = item.branchId ?? mainBranch?.id;
        if (!branchId)
          throw new BadRequestException('Tu negocio no tiene sucursales');
        const inventory = await this.prisma.inventory.findUnique({
          where: {
            variantId_branchId: { variantId: item.variantId, branchId },
          },
        });
        const stock = inventory ? inventory.quantity : item.variant.stock;
        if (stock < item.quantity) {
          throw new BadRequestException(
            `No hay stock suficiente de "${item.productName}" (quedan ${stock}). Ajusta el inventario o rechaza el pedido.`,
          );
        }
        groups.set(branchId, [...(groups.get(branchId) ?? []), item]);
      }

      for (const [branchId, items] of groups) {
        // Sell at the price the buyer accepted: if the product got more expensive since, the difference is a discount.
        const saleItems = items.map((item) => {
          const agreedNet = item.price / (1 + order.taxRate / 100);
          const discountAmt = Math.max(
            0,
            round((item.variant!.price - agreedNet) * item.quantity),
          );
          return {
            variantId: item.variantId!,
            quantity: item.quantity,
            discountAmt,
          };
        });
        const net = saleItems.reduce(
          (sum, si, i) =>
            sum + items[i].variant!.price * si.quantity - si.discountAmt,
          0,
        );
        const result: any = await this.sales.create(
          {
            branchId,
            items: saleItems,
            clientId,
            channel: 'ONLINE',
            orderCode: order.code,
            payments: [
              {
                method: paymentMethod,
                amount: round(net * (1 + order.taxRate / 100)),
                reference: `Syncro Shop ${order.code}`,
              },
            ],
          },
          userId,
        );
        saleIds.push(result.id ?? result.sale?.id);
      }

      const sales = await this.prisma.sale.findMany({
        where: { id: { in: saleIds } },
        select: { total: true },
      });
      const saleTotal = round(
        sales.reduce((sum, s) => sum + s.total, 0) + order.deliveryCost,
      );
      return await this.prisma.shopOrder.update({
        where: { id },
        data: {
          status: 'APROBADO',
          saleIds,
          clientId,
          paymentMethod,
          statusHistory: this.pushHistory(
            order.statusHistory,
            'APROBADO',
            userId,
            Math.abs(saleTotal - order.total) >= 0.01
              ? `Venta registrada por ${saleTotal.toFixed(2)} (incluye IGTF u otros ajustes)`
              : 'Venta registrada en el POS',
          ),
        },
        include: { items: true },
      });
    } catch (err) {
      // Nothing was sold (the check runs first), so the order goes back to pending.
      await this.prisma.shopOrder.update({
        where: { id },
        data: { status: saleIds.length ? 'APROBADO' : 'PENDIENTE', saleIds },
      });
      throw err;
    }
  }

  async rejectOrder(
    businessId: string | undefined,
    id: string,
    userId: string,
    reason: string,
  ) {
    const order = await this.getOrder(businessId, id);
    if (order.status !== 'PENDIENTE')
      throw new BadRequestException(
        'Solo se pueden rechazar pedidos pendientes',
      );
    const text = (reason || '').trim().slice(0, 300);
    if (!text)
      throw new BadRequestException('Escribe el motivo; el cliente lo verá');
    return this.prisma.shopOrder.update({
      where: { id },
      data: {
        status: 'RECHAZADO',
        rejectionReason: text,
        statusHistory: this.pushHistory(
          order.statusHistory,
          'RECHAZADO',
          userId,
          text,
        ),
      },
    });
  }

  async advanceOrder(
    businessId: string | undefined,
    id: string,
    userId: string,
    status: 'EN_CAMINO' | 'ENTREGADO',
  ) {
    const order = await this.getOrder(businessId, id);
    const allowed =
      status === 'EN_CAMINO' ? ['APROBADO'] : ['APROBADO', 'EN_CAMINO'];
    if (!allowed.includes(order.status))
      throw new BadRequestException(
        'El pedido no está en un estado que permita este cambio',
      );
    if (status === 'EN_CAMINO' && order.deliveryMethod !== 'DELIVERY')
      throw new BadRequestException('Este pedido es para retirar en tienda');
    return this.prisma.shopOrder.update({
      where: { id },
      data: {
        status,
        statusHistory: this.pushHistory(order.statusHistory, status, userId),
      },
    });
  }

  /** Cancels an approved order, returning its stock with the POS return flow. */
  async cancelOrder(
    businessId: string | undefined,
    id: string,
    userId: string,
    reason: string,
  ) {
    const order = await this.getOrder(businessId, id);
    if (!['APROBADO', 'EN_CAMINO'].includes(order.status))
      throw new BadRequestException(
        'Solo se pueden cancelar pedidos aprobados que no se hayan entregado',
      );
    const text =
      (reason || '').trim().slice(0, 300) || 'Cancelado por la tienda';
    for (const saleId of order.saleIds) {
      const sale = await this.prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: true },
      });
      if (!sale) continue;
      const items = sale.items
        .filter((i) => i.variantId)
        .map((i) => ({ variantId: i.variantId!, quantity: i.quantity }));
      if (items.length)
        await this.sales.returnItems(
          saleId,
          {
            items,
            reason: `Pedido Syncro Shop ${order.code} cancelado: ${text}`,
          },
          userId,
          businessId,
        );
    }
    return this.prisma.shopOrder.update({
      where: { id },
      data: {
        status: 'CANCELADO',
        rejectionReason: text,
        statusHistory: this.pushHistory(
          order.statusHistory,
          'CANCELADO',
          userId,
          text,
        ),
      },
    });
  }

  private pushHistory(
    history: unknown,
    status: string,
    userId: string,
    note?: string,
  ) {
    const list = Array.isArray(history) ? history : [];
    return [
      ...list,
      {
        status,
        at: new Date().toISOString(),
        by: userId,
        ...(note ? { note } : {}),
      },
    ];
  }

  /** POS client for the buyer, matched by phone within the business. */
  private async findOrCreateClient(
    businessId: string,
    order: {
      customerName: string;
      customerPhone: string;
      customerEmail: string | null;
      address: string | null;
      clientId: string | null;
    },
  ) {
    if (order.clientId) return order.clientId;
    const last7 = digits(order.customerPhone).slice(-7);
    const candidates = await this.prisma.client.findMany({
      where: { businessId, phone: { not: null } },
      select: { id: true, phone: true },
    });
    const match = candidates.find(
      (c) => digits(c.phone || '').slice(-7) === last7 && last7.length === 7,
    );
    if (match) return match.id;
    const client = await this.prisma.client.create({
      data: {
        businessId,
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
        address: order.address,
        creditLimit: 0,
      },
    });
    return client.id;
  }

  // ── Merchant: review moderation (phase 7) ──────────────────────────────────

  async listReviews(businessId?: string) {
    if (!businessId)
      throw new BadRequestException('Falta el negocio del usuario');
    const reviews = await this.prisma.productReview.findMany({
      where: { product: { businessId } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: {
        product: { select: { id: true, name: true, image: true } },
        customer: { select: { name: true } },
      },
    });
    return reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      isHidden: r.isHidden,
      isVerifiedPurchase: r.isVerifiedPurchase,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      customerName: r.customer.name,
      product: r.product,
    }));
  }

  /** Hides or shows a review; hidden reviews are kept, not deleted. */
  async setReviewHidden(
    businessId: string | undefined,
    id: string,
    hidden: boolean,
  ) {
    if (!businessId)
      throw new BadRequestException('Falta el negocio del usuario');
    const review = await this.prisma.productReview.findFirst({
      where: { id, product: { businessId } },
    });
    if (!review) throw new NotFoundException('Reseña no encontrada');
    return this.prisma.productReview.update({
      where: { id },
      data: { isHidden: Boolean(hidden) },
    });
  }

  // ── Merchant: public store profile (phase 1) ───────────────────────────────

  async getProfileForMerchant(businessId?: string) {
    if (!businessId)
      throw new BadRequestException('Falta el negocio del usuario');
    const profile = await this.ensureStoreProfile(businessId);
    const { checkoutForm: _form, ...rest } = profile;
    void _form;
    return rest;
  }

  async saveProfile(
    businessId: string | undefined,
    input: Record<string, any>,
  ) {
    if (!businessId)
      throw new BadRequestException('Falta el negocio del usuario');
    const profile = await this.ensureStoreProfile(businessId);
    const data = validateProfile(input);

    if (data.slug && data.slug !== profile.slug) {
      const taken = await this.prisma.storeProfile.findUnique({
        where: { slug: data.slug },
      });
      if (taken)
        throw new BadRequestException(
          'Esa dirección de tienda ya está en uso. Prueba con otra.',
        );
    }
    const saved = await this.prisma.storeProfile.update({
      where: { id: profile.id },
      data,
    });
    const { checkoutForm: _form, ...rest } = saved;
    void _form;
    return rest;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async getActiveVendor(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: {
        storeProfile: true,
        settings: { select: { isSyncroVendor: true, taxRate: true }, take: 1 },
      },
    });
    if (!business || !business.settings[0]?.isSyncroVendor)
      throw new NotFoundException('Esta tienda no está disponible');
    // Same rule as the POS sale: the business tax rate is always added to the price.
    return {
      business,
      profile: business.storeProfile,
      taxRate: business.settings[0]?.taxRate ?? 16,
    };
  }

  private deliveryOptions(profile: any) {
    return {
      pickupEnabled: profile?.pickupEnabled ?? true,
      deliveryEnabled: profile?.deliveryEnabled ?? false,
      deliveryCostMode:
        (profile?.deliveryCostMode as 'FIXED' | 'TO_AGREE') ?? 'FIXED',
      deliveryCost: profile?.deliveryCost ?? 0,
      freeDeliveryFrom: profile?.freeDeliveryFrom ?? null,
      minOrderAmount: profile?.minOrderAmount ?? 0,
      deliveryTime: profile?.deliveryTime ?? null,
      address: profile?.address ?? null,
    };
  }

  private validateValues(
    form: CheckoutFormConfig,
    values: Record<string, unknown>,
    deliveryMethod: 'PICKUP' | 'DELIVERY',
  ) {
    const text = (key: string, max = 300) =>
      typeof values[key] === 'string'
        ? (values[key] as string).trim().slice(0, max)
        : '';
    const missing: string[] = [];

    for (const field of form.fields) {
      if (!field.enabled) continue;
      // Address fields only apply to delivery: required there, ignored for pickup.
      const isAddressField =
        field.builtin === 'address' ||
        field.builtin === 'city' ||
        field.builtin === 'reference';
      if (isAddressField && deliveryMethod === 'PICKUP') continue;
      const needsAddress =
        deliveryMethod === 'DELIVERY' &&
        (field.builtin === 'address' || field.builtin === 'city');
      if (!field.required && !needsAddress) continue;
      const value = values[field.id];
      const empty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (field.type === 'checkbox' && value !== true);
      if (empty) missing.push(field.label);
    }
    if (missing.length)
      throw new BadRequestException(`Completa: ${missing.join(', ')}`);

    const phone = text('phone', 30);
    if (digits(phone).length < 10 || digits(phone).length > 15)
      throw new BadRequestException(
        'Escribe un teléfono válido, con código de área',
      );
    const email = text('email', 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException('El correo no es válido');

    const forDelivery = deliveryMethod === 'DELIVERY';
    return {
      name: text('name', 120),
      phone,
      email: email || null,
      address: forDelivery ? text('address', 300) || null : null,
      city: forDelivery ? text('city', 120) || null : null,
      reference: forDelivery ? text('reference', 200) || null : null,
      notes: text('notes', 500) || null,
    };
  }

  /** Order lines with prices including IVA, exactly as the storefront shows them. */
  private async resolveLines(
    businessId: string,
    items: CreateOrderInput['items'],
    taxRate: number,
  ) {
    if (!Array.isArray(items) || items.length === 0)
      throw new BadRequestException('El pedido no tiene productos');
    if (items.length > MAX_LINES)
      throw new BadRequestException(`Máximo ${MAX_LINES} productos por pedido`);

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: items.map((i) => i.productId) },
        businessId,
        isPublishedOnSyncroShop: true,
      },
      include: {
        variants: {
          where: { showOnSyncroShop: true },
          orderBy: { createdAt: 'asc' },
          include: {
            inventory: { select: { branchId: true, quantity: true } },
          },
        },
      },
    });

    const merged = new Map<
      string,
      {
        product: (typeof products)[number];
        variant: (typeof products)[number]['variants'][number];
        quantity: number;
      }
    >();
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product)
        throw new BadRequestException(
          'Uno de los productos ya no está disponible en esta tienda',
        );
      const variant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)
        : product.variants[0];
      if (!variant)
        throw new BadRequestException(
          `"${product.name}" ya no está disponible en esa presentación`,
        );
      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0)
        throw new BadRequestException(
          `Cantidad inválida para "${product.name}"`,
        );
      if (!product.isWeighable && !Number.isInteger(quantity))
        throw new BadRequestException(
          `"${product.name}" se vende por unidades`,
        );
      const prev = merged.get(variant.id);
      merged.set(variant.id, {
        product,
        variant,
        quantity: round((prev?.quantity ?? 0) + quantity),
      });
    }

    return [...merged.values()].map(({ product, variant, quantity }) => {
      const branchId = product.syncroShopBranchId;
      const inventory = branchId
        ? variant.inventory.find((inv) => inv.branchId === branchId)
        : undefined;
      const stock = branchId ? (inventory?.quantity ?? 0) : variant.stock;
      if (quantity > stock) {
        const unit = product.isWeighable ? 'kg' : 'unidades';
        throw new BadRequestException(
          stock > 0
            ? `Solo quedan ${stock} ${unit} de "${product.name}${variant.name && product.variants.length > 1 ? ` (${variant.name})` : ''}"`
            : `"${product.name}" se agotó`,
        );
      }
      const netPrice =
        variant.promoPrice &&
        variant.promoPrice > 0 &&
        variant.promoPrice < variant.price
          ? variant.promoPrice
          : variant.price;
      const price = round(netPrice * (1 + taxRate / 100));
      return {
        productId: product.id,
        variantId: variant.id,
        branchId,
        productName: product.name,
        variantName: product.variants.length > 1 ? variant.name : null,
        image: product.image,
        quantity,
        price,
        subtotal: round(price * quantity),
      };
    });
  }

  private async createWithUniqueCode<T>(
    create: (code: string) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code =
        'SS-' + randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
      try {
        return await create(code);
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err;
      }
    }
    throw new BadRequestException(
      'No se pudo generar el número de pedido, intenta de nuevo',
    );
  }

  /** Creates the public store profile the first time a merchant configures Syncro Shop. */
  async ensureStoreProfile(businessId: string) {
    const existing = await this.prisma.storeProfile.findUnique({
      where: { businessId },
    });
    if (existing) return existing;
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });
    if (!business) throw new NotFoundException('Negocio no encontrado');
    const base = slugify(business.name) || 'tienda';
    let slug = base;
    for (
      let n = 2;
      await this.prisma.storeProfile.findUnique({ where: { slug } });
      n++
    )
      slug = `${base}-${n}`;
    return this.prisma.storeProfile.create({
      data: {
        businessId,
        slug,
        displayName: business.name,
        address: business.address,
        phone: business.phone,
      },
    });
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function slugify(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function normalizeCustomValue(type: string, value: unknown) {
  if (type === 'checkbox' || type === 'yesno')
    return value === true || value === 'true' || value === 'si' ? 'Sí' : 'No';
  return String(value).slice(0, 300);
}

const DAYS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'] as const;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validates the editable store profile fields; anything not listed is ignored. */
function validateProfile(input: Record<string, any>) {
  const data: Record<string, any> = {};
  const text = (key: string, max: number) => {
    if (input[key] === undefined) return;
    const value =
      typeof input[key] === 'string' ? input[key].trim().slice(0, max) : '';
    data[key] = value || null;
  };
  const money = (key: string, label: string, nullable = false) => {
    if (input[key] === undefined) return;
    if (nullable && (input[key] === null || input[key] === ''))
      return void (data[key] = null);
    const n = Number(input[key]);
    if (!Number.isFinite(n) || n < 0 || n > 100000)
      throw new BadRequestException(`${label} no es un monto válido`);
    data[key] = Math.round(n * 100) / 100;
  };
  const bool = (key: string) => {
    if (input[key] !== undefined) data[key] = Boolean(input[key]);
  };

  if (input.slug !== undefined) {
    const slug = slugify(String(input.slug || ''));
    if (slug.length < 3)
      throw new BadRequestException(
        'La dirección de la tienda debe tener al menos 3 letras o números',
      );
    data.slug = slug;
  }
  text('displayName', 80);
  if (data.displayName === null)
    throw new BadRequestException('El nombre de la tienda es obligatorio');
  text('description', 500);
  text('logo', 500);
  text('banner', 500);
  text('address', 300);
  text('phone', 30);
  text('whatsapp', 30);
  text('email', 120);
  text('deliveryNotes', 300);
  text('deliveryTime', 120);
  text('returnPolicy', 500);
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    throw new BadRequestException('El correo no es válido');
  for (const key of ['phone', 'whatsapp']) {
    if (
      data[key] &&
      (data[key].replace(/\D/g, '').length < 10 ||
        data[key].replace(/\D/g, '').length > 15)
    ) {
      throw new BadRequestException(
        `El ${key === 'whatsapp' ? 'WhatsApp' : 'teléfono'} debe tener entre 10 y 15 dígitos, con código de área`,
      );
    }
  }

  if (input.latitude !== undefined || input.longitude !== undefined) {
    const lat =
      input.latitude === null || input.latitude === ''
        ? null
        : Number(input.latitude);
    const lng =
      input.longitude === null || input.longitude === ''
        ? null
        : Number(input.longitude);
    if ((lat === null) !== (lng === null))
      throw new BadRequestException('Marca la ubicación completa en el mapa');
    if (
      lat !== null &&
      (!Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90 ||
        !Number.isFinite(lng!) ||
        lng! < -180 ||
        lng! > 180)
    ) {
      throw new BadRequestException('La ubicación del mapa no es válida');
    }
    data.latitude = lat;
    data.longitude = lng;
  }

  if (input.socials !== undefined) {
    const raw =
      input.socials && typeof input.socials === 'object' ? input.socials : {};
    const socials: Record<string, string> = {};
    for (const key of ['instagram', 'facebook', 'tiktok', 'website']) {
      const v =
        typeof raw[key] === 'string' ? raw[key].trim().slice(0, 200) : '';
      if (v) socials[key] = v;
    }
    data.socials = Object.keys(socials).length ? socials : null;
  }

  if (input.schedule !== undefined) {
    if (input.schedule === null) data.schedule = null;
    else {
      const schedule: Record<string, [string, string] | null> = {};
      for (const day of DAYS) {
        const hours = input.schedule?.[day];
        if (!hours) {
          schedule[day] = null;
          continue;
        }
        if (
          !Array.isArray(hours) ||
          !TIME.test(hours[0]) ||
          !TIME.test(hours[1]) ||
          hours[0] >= hours[1]
        ) {
          throw new BadRequestException(
            'Revisa el horario: la hora de apertura debe ser antes que la de cierre',
          );
        }
        schedule[day] = [hours[0], hours[1]];
      }
      data.schedule = schedule;
    }
  }

  bool('pickupEnabled');
  bool('deliveryEnabled');
  bool('showBolivares');
  if (input.deliveryCostMode !== undefined)
    data.deliveryCostMode =
      input.deliveryCostMode === 'TO_AGREE' ? 'TO_AGREE' : 'FIXED';
  money('deliveryCost', 'El costo de delivery');
  money('freeDeliveryFrom', 'El monto para delivery gratis', true);
  money('minOrderAmount', 'El pedido mínimo');
  if (data.pickupEnabled === false && data.deliveryEnabled === false) {
    throw new BadRequestException(
      'Activa al menos una forma de entrega: retiro en tienda o delivery',
    );
  }
  return data;
}
