import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const count = await this.prisma.branch.count();
    if (count === 0) {
      await this.prisma.branch.create({
        data: {
          name: 'Sucursal Principal',
          location: 'Sede Central',
          isMain: true,
          country: 'Venezuela',
          state: 'Distrito Capital',
        }
      });
      console.log('Default branch created');
    }
  }

  async create(data: any) {
    return this.prisma.branch.create({ data });
  }

  async findAll() {
    return this.prisma.branch.findMany();
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, data: any) {
    return this.prisma.branch.update({
      where: { id },
      data
    });
  }

  async setMain(id: string) {
    await this.prisma.branch.updateMany({ data: { isMain: false } });
    return this.prisma.branch.update({
      where: { id },
      data: { isMain: true }
    });
  }

  async remove(id: string) {
    const branch = await this.findOne(id);
    if (branch.isMain) throw new Error('No se puede eliminar la sucursal principal');
    return this.prisma.branch.delete({ where: { id } });
  }

  async findMain() {
    return this.prisma.branch.findFirst({ where: { isMain: true } });
  }
}
