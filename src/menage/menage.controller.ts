import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MenageService } from './menage.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('menage')
@UseGuards(JwtAuthGuard)
export class MenageController {
  constructor(private readonly menageService: MenageService) {}

  @Get(':colocationId')
  getCurrentWeek(@Param('colocationId') colocationId: string) {
    return this.menageService.getCurrentWeek(colocationId);
  }

  @Post(':colocationId/done')
  markDone(
    @CurrentUser() user: any,
    @Param('colocationId') colocationId: string,
    @Body() body: { comment?: string },
  ) {
    return this.menageService.markDone(colocationId, user.id, body?.comment);
  }

  @Post(':colocationId/sub-tasks')
  addSubTask(
    @CurrentUser() user: any,
    @Param('colocationId') colocationId: string,
    @Body() body: { text: string },
  ) {
    return this.menageService.addSubTask(colocationId, user.id, body?.text);
  }

  @Delete(':colocationId/done')
  @HttpCode(HttpStatus.NO_CONTENT)
  undoMark(
    @CurrentUser() user: any,
    @Param('colocationId') colocationId: string,
  ) {
    return this.menageService.undoMark(colocationId, user.id);
  }

  @Patch(':colocationId/task-description')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateTaskDescription(
    @Param('colocationId') colocationId: string,
    @Body() body: { description: string },
  ) {
    return this.menageService.updateTaskDescription(colocationId, body.description);
  }

  @Patch(':colocationId/sub-task-limit')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  updateSubTaskLimit(
    @Param('colocationId') colocationId: string,
    @Body() body: { limit: number },
  ) {
    return this.menageService.updateSubTaskLimit(colocationId, body.limit);
  }
}
