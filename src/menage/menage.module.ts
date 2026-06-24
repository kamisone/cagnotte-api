import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenageEntry } from './entities/menage-entry.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { Colocation } from '../colocations/entities/colocation.entity';
import { MenageService } from './menage.service';
import { MenageController } from './menage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MenageEntry, ColocationMember, Colocation])],
  controllers: [MenageController],
  providers: [MenageService],
  exports: [MenageService],
})
export class MenageModule {}
