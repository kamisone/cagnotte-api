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
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('receipts')
@UseGuards(JwtAuthGuard)
export class ReceiptsController {
  constructor(private readonly receiptsService: ReceiptsService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateReceiptDto) {
    return this.receiptsService.create(user.id, dto);
  }

  @Get(':colocationId')
  findByColocation(@Param('colocationId') colocationId: string) {
    return this.receiptsService.findByColocation(colocationId);
  }

  @Get(':colocationId/articles/stats')
  getArticleStats(@Param('colocationId') colocationId: string) {
    return this.receiptsService.getArticleStats(colocationId);
  }

  @Get(':colocationId/articles')
  getArticleCatalog(@Param('colocationId') colocationId: string) {
    return this.receiptsService.getArticleCatalog(colocationId);
  }

  @Get(':colocationId/stats')
  getStats(@Param('colocationId') colocationId: string) {
    return this.receiptsService.getStats(colocationId);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.receiptsService.remove(id);
  }
}
