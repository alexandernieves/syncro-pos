import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.supplier.create({ data });
  }

  async findAll() {
    return this.prisma.supplier.findMany();
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    return supplier;
  }

  async update(id: string, data: any) {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.supplier.delete({ where: { id } });
  }

  async seed() {
    const testProviders = [
      { name: 'Apple Inc.' },
      { name: 'Logitech S.A.' },
      { name: 'Dell Technologies' },
      { name: 'Samsung Electronics' },
      { name: 'Secretlab SG' },
    ];

    return Promise.all(testProviders.map(p => this.prisma.supplier.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    })));
  }
}
