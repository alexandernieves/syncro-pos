import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { GymService } from './gym.service';
import { GymRemindersService } from './gym-reminders.service';

export const DOCUMENT_KINDS = ['CONTRACT', 'WAIVER', 'HEALTH', 'PHOTO', 'OTHER'];

type TemplateInput = { kind?: string; title?: string; body?: string; required?: boolean; isActive?: boolean };
type SignInput = { signature?: string; signerName?: string; signerDocument?: string; accepted?: boolean };

/** Ready-made texts the gym can start from (they edit them before using). */
export const DOCUMENT_STARTERS: { kind: string; title: string; body: string }[] = [
  {
    kind: 'WAIVER',
    title: 'Exoneración de responsabilidad',
    body:
      'Yo, {nombre}, cédula {cedula}, declaro que practico actividad física en {gimnasio} por voluntad propia y bajo mi responsabilidad.\n\n' +
      'Declaro estar en condiciones de salud aptas para hacer ejercicio y me comprometo a informar al personal cualquier lesión, enfermedad o condición médica.\n\n' +
      'Seguiré las indicaciones de los entrenadores y las normas del gimnasio, y usaré los equipos de forma adecuada. Libero a {gimnasio} de responsabilidad por lesiones que resulten del uso indebido de las instalaciones o de no seguir estas indicaciones.\n\n' +
      'Fecha: {fecha}',
  },
  {
    kind: 'CONTRACT',
    title: 'Contrato de membresía',
    body:
      'Entre {gimnasio} y {nombre}, cédula {cedula}, se acuerda la membresía {plan}.\n\n' +
      '1. La membresía es personal e intransferible. El acceso se registra en recepción o con el lector facial.\n' +
      '2. Los pagos no son reembolsables. La membresía puede congelarse según las condiciones del plan.\n' +
      '3. El socio respetará los horarios, el reglamento interno y al resto de los socios y el personal.\n' +
      '4. El gimnasio puede suspender el acceso por incumplimiento del reglamento.\n\n' +
      'Fecha: {fecha}',
  },
  {
    kind: 'PHOTO',
    title: 'Uso de foto y datos',
    body:
      'Autorizo a {gimnasio} a guardar mi foto y mis datos para identificarme en la entrada (incluido el reconocimiento facial) y para enviarme avisos por WhatsApp sobre mi membresía y mis clases.\n\n' +
      'Puedo pedir que se borren mis datos al terminar mi membresía.\n\n' +
      'Nombre: {nombre} · Cédula: {cedula} · Fecha: {fecha}',
  },
];

/** Contracts, waivers and consents: versioned templates and the signed copies of each member. */
@Injectable()
export class GymDocumentsService {
  constructor(
    private prisma: PrismaService,
    private uploads: UploadsService,
    private gym: GymService,
    private settings: GymRemindersService,
  ) {}

  listTemplates(businessId: string) {
    return this.prisma.gymDocumentTemplate.findMany({
      where: { businessId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      include: { _count: { select: { signatures: true } } },
    });
  }

  async createTemplate(businessId: string, data: TemplateInput) {
    if (!data.title?.trim()) throw new BadRequestException('Escribe el título del documento');
    if (!data.body?.trim()) throw new BadRequestException('Escribe el texto del documento');
    if (data.kind && !DOCUMENT_KINDS.includes(data.kind)) throw new BadRequestException('Tipo inválido');
    return this.prisma.gymDocumentTemplate.create({
      data: { businessId, kind: data.kind || 'WAIVER', title: data.title.trim(), body: data.body.trim(), required: data.required !== false },
    });
  }

  /** Changing the title or the text creates a new version: members sign it again. */
  async updateTemplate(businessId: string, id: string, data: TemplateInput) {
    const t = await this.prisma.gymDocumentTemplate.findFirst({ where: { id, businessId } });
    if (!t) throw new NotFoundException('Documento no encontrado');
    if (data.title !== undefined && !data.title.trim()) throw new BadRequestException('Escribe el título del documento');
    if (data.body !== undefined && !data.body.trim()) throw new BadRequestException('Escribe el texto del documento');
    const changed = (data.title !== undefined && data.title.trim() !== t.title) || (data.body !== undefined && data.body.trim() !== t.body);
    return this.prisma.gymDocumentTemplate.update({
      where: { id },
      data: {
        ...(data.kind !== undefined && DOCUMENT_KINDS.includes(data.kind) && { kind: data.kind }),
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.body !== undefined && { body: data.body.trim() }),
        ...(data.required !== undefined && { required: !!data.required }),
        ...(data.isActive !== undefined && { isActive: !!data.isActive }),
        ...(changed && { version: t.version + 1 }),
      },
    });
  }

