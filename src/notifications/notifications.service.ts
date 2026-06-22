import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Notification } from './entities/notification.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
    @InjectQueue('notifications')
    private readonly notificationQueue: Queue,
  ) {}

  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async markRead(id: string): Promise<Notification> {
    await this.notificationRepository.update(id, { isRead: true });
    return this.notificationRepository.findOneBy({ id });
  }

  async create(data: Partial<Notification>): Promise<Notification> {
    const notification = this.notificationRepository.create(data);
    return this.notificationRepository.save(notification);
  }

  async enqueue(data: {
    type: string;
    message: string;
    colocationId: string;
    actorId?: string;
  }): Promise<void> {
    await this.notificationQueue.add('notify', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async createForAllMembers(
    colocationId: string,
    type: string,
    message: string,
    actorId?: string,
  ): Promise<void> {
    try {
      await this.enqueue({ type, message, colocationId, actorId });
    } catch {
      // Fallback to direct DB insert if Redis is unavailable
      const members = await this.memberRepository.find({
        where: { colocationId },
      });
      const notifications = members.map((member) =>
        this.notificationRepository.create({
          type,
          message,
          userId: member.userId,
          colocationId,
          actorId: actorId || null,
        }),
      );
      await this.notificationRepository.save(notifications);
    }
  }

  async createSpendingGapNotification(
    colocationId: string,
    gap: number,
  ): Promise<void> {
    const gapFormatted = gap.toFixed(2).replace('.', ',');
    await this.createForAllMembers(
      colocationId,
      'spending_gap',
      `Attention : l'écart de dépenses entre colocataires est de ${gapFormatted} €. Une rééquilibration s'impose !`,
    );
  }
}
