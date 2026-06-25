import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { Notification } from './entities/notification.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { NotificationGateway } from './notification.gateway';
import { FirebaseService } from './firebase.service';
import { DeviceService } from './device.service';

export interface NotificationJobData {
  type: string;
  title: string;
  message: string;
  colocationId: string;
  actorId?: string;
  data?: Record<string, string>;
  excludeUserId?: string;
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
    private readonly firebase: FirebaseService,
    private readonly deviceService: DeviceService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { type, title, message, colocationId, actorId, data, excludeUserId } = job.data;
    this.logger.log(`Processing notification [${type}] for colocation ${colocationId}`);

    const members = await this.memberRepository.find({ where: { colocationId } });
    const targetMembers = excludeUserId
      ? members.filter((m) => m.userId !== excludeUserId)
      : members;

    if (targetMembers.length === 0) return;

    const notifications = targetMembers.map((member) =>
      this.notificationRepository.create({
        type,
        title: title ?? null,
        message,
        data: data ?? null,
        userId: member.userId,
        colocationId,
        actorId: actorId ?? null,
      }),
    );

    const saved = await this.notificationRepository.save(notifications);

    for (const notif of saved) {
      this.gateway.sendToUser(notif.userId, 'newNotification', {
        id: notif.id,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        data: notif.data,
        isRead: false,
        createdAt: notif.createdAt,
      });
    }

    if (this.firebase.isReady) {
      const userIds = targetMembers.map((m) => m.userId);
      const tokens = await this.deviceService.getActiveTokensForUsers(userIds);
      if (tokens.length > 0) {
        const { staleTokens } = await this.firebase.sendMulticast(
          tokens,
          { title, body: message },
          data ?? {},
        );
        if (staleTokens.length > 0) {
          await this.deviceService.deactivateStaleTokens(staleTokens);
        }
      }
    }

    this.logger.log(`Delivered ${saved.length} in-app + FCM push for [${type}]`);
  }
}
