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
import { MenageService } from './menage.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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

  @Delete(':colocationId/done')
  @HttpCode(HttpStatus.NO_CONTENT)
  undoMark(
    @CurrentUser() user: any,
    @Param('colocationId') colocationId: string,
  ) {
    return this.menageService.undoMark(colocationId, user.id);
  }
}
