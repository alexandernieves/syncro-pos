import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClientDocument = Client & Document;

@Schema({ timestamps: true })
export class Client {
  @Prop({ required: true })
  name: string;

  @Prop()
  documentId: string;

  @Prop()
  email: string;

  @Prop()
  phone: string;

  @Prop()
  address: string;

  @Prop({ default: 0 })
  totalPurchases: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const ClientSchema = SchemaFactory.createForClass(Client);
