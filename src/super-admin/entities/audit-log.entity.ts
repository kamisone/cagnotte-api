import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type AuditAction =
  | 'BOOTSTRAP'
  | 'DELETE_USER'
  | 'ANONYMIZE_USER'
  | 'DELETE_COLOCATION'
  | 'SUSPEND_USER'
  | 'ACTIVATE_USER'
  | 'SUSPEND_COLOCATION'
  | 'ACTIVATE_COLOCATION'
  | 'BROADCAST_NOTIFICATION'
  | 'CHANGE_ROLE';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: AuditAction;

  @Column()
  targetType: string;

  @Column({ nullable: true })
  targetId: string;

  @Column({ nullable: true })
  targetName: string;

  @Column()
  actorId: string;

  @Column()
  actorName: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
