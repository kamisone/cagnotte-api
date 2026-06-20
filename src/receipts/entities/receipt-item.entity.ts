import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Receipt } from './receipt.entity';

@Entity('receipt_items')
export class ReceiptItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ default: 1 })
  quantity: number;

  @Column({ default: 'divers' })
  category: string;

  @ManyToOne(() => Receipt, (receipt) => receipt.items)
  @JoinColumn({ name: 'receiptId' })
  receipt: Receipt;

  @Column()
  receiptId: string;
}
