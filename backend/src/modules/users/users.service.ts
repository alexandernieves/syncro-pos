import { Injectable, ConflictException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { forgetUser } from '../auth/closed-accounts';

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
      // Closed accounts (removed people who had sales or shifts) don't show up
      where: { businessId, role: { not: 'deleted' } },
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
      // A new password ends every fingerprint sign-in of this person (they turn it on again)
      await this.prisma.biometricCredential.deleteMany({ where: { userId: id } });
    }
    
    // Ensure businessId is not changed
    delete data.businessId;

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * Removes a person from the business. Someone who never sold or worked a shift is deleted for
   * good. Someone with history (sales, shifts, expenses…) can't be erased without breaking those
   * records, so the account is closed instead: they can no longer sign in, they leave the list,
   * and their name stays on the sales they made. Their email is freed to be used again.
   */
  async remove(id: string, businessId: string, actor: { id: string; role: string }) {
    if (!['ownerpos', 'admin'].includes(actor.role)) throw new ForbiddenException('Solo el dueño o un administrador puede eliminar usuarios');
    const user = await this.findOneById(id, businessId);
    if (!user || user.role === 'deleted') throw new NotFoundException('Usuario no encontrado');
    if (user.id === actor.id) throw new BadRequestException('No puedes eliminar tu propio usuario');
    if (user.role === 'ownerpos') throw new BadRequestException('El dueño del negocio no se puede eliminar');

    // What belongs only to the person: their devices, fingerprints and saved profiles
    await this.prisma.$transaction([
      this.prisma.pushSubscription.deleteMany({ where: { userId: id } }),
      this.prisma.biometricCredential.deleteMany({ where: { userId: id } }),
      this.prisma.savedProfile.deleteMany({ where: { email: user.email } }),
    ]);

    try {
      await this.prisma.user.delete({ where: { id } });
      return { deleted: true, historyKept: false };
    } catch (e: any) {
      // Referenced by sales, shifts… (foreign key): close the account and keep the history
      if (e?.code !== 'P2003' && e?.code !== 'P2014') throw e;
    }
    await this.prisma.user.update({
      where: { id },
      data: {
        role: 'deleted',
        email: `eliminado-${id}@usuarios.syncro.invalid`,
        password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
        permissions: [],
        branchIds: [],
      },
    });
    forgetUser(id);
    return { deleted: true, historyKept: true };
  }

  async ensureOwnerExists() {
    const owner = await this.prisma.user.findUnique({ where: { email: 'admin@mipos.com' } });
    if (!owner) {
      console.log('Seeding owner user...');
      // Note: This global admin should probably be handled differently in a real multi-tenant app
    }
  }
}
