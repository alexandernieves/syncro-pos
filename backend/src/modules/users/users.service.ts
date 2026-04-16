import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(userData: any) {
    try {
      if (!userData.password) {
        throw new Error('La contraseña es requerida');
      }
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      return await this.prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Esta cuenta ya existe. Por favor, intenta con un correo electrónico diferente.');
      }
      throw err;
    }
  }

  async findOneByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findOneByEmailWithPassword(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findOneById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findAll() {
    return this.prisma.user.findMany();
  }

  async update(id: string, updateData: any) {
    const data = { ...updateData };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async ensureOwnerExists() {
    const owner = await this.findOneByEmail('admin@mipos.com');
    if (!owner) {
      console.log('Seeding owner user...');
      return this.create({
        email: 'admin@mipos.com',
        password: 'admin',
        role: 'ownerpos',
        country: 'Venezuela',
      });
    }
  }
}
