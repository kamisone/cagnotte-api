import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogArticle } from './entities/catalog-article.entity';
import { CreateCatalogArticleDto } from './dto/create-catalog-article.dto';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(CatalogArticle)
    private readonly repo: Repository<CatalogArticle>,
  ) {}

  findByColocation(colocationId: string): Promise<CatalogArticle[]> {
    return this.repo.find({
      where: { colocationId },
      order: { name: 'ASC' },
    });
  }

  create(dto: CreateCatalogArticleDto): Promise<CatalogArticle> {
    const article = this.repo.create({
      name: dto.name,
      category: dto.category ?? 'divers',
      colocationId: dto.colocationId,
    });
    return this.repo.save(article);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
