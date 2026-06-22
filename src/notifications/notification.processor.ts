import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Notification } from './entities/notification.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { NotificationGateway } from './notification.gateway';

export interface NotificationJobData {
  type: string;
  message: string;
  colocationId: string;
  actorId?: string;
}

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
    private readonly gateway: NotificationGateway,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { type, message, colocationId, actorId } = job.data;
    this.logger.log(`Processing notification: ${type} for colocation ${colocationId}`);

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

    const saved = await this.notificationRepository.save(notifications);

    const memberIds = members.map((m) => m.userId);
    for (const notif of saved) {
      this.gateway.sendToUser(notif.userId, 'newNotification', {
        id: notif.id,
        type: notif.type,
        message: notif.message,
        isRead: false,
        createdAt: notif.createdAt,
      });
    }

    this.logger.log(`Sent ${saved.length} notifications for ${type}`);
  }
}
