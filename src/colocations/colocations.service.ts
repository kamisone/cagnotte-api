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
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ColocationsService {
  constructor(
    @InjectRepository(Colocation)
    private readonly colocationRepository: Repository<Colocation>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
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

    if (colocation.purchaseOrder?.length > 0) {
      colocation.purchaseOrder = [...colocation.purchaseOrder, user.id];
      await this.colocationRepository.save(colocation);
    }

    await this.notificationsService.notifyMemberJoined(colocation.id, 'Locataire', user.id);

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
    if (dto.notificationsEnabled !== undefined) colocation.notificationsEnabled = dto.notificationsEnabled;

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

    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (colocation?.purchaseOrder?.length > 0) {
      const removedIndex = colocation.purchaseOrder.indexOf(targetUserId);
      if (removedIndex !== -1) {
        colocation.purchaseOrder = colocation.purchaseOrder.filter((id) => id !== targetUserId);
        colocation.disabledMembers = (colocation.disabledMembers ?? []).filter((id) => id !== targetUserId);
        if (colocation.purchaseOrder.length > 0) {
          if (removedIndex < colocation.currentPurchaserIndex) {
            colocation.currentPurchaserIndex--;
          }
          colocation.currentPurchaserIndex = colocation.currentPurchaserIndex % colocation.purchaseOrder.length;
        } else {
          colocation.currentPurchaserIndex = 0;
        }
        await this.colocationRepository.save(colocation);
      }
    }
  }

  async toggleMemberActive(colocationId: string, userId: string) {
    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (!colocation) throw new NotFoundException('Colocation not found');

    const disabled = colocation.disabledMembers ?? [];
    const isCurrentlyDisabled = disabled.includes(userId);

    if (isCurrentlyDisabled) {
      colocation.disabledMembers = disabled.filter((id) => id !== userId);
    } else {
      colocation.disabledMembers = [...disabled, userId];

      // If the disabled member is the current purchaser, advance to next active
      const order = colocation.purchaseOrder ?? [];
      if (order.length > 0) {
        const currentIndex = colocation.currentPurchaserIndex % order.length;
        if (order[currentIndex] === userId) {
          let nextIndex = (currentIndex + 1) % order.length;
          const newDisabled = colocation.disabledMembers;
          for (let i = 0; i < order.length; i++) {
            if (!newDisabled.includes(order[nextIndex])) break;
            nextIndex = (nextIndex + 1) % order.length;
          }
          colocation.currentPurchaserIndex = nextIndex;
        }
      }
    }

    await this.colocationRepository.save(colocation);

    const user = await this.usersService.findById(userId);
    const userName = user?.name ?? 'Un membre';
    if (isCurrentlyDisabled) {
      await this.notificationsService.notifyTenantReactivated(colocationId, userName, userId);
    } else {
      await this.notificationsService.notifyTenantDisabled(colocationId, userName, userId);
    }

    return { userId, isDisabled: !isCurrentlyDisabled };
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
    let user: any;
    let generatedPassword: string | null = null;

    if (existing) {
      const activeMembership = await this.memberRepository.findOne({
        where: { userId: existing.id, colocationId },
      });
      if (activeMembership) {
        throw new ConflictException('This user is already a member of this colocation');
      }
      existing.name = dto.name;
      existing.colorHex = dto.colorHex;
      existing.initial = dto.name[0].toUpperCase();
      if (dto.password) {
        existing.password = await bcrypt.hash(dto.password, 10);
      }
      user = await this.usersService.save(existing);
    } else {
      const plainPassword = dto.password ?? crypto.randomBytes(9).toString('base64url');
      generatedPassword = dto.password ? null : plainPassword;
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      user = await this.usersService.create({
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        colorHex: dto.colorHex,
        initial: dto.name[0].toUpperCase(),
      });
    }

    const member = this.memberRepository.create({
      userId: user.id,
      colocationId,
      role: 'member',
    });
    await this.memberRepository.save(member);

    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (colocation?.purchaseOrder?.length > 0) {
      colocation.purchaseOrder = [...colocation.purchaseOrder, user.id];
      await this.colocationRepository.save(colocation);
    }

    await this.notificationsService.notifyMemberJoined(colocationId, user.name, user.id);

    const { password, refreshToken, ...profile } = user;
    return {
      user: profile,
      generatedPassword,
    };
  }
}
