import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report } from './entities/report.entity';
import { ReportComment } from './entities/report-comment.entity';
import { ReportTag } from './entities/report-tag.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { CreateReportCommentDto } from './dto/create-report-comment.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,
    @InjectRepository(ReportComment)
    private readonly commentRepository: Repository<ReportComment>,
    @InjectRepository(ReportTag)
    private readonly tagRepository: Repository<ReportTag>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
    private readonly usersService: UsersService,
  ) {}

  async findByColocation(
    colocationId: string,
    requesterId: string,
    filters?: { tag?: string },
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

    if (filters?.tag) {
      qb.andWhere('r.tags LIKE :tag', { tag: `%${filters.tag}%` });
    }

    const reports = await qb.getMany();
    const requester = await this.usersService.findById(requesterId);
    const isAdmin = requester?.isAdmin === true;

    const availableTags = await this.tagRepository.find({ where: { colocationId } });
    const tagColorMap = new Map(availableTags.map((t) => [t.title, t.color]));

    return Promise.all(
      reports.map(async (r) => {
        const signed = await this.withSignedPhotoUrls(r);
        if (!isAdmin && r.userId !== requesterId) {
          this.anonymizeUser(signed);
        }
        const result = signed as any;
        result.tagDetails = (r.tags ?? []).map((title) => ({
          title,
          color: tagColorMap.get(title) ?? null,
        }));
        return result;
      }),
    );
  }

  async create(userId: string, dto: CreateReportDto): Promise<Report> {
    const report = this.reportRepository.create({
      title: dto.title,
      description: dto.description ?? null,
      tags: dto.tags ?? null,
      photoUrls: dto.photoUrls ?? null,
      userId,
      colocationId: dto.colocationId,
    });

    const saved = await this.reportRepository.save(report);
    const hydrated = await this.reportRepository.findOneOrFail({
      where: { id: saved.id },
    });

    await this.notificationsService.notifyReportCreated(dto.colocationId, dto.title, userId, saved.id);

    return this.withSignedPhotoUrls(hydrated);
  }

  async update(id: string, userId: string, dto: UpdateReportDto) {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    const isCreator = report.userId === userId;
    const membership = await this.memberRepository.findOne({
      where: { colocationId: report.colocationId, userId },
    });
    const isAdmin = membership?.role === 'admin';

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException('Only the creator or an admin can update this report');
    }

    if (dto.title !== undefined) report.title = dto.title;
    if (dto.description !== undefined) report.description = dto.description;
    if (dto.tags !== undefined) report.tags = dto.tags;
    if (dto.photoUrls !== undefined) report.photoUrls = dto.photoUrls;

    await this.reportRepository.save(report);
    const updated = await this.reportRepository.findOneOrFail({
      where: { id },
      relations: ['comments', 'comments.user'],
    });

    await this.notificationsService.notifyReportUpdated(report.colocationId, report.title, userId, id);

    return this.withSignedPhotoUrls(updated);
  }

  async findOneWithComments(id: string, requesterId: string) {
    const report = await this.reportRepository.findOne({
      where: { id },
      relations: ['comments', 'comments.user'],
    });
    if (!report) throw new NotFoundException('Report not found');

    report.comments.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const signed = await this.withSignedPhotoUrls(report);
    const requester = await this.usersService.findById(requesterId);
    const isAdmin = requester?.isAdmin === true;

    if (!isAdmin && report.userId !== requesterId) {
      this.anonymizeUser(signed);
    }

    const availableTags = await this.tagRepository.find({ where: { colocationId: report.colocationId } });
    const tagColorMap = new Map(availableTags.map((t) => [t.title, t.color]));
    const result = signed as any;
    result.tagDetails = (report.tags ?? []).map((title) => ({
      title,
      color: tagColorMap.get(title) ?? null,
    }));

    return result;
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

    await this.notificationsService.notifyCommentAdded(report.colocationId, report.title, userId, reportId);

    return this.commentRepository.findOneOrFail({ where: { id: saved.id } });
  }

  async findTagsByColocation(colocationId: string): Promise<ReportTag[]> {
    return this.tagRepository.find({ where: { colocationId }, order: { title: 'ASC' } });
  }

  async createTag(dto: CreateTagDto): Promise<ReportTag> {
    const tag = this.tagRepository.create({
      title: dto.title,
      color: dto.color,
      colocationId: dto.colocationId,
    });
    return this.tagRepository.save(tag);
  }

  async removeTag(id: string): Promise<void> {
    await this.tagRepository.delete(id);
  }

  async remove(id: string, userId: string): Promise<void> {
    const report = await this.reportRepository.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');

    const isCreator = report.userId === userId;
    const membership = await this.memberRepository.findOne({
      where: { colocationId: report.colocationId, userId },
    });
    const isAdmin = membership?.role === 'admin';

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException('Only the creator or an admin can delete this report');
    }

    await this.commentRepository.delete({ reportId: id });
    await this.reportRepository.delete(id);
  }

  private anonymizeUser(report: Report): void {
    report.user = {
      ...report.user,
      id: 'anonymous',
      name: 'Anonyme',
      email: '',
      colorHex: '#8A8275',
      initial: '?',
    };
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
