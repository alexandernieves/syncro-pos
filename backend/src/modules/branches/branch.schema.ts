import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Branch extends Document {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  location: string;

  @Prop()
  phone: string;

  @Prop()
  email: string;

  @Prop({ default: false })
  isMain: boolean;

  @Prop({ required: true })
  country: string;

  @Prop()
  state: string;

  @Prop()
  city: string;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);
