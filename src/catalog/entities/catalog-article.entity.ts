import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Colocation } from '../../colocations/entities/colocation.entity';

@Entity('catalog_articles')
export class CatalogArticle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: 'divers' })
  category: string;

  @Column()
  colocationId: string;

  @ManyToOne(() => Colocation)
  @JoinColumn({ name: 'colocationId' })
  colocation: Colocation;

  @CreateDateColumn()
  createdAt: Date;
}
