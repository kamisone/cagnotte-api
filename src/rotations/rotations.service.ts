import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rotation } from './entities/rotation.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';

@Injectable()
export class RotationsService {
  constructor(
    @InjectRepository(Rotation)
    private readonly rotationRepository: Repository<Rotation>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
  ) {}

  async findByColocation(colocationId: string): Promise<Rotation[]> {
    const rotations = await this.rotationRepository.find({
      where: { colocationId },
      order: { orderIndex: 'ASC' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return rotations.map((rotation) => {
      const weekStart = new Date(rotation.weekStart);
      const weekEnd = new Date(rotation.weekEnd);

      if (today >= weekStart && today <= weekEnd) {
        rotation.status = 'current';
      } else if (today > weekEnd) {
        rotation.status = 'completed';
      } else {
        rotation.status = 'upcoming';
      }

      return rotation;
    });
  }

  async generate(colocationId: string): Promise<Rotation[]> {
    const members = await this.memberRepository.find({
      where: { colocationId },
    });

    if (members.length === 0) {
      throw new NotFoundException('No members found in this colocation');
    }

    // Get the highest existing orderIndex to continue from
    const lastRotation = await this.rotationRepository.findOne({
      where: { colocationId },
      order: { orderIndex: 'DESC' },
    });

    let startIndex = lastRotation ? lastRotation.orderIndex + 1 : 0;

    // Determine the start date
    let startDate: Date;
    if (lastRotation) {
      startDate = new Date(lastRotation.weekEnd);
      startDate.setDate(startDate.getDate() + 1);
    } else {
      startDate = new Date();
      // Set to next Monday
      const day = startDate.getDay();
      const diff = day === 0 ? 1 : 8 - day;
      startDate.setDate(startDate.getDate() + diff);
    }
    startDate.setHours(0, 0, 0, 0);

    const rotations: Rotation[] = [];

    for (let i = 0; i < members.length; i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() + i * 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const rotation = this.rotationRepository.create({
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: weekEnd.toISOString().split('T')[0],
        orderIndex: startIndex + i,
        userId: members[i].userId,
        colocationId,
        status: 'upcoming',
      });

      rotations.push(rotation);
    }

    return this.rotationRepository.save(rotations);
  }

  async swap(myRotationId: string, theirRotationId: string): Promise<Rotation[]> {
    const myRotation = await this.rotationRepository.findOneBy({
      id: myRotationId,
    });
    const theirRotation = await this.rotationRepository.findOneBy({
      id: theirRotationId,
    });

    if (!myRotation || !theirRotation) {
      throw new NotFoundException('One or both rotations not found');
    }

    const tempUserId = myRotation.userId;
    myRotation.userId = theirRotation.userId;
    theirRotation.userId = tempUserId;

    return this.rotationRepository.save([myRotation, theirRotation]);
  }
}
