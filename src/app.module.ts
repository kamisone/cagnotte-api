import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ColocationsModule } from './colocations/colocations.module';
import { ShoppingModule } from './shopping/shopping.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { RotationsModule } from './rotations/rotations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { CatalogModule } from './catalog/catalog.module';
import { ReportsModule } from './reports/reports.module';
import { MenageModule } from './menage/menage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('TYPEORM_HOST'),
        port: config.get<number>('TYPEORM_PORT'),
        username: config.get<string>('TYPEORM_USERNAME'),
        password: config.get<string>('TYPEORM_PASSWORD'),
        database: config.get<string>('TYPEORM_DATABASE'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') || 'localhost',
          port: config.get<number>('REDIS_PORT') || 6379,
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          username: 'default',
          db: config.get<number>('REDIS_DB') || 0,
        },
      }),
    }),
    UsersModule,
    AuthModule,
    ColocationsModule,
    ShoppingModule,
    ReceiptsModule,
    RotationsModule,
    NotificationsModule,
    StorageModule,
    CatalogModule,
    ReportsModule,
    MenageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
