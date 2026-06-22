import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { ReportComment } from './entities/report-comment.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateReportCommentDto } from './dto/create-report-comment.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(ReportComment)
    private readonly commentRepository: Repository<ReportComment>,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
  ) {}

  async findByColocation(
    colocationId: string,
    filters?: { status?: string; category?: string },
  ) {
    const qb = this.reportRepository
      .createQueryBuilder('r')
      .leftJoin('r.user', 'u')
      .addSelect([
        'u.id',
        'u.name',
        'u.email',
        'u.colorHex',
        'u.initial',
        'u.isAdmin',
      ])
      .loadRelationCountAndMap('r.commentCount', 'r.comments')
      .where('r.colocationId = :colocationId', { colocationId })
      .orderBy('r.createdAt', 'DESC');

    if (filters?.status) {
      qb.andWhere('r.status = :status', { status: filters.status });
    }
    if (filters?.category) {
      qb.andWhere('r.category = :category', { category: filters.category });
    }

    const reports = await qb.getMany();
    return Promise.all(reports.map((r) => this.withSignedPhotoUrls(r)));
  }

  async create(userId: string, dto: CreateReportDto): Promise<Report> {
    const report = this.reportRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      category: dto.category,
      photoUrls: dto.photoUrls ?? null,
      userId,
      colocationId: dto.colocationId,
    });

    const saved = await this.reportRepository.save(report);
    const hydrated = await this.reportRepository.findOneOrFail({
      where: { id: saved.id },
    });

    await this.notificationsService.createForAllMembers(
      dto.colocationId,
      'report_created',
      `Nouveau signalement : ${dto.title}`,
      userId,
    );

    return this.withSignedPhotoUrls(hydrated);
  }

  async findOneWithComments(id: string) {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['comments', 'comments.user'],
    });
    if (!report) throw new NotFoundException('Report not found');

    report.comments.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return this.withSignedPhotoUrls(report);
  }

  async updateStatus(
    id: string,
    userId: string,
    status: string,
  ): Promise<Report> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    report.status = status;
    const saved = await this.reportRepository.save(report);

    const notifType =
      status === 'resolved' ? 'report_resolved' : 'report_updated';
    const message =
      status === 'resolved'
        ? `Signalement resolu : ${report.title}`
        : `Signalement mis a jour : ${report.title}`;

    await this.notificationsService.createForAllMembers(
      report.colocationId,
      notifType,
      message,
      userId,
    );

    return saved;
  }

  async addComment(
    reportId: string,
    userId: string,
    dto: CreateReportCommentDto,
  ): Promise<ReportComment> {
    const report = await this.reportRepository.findOne({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('Report not found');

    const comment = this.commentRepository.create({
      content: dto.content,
      reportId,
      userId,
    });
    const saved = await this.commentRepository.save(comment);

    await this.notificationsService.createForAllMembers(
      report.colocationId,
      'report_commented',
      `Nouveau commentaire sur : ${report.title}`,
      userId,
    );

    return this.commentRepository.findOneOrFail({ where: { id: saved.id } });
  }

  private async withSignedPhotoUrls(report: Report): Promise<Report> {
    if (!report.photoUrls?.length) return report;
    try {
      report.photoUrls = await Promise.all(
        report.photoUrls.map(async (url) => {
          try {
            const key = this.storageService.extractKey(url);
            return await this.storageService.signedReadUrl(key);
          } catch {
            return url;
          }
        }),
      );
    } catch {
      // fall back to stored URLs
    }
    return report;
  }
}
