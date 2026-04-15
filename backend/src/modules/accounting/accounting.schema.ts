import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum EntryType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export type AccountingEntryDocument = AccountingEntry & Document;

@Schema({ timestamps: true })
export class AccountingEntry {
  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: EntryType })
  type: EntryType;

  @Prop({ required: true, default: 0 })
  amount: number;

  @Prop()
  category: string; // e.g., 'SALES', 'RENT', 'UTILITIES'

  @Prop({ type: Types.ObjectId, ref: 'Sale' }) // Optional link to sale
  saleId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;
}

export const AccountingEntrySchema = SchemaFactory.createForClass(AccountingEntry);
