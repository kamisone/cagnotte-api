import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: '#17A877' })
  colorHex: string;

  @Column({ length: 2 })
  initial: string;

  @Column({ default: false })
  isAdmin: boolean;

  @Column({ default: false })
  isSuperAdmin: boolean;

  @Column({ default: true })
  profileCompleted: boolean;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ type: 'timestamp', nullable: true, default: null })
  suspendedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  anonymizedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
