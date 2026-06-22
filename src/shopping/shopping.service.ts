import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShoppingItem } from './entities/shopping-item.entity';
import { CreateShoppingItemDto } from './dto/create-shopping-item.dto';

@Injectable()
export class ShoppingService {
  constructor(
    @InjectRepository(ShoppingItem)
    private readonly shoppingItemRepository: Repository<ShoppingItem>,
  ) {}

  async findByColocation(colocationId: string): Promise<ShoppingItem[]> {
    return this.shoppingItemRepository.find({
      where: { colocationId },
      order: { isChecked: 'ASC', createdAt: 'DESC' },
    });
  }

  async create(dto: CreateShoppingItemDto): Promise<ShoppingItem> {
    const item = this.shoppingItemRepository.create({
      name: dto.name,
      quantity: dto.quantity ?? 1,
      colocationId: dto.colocationId,
      assigneeId: dto.assigneeId || null,
    });
    return this.shoppingItemRepository.save(item);
  }

  async toggle(id: string, userId: string): Promise<ShoppingItem> {
    const item = await this.shoppingItemRepository.findOneBy({ id });
    if (!item) {
      throw new NotFoundException('Shopping item not found');
    }

    item.isChecked = !item.isChecked;
    item.checkedById = item.isChecked ? userId : null;

    return this.shoppingItemRepository.save(item);
  }

  async clearByColocation(colocationId: string): Promise<void> {
    await this.shoppingItemRepository.delete({ colocationId });
  }

  async remove(id: string): Promise<void> {
    const result = await this.shoppingItemRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Shopping item not found');
    }
  }
}
