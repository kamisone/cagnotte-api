import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('colocations')
export class Colocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('decimal', { precision: 10, scale: 2, default: 5.0 })
  contributionAmount: number;

  @Column({ unique: true })
  inviteCode: string;

  @Column({ default: 1 })
  currentCycle: number;

  @CreateDateColumn()
  createdAt: Date;
}
