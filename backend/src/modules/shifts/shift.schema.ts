import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ShiftStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export type ShiftDocument = Shift & Document;

@Schema({ timestamps: true })
export class Shift {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true })
  branch: Types.ObjectId;

  @Prop({ required: true, default: 0 })
  openingBalance: number;

  @Prop({ required: false, default: 0 })
  closingBalance: number;

  @Prop({ required: false, default: 0 })
  expectedBalance: number; // Opening + Sales

  @Prop({ required: true, enum: ShiftStatus, default: ShiftStatus.OPEN })
  status: ShiftStatus;

  @Prop({ required: true })
  openedAt: Date;

  @Prop({ required: false })
  closedAt: Date;

  @Prop({ required: false })
  notes: string;
}

export const ShiftSchema = SchemaFactory.createForClass(Shift);
