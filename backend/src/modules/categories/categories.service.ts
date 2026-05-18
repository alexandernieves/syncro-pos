import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async create(data: any) {
    return this.prisma.category.create({ data });
  }

  async findAll(businessId?: string) {
    const where: any = {};
    if (businessId) {
      where.businessId = businessId;
    }
    return this.prisma.category.findMany({ where });
  }

  async findOne(id: string, businessId?: string) {
    const where: any = { id };
    if (businessId) {
      where.businessId = businessId;
    }
    const category = await this.prisma.category.findFirst({ where });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  async update(id: string, data: any, businessId?: string) {
    await this.findOne(id, businessId);
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string, businessId?: string) {
    await this.findOne(id, businessId);
    return this.prisma.category.delete({ where: { id } });
  }
}
