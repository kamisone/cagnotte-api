import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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

  @Get(':colocationId/stats')
  getStats(@Param('colocationId') colocationId: string) {
    return this.receiptsService.getStats(colocationId);
  }
}
