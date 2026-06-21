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
import { ColocationsService } from './colocations.service';
import { CreateColocationDto } from './dto/create-colocation.dto';
import { JoinColocationDto } from './dto/join-colocation.dto';
import { UpdateColocationDto } from './dto/update-colocation.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('colocations')
export class ColocationsController {
  constructor(private readonly colocationsService: ColocationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateColocationDto) {
    return this.colocationsService.create(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findByUser(@CurrentUser() user: any) {
    return this.colocationsService.findByUser(user.id);
  }

  @Post('join')
  join(@Body() dto: JoinColocationDto) {
    return this.colocationsService.joinAsGuest(dto.inviteCode);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/balance')
  getBalance(@Param('id') id: string) {
    return this.colocationsService.getBalance(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateColocationDto,
  ) {
    return this.colocationsService.update(id, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/members')
  addMember(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.colocationsService.createAndAddMember(id, user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.colocationsService.removeMember(id, user.id, userId);
  }
}
