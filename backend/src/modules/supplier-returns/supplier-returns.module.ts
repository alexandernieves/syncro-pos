import { Module } from '@nestjs/common';
import { SupplierReturnsService } from './supplier-returns.service';
import { SupplierReturnsController, SuppliersReturnsController } from './supplier-returns.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SupplierReturnsController, SuppliersReturnsController],
  providers: [SupplierReturnsService],
  exports: [SupplierReturnsService],
})
export class SupplierReturnsModule {}
