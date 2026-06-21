import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Colocation } from './entities/colocation.entity';
import { ColocationMember } from './entities/colocation-member.entity';
import { Contribution } from '../contributions/entities/contribution.entity';
import { Receipt } from '../receipts/entities/receipt.entity';
import { ColocationsService } from './colocations.service';
import { ColocationsController } from './colocations.controller';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Colocation,
      ColocationMember,
      Contribution,
      Receipt,
    ]),
    UsersModule,
    AuthModule,
  ],
  controllers: [ColocationsController],
  providers: [ColocationsService],
  exports: [ColocationsService],
})
export class ColocationsModule {}
