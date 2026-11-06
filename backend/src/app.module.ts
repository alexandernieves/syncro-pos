import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/app-throttler.guard';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersService } from './modules/users/users.service';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ClientsModule } from './modules/clients/clients.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SalesModule } from './modules/sales/sales.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { BranchesModule } from './modules/branches/branches.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { PurchaseOrdersModule } from './modules/purchase-orders/purchase-orders.module';
import { SupplierPaymentsModule } from './modules/supplier-payments/supplier-payments.module';
import { SupplierReturnsModule } from './modules/supplier-returns/supplier-returns.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HistoryModule } from './modules/history/history.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { MovementsModule } from './modules/movements/movements.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { SyncroAdminModule } from './modules/syncro-admin/syncro-admin.module';
import { ChatModule } from './modules/chat/chat.module';
import { UploadModule } from './modules/upload/upload.module';
import { AiAgentModule } from './modules/ai-agent/ai-agent.module';
import { AppCacheModule } from './modules/cache/app-cache.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { GymModule } from './modules/gym/gym.module';
import { BusinessModulesModule } from './modules/business-modules/business-modules.module';
import { MascotModule } from './modules/mascot/mascot.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // ── Rate Limiting: 600 req / 60 s per client IP. A gym's front desk has several
    // computers behind one internet IP, with screens that refresh on their own. ──
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,   // 60 seconds
        limit: 600,   // max requests per window
      },
    ]),
    AppCacheModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    CategoriesModule,
    SuppliersModule,
    ClientsModule,
    InventoryModule,
    SalesModule,
    SettingsModule,
    AccountingModule,
    ShiftsModule,
    BranchesModule,
    UploadsModule,
    PrismaModule,
    PurchaseOrdersModule,
    SupplierPaymentsModule,
    SupplierReturnsModule,
    DashboardModule,
    ReportsModule,
    HistoryModule,
    TransfersModule,
    ExpensesModule,
    MovementsModule,
    NotificationsModule,
    StorefrontModule,
    SyncroAdminModule,
    ChatModule,
    UploadModule,
    AiAgentModule,
    WhatsAppModule,
    GymModule,
    BusinessModulesModule,
    MascotModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // ── Global Rate-Limit Guard ────────────────────────────────────────────
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly usersService: UsersService) {}
  
  async onModuleInit() {
    await this.usersService.ensureOwnerExists();
  }
}

