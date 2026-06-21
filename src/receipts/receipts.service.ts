import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Receipt } from './entities/receipt.entity';
import { ReceiptItem } from './entities/receipt-item.entity';
import { Colocation } from '../colocations/entities/colocation.entity';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { RotationsService } from '../rotations/rotations.service';

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(ReceiptItem)
    private readonly receiptItemRepository: Repository<ReceiptItem>,
    @InjectRepository(Colocation)
    private readonly colocationRepository: Repository<Colocation>,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
    private readonly rotationsService: RotationsService,
  ) {}

  async create(userId: string, dto: CreateReceiptDto): Promise<Receipt> {
    const currentPurchaserId = await this.rotationsService.getCurrentPurchaserId(dto.colocationId);
    if (currentPurchaserId && currentPurchaserId !== userId) {
      throw new ForbiddenException("Ce n'est pas votre tour de faire les courses");
    }

    const receipt = this.receiptRepository.create({
      store: dto.store,
      date: dto.date,
      time: dto.time ?? null,
      totalAmount: dto.totalAmount,
      photoUrl: dto.photoUrl,
      userId,
      colocationId: dto.colocationId,
      items: dto.items.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity ?? 1,
        category: item.category ?? 'divers',
      })),
    });

    const saved = await this.receiptRepository.save(receipt);
    const hydrated = await this.receiptRepository.findOneOrFail({ where: { id: saved.id } });

    if (currentPurchaserId) {
      await this.rotationsService.advancePurchaser(dto.colocationId);
    }

    // Check spending gap between tenants
    await this.checkSpendingGap(dto.colocationId);

    await this.notificationsService.createForAllMembers(
      dto.colocationId,
      'receipt_added',
      `Un nouveau ticket de caisse a été ajouté (${dto.store}).`,
      userId,
    );

    return this.withSignedPhotoUrl(hydrated);
  }

  private async checkSpendingGap(colocationId: string): Promise<void> {
    const colocation = await this.colocationRepository.findOneBy({ id: colocationId });
    if (!colocation || colocation.spendingGapThreshold <= 0) return;

    const spendingPerUser = await this.receiptRepository
      .createQueryBuilder('r')
      .select('r.userId', 'userId')
      .addSelect('COALESCE(SUM(r.totalAmount), 0)', 'total')
      .where('r.colocationId = :colocationId', { colocationId })
      .groupBy('r.userId')
      .getRawMany();

    if (spendingPerUser.length < 2) return;

    const amounts = spendingPerUser.map((r) => parseFloat(r.total));
    const gap = Math.max(...amounts) - Math.min(...amounts);

    if (gap > colocation.spendingGapThreshold) {
      await this.notificationsService.createSpendingGapNotification(colocationId, gap);
    }
  }

  private async withSignedPhotoUrl(receipt: Receipt): Promise<Receipt> {
    if (!receipt.photoUrl) return receipt;
    try {
      const key = this.storageService.extractKey(receipt.photoUrl);
      receipt.photoUrl = await this.storageService.signedReadUrl(key);
    } catch {
      // fall back to stored URL on signing failure
    }
    return receipt;
  }

  async remove(id: string): Promise<void> {
    const receipt = await this.receiptRepository.findOne({ where: { id } });
    if (!receipt) return;
    if (receipt.photoUrl) {
      const key = this.storageService.extractKey(receipt.photoUrl);
      await this.storageService.deleteFile(key);
    }
    await this.receiptItemRepository.delete({ receiptId: id });
    await this.receiptRepository.delete(id);
  }

  async findByColocation(colocationId: string): Promise<Receipt[]> {
    const receipts = await this.receiptRepository.find({
      where: { colocationId },
      order: { date: 'DESC' },
    });
    return Promise.all(receipts.map((r) => this.withSignedPhotoUrl(r)));
  }

  async getStats(colocationId: string) {
    const totalResult = await this.receiptRepository
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.totalAmount), 0)', 'totalSpent')
      .where('r.colocationId = :colocationId', { colocationId })
      .getRawOne();

    const totalSpent = parseFloat(totalResult.totalSpent);

    const byCategoryRaw = await this.receiptItemRepository
      .createQueryBuilder('ri')
      .innerJoin('ri.receipt', 'r')
      .select('ri.category', 'category')
      .addSelect('SUM(ri.price * ri.quantity)', 'amount')
      .where('r.colocationId = :colocationId', { colocationId })
      .groupBy('ri.category')
      .getRawMany();

    const byCategory = byCategoryRaw.map((row) => ({
      category: row.category,
      total: parseFloat(row.amount),
      fraction: totalSpent > 0 ? parseFloat(row.amount) / totalSpent : 0,
    }));

    const byRoommateRaw = await this.receiptRepository
      .createQueryBuilder('r')
      .innerJoin('r.user', 'u')
      .select('r.userId', 'userId')
      .addSelect('SUM(r.totalAmount)', 'amount')
      .addSelect('u.id', 'uid')
      .addSelect('u.name', 'uName')
      .addSelect('u.email', 'uEmail')
      .addSelect('u.colorHex', 'uColorHex')
      .addSelect('u.initial', 'uInitial')
      .addSelect('u.phone', 'uPhone')
      .where('r.colocationId = :colocationId', { colocationId })
      .groupBy('r.userId')
      .addGroupBy('u.id')
      .addGroupBy('u.name')
      .addGroupBy('u.email')
      .addGroupBy('u.colorHex')
      .addGroupBy('u.initial')
      .addGroupBy('u.phone')
      .getRawMany();

    const byRoommate = byRoommateRaw.map((row) => ({
      user: {
        id: row.uid,
        email: row.uEmail,
        name: row.uName,
        colorHex: row.uColorHex,
        initial: row.uInitial,
        phone: row.uPhone ?? null,
      },
      total: parseFloat(row.amount),
      fraction: totalSpent > 0 ? parseFloat(row.amount) / totalSpent : 0,
    }));

    return { totalSpent, byCategory, byRoommate };
  }

  async getArticleCatalog(
    colocationId: string,
  ): Promise<{ name: string; category: string; lastPrice: number }[]> {
    const raw = await this.receiptItemRepository
      .createQueryBuilder('ri')
      .innerJoin('ri.receipt', 'r')
      .select('ri.name', 'name')
      .addSelect('ri.category', 'category')
      .addSelect('MAX(ri.price)', 'lastPrice')
      .addSelect('COUNT(*)', 'usageCount')
      .where('r.colocationId = :colocationId', { colocationId })
      .groupBy('ri.name')
      .addGroupBy('ri.category')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    return raw.map((row) => ({
      name: row.name,
      category: row.category,
      lastPrice: parseFloat(row.lastPrice),
    }));
  }

  async getArticleStats(
    colocationId: string,
  ): Promise<
    {
      name: string;
      category: string;
      totalAmount: number;
      totalQuantity: number;
      fraction: number;
    }[]
  > {
    const totalResult = await this.receiptRepository
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.totalAmount), 0)', 'totalSpent')
      .where('r.colocationId = :colocationId', { colocationId })
      .getRawOne();

    const overallTotal = Math.max(parseFloat(totalResult.totalSpent), 0.01);

    const raw = await this.receiptItemRepository
      .createQueryBuilder('ri')
      .innerJoin('ri.receipt', 'r')
      .select('ri.name', 'name')
      .addSelect('ri.category', 'category')
      .addSelect('SUM(ri.price * ri.quantity)', 'totalAmount')
      .addSelect('SUM(ri.quantity)', 'totalQuantity')
      .where('r.colocationId = :colocationId', { colocationId })
      .groupBy('ri.name')
      .addGroupBy('ri.category')
      .orderBy('SUM(ri.price * ri.quantity)', 'DESC')
      .getRawMany();

    return raw.map((row) => ({
      name: row.name,
      category: row.category,
      totalAmount: parseFloat(row.totalAmount),
      totalQuantity: parseInt(row.totalQuantity, 10),
      fraction: parseFloat(row.totalAmount) / overallTotal,
    }));
  }
}
