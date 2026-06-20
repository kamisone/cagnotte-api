import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Colocation } from '../../colocations/entities/colocation.entity';

@Entity('rotations')
export class Rotation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  weekStart: string;

  @Column({ type: 'date' })
  weekEnd: string;

  @Column()
  orderIndex: number;

  @Column({ default: 'upcoming' })
  status: string;

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
}
