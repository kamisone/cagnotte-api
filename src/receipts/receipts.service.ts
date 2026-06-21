import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Receipt } from './entities/receipt.entity';
import { ReceiptItem } from './entities/receipt-item.entity';
import { Contribution } from '../contributions/entities/contribution.entity';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectRepository(Receipt)
    private readonly receiptRepository: Repository<Receipt>,
    @InjectRepository(ReceiptItem)
    private readonly receiptItemRepository: Repository<ReceiptItem>,
    @InjectRepository(Contribution)
    private readonly contributionRepository: Repository<Contribution>,
    private readonly notificationsService: NotificationsService,
    private readonly storageService: StorageService,
  ) {}

  async create(userId: string, dto: CreateReceiptDto): Promise<Receipt> {
    const receipt = this.receiptRepository.create({
      store: dto.store,
      date: dto.date,
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
    // Reload with eager relations (save() does not hydrate them)
    const hydrated = await this.receiptRepository.findOneOrFail({ where: { id: saved.id } });

    // Compute balance after receipt creation
    const contributionsResult = await this.contributionRepository
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.amount), 0)', 'total')
      .where('c.colocationId = :colocationId', {
        colocationId: dto.colocationId,
      })
      .getRawOne();

    const receiptsResult = await this.receiptRepository
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.totalAmount), 0)', 'total')
      .where('r.colocationId = :colocationId', {
        colocationId: dto.colocationId,
      })
      .getRawOne();

    const balance =
      parseFloat(contributionsResult.total) -
      parseFloat(receiptsResult.total);

    if (balance <= 0) {
      await this.notificationsService.createFundEmptyNotification(
        dto.colocationId,
      );
    }

    await this.notificationsService.createForAllMembers(
      dto.colocationId,
      'receipt_added',
      `Un nouveau ticket de caisse a été ajouté (${dto.store}).`,
      userId,
    );

    return this.withSignedPhotoUrl(hydrated);
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

  async findByColocation(colocationId: string): Promise<Receipt[]> {
    const receipts = await this.receiptRepository.find({
      where: { colocationId },
      order: { date: 'DESC' },
    });
    return Promise.all(receipts.map((r) => this.withSignedPhotoUrl(r)));
  }

  async getStats(colocationId: string) {
    // Total spent
    const totalResult = await this.receiptRepository
      .createQueryBuilder('r')
      .select('COALESCE(SUM(r.totalAmount), 0)', 'totalSpent')
      .where('r.colocationId = :colocationId', { colocationId })
      .getRawOne();

    const totalSpent = parseFloat(totalResult.totalSpent);

    // By category
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

    // By roommate — join user table to return the full user object
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
}
