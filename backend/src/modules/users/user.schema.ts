import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum UserRole {
  OWNERPOS = 'ownerpos',
  POS = 'pos',
}

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: 'POS' })
  role: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ required: true })
  country: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
