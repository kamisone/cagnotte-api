import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Rotation } from './entities/rotation.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { Colocation } from '../colocations/entities/colocation.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class RotationsService {
  constructor(
    @InjectRepository(Rotation)
    private readonly rotationRepository: Repository<Rotation>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
    @InjectRepository(Colocation)
    private readonly colocationRepository: Repository<Colocation>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByColocation(colocationId: string) {
    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (!colocation) throw new NotFoundException('Colocation not found');

    const order = colocation.purchaseOrder;
    if (!order || order.length === 0) return [];

    const disabled = colocation.disabledMembers ?? [];
    const users = await this.userRepository.find({ where: { id: In(order) } });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const currentIndex = colocation.currentPurchaserIndex % order.length;

    return order.map((userId, i) => {
      const user = userMap.get(userId);
      const isDisabled = disabled.includes(userId);
      let status: string;
      if (isDisabled) status = 'disabled';
      else if (i === currentIndex) status = 'current';
      else if (i < currentIndex) status = 'completed';
      else status = 'upcoming';

      return {
        id: `${colocationId}-${i}`,
        orderIndex: i,
        status,
        isDisabled,
        weekStart: null,
        weekEnd: null,
        user: user
          ? {
              id: user.id,
              email: user.email,
              name: user.name,
              colorHex: user.colorHex,
              initial: user.initial,
              phone: user.phone ?? null,
              isAdmin: user.isAdmin,
            }
          : null,
      };
    });
  }

  async generate(colocationId: string) {
    const members = await this.memberRepository.find({
      where: { colocationId },
      relations: ['user'],
    });

    if (members.length === 0) {
      throw new NotFoundException('No members found in this colocation');
    }

    const order = members.map((m) => m.userId);

    await this.colocationRepository.update(colocationId, {
      purchaseOrder: order,
      currentPurchaserIndex: 0,
    });

    return this.findByColocation(colocationId);
  }

  async setOrder(colocationId: string, userIds: string[]) {
    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (!colocation) throw new NotFoundException('Colocation not found');

    colocation.purchaseOrder = userIds;
    colocation.currentPurchaserIndex = 0;
    await this.colocationRepository.save(colocation);

    return this.findByColocation(colocationId);
  }

  async advancePurchaser(colocationId: string): Promise<void> {
    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (!colocation?.purchaseOrder?.length) return;

    const disabled = colocation.disabledMembers ?? [];
    const order = colocation.purchaseOrder;
    let nextIndex = (colocation.currentPurchaserIndex + 1) % order.length;

    // Skip disabled members (max one full loop to avoid infinite loop)
    for (let i = 0; i < order.length; i++) {
      if (!disabled.includes(order[nextIndex])) break;
      nextIndex = (nextIndex + 1) % order.length;
    }

    colocation.currentPurchaserIndex = nextIndex;
    await this.colocationRepository.save(colocation);
  }

  async getCurrentPurchaserId(colocationId: string): Promise<string | null> {
    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (!colocation?.purchaseOrder?.length) return null;

    const disabled = colocation.disabledMembers ?? [];
    const order = colocation.purchaseOrder;
    let index = colocation.currentPurchaserIndex % order.length;

    // If current is disabled, find the next active one
    for (let i = 0; i < order.length; i++) {
      if (!disabled.includes(order[index])) return order[index];
      index = (index + 1) % order.length;
    }

    return null;
  }

  async swap(myRotationId: string, theirRotationId: string) {
    const [, myIndexStr] = myRotationId.split(/-(?=[^-]+$)/);
    const [colocationId, theirIndexStr] = theirRotationId.split(/-(?=[^-]+$)/);

    const myIndex = parseInt(myIndexStr, 10);
    const theirIndex = parseInt(theirIndexStr, 10);

    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (!colocation?.purchaseOrder) {
      throw new NotFoundException('No purchase order found');
    }

    const order = [...colocation.purchaseOrder];
    if (myIndex >= order.length || theirIndex >= order.length) {
      throw new NotFoundException('Invalid rotation index');
    }

    [order[myIndex], order[theirIndex]] = [order[theirIndex], order[myIndex]];
    colocation.purchaseOrder = order;
    await this.colocationRepository.save(colocation);

    return this.findByColocation(colocationId);
  }
}
