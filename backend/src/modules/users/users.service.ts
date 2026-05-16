import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(userData: any) {
    try {
      if (!userData.password) {
        throw new BadRequestException('La contraseña es requerida');
      }
      if (!userData.businessId) {
        throw new BadRequestException('El ID del negocio es requerido');
      }

      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      // If no branchIds are specified, we could default to the main branch or empty
      // but usually the owner will assign them.
      
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

  async findOneByEmail(email: string, businessId?: string) {
    if (businessId) {
      return this.prisma.user.findFirst({ where: { email, businessId } });
    }
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findOneByEmailWithPassword(email: string) {
    // This is typically used by Auth service, so we don't necessarily scope by businessId
    // unless we want to allow the same email for different businesses (which is not current design)
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findOneById(id: string, businessId?: string) {
    if (businessId) {
      return this.prisma.user.findFirst({ where: { id, businessId } });
    }
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findAll(businessId: string) {
    return this.prisma.user.findMany({
      where: { businessId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        country: true,
        city: true,
        avatar: true,
        permissions: true,
        branchIds: true,
        businessId: true,
        createdAt: true,
        updatedAt: true,
        lastSeen: true
      }
    });
  }

  async update(id: string, updateData: any, businessId: string) {
    // Security check
    const user = await this.findOneById(id, businessId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const data = { ...updateData };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    
    // Ensure businessId is not changed
    delete data.businessId;

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, businessId: string) {
    const user = await this.findOneById(id, businessId);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    return this.prisma.user.delete({ where: { id } });
  }

  async ensureOwnerExists() {
    const owner = await this.prisma.user.findUnique({ where: { email: 'admin@mipos.com' } });
    if (!owner) {
      console.log('Seeding owner user...');
      // Note: This global admin should probably be handled differently in a real multi-tenant app
    }
  }
}
