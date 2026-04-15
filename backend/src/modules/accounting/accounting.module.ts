import { Module, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountingService } from './accounting.service';
import { AccountingController } from './accounting.controller';
import { AccountingEntry, AccountingEntrySchema } from './accounting.schema';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: AccountingEntry.name, schema: AccountingEntrySchema }]),
  ],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
