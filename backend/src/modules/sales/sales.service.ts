import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Sale, SaleDocument, SaleStatus } from './sale.schema';
import { Product, ProductDocument } from '../products/product.schema';
import { InventoryService } from '../inventory/inventory.service';
import { AccountingService } from '../accounting/accounting.service';

@Injectable()
export class SalesService {
  constructor(
    @InjectModel(Sale.name) private saleModel: Model<SaleDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private inventoryService: InventoryService,
    private accountingService: AccountingService,
  ) {}

  async create(saleData: any, userId: string): Promise<SaleDocument> {
    const saleNumber = `SALE-${Date.now().toString().slice(-6)}`;
    
    const sale = new this.saleModel({
      ...saleData,
      saleNumber,
      createdBy: new Types.ObjectId(userId),
    });

    // Update stock and create inventory movements for each item
    for (const item of sale.items) {
      const product = await this.productModel.findById(item.product);
      if (product) {
        // Decrease stock
        product.stock -= item.quantity;
        await product.save();

        // Register inventory movement
        await this.inventoryService.createMovement({
          product: product._id,
          type: 'OUT',
          quantity: item.quantity,
          previousStock: product.stock + item.quantity,
          newStock: product.stock,
          notes: `Venta #${saleNumber}`,
          createdBy: userId,
        });
      }
    }

    const savedSale = await sale.save();
    
    // Automatically record in accounting
    await this.accountingService.recordSaleAsIncome(savedSale);

    return savedSale;
  }

  async findAll(): Promise<SaleDocument[]> {
    return this.saleModel.find().populate('client').sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string): Promise<SaleDocument | null> {
    return this.saleModel.findById(id).populate('client').exec();
  }

  async delete(id: string): Promise<any> {
    return this.saleModel.findByIdAndDelete(id).exec();
  }
}
