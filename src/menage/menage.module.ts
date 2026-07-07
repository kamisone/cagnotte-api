import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenageEntry } from './entities/menage-entry.entity';
import { MenageSubTaskEntry } from './entities/menage-sub-task.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { Colocation } from '../colocations/entities/colocation.entity';
import { UsersModule } from '../users/users.module';
import { MenageService } from './menage.service';
import { MenageController } from './menage.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MenageEntry,
      MenageSubTaskEntry,
      ColocationMember,
      Colocation,
    ]),
    UsersModule,
  ],
  controllers: [MenageController],
  providers: [MenageService],
  exports: [MenageService],
})
export class MenageModule {}
