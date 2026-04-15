import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Shift, ShiftDocument, ShiftStatus } from './shift.schema';
import { Sale, SaleDocument } from '../sales/sale.schema';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectModel(Shift.name) private shiftModel: Model<ShiftDocument>,
    @InjectModel(Sale.name) private saleModel: Model<SaleDocument>,
  ) {}

  async openShift(userId: string, openingBalance: number, branchId: string): Promise<Shift> {
    const activeShift = await this.getActiveShift(userId);
    if (activeShift) {
      throw new BadRequestException('El usuario ya tiene un turno abierto.');
    }

    const newShift = new this.shiftModel({
      user: new Types.ObjectId(userId),
      branch: new Types.ObjectId(branchId),
      openingBalance,
      status: ShiftStatus.OPEN,
      openedAt: new Date(),
    });

    return newShift.save();
  }

  async closeShift(shiftId: string, closingBalance: number, notes?: string): Promise<Shift> {
    const shift = await this.shiftModel.findById(shiftId);
    if (!shift || shift.status === ShiftStatus.CLOSED) {
      throw new NotFoundException('Turno no encontrado o ya cerrado.');
    }

    // Calculate expected balance: Opening + Sum of sales totals
    const sales = await this.saleModel.find({ shiftId: shift._id });
    const totalSales = sales.reduce((acc, sale) => acc + sale.total, 0);
    const expectedBalance = shift.openingBalance + totalSales;

    shift.closingBalance = closingBalance;
    shift.expectedBalance = expectedBalance;
    shift.status = ShiftStatus.CLOSED;
    shift.closedAt = new Date();
    if (notes) shift.notes = notes;

    return shift.save();
  }

  async getActiveShift(userId: string): Promise<Shift | null> {
    return this.shiftModel.findOne({ 
      user: new Types.ObjectId(userId), 
      status: ShiftStatus.OPEN 
    })
    .populate('branch')
    .exec();
  }

  async getShiftById(shiftId: string): Promise<Shift> {
    const shift = await this.shiftModel.findById(shiftId);
    if (!shift) throw new NotFoundException('Turno no encontrado.');
    return shift;
  }
}
