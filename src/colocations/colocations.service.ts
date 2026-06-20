import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Colocation } from './entities/colocation.entity';
import { ColocationMember } from './entities/colocation-member.entity';
import { Contribution } from '../contributions/entities/contribution.entity';
import { Receipt } from '../receipts/entities/receipt.entity';
import { CreateColocationDto } from './dto/create-colocation.dto';

@Injectable()
export class ColocationsService {
  constructor(
    @InjectRepository(Colocation)
    private readonly colocationRepository: Repository<Colocation>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
    @InjectRepository(Contribution)
    private readonly contributionRepository: Repository<Contribution>,
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
  ) {}

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async create(
    userId: string,
    dto: CreateColocationDto,
  ): Promise<Colocation> {
    const colocation = this.colocationRepository.create({
      name: dto.name,
      contributionAmount: dto.contributionAmount ?? 5.0,
      inviteCode: this.generateInviteCode(),
    });

    const savedColocation = await this.colocationRepository.save(colocation);

    const member = this.memberRepository.create({
      userId,
      colocationId: savedColocation.id,
      role: 'admin',
    });
    await this.memberRepository.save(member);

    return savedColocation;
  }

  async findByUser(userId: string): Promise<Colocation & { members: ColocationMember[] }> {
    const membership = await this.memberRepository.findOne({
      where: { userId },
      relations: ['colocation'],
    });

    if (!membership) {
      throw new NotFoundException('No colocation found for this user');
    }

    const members = await this.memberRepository.find({
      where: { colocationId: membership.colocationId },
    });

    return { ...membership.colocation, members };
  }

  async join(userId: string, inviteCode: string): Promise<ColocationMember> {
    const colocation = await this.colocationRepository.findOneBy({ inviteCode });
    if (!colocation) {
      throw new NotFoundException('Invalid invite code');
    }

    const existing = await this.memberRepository.findOne({
      where: { userId, colocationId: colocation.id },
    });
    if (existing) {
      throw new ConflictException('User already a member of this colocation');
    }

    const member = this.memberRepository.create({
      userId,
      colocationId: colocation.id,
      role: 'member',
    });

    return this.memberRepository.save(member);
  }

  async getBalance(colocationId: string): Promise<{ balance: number }> {
    const contributionsResult = await this.contributionRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.amount), 0)', 'total')
      .where('c.colocationId = :colocationId', { colocationId })
      .getRawOne();

    const receiptsResult = await this.receiptRepository
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.totalAmount), 0)', 'total')
      .where('r.colocationId = :colocationId', { colocationId })
      .getRawOne();

    const totalContributions = parseFloat(contributionsResult.total);
    const totalReceipts = parseFloat(receiptsResult.total);

    return { balance: totalContributions - totalReceipts };
  }

  async getMembers(colocationId: string): Promise<ColocationMember[]> {
    return this.memberRepository.find({
      where: { colocationId },
    });
  }
}
