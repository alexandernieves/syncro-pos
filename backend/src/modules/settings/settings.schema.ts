import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SettingDocument = Setting & Document;

@Schema({ timestamps: true })
export class Setting {
  // --- Negocio ---
  @Prop({ default: 'Syncro POS' })
  businessName: string;

  @Prop({ default: 'IconInnerShadowTop' })
  businessIcon: string;

  @Prop({ default: '' })
  ruc: string;

  @Prop({ default: '' })
  address: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  website: string;

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({ default: 'Venezuela' })
  country: string;

  // --- Facturación ---
  @Prop({ default: '16' })
  taxRate: string;

  @Prop({ default: true })
  taxEnabled: boolean;

  @Prop({ default: 'VTA-' })
  invoicePrefix: string;

  @Prop({ default: 'Gracias por su compra. Vuelva pronto.' })
  receiptFooter: string;

  // --- Métodos de Pago ---
  @Prop({ type: [{ name: String, enabled: Boolean }], default: [
    { name: 'Efectivo', enabled: true },
    { name: 'Tarjeta de Crédito', enabled: true },
    { name: 'Tarjeta de Débito', enabled: true },
    { name: 'Transferencia', enabled: false },
  ] })
  paymentMethods: { name: string; enabled: boolean }[];

  // --- POS Config ---
  @Prop({ default: false })
  requireClient: boolean;

  @Prop({ default: true })
  printOnSale: boolean;

  @Prop({ default: 5 })
  lowStockAlert: number;

  @Prop({ default: false })
  allowNegativeStock: boolean;

  // --- Impresión ---
  @Prop({ default: '' })
  defaultPrinter: string;

  @Prop({ default: 80 })
  paperWidth: number;

  @Prop({ default: 1 })
  copiesPerSale: number;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
