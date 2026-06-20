import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ColocationsService } from './colocations.service';
import { CreateColocationDto } from './dto/create-colocation.dto';
import { JoinColocationDto } from './dto/join-colocation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('colocations')
@UseGuards(JwtAuthGuard)
export class ColocationsController {
  constructor(private readonly colocationsService: ColocationsService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateColocationDto) {
    return this.colocationsService.create(user.id, dto);
  }

  @Get('mine')
  findByUser(@CurrentUser() user: any) {
    return this.colocationsService.findByUser(user.id);
  }

  @Post('join')
  join(@CurrentUser() user: any, @Body() dto: JoinColocationDto) {
    return this.colocationsService.join(user.id, dto.inviteCode);
  }

  @Get(':id/balance')
  getBalance(@Param('id') id: string) {
    return this.colocationsService.getBalance(id);
  }
}
