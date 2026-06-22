import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { CreateReportCommentDto } from './dto/create-report-comment.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get(':colocationId')
  findByColocation(
    @Param('colocationId') colocationId: string,
    @Query('tag') tag?: string,
  ) {
    return this.reportsService.findByColocation(colocationId, { tag });
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateReportDto) {
    return this.reportsService.create(user.id, dto);
  }

  @Get(':id/detail')
  findOne(@Param('id') id: string) {
    return this.reportsService.findOneWithComments(id);
  }

  @Post(':id/comments')
  addComment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateReportCommentDto,
  ) {
    return this.reportsService.addComment(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.reportsService.remove(id);
  }

  @Get('tags/:colocationId')
  findTags(@Param('colocationId') colocationId: string) {
    return this.reportsService.findTagsByColocation(colocationId);
  }

  @Post('tags')
  @UseGuards(AdminGuard)
  createTag(@Body() dto: CreateTagDto) {
    return this.reportsService.createTag(dto);
  }

  @Delete('tags/:id')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTag(@Param('id') id: string) {
    return this.reportsService.removeTag(id);
  }
}
