import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
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

  async createForAllMembers(
    colocationId: string,
    type: string,
    message: string,
    actorId?: string,
  ): Promise<void> {
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

  async createFundEmptyNotification(colocationId: string): Promise<void> {
    await this.createForAllMembers(
      colocationId,
      'fund_empty',
      'La cagnotte est vide ! Il est temps de contribuer.',
    );
  }
}
