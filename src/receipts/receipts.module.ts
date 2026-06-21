import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Receipt } from './entities/receipt.entity';
import { ReceiptItem } from './entities/receipt-item.entity';
import { Contribution } from '../contributions/entities/contribution.entity';
import { ReceiptsService } from './receipts.service';
import { ReceiptsController } from './receipts.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Receipt, ReceiptItem, Contribution]),
    forwardRef(() => NotificationsModule),
    StorageModule,
    UsersModule,
  ],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
