import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Notification } from './entities/notification.entity';
import { Device } from './entities/device.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationProcessor } from './notification.processor';
import { NotificationGateway } from './notification.gateway';
import { FirebaseService } from './firebase.service';
import { DeviceService } from './device.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, Device, ColocationMember]),
    BullModule.registerQueue({ name: 'notifications' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationProcessor,
    NotificationGateway,
    FirebaseService,
    DeviceService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
