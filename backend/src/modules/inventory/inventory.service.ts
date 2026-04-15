import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InventoryMovement, InventoryMovementDocument } from './inventory-movement.schema';

@Injectable()
export class InventoryService {
  constructor(@InjectModel(InventoryMovement.name) private movementModel: Model<InventoryMovementDocument>) {}

  async findAll(): Promise<InventoryMovement[]> {
    return this.movementModel.find().populate('product').sort({ createdAt: -1 }).exec();
  }

  async findByProduct(productId: string): Promise<InventoryMovement[]> {
    return this.movementModel.find({ product: productId }).populate('product').sort({ createdAt: -1 }).exec();
  }

  async createMovement(movementData: any): Promise<InventoryMovementDocument> {
    const movement = new this.movementModel(movementData);
    return movement.save();
  }
}
