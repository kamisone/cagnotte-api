import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contribution } from './entities/contribution.entity';
import { Colocation } from '../colocations/entities/colocation.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { ContributionsService } from './contributions.service';
import { ContributionsController } from './contributions.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contribution, Colocation, ColocationMember]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [ContributionsController],
  providers: [ContributionsService],
  exports: [ContributionsService],
})
export class ContributionsModule {}
