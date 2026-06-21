import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Rotation } from './entities/rotation.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { Colocation } from '../colocations/entities/colocation.entity';
import { User } from '../users/entities/user.entity';
import { RotationsService } from './rotations.service';
import { RotationsController } from './rotations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Rotation, ColocationMember, Colocation, User])],
  controllers: [RotationsController],
  providers: [RotationsService],
  exports: [RotationsService],
})
export class RotationsModule {}
