import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateCatalogArticleDto } from './dto/create-catalog-article.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get(':colocationId')
  findByColocation(@Param('colocationId') colocationId: string) {
    return this.catalogService.findByColocation(colocationId);
  }

  @Get(':colocationId/categories')
  findCategories(@Param('colocationId') colocationId: string) {
    return this.catalogService.findCategories(colocationId);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateCatalogArticleDto) {
    return this.catalogService.create(dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.catalogService.remove(id);
  }
}
