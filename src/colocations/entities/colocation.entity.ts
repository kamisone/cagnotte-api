import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  AfterLoad,
} from 'typeorm';

@Entity('colocations')
export class Colocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  inviteCode: string;

  @Column('decimal', { precision: 10, scale: 2, default: 50.0 })
  spendingGapThreshold: number;

  @Column('simple-array', { nullable: true })
  purchaseOrder: string[];

  @Column({ default: 0 })
  currentPurchaserIndex: number;

  @Column('simple-array', { nullable: true })
  disabledMembers: string[];

  @Column({ default: true })
  notificationsEnabled: boolean;

  @Column({ type: 'text', nullable: true, default: null })
  menageTaskDescription: string | null;

  @Column({ default: 10 })
  menageSubTaskLimit: number;

  @Column({ type: 'timestamp', nullable: true, default: null })
  suspendedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @AfterLoad()
  parseDecimals() {
    this.spendingGapThreshold = parseFloat(this.spendingGapThreshold as any);
  }
}
