import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contribution } from './entities/contribution.entity';
import { Colocation } from '../colocations/entities/colocation.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ContributionsService {
  constructor(
    @InjectRepository(Contribution)
    private readonly contributionRepository: Repository<Contribution>,
    @InjectRepository(Colocation)
    private readonly colocationRepository: Repository<Colocation>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    dto: CreateContributionDto,
  ): Promise<Contribution> {
    const colocation = await this.colocationRepository.findOneBy({
      id: dto.colocationId,
    });
    if (!colocation) {
      throw new NotFoundException('Colocation not found');
    }

    const existing = await this.contributionRepository.findOne({
      where: {
        userId,
        colocationId: dto.colocationId,
        cycleNumber: colocation.currentCycle,
      },
    });
    if (existing) {
      throw new ConflictException('Already contributed for this cycle');
    }

    const contribution = this.contributionRepository.create({
      userId,
      colocationId: dto.colocationId,
      amount: dto.amount ?? colocation.contributionAmount,
      cycleNumber: colocation.currentCycle,
    });

    const saved = await this.contributionRepository.save(contribution);

    await this.notificationsService.createForAllMembers(
      dto.colocationId,
      'contribution',
      'Un colocataire a contribué à la cagnotte.',
      userId,
    );

    return saved;
  }

  async getCycleStatus(colocationId: string) {
    const colocation = await this.colocationRepository.findOneBy({
      id: colocationId,
    });
    if (!colocation) {
      throw new NotFoundException('Colocation not found');
    }

    const members = await this.memberRepository.find({
      where: { colocationId },
    });

    const contributions = await this.contributionRepository.find({
      where: {
        colocationId,
        cycleNumber: colocation.currentCycle,
      },
    });

    const contributedUserIds = contributions.map((c) => c.userId);

    const status = members.map((member) => ({
      userId: member.userId,
      user: member.user,
      hasPaid: contributedUserIds.includes(member.userId),
    }));

    return {
      cycle: colocation.currentCycle,
      status,
    };
  }
}