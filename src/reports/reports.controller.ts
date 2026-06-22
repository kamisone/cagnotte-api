import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { CreateReportCommentDto } from './dto/create-report-comment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':colocationId')
  findByColocation(
    @Param('colocationId') colocationId: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
  ) {
    return this.reportsService.findByColocation(colocationId, {
      status,
      category,
    });
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.id, dto);
  }

  @Get(':id/detail')
  findOne(@Param('id') id: string) {
    return this.reportsService.findOneWithComments(id);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    return this.reportsService.updateStatus(id, user.id, dto.status);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateReportCommentDto,
  ) {
    return this.reportsService.addComment(id, user.id, dto);
  }
}