  /** The text with the member's data filled in. */
  async render(businessId: string, templateId: string, memberId: string) {
    const [template, member, business, settings] = await Promise.all([
      this.prisma.gymDocumentTemplate.findFirst({ where: { id: templateId, businessId } }),
      this.prisma.gymMember.findFirst({
        where: { id: memberId, businessId },
        include: { client: { select: { name: true, documentId: true } }, memberships: { where: { status: { not: 'CANCELLED' } }, orderBy: { endDate: 'desc' }, take: 1 } },
      }),
      this.prisma.business.findUnique({ where: { id: businessId }, select: { name: true } }),
      this.settings.getSettings(businessId),
    ]);
    if (!template) throw new NotFoundException('Documento no encontrado');
    if (!member) throw new NotFoundException('Socio no encontrado');
    const body = template.body
      .replace(/\{nombre\}/g, member.client.name)
      .replace(/\{cedula\}/g, member.client.documentId || '________')
      .replace(/\{plan\}/g, member.memberships[0]?.planName || '________')
      .replace(/\{fecha\}/g, new Date().toLocaleDateString('es-VE', { timeZone: settings.timeZone, day: 'numeric', month: 'long', year: 'numeric' }))
      .replace(/\{gimnasio\}/g, business?.name || 'el gimnasio');
    return { template, member, body };
  }

  /** Documents of a member: the required and active ones with their status, and every signed copy. */
  async forMember(businessId: string, memberId: string) {
    const [templates, signatures] = await Promise.all([
      this.prisma.gymDocumentTemplate.findMany({ where: { businessId, isActive: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.gymSignature.findMany({ where: { businessId, memberId }, orderBy: { signedAt: 'desc' }, select: { id: true, templateId: true, version: true, title: true, signerName: true, signatureUrl: true, method: true, signedAt: true } }),
    ]);
    return {
      documents: templates.map((t) => {
        const last = signatures.find((s) => s.templateId === t.id);
        const status = !last ? 'PENDING' : last.version < t.version ? 'OUTDATED' : 'SIGNED';
        return { id: t.id, kind: t.kind, title: t.title, required: t.required, version: t.version, status, signature: last ?? null };
      }),
      signatures,
    };
  }

  async getSignature(businessId: string, id: string) {
    const s = await this.prisma.gymSignature.findFirst({ where: { id, businessId }, include: { member: { select: { memberNumber: true } } } });
    if (!s) throw new NotFoundException('Firma no encontrada');
    return s;
  }

  async sign(businessId: string, templateId: string, memberId: string, data: SignInput, meta: { method: 'RECEPTION' | 'PORTAL'; ip?: string; userAgent?: string }) {
    if (!data.accepted) throw new BadRequestException('Marca que leyó y acepta el documento');
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(data.signature || '');
    if (!match) throw new BadRequestException('Falta la firma');
    const png = Buffer.from(match[1], 'base64');
    if (png.length < 500) throw new BadRequestException('La firma está vacía');
    if (png.length > 1_500_000) throw new BadRequestException('La firma es demasiado grande');
    const { template, member, body } = await this.render(businessId, templateId, memberId);
    if (!template.isActive) throw new BadRequestException('Este documento ya no está activo');
    const signatureUrl = await this.uploads.uploadBuffer(png, 'image/png', `gym-signatures/${businessId}`, 'firma.png');
    return this.prisma.gymSignature.create({
      data: {
        businessId,
        templateId,
        memberId,
        version: template.version,
        title: template.title,
        body,
        signerName: data.signerName?.trim() || member.client.name,
        signerDocument: data.signerDocument?.trim() || member.client.documentId || null,
        signatureUrl,
        method: meta.method,
        ip: meta.ip?.slice(0, 64) || null,
        userAgent: meta.userAgent?.slice(0, 300) || null,
      },
    });
  }

  /** For the member's app: what they still have to sign, with the text ready to read. */
  async pendingForPortal(businessId: string, memberId: string) {
    const pending = await this.gym.pendingDocuments(businessId, memberId);
    return Promise.all(pending.map(async (p) => ({ ...p, body: (await this.render(businessId, p.id, memberId)).body })));
  }
}
