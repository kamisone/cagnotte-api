import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { MenageEntry } from './entities/menage-entry.entity';
import { MenageSubTaskEntry } from './entities/menage-sub-task.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { Colocation } from '../colocations/entities/colocation.entity';

const DEFAULT_SUB_TASK_LIMIT = 10;
const MIN_SUB_TASK_LIMIT = 1;
const MAX_SUB_TASK_LIMIT = 50;
const MAX_SUB_TASK_LENGTH = 60;

@Injectable()
export class MenageService {
  constructor(
    @InjectRepository(MenageEntry)
    private readonly entryRepository: Repository<MenageEntry>,
    @InjectRepository(MenageSubTaskEntry)
    private readonly subTaskRepository: Repository<MenageSubTaskEntry>,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
    @InjectRepository(Colocation)
    private readonly colocationRepository: Repository<Colocation>,
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
    const [entries, subTasks, members, colocation] = await Promise.all([
      this.entryRepository.find({
        where: { colocationId, weekStart },
        order: { createdAt: 'ASC' },
      }),
      this.subTaskRepository.find({
        where: { colocationId, weekStart },
        order: { createdAt: 'ASC' },
      }),
      this.memberRepository.find({
        where: { colocationId },
        relations: ['user'],
      }),
      this.colocationRepository.findOne({ where: { id: colocationId } }),
    ]);

    const doneUserIds = new Set(entries.map((e) => e.userId));

    const { start, end } = this.getTodayRange();
    const todayEntry = entries.find(
      (e) => e.createdAt >= start && e.createdAt < end,
    );

    const board = members.map((m) => {
      const entry = entries.find((e) => e.userId === m.user.id);
      const mySubTasks = subTasks
        .filter((t) => t.userId === m.user.id)
        .map((t) => ({ text: t.text, completedAt: t.createdAt.toISOString() }));
      return {
        userId: m.user.id,
        name: m.user.name,
        initial: m.user.initial,
        colorHex: m.user.colorHex,
        done: doneUserIds.has(m.user.id),
        doneAt: entry?.createdAt ?? null,
        comment: entry?.comment ?? null,
        subTasks: mySubTasks.length > 0 ? mySubTasks : null,
      };
    });

    return {
      weekStart,
      board,
      totalMembers: members.length,
      totalDone: entries.length,
      todayTakenBy: todayEntry?.userId ?? null,
      taskDescription: colocation?.menageTaskDescription ?? null,
      subTaskLimit: colocation?.menageSubTaskLimit ?? DEFAULT_SUB_TASK_LIMIT,
    };
  }

  async updateTaskDescription(colocationId: string, description: string) {
    await this.colocationRepository.update(
      { id: colocationId },
      { menageTaskDescription: description || null },
    );
  }

  async updateSubTaskLimit(colocationId: string, limit: number) {
    if (
      !Number.isInteger(limit) ||
      limit < MIN_SUB_TASK_LIMIT ||
      limit > MAX_SUB_TASK_LIMIT
    ) {
      throw new BadRequestException(
        `La limite doit être un nombre entier entre ${MIN_SUB_TASK_LIMIT} et ${MAX_SUB_TASK_LIMIT}`,
      );
    }
    await this.colocationRepository.update(
      { id: colocationId },
      { menageSubTaskLimit: limit },
    );
  }

  async addSubTask(colocationId: string, userId: string, text: string) {
    const cleanText = (text ?? '').trim();
    if (!cleanText) {
      throw new BadRequestException('La tâche ne peut pas être vide');
    }
    if (cleanText.length > MAX_SUB_TASK_LENGTH) {
      throw new BadRequestException(
        `Une tâche ne peut pas dépasser ${MAX_SUB_TASK_LENGTH} caractères`,
      );
    }

    const weekStart = this.getWeekStart();
    const [colocation, existingCount] = await Promise.all([
      this.colocationRepository.findOne({ where: { id: colocationId } }),
      this.subTaskRepository.count({ where: { colocationId, userId, weekStart } }),
    ]);
    const limit = colocation?.menageSubTaskLimit ?? DEFAULT_SUB_TASK_LIMIT;
    if (existingCount >= limit) {
      throw new BadRequestException(
        `Vous ne pouvez pas ajouter plus de ${limit} tâches`,
      );
    }

    const subTask = this.subTaskRepository.create({
      userId,
      colocationId,
      weekStart,
      text: cleanText,
    });
    return this.subTaskRepository.save(subTask);
  }

  async markDone(colocationId: string, userId: string, comment?: string) {
    if (comment && comment.length > 50) {
      throw new BadRequestException('Le commentaire ne peut pas dépasser 50 caractères');
    }
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
