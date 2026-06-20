import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Colocation } from './colocation.entity';

@Entity('colocation_members')
@Unique(['userId', 'colocationId'])
export class ColocationMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'member' })
  role: string;

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

  @CreateDateColumn()
  joinedAt: Date;
}
