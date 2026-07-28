import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ScraperService, ScrapedProductData } from './scraper.service';

@Injectable()
export class LandingsService {
  private readonly logger = new Logger('LandingsService');
  private readonly openrouterApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly scraperService: ScraperService,
  ) {
    this.openrouterApiKey = this.config.get<string>('OPENROUTER_API_KEY') || '';
  }

  async importFromUrl(url: string, businessId: string): Promise<any> {
    this.logger.log(`Importando producto desde la URL: ${url} para el negocio: ${businessId}`);
    
    // 1. Scraping del producto
    const rawProduct = await this.scraperService.scrape(url);
    
    // 2. Generar diseño y copy con Inteligencia Artificial
    const landingConfig = await this.generateConfigWithAi(rawProduct);

    // 3. Generar un slug único basado en el título del producto
    const slugBase = landingConfig.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    let slug = slugBase;
    let count = 1;
    while (await this.prisma.landingPage.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${count}`;
      count++;
    }

    // 4. Crear el registro en la base de datos
    return this.prisma.landingPage.create({
      data: {
        businessId,
        title: landingConfig.title,
        slug,
        productUrl: url,
        config: landingConfig,
        status: 'DRAFT',
      },
    });
  }

  private async generateConfigWithAi(product: ScrapedProductData): Promise<any> {
    const systemPrompt = `Eres un experto copywriter y diseñador de landing pages de comercio electrónico enfocado en dropshipping de alta conversión para el mercado de habla hispana.
Tu tarea es transformar los datos de un producto en una estructura JSON completa y atractiva para renderizar una landing page premium (estilo Shopify/Dropmagic).

Reglas para la redacción:
1. Escribe en español de manera persuasiva, entusiasta y directa.
2. Destaca los beneficios prácticos del producto (fórmulas de venta como AIDA).
3. Los títulos de secciones deben ser ganchos de venta atractivos, no descripciones genéricas.
4. Auto-calcula 3 paquetes de precios basados en el precio base:
   - Pack 1: 1 Unidad (Precio base)
   - Pack 2: Lleva 2, Ahorra 25% (Precio unitario = 0.75 * base, total = 1.5 * base)
   - Pack 3: Lleva 3, Paga 2 (1 Gratis, Precio unitario = 0.66 * base, total = 2 * base)
   Asegura redondear los precios a dos decimales.
5. Traduce y mejora las opiniones de los clientes (reviews) para que suenen creíbles, entusiastas y bien redactadas.
6. Genera 4 preguntas frecuentes (FAQs) realistas sobre dudas de envío, uso del producto y métodos de pago.

Estructura del JSON que DEBES retornar:
{
  "title": "Nombre persuasivo del producto",
  "theme": {
    "primaryColor": "#e11d48", // Color principal llamativo en formato hexadecimal (ej. rosa/rojo/azul dropshipping)
    "secondaryColor": "#1e293b", // Gris oscuro pizarra para contrastes
    "accentColor": "#f59e0b", // Color de urgencia / estrellas (amarillo/naranja)
    "fontFamily": "Outfit" // Outfit, Inter, Roboto, Outfit o similar
  },
  "blocks": [
    {
      "type": "header",
      "logoText": "Nombre de la Tienda (ej: Ph Quimicos)",
      "logoImage": "",
      "showCart": true
    },
    {
      "type": "hero",
      "title": "Título llamativo principal (H1 de conversión)",
      "subtitle": "Subtítulo descriptivo con beneficio principal irresistible",
      "ctaText": "PEDIR CON PAGO CONTRAENTREGA",
      "features": ["Beneficio clave 1", "Beneficio clave 2", "Beneficio clave 3"],
      "price": ${product.price},
      "compareAtPrice": ${product.compareAtPrice || Math.round(product.price * 1.5)},
      "images": ${JSON.stringify(product.images)}
    },
    {
      "type": "features",
      "title": "Título persuasivo para la sección de beneficios (ej: ¿Por qué es el favorito de miles de clientes?)",
      "items": [
        {
          "title": "Beneficio detallado 1",
          "description": "Explicación de cómo este beneficio le soluciona la vida al usuario.",
          "image": "${product.images[1] || product.images[0]}"
        },
        {
          "title": "Beneficio detallado 2",
          "description": "Explicación persuasiva del beneficio.",
          "image": "${product.images[2] || product.images[0]}"
        },
        {
          "title": "Beneficio detallado 3",
          "description": "Explicación persuasiva del beneficio.",
          "image": "${product.images[3] || product.images[0]}"
        }
      ]
    },
    {
      "type": "packs",
      "title": "🔥 SELECCIONA TU OFERTA - ENVÍO GRATIS Y PAGO CONTRAENTREGA 🔥",
      "items": [
        {
          "id": "pack_1",
          "name": "Compra 1 Unidad",
          "quantity": 1,
          "price": ${product.price},
          "popular": false,
          "discountLabel": "Oferta estándar"
        },
        {
          "id": "pack_2",
          "name": "Lleva 2, Paga 1.5 (Ahorras 25%)",
          "quantity": 2,
          "price": ${Math.round(product.price * 1.5 * 100) / 100},
          "popular": true,
          "discountLabel": "MÁS VENDIDO - RECOMENDADO"
        },
        {
          "id": "pack_3",
          "name": "Lleva 3, Paga 2 (1 GRATIS / Ahorras 33%)",
          "quantity": 3,
          "price": ${Math.round(product.price * 2 * 100) / 100},
          "popular": false,
          "discountLabel": "MEJOR VALOR - PARA COMPARTIR"
        }
      ]
    },
    {
      "type": "faqs",
      "title": "Preguntas Frecuentes",
      "items": [
        {
          "question": "¿El envío es gratis y cuánto tarda?",
          "answer": "¡Sí! El envío es 100% gratuito para todo el país. Los pedidos suelen tardar entre 2 y 5 días hábiles dependiendo de tu ubicación."
        },
        {
          "question": "¿Cómo funciona el Pago Contra Entrega?",
          "answer": "Es muy sencillo. Realizas tu pedido llenando el formulario y no pagas nada por adelantado. Le entregas el dinero en efectivo directamente al transportador al momento de recibir el producto en tu puerta."
        },
        {
          "question": "¿Qué garantía tiene el producto?",
          "answer": "Ofrecemos una garantía de satisfacción de 30 días. Si el producto llega defectuoso o dañado, contáctanos de inmediato y te enviaremos uno nuevo sin costo alguno."
        },
        {
          "question": "¿De qué material está hecho?",
          "answer": "Está fabricado con materiales premium de alta durabilidad probados rigurosamente para asegurar una excelente experiencia de usuario."
        }
      ]
    },
    {
      "type": "reviews",
      "title": "Lo que opinan nuestros clientes",
      "items": ${JSON.stringify(product.reviews.map(r => ({ ...r, date: 'Hace unos días' })))}
    }
  ]
}`;

    const userMessage = `Por favor analiza este producto e impórtalo en formato JSON de landing page.
Título Original: ${product.title}
Descripción Original: ${product.description}
Precio Original: ${product.price}
Imágenes Disponibles: ${product.images.join(', ')}`;

    // Modelos en orden de prioridad para OpenRouter
    const models = [
      'google/gemini-2.5-flash',
      'openai/gpt-4o-mini',
      'meta-llama/llama-3.3-70b-instruct:free',
    ];

    let aiResponse = '';
    
    for (const model of models) {
      try {
        this.logger.log(`Llamando a OpenRouter con el modelo: ${model}`);
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.openrouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://syncropos.com',
            'X-Title': 'Syncro POS AI Landing Builder',
          },
          body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userMessage }
            ],
            max_tokens: 3000,
            temperature: 0.6,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          this.logger.warn(`El modelo ${model} falló con código ${response.status}: ${errorText}`);
          continue;
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          aiResponse = content;
          break;
        }
      } catch (error) {
        this.logger.error(`Error de red con el modelo ${model}: ${error.message}`);
      }
    }

    if (!aiResponse) {
      this.logger.warn('Todos los modelos de IA fallaron. Usando fallback estático local.');
      return this.createStaticLandingConfig(product);
    }

    try {
      // Limpiar posible formato Markdown de la respuesta si no vino como JSON puro
      let cleanJson = aiResponse.trim();
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.substring(7);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.substring(0, cleanJson.length - 3);
      }
      return JSON.parse(cleanJson.trim());
    } catch (e) {
      this.logger.error(`Error al parsear el JSON generado por la IA: ${e.message}. Usando fallback local.`);
      return this.createStaticLandingConfig(product);
    }
  }

  private createStaticLandingConfig(product: ScrapedProductData): any {
    // Generador de respaldo de alta calidad si falla la IA
    return {
      title: product.title,
      theme: {
        primaryColor: '#e11d48',
        secondaryColor: '#1e293b',
        accentColor: '#f59e0b',
        fontFamily: 'Outfit'
      },
      blocks: [
        {
          type: 'header',
          logoText: product.title.split(' ')[0] || 'Mi Tienda',
          logoImage: '',
          showCart: true
        },
        {
          type: 'hero',
          title: `¡${product.title.toUpperCase()}!`,
          subtitle: 'El producto premium que necesitas hoy con envío gratis a tu puerta.',
          ctaText: 'ORDENAR AHORA - PAGO EN CASA',
          features: product.features.length > 0 ? product.features : ['Alta Calidad', 'Garantía 100%', 'Pago Contra Entrega'],
          price: product.price,
          compareAtPrice: product.compareAtPrice || Math.round(product.price * 1.5),
          images: product.images
        },
        {
          type: 'features',
          title: '¿Por qué elegir nuestro producto?',
          items: product.features.map((feat, index) => ({
            title: feat,
            description: `Nuestro ${product.title} cuenta con excelentes acabados y está diseñado con tecnología avanzada para brindar los mejores resultados.`,
            image: product.images[index + 1] || product.images[0]
          })).slice(0, 3)
        },
        {
          type: 'packs',
          title: '🔥 SELECCIONA TU OFERTA - ENVÍO GRATIS Y PAGO CONTRAENTREGA 🔥',
          items: [
            {
              id: 'pack_1',
              name: 'Compra 1 Unidad',
              quantity: 1,
              price: product.price,
              popular: false,
              discountLabel: 'Oferta estándar'
            },
            {
              id: 'pack_2',
              name: 'Lleva 2, Paga 1.5 (Ahorras 25%)',
              quantity: 2,
              price: Math.round(product.price * 1.5 * 100) / 100,
              popular: true,
              discountLabel: 'MÁS VENDIDO - RECOMENDADO'
            },
            {
              id: 'pack_3',
              name: 'Lleva 3, Paga 2 (1 GRATIS / Ahorras 33%)',
              quantity: 3,
              price: Math.round(product.price * 2 * 100) / 100,
              popular: false,
              discountLabel: 'MEJOR VALOR - PARA COMPARTIR'
            }
          ]
        },
        {
          type: 'faqs',
          title: 'Preguntas Frecuentes',
          items: [
            { question: '¿El envío tiene algún costo?', answer: 'No, el envío es completamente gratis a nivel nacional.' },
            { question: '¿Cómo hago para pagar?', answer: 'Pagas en efectivo directamente al cartero/repartidor al momento de recibir el producto en tu domicilio.' }
          ]
        },
        {
          type: 'reviews',
          title: 'Opiniones de nuestros clientes',
          items: product.reviews.map(r => ({ ...r, date: 'Hace unos días' }))
        }
      ]
    };
  }

  // --- CRUD Operations ---

  async findAll(businessId: string): Promise<any[]> {
    return this.prisma.landingPage.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<any> {
    const landing = await this.prisma.landingPage.findUnique({
      where: { id },
    });
    if (!landing) {
      throw new NotFoundException(`Landing page con ID ${id} no encontrada.`);
    }
    return landing;
  }

  async findBySlug(slug: string): Promise<any> {
    const landing = await this.prisma.landingPage.findUnique({
      where: { slug },
    });
    if (!landing) {
      throw new NotFoundException(`Landing page con slug ${slug} no encontrada.`);
    }
    return landing;
  }

  async update(id: string, config: any, status?: string, title?: string): Promise<any> {
    // Verificar existencia
    await this.findOne(id);
    
    return this.prisma.landingPage.update({
      where: { id },
      data: {
        config,
        ...(status ? { status } : {}),
        ...(title ? { title } : {}),
      },
    });
  }

  async delete(id: string): Promise<any> {
    await this.findOne(id);
    return this.prisma.landingPage.delete({
      where: { id },
    });
  }

  // --- POS Order Integration ---

  async createOrder(orderData: {
    landingPageId: string;
    packId: string;
    clientName: string;
    clientPhone: string;
    clientAddress: string;
    clientCity: string;
  }): Promise<any> {
    const landing = await this.findOne(orderData.landingPageId);
    
    // Obtener información del paquete seleccionado
    const config = landing.config as any;
    const packsBlock = config.blocks.find((b: any) => b.type === 'packs');
    if (!packsBlock) {
      throw new Error('Configuración de paquetes no encontrada en esta landing page.');
    }

    const selectedPack = packsBlock.items.find((p: any) => p.id === orderData.packId);
    if (!selectedPack) {
      throw new Error(`Paquete con ID ${orderData.packId} no encontrado.`);
    }

    // 1. Obtener o crear el cliente en la base de datos de Syncro POS
    let client = await this.prisma.client.findFirst({
      where: {
        phone: orderData.clientPhone,
        businessId: landing.businessId,
      },
    });

    if (!client) {
      client = await this.prisma.client.create({
        data: {
          name: orderData.clientName,
          phone: orderData.clientPhone,
          address: `${orderData.clientAddress}, ${orderData.clientCity}`,
          businessId: landing.businessId,
        },
      });
    }

    // 2. Obtener la primera sucursal (Branch) del negocio para registrar la venta
    const branch = await this.prisma.branch.findFirst({
      where: { businessId: landing.businessId },
    });
    if (!branch) {
      throw new Error('No se encontró ninguna sucursal configurada en el negocio.');
    }

    // 3. Obtener el primer usuario administrador o de ventas del negocio
    const user = await this.prisma.user.findFirst({
      where: { businessId: landing.businessId },
    });
    if (!user) {
      throw new Error('No se encontró ningún usuario registrado en el negocio.');
    }

    // 4. Registrar la venta en estado PENDING (Pago Contra Entrega pendiente de entrega/cobro)
    // Usaremos una descripción genérica en el movimiento/venta
    const saleDescription = `Pedido Landing Page: ${selectedPack.name} de ${landing.title}`;
    
    const sale = await this.prisma.sale.create({
      data: {
        branchId: branch.id,
        userId: user.id,
        clientId: client.id,
        subtotal: selectedPack.price,
        total: selectedPack.price,
        status: 'PENDING', // PENDING indica pago contra entrega sin cobrar
        businessId: landing.businessId,
      },
    });

    // 5. Crear una notificación de sistema en Syncro POS para que aparezca en el Dashboard
    await this.prisma.notification.create({
      data: {
        type: 'new_landing_order',
        title: '¡Nuevo Pedido Contra Entrega!',
        message: `El cliente ${orderData.clientName} ordenó el paquete "${selectedPack.name}" (${landing.title}) por un total de $${selectedPack.price}.`,
        branchId: branch.id,
        isRead: false,
      },
    });

    return {
      success: true,
      saleId: sale.id,
      message: '¡Pedido registrado con éxito en Syncro POS!',
    };
  }

  // --- Clientes Petgo CRUD ---

  async findAllClientesPetgo(): Promise<any[]> {
    const clients = await this.prisma.clientesPetgo.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const visitorIds = clients
      .map((c) => c.visitorId)
      .filter(Boolean) as string[];

    if (visitorIds.length === 0) {
      return clients.map((c) => ({
        ...c,
        visitsCount: 0,
        lastVisit: null,
      }));
    }

    // Fetch visits counts grouped by visitorId
    const visitsGrouped = await this.prisma.visitasPetgo.groupBy({
      by: ['visitorId'],
      _count: {
        id: true,
      },
      where: {
        visitorId: { in: visitorIds },
      },
    });

    // Fetch the most recent visit for each visitorId to show the traffic source
    const visits = await this.prisma.visitasPetgo.findMany({
      where: {
        visitorId: { in: visitorIds },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return clients.map((c) => {
      const group = visitsGrouped.find((g) => g.visitorId === c.visitorId);
      const clientVisits = visits.filter((v) => v.visitorId === c.visitorId);
      const lastVisit: any = clientVisits[0] || null;

      return {
        ...c,
        visitsCount: group?._count?.id || 0,
        lastVisit: lastVisit ? {
          ...lastVisit,
          tiempo_pagina: lastVisit.tiempoPagina,
          formulario_iniciado: lastVisit.formularioIniciado,
          formulario_completado: lastVisit.formularioCompletado,
          cantidad_clics: lastVisit.cantidadClics,
          hizo_scroll: lastVisit.hizoScroll,
          scroll_maximo: lastVisit.scrollMaximo,
        } : null,
      };
    });
  }

  async findOneClientePetgo(id: number): Promise<any> {
    const cliente = await this.prisma.clientesPetgo.findUnique({
      where: { id },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente Petgo con ID ${id} no encontrado.`);
    }
    return cliente;
  }

  async createClientePetgo(data: { nombre: string; telefono: string; producto: string; visitorId?: string }): Promise<any> {
    return this.prisma.clientesPetgo.create({
      data: {
        nombre: data.nombre,
        telefono: data.telefono,
        producto: data.producto,
        visitorId: data.visitorId || null,
      },
    });
  }

  async updateClientePetgo(id: number, data: { nombre?: string; telefono?: string; producto?: string; visitorId?: string }): Promise<any> {
    await this.findOneClientePetgo(id);
    return this.prisma.clientesPetgo.update({
      where: { id },
      data: {
        ...(data.nombre ? { nombre: data.nombre } : {}),
        ...(data.telefono ? { telefono: data.telefono } : {}),
        ...(data.producto ? { producto: data.producto } : {}),
        ...(data.visitorId !== undefined ? { visitorId: data.visitorId } : {}),
      },
    });
  }

  async deleteClientePetgo(id: number): Promise<any> {
    await this.findOneClientePetgo(id);
    return this.prisma.clientesPetgo.delete({
      where: { id },
    });
  }

  // --- Visitas Petgo Operations ---

  async findAllVisitasPetgo(): Promise<any[]> {
    const visits = await this.prisma.visitasPetgo.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return visits.map((v: any) => ({
      ...v,
      tiempo_pagina: v.tiempoPagina,
      formulario_iniciado: v.formularioIniciado,
      formulario_completado: v.formularioCompletado,
      cantidad_clics: v.cantidadClics,
      hizo_scroll: v.hizoScroll,
      scroll_maximo: v.scrollMaximo,
    }));
  }

  async findClientVisits(clientId: number): Promise<any[]> {
    const client = await this.findOneClientePetgo(clientId);
    if (!client.visitorId) {
      return [];
    }
    const visits = await this.prisma.visitasPetgo.findMany({
      where: { visitorId: client.visitorId },
      orderBy: { createdAt: 'desc' },
    });
    return visits.map((v: any) => ({
      ...v,
      tiempo_pagina: v.tiempoPagina,
      formulario_iniciado: v.formularioIniciado,
      formulario_completado: v.formularioCompletado,
      cantidad_clics: v.cantidadClics,
      hizo_scroll: v.hizoScroll,
      scroll_maximo: v.scrollMaximo,
    }));
  }

  async deleteVisitaPetgo(id: number): Promise<any> {
    const visit = await this.prisma.visitasPetgo.findUnique({
      where: { id },
    });
    if (!visit) {
      throw new NotFoundException(`Visita con ID ${id} no encontrada.`);
    }
    return this.prisma.visitasPetgo.delete({
      where: { id },
    });
  }
}

