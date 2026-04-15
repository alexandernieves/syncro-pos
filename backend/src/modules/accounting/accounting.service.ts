import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountingEntry, AccountingEntryDocument, EntryType } from './accounting.schema';

@Injectable()
export class AccountingService {
  constructor(
    @InjectModel(AccountingEntry.name) private entryModel: Model<AccountingEntryDocument>,
  ) {}

  async createEntry(data: any, userId: string): Promise<AccountingEntryDocument> {
    const entry = new this.entryModel({
      ...data,
      createdBy: new Types.ObjectId(userId),
    });
    return entry.save();
  }

  async recordSaleAsIncome(sale: any): Promise<AccountingEntryDocument> {
    return this.createEntry({
      description: `Ingreso por Venta #${sale.saleNumber || 'S/N'}`,
      type: EntryType.INCOME,
      amount: sale.total,
      category: 'SALES',
      saleId: sale._id,
    }, sale.createdBy);
  }

  async findAll(): Promise<AccountingEntryDocument[]> {
    return this.entryModel.find().sort({ createdAt: -1 }).exec();
  }

  async findByType(type: EntryType): Promise<AccountingEntryDocument[]> {
    return this.entryModel.find({ type }).sort({ createdAt: -1 }).exec();
  }

  async getSummary(): Promise<any> {
    const entries = await this.entryModel.find().exec();
    const income = entries.filter(e => e.type === EntryType.INCOME).reduce((a, b) => a + b.amount, 0);
    const expense = entries.filter(e => e.type === EntryType.EXPENSE).reduce((a, b) => a + b.amount, 0);
    return { income, expense, balance: income - expense };
  }
}
