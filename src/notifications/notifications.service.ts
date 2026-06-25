import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Notification } from './entities/notification.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { NotificationType } from './constants/notification-types';

export interface SendNotificationOptions {
  colocationId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  actorId?: string;
  data?: Record<string, string>;
  excludeUserId?: string;
}

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

  async findSince(userId: string, lastId: string): Promise<Notification[]> {
    const lastNotification = await this.notificationRepository.findOne({ where: { id: lastId } });
    if (!lastNotification) {
      return this.notificationRepository.find({ where: { userId }, order: { createdAt: 'ASC' } });
    }
    return this.notificationRepository.find({
      where: { userId, createdAt: MoreThan(lastNotification.createdAt) },
      order: { createdAt: 'ASC' },
    });
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationRepository.count({ where: { userId, isRead: false } });
  }

  async markRead(id: string): Promise<Notification> {
    await this.notificationRepository.update(id, { isRead: true });
    return this.notificationRepository.findOneBy({ id });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationRepository.update({ userId, isRead: false }, { isRead: true });
  }

  async send(options: SendNotificationOptions): Promise<void> {
    try {
      await this.notificationQueue.add('notify', options, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
    } catch {
      // Fallback to direct DB insert if Redis is unavailable
      const members = await this.memberRepository.find({ where: { colocationId: options.colocationId } });
      const targets = options.excludeUserId
        ? members.filter((m) => m.userId !== options.excludeUserId)
        : members;
      const notifications = targets.map((member) =>
        this.notificationRepository.create({
          type: options.type,
          title: options.title ?? null,
          message: options.message,
          data: options.data ?? null,
          userId: member.userId,
          colocationId: options.colocationId,
          actorId: options.actorId ?? null,
        }),
      );
      await this.notificationRepository.save(notifications);
    }
  }

  async createForAllMembers(
    colocationId: string,
    type: string,
    message: string,
    actorId?: string,
    title?: string,
    data?: Record<string, string>,
  ): Promise<void> {
    await this.send({
      colocationId,
      type,
      title: title ?? type,
      message,
      actorId,
      data,
    });
  }

  async createSpendingGapNotification(colocationId: string, gap: number): Promise<void> {
    const gapFormatted = gap.toFixed(2).replace('.', ',');
    await this.send({
      colocationId,
      type: NotificationType.SPENDING_GAP,
      title: 'Écart de dépenses',
      message: `L'écart de dépenses entre colocataires est de ${gapFormatted} €. Une rééquilibration s'impose !`,
      data: { gap: String(gap) },
    });
  }

  async notifyReceiptAdded(colocationId: string, store: string, actorId: string): Promise<void> {
    await this.send({
      colocationId,
      type: NotificationType.RECEIPT_ADDED,
      title: 'Nouveau ticket de caisse',
      message: `Un ticket de caisse a été ajouté (${store}).`,
      actorId,
      data: { store },
    });
  }

  async notifyReportCreated(colocationId: string, reportTitle: string, actorId: string, reportId: string): Promise<void> {
    await this.send({
      colocationId,
      type: NotificationType.REPORT_CREATED,
      title: 'Nouveau signalement',
      message: `Nouveau signalement : ${reportTitle}`,
      actorId,
      data: { reportId, screen: 'report_detail' },
    });
  }

  async notifyReportUpdated(colocationId: string, reportTitle: string, actorId: string, reportId: string): Promise<void> {
    await this.send({
      colocationId,
      type: NotificationType.REPORT_UPDATED,
      title: 'Signalement mis à jour',
      message: `Le signalement "${reportTitle}" a été mis à jour.`,
      actorId,
      data: { reportId, screen: 'report_detail' },
    });
  }

  async notifyCommentAdded(colocationId: string, reportTitle: string, actorId: string, reportId: string): Promise<void> {
    await this.send({
      colocationId,
      type: NotificationType.COMMENT_ADDED,
      title: 'Nouveau commentaire',
      message: `Nouveau commentaire sur : ${reportTitle}`,
      actorId,
      data: { reportId, screen: 'report_detail' },
    });
  }

  async notifyTurnStarted(colocationId: string, userName: string, userId: string): Promise<void> {
    await this.send({
      colocationId,
      type: NotificationType.TURN_STARTED,
      title: "C'est votre tour !",
      message: `C'est au tour de ${userName} de faire les courses.`,
      actorId: userId,
      data: { userId, screen: 'shopping' },
    });
  }

  async notifyTenantDisabled(colocationId: string, userName: string, targetUserId: string): Promise<void> {
    await this.send({
      colocationId,
      type: NotificationType.TENANT_DISABLED,
      title: 'Membre désactivé',
      message: `${userName} a été désactivé(e) de la colocation.`,
      data: { userId: targetUserId },
    });
  }

  async notifyTenantReactivated(colocationId: string, userName: string, targetUserId: string): Promise<void> {
    await this.send({
      colocationId,
      type: NotificationType.TENANT_REACTIVATED,
      title: 'Membre réactivé',
      message: `${userName} a été réactivé(e) dans la colocation.`,
      data: { userId: targetUserId },
    });
  }

  async notifyMemberJoined(colocationId: string, userName: string, newUserId: string): Promise<void> {
    await this.send({
      colocationId,
      type: NotificationType.MEMBER_JOINED,
      title: 'Nouveau colocataire',
      message: `${userName} a rejoint la colocation.`,
      actorId: newUserId,
      excludeUserId: newUserId,
      data: { userId: newUserId },
    });
  }

  async sendAnnouncement(colocationId: string, message: string, actorId: string): Promise<void> {
    await this.send({
      colocationId,
      type: NotificationType.ANNOUNCEMENT,
      title: 'Annonce',
      message,
      actorId,
    });
  }
}
