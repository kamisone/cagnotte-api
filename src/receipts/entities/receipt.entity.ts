import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Colocation } from '../../colocations/entities/colocation.entity';
import { ReceiptItem } from './receipt-item.entity';

@Entity('receipts')
export class Receipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  store: string;

  @Column({ type: 'date' })
  date: string;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column({ nullable: true })
  photoUrl: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Colocation)
  @JoinColumn({ name: 'colocationId' })
  colocation: Colocation;

  @Column()
  colocationId: string;

  @OneToMany(() => ReceiptItem, (item) => item.receipt, {
    cascade: true,
    eager: true,
  })
  items: ReceiptItem[];

  @CreateDateColumn()
  createdAt: Date;
}
