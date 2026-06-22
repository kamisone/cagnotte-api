import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Colocation } from './entities/colocation.entity';
import { ColocationMember } from './entities/colocation-member.entity';
import { CreateColocationDto } from './dto/create-colocation.dto';
import { UpdateColocationDto } from './dto/update-colocation.dto';
import { UsersService } from '../users/users.service';
import { AddMemberDto } from './dto/add-member.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class ColocationsService {
  constructor(
    @InjectRepository(Colocation)
    private readonly colocationRepository: Repository<Colocation>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
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

  async findByUser(userId: string) {
    const membership = await this.memberRepository.findOne({
      where: { userId },
      relations: ['colocation'],
    });

    if (!membership) {
      throw new NotFoundException('No colocation found for this user');
    }

    const members = await this.memberRepository.find({
      where: { colocationId: membership.colocationId },
      relations: ['user'],
    });

    return {
      colocation: membership.colocation,
      members,
    };
  }

  async joinAsGuest(inviteCode: string): Promise<{ accessToken: string; refreshToken: string }> {
    const colocation = await this.colocationRepository.findOneBy({ inviteCode });
    if (!colocation) {
      throw new NotFoundException('Code d\'invitation invalide');
    }

    const guestEmail = `guest-${crypto.randomUUID()}@cagnotte.local`;
    const plainPassword = crypto.randomBytes(9).toString('base64url');
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const user = await this.usersService.create({
      email: guestEmail,
      password: hashedPassword,
      name: 'Locataire',
      initial: 'L',
      colorHex: '#17A877',
      profileCompleted: false,
    });

    const member = this.memberRepository.create({
      userId: user.id,
      colocationId: colocation.id,
      role: 'member',
    });
    await this.memberRepository.save(member);

    return this.authService.generateTokens(user.id, guestEmail);
  }

  async getMembers(colocationId: string): Promise<ColocationMember[]> {
    return this.memberRepository.find({
      where: { colocationId },
    });
  }

  async update(
    colocationId: string,
    requesterId: string,
    dto: UpdateColocationDto,
  ): Promise<Colocation> {
    const membership = await this.memberRepository.findOne({
      where: { colocationId, userId: requesterId },
    });
    if (!membership || membership.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (!colocation) throw new NotFoundException('Colocation not found');

    if (dto.name !== undefined) colocation.name = dto.name;
    if (dto.spendingGapThreshold !== undefined) colocation.spendingGapThreshold = dto.spendingGapThreshold;

    return this.colocationRepository.save(colocation);
  }

  async removeMember(
    colocationId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    const requesterMembership = await this.memberRepository.findOne({
      where: { colocationId, userId: requesterId },
    });
    if (!requesterMembership || requesterMembership.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    if (requesterId === targetUserId) {
      throw new ForbiddenException('Admin cannot remove themselves');
    }

    const targetMembership = await this.memberRepository.findOne({
      where: { colocationId, userId: targetUserId },
    });
    if (!targetMembership) throw new NotFoundException('Member not found');
    if (targetMembership.role === 'admin') {
      throw new ForbiddenException('Cannot remove another admin');
    }

    await this.memberRepository.remove(targetMembership);
  }

  async toggleMemberActive(colocationId: string, userId: string) {
    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (!colocation) throw new NotFoundException('Colocation not found');

    const disabled = colocation.disabledMembers ?? [];
    if (disabled.includes(userId)) {
      colocation.disabledMembers = disabled.filter((id) => id !== userId);
    } else {
      colocation.disabledMembers = [...disabled, userId];
    }
    await this.colocationRepository.save(colocation);
    return { userId, isDisabled: colocation.disabledMembers.includes(userId) };
  }

  async setPurchaseOrder(
    colocationId: string,
    userIds: string[],
  ): Promise<Colocation> {
    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (!colocation) throw new NotFoundException('Colocation not found');

    colocation.purchaseOrder = userIds;
    colocation.currentPurchaserIndex = 0;
    return this.colocationRepository.save(colocation);
  }

  async createAndAddMember(
    colocationId: string,
    requesterId: string,
    dto: AddMemberDto,
  ) {
    const requesterMembership = await this.memberRepository.findOne({
      where: { colocationId, userId: requesterId },
    });
    if (!requesterMembership || requesterMembership.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const plainPassword = dto.password ?? crypto.randomBytes(9).toString('base64url');
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const user = await this.usersService.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      colorHex: dto.colorHex,
      initial: dto.name[0].toUpperCase(),
    });

    const member = this.memberRepository.create({
      userId: user.id,
      colocationId,
      role: 'member',
    });
    await this.memberRepository.save(member);

    const { password, refreshToken, ...profile } = user;
    return {
      user: profile,
      generatedPassword: dto.password ? null : plainPassword,
    };
  }
}
