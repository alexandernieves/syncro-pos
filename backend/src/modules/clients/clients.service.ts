import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client, ClientDocument } from './client.schema';

@Injectable()
export class ClientsService {
  constructor(@InjectModel(Client.name) private clientModel: Model<ClientDocument>) {}

  async create(data: Partial<Client>): Promise<Client> {
    return this.clientModel.create(data);
  }

  async findAll(): Promise<Client[]> {
    return this.clientModel.find({ isActive: true }).exec();
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.clientModel.findById(id).exec();
    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  async update(id: string, data: Partial<Client>): Promise<Client> {
    const updated = await this.clientModel.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!updated) throw new NotFoundException('Cliente no encontrado');
    return updated;
  }

  async remove(id: string): Promise<void> {
    await this.clientModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }
}
