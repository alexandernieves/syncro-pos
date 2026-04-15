import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  category: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Supplier' })
  supplier: Types.ObjectId;

  @Prop({ required: true })
  sku: string;

  @Prop({ required: true, default: 0 })
  price: number;

  @Prop({ required: true, default: 0 })
  cost: number;

  @Prop({ default: 0 })
  stock: number;

  @Prop({ default: 0 })
  minStock: number;

  @Prop()
  image: string;

  @Prop([String])
  barcodes: string[];

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: false })
  branch: Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
