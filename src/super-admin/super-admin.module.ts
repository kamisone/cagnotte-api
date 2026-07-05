import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminService } from './super-admin.service';
import { User } from '../users/entities/user.entity';
import { Colocation } from '../colocations/entities/colocation.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { Receipt } from '../receipts/entities/receipt.entity';
import { Report } from '../reports/entities/report.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AuditLog } from './entities/audit-log.entity';
import { UsersModule } from '../users/users.module';
import { SuperAdminSeeder } from './super-admin.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Colocation, ColocationMember, Receipt, Report, Notification, AuditLog]),
    UsersModule,
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, SuperAdminSeeder],
})
export class SuperAdminModule {}
