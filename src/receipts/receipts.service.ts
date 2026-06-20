import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Receipt } from './entities/receipt.entity';
import { ReceiptItem } from './entities/receipt-item.entity';
import { Contribution } from '../contributions/entities/contribution.entity';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { NotificationsService } from '../notifications/notifications.service';

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
  ) {}

  async create(userId: string, dto: CreateReceiptDto): Promise<Receipt> {
    const receipt = this.receiptRepository.create({
      store: dto.store,
      date: dto.date,
      totalAmount: dto.totalAmount,
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

    return saved;
  }

  async findByColocation(colocationId: string): Promise<Receipt[]> {
    return this.receiptRepository.find({
      where: { colocationId },
      order: { date: 'DESC' },
    });
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
      amount: parseFloat(row.amount),
      fraction: totalSpent > 0 ? parseFloat(row.amount) / totalSpent : 0,
    }));

    // By roommate
    const byRoommateRaw = await this.receiptRepository
      .createQueryBuilder('r')
      .select('r.userId', 'userId')
      .addSelect('SUM(r.totalAmount)', 'amount')
      .where('r.colocationId = :colocationId', { colocationId })
      .groupBy('r.userId')
      .getRawMany();

    const byRoommate = byRoommateRaw.map((row) => ({
      userId: row.userId,
      amount: parseFloat(row.amount),
      fraction: totalSpent > 0 ? parseFloat(row.amount) / totalSpent : 0,
    }));

    return { totalSpent, byCategory, byRoommate };
  }
}
