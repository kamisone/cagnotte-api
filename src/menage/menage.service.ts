import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { MenageEntry } from './entities/menage-entry.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';

@Injectable()
export class MenageService {
  constructor(
    @InjectRepository(MenageEntry)
    private readonly entryRepository: Repository<MenageEntry>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
  ) {}

  private getWeekStart(date: Date = new Date()): string {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  }

  private getTodayRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  }

  async getCurrentWeek(colocationId: string) {
    const weekStart = this.getWeekStart();
    const entries = await this.entryRepository.find({
      where: { colocationId, weekStart },
      order: { createdAt: 'ASC' },
    });

    const members = await this.memberRepository.find({
      where: { colocationId },
      relations: ['user'],
    });

    const doneUserIds = new Set(entries.map((e) => e.userId));

    const { start, end } = this.getTodayRange();
    const todayEntry = entries.find(
      (e) => e.createdAt >= start && e.createdAt < end,
    );

    const board = members.map((m) => {
      const entry = entries.find((e) => e.userId === m.user.id);
      return {
        userId: m.user.id,
        name: m.user.name,
        initial: m.user.initial,
        colorHex: m.user.colorHex,
        done: doneUserIds.has(m.user.id),
        doneAt: entry?.createdAt ?? null,
        comment: entry?.comment ?? null,
      };
    });

    return {
      weekStart,
      board,
      totalMembers: members.length,
      totalDone: entries.length,
      todayTakenBy: todayEntry?.userId ?? null,
    };
  }

  async markDone(colocationId: string, userId: string, comment?: string) {
    const weekStart = this.getWeekStart();

    const existing = await this.entryRepository.findOne({
      where: { colocationId, userId, weekStart },
    });
    if (existing) {
      throw new ConflictException('Ménage déjà marqué pour cette semaine');
    }

    const { start, end } = this.getTodayRange();
    const todayEntry = await this.entryRepository
      .createQueryBuilder('e')
      .where('e.colocationId = :colocationId', { colocationId })
      .andWhere('e.weekStart = :weekStart', { weekStart })
      .andWhere('e.createdAt >= :start AND e.createdAt < :end', { start, end })
      .getOne();
    if (todayEntry) {
      throw new ConflictException(
        'Un colocataire a déjà fait le ménage aujourd\'hui',
      );
    }

    const entry = this.entryRepository.create({
      userId,
      colocationId,
      weekStart,
      comment: comment || null,
    });
    return this.entryRepository.save(entry);
  }

  async undoMark(colocationId: string, userId: string) {
    const weekStart = this.getWeekStart();
    const entry = await this.entryRepository.findOne({
      where: { colocationId, userId, weekStart },
    });
    if (!entry) {
      throw new NotFoundException('Aucun ménage marqué pour cette semaine');
    }
    await this.entryRepository.remove(entry);
  }
}
