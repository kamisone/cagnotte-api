import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Colocation } from '../colocations/entities/colocation.entity';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { Receipt } from '../receipts/entities/receipt.entity';
import { Report } from '../reports/entities/report.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AuditLog, AuditAction } from './entities/audit-log.entity';

@Injectable()
export class SuperAdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Colocation) private readonly colocationRepo: Repository<Colocation>,
    @InjectRepository(ColocationMember) private readonly memberRepo: Repository<ColocationMember>,
    @InjectRepository(Receipt) private readonly receiptRepo: Repository<Receipt>,
    @InjectRepository(Report) private readonly reportRepo: Repository<Report>,
    @InjectRepository(Notification) private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
  ) {}

  // ─── Overview ────────────────────────────────────────────────────────────
  async getOverview() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalUsers, newUsers, suspendedUsers, totalColocations, newColocations, suspendedColocations, totalReceipts, spendingRaw, totalReports] = await Promise.all([
      this.userRepo.count({ where: { isSuperAdmin: false } }),
      this.userRepo.createQueryBuilder('u').where('u.createdAt >= :d', { d: thirtyDaysAgo }).andWhere('u.isSuperAdmin = false').getCount(),
      this.userRepo.count({ where: { suspendedAt: Not(IsNull()) } }),
      this.colocationRepo.count(),
      this.colocationRepo.createQueryBuilder('c').where('c.createdAt >= :d', { d: thirtyDaysAgo }).getCount(),
      this.colocationRepo.count({ where: { suspendedAt: Not(IsNull()) } }),
      this.receiptRepo.count(),
      this.receiptRepo.createQueryBuilder('r').select('COALESCE(SUM(r.totalAmount), 0)', 'sum').getRawOne<{ sum: string }>(),
      this.reportRepo.count(),
    ]);

    return {
      users: { total: totalUsers, newLast30Days: newUsers, suspended: suspendedUsers, active: totalUsers - suspendedUsers },
      colocations: { total: totalColocations, newLast30Days: newColocations, suspended: suspendedColocations, active: totalColocations - suspendedColocations },
      receipts: { total: totalReceipts, totalSpending: parseFloat(spendingRaw?.sum ?? '0') },
      reports: { total: totalReports },
    };
  }

  // ─── Analytics ───────────────────────────────────────────────────────────
  async getAnalytics(period: 'week' | 'month' | '3months' = 'month') {
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [userGrowth, colocationGrowth, receiptActivity] = await Promise.all([
      this.userRepo.createQueryBuilder('u')
        .select(`DATE_TRUNC('day', u."createdAt")`, 'date')
        .addSelect('COUNT(*)', 'count')
        .where('u.createdAt >= :since', { since })
        .groupBy(`DATE_TRUNC('day', u."createdAt")`)
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; count: string }>(),

      this.colocationRepo.createQueryBuilder('c')
        .select(`DATE_TRUNC('day', c."createdAt")`, 'date')
        .addSelect('COUNT(*)', 'count')
        .where('c.createdAt >= :since', { since })
        .groupBy(`DATE_TRUNC('day', c."createdAt")`)
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; count: string }>(),

      this.receiptRepo.createQueryBuilder('r')
        .select(`DATE_TRUNC('day', r."createdAt")`, 'date')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(r."totalAmount"), 0)', 'total')
        .where('r.createdAt >= :since', { since })
        .groupBy(`DATE_TRUNC('day', r."createdAt")`)
        .orderBy('date', 'ASC')
        .getRawMany<{ date: string; count: string; total: string }>(),
    ]);

    return {
      period, days,
      userGrowth: userGrowth.map(r => ({ date: new Date(r.date).toISOString().slice(0, 10), count: parseInt(r.count, 10) })),
      colocationGrowth: colocationGrowth.map(r => ({ date: new Date(r.date).toISOString().slice(0, 10), count: parseInt(r.count, 10) })),
      receiptActivity: receiptActivity.map(r => ({ date: new Date(r.date).toISOString().slice(0, 10), count: parseInt(r.count, 10), total: parseFloat(r.total) })),
    };
  }

  // ─── Colocations ─────────────────────────────────────────────────────────
  async getColocations(search?: string, status?: 'active' | 'suspended') {
    const members = await this.memberRepo.find({ relations: ['colocation', 'user'] });

    const map = new Map<string, {
      id: string; name: string; inviteCode: string; createdAt: Date; suspendedAt: Date | null;
      memberCount: number; admin: { id: string; name: string; email: string } | null;
    }>();

    for (const m of members) {
      const c = m.colocation;
      if (!map.has(c.id)) {
        map.set(c.id, { id: c.id, name: c.name, inviteCode: c.inviteCode, createdAt: c.createdAt, suspendedAt: c.suspendedAt, memberCount: 0, admin: null });
      }
      const entry = map.get(c.id)!;
      entry.memberCount++;
      if (m.role === 'admin') entry.admin = { id: m.user.id, name: m.user.name, email: m.user.email };
    }

    const allColocations = await this.colocationRepo.find({ order: { createdAt: 'DESC' } });
    for (const c of allColocations) {
      if (!map.has(c.id)) {
        map.set(c.id, { id: c.id, name: c.name, inviteCode: c.inviteCode, createdAt: c.createdAt, suspendedAt: c.suspendedAt, memberCount: 0, admin: null });
      }
    }

    let result = Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.admin?.email.toLowerCase().includes(q) || c.inviteCode.toLowerCase().includes(q));
    }
    if (status === 'active') result = result.filter(c => !c.suspendedAt);
    if (status === 'suspended') result = result.filter(c => !!c.suspendedAt);

    return result;
  }

  // ─── Users ───────────────────────────────────────────────────────────────
  async getUsers(search?: string, role?: 'admin' | 'super_admin' | 'member', status?: 'active' | 'suspended', colocationId?: string) {
    const [users, members] = await Promise.all([
      this.userRepo.find({ order: { createdAt: 'DESC' } }),
      this.memberRepo.find({ relations: ['colocation'] }),
    ]);

    const memberMap = new Map<string, ColocationMember>();
    for (const m of members) {
      if (!memberMap.has(m.userId)) memberMap.set(m.userId, m);
    }

    let result = users.map(({ password: _p, refreshToken: _r, ...u }) => ({
      ...u,
      colocation: memberMap.has(u.id) ? { id: memberMap.get(u.id)!.colocationId, name: memberMap.get(u.id)!.colocation.name } : null,
    }));

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    if (role === 'super_admin') result = result.filter(u => u.isSuperAdmin);
    else if (role === 'admin') result = result.filter(u => u.isAdmin && !u.isSuperAdmin);
    else if (role === 'member') result = result.filter(u => !u.isAdmin && !u.isSuperAdmin);

    if (status === 'active') result = result.filter(u => !u.suspendedAt && !u.anonymizedAt);
    if (status === 'suspended') result = result.filter(u => !!u.suspendedAt);
    if (colocationId) result = result.filter(u => u.colocation?.id === colocationId);

    return result;
  }

  // ─── Reports ─────────────────────────────────────────────────────────────
  async getReports(search?: string, colocationId?: string, page = 1, limit = 50) {
    const qb = this.reportRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.colocation', 'c')
      .leftJoin('r.user', 'u')
      .addSelect(['u.id', 'u.name', 'u.email'])
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (colocationId) qb.where('r.colocationId = :colocationId', { colocationId });
    if (search) qb.andWhere('(r.title ILIKE :q OR r.description ILIKE :q)', { q: `%${search}%` });

    const [reports, total] = await qb.getManyAndCount();
    return { reports, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ─── Notifications ───────────────────────────────────────────────────────
  async getNotificationHistory(type?: string, page = 1, limit = 50) {
    const [items, total] = await this.notificationRepo.findAndCount({
      where: type ? { type } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async broadcastNotification(actorId: string, actorName: string, title: string, message: string, colocationId?: string) {
    let userIds: string[];

    if (colocationId) {
      const members = await this.memberRepo.find({ where: { colocationId } });
      userIds = members.map(m => m.userId);
    } else {
      const users = await this.userRepo.find({ where: { isSuperAdmin: false } });
      userIds = users.map(u => u.id);
    }

    const notifications = userIds.map(userId =>
      this.notificationRepo.create({ type: 'ANNOUNCEMENT', title, message, userId, actorId, colocationId: colocationId ?? null, data: { source: 'super_admin' } }),
    );
    await this.notificationRepo.save(notifications);
    await this.log(actorId, actorName, 'BROADCAST_NOTIFICATION', 'notification', null, colocationId ? `Colocation ${colocationId}` : 'All users', { title, recipientCount: userIds.length });
    return { sent: userIds.length };
  }

  // ─── Suspend / Activate ──────────────────────────────────────────────────
  async suspendUser(id: string, actorId: string, actorName: string) {
    const user = await this.userRepo.findOneOrFail({ where: { id } });
    if (user.isSuperAdmin) throw new ForbiddenException('Cannot suspend a super-admin');
    if (user.anonymizedAt) throw new ForbiddenException('User is anonymized');
    await this.userRepo.update(id, { suspendedAt: new Date() });
    await this.log(actorId, actorName, 'SUSPEND_USER', 'user', id, user.name);
  }

  async activateUser(id: string, actorId: string, actorName: string) {
    const user = await this.userRepo.findOneOrFail({ where: { id } });
    if (user.anonymizedAt) throw new ForbiddenException('User is anonymized');
    await this.userRepo.update(id, { suspendedAt: null });
    await this.log(actorId, actorName, 'ACTIVATE_USER', 'user', id, user.name);
  }

  async suspendColocation(id: string, actorId: string, actorName: string) {
    const c = await this.colocationRepo.findOneOrFail({ where: { id } });
    await this.colocationRepo.update(id, { suspendedAt: new Date() });
    await this.log(actorId, actorName, 'SUSPEND_COLOCATION', 'colocation', id, c.name);
  }

  async activateColocation(id: string, actorId: string, actorName: string) {
    const c = await this.colocationRepo.findOneOrFail({ where: { id } });
    await this.colocationRepo.update(id, { suspendedAt: null });
    await this.log(actorId, actorName, 'ACTIVATE_COLOCATION', 'colocation', id, c.name);
  }

  // ─── Delete ──────────────────────────────────────────────────────────────
  // Anonymizes rather than hard-deletes: the user keeps historical rows
  // (receipts, reports, menage entries, audit logs, …) for record-keeping,
  // but is stripped of all colocation memberships and can never log in again.
  async deleteUser(id: string, actorId: string, actorName: string) {
    const user = await this.userRepo.findOneOrFail({ where: { id } });
    if (user.isSuperAdmin) throw new ForbiddenException('Cannot delete a super-admin');
    if (user.anonymizedAt) throw new ForbiddenException('User is already anonymized');
    await this.log(actorId, actorName, 'ANONYMIZE_USER', 'user', id, user.name);

    const memberships = await this.memberRepo.find({ where: { userId: id } });
    for (const membership of memberships) {
      const colocation = await this.colocationRepo.findOneBy({ id: membership.colocationId });
      if (colocation?.purchaseOrder?.includes(id)) {
        const removedIndex = colocation.purchaseOrder.indexOf(id);
        colocation.purchaseOrder = colocation.purchaseOrder.filter((uid) => uid !== id);
        colocation.disabledMembers = (colocation.disabledMembers ?? []).filter((uid) => uid !== id);
        if (colocation.purchaseOrder.length > 0) {
          if (removedIndex < colocation.currentPurchaserIndex) colocation.currentPurchaserIndex--;
          colocation.currentPurchaserIndex = colocation.currentPurchaserIndex % colocation.purchaseOrder.length;
        } else {
          colocation.currentPurchaserIndex = 0;
        }
        await this.colocationRepo.save(colocation);
      }
    }
    await this.memberRepo.delete({ userId: id });

    const anonymizedPassword = await bcrypt.hash(randomUUID(), 10);
    await this.userRepo.update(id, {
      email: `deleted-${id}@anonymized.habizy.com`,
      name: 'Utilisateur supprimé',
      phone: null,
      password: anonymizedPassword,
      refreshToken: null,
      isAdmin: false,
      profileCompleted: false,
      anonymizedAt: new Date(),
    });
  }

  async deleteColocation(id: string, actorId: string, actorName: string) {
    const c = await this.colocationRepo.findOneOrFail({ where: { id } });
    await this.log(actorId, actorName, 'DELETE_COLOCATION', 'colocation', id, c.name);
    await this.memberRepo.delete({ colocationId: id });
    await this.colocationRepo.delete(id);
  }

  // ─── Bootstrap ───────────────────────────────────────────────────────────
  async bootstrap(userId: string, secret: string) {
    const envSecret = process.env.SUPER_ADMIN_SECRET;
    if (!envSecret || secret !== envSecret) throw new ForbiddenException('Invalid secret');
    const existing = await this.userRepo.findOne({ where: { isSuperAdmin: true } });
    if (existing) throw new ForbiddenException('Super-admin already bootstrapped');
    await this.userRepo.update(userId, { isSuperAdmin: true });
  }

  // ─── Audit logs ──────────────────────────────────────────────────────────
  async getAuditLogs(action?: string, page = 1, limit = 50) {
    const [logs, total] = await this.auditRepo.findAndCount({
      where: action ? { action: action as AuditAction } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { logs, total, page, limit, pages: Math.ceil(total / limit) };
  }

  private async log(actorId: string, actorName: string, action: AuditAction, targetType: string, targetId: string | null, targetName: string, details?: Record<string, unknown>) {
    await this.auditRepo.save(this.auditRepo.create({ action, targetType, targetId, targetName, actorId, actorName, details }));
  }
}
