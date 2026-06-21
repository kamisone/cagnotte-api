import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogArticle } from './entities/catalog-article.entity';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([CatalogArticle]), UsersModule],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
