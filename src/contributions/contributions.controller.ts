import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ContributionsService } from './contributions.service';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('contributions')
@UseGuards(JwtAuthGuard)
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateContributionDto) {
    return this.contributionsService.create(user.id, dto);
  }

  @Get('cycle/:colocationId')
  getCycleStatus(@Param('colocationId') colocationId: string) {
    return this.contributionsService.getCycleStatus(colocationId);
  }
}
