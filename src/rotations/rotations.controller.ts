import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RotationsService } from './rotations.service';
import { SwapRotationDto } from './dto/swap-rotation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('rotations')
@UseGuards(JwtAuthGuard)
export class RotationsController {
  constructor(private readonly rotationsService: RotationsService) {}

  @Get(':colocationId')
  findByColocation(@Param('colocationId') colocationId: string) {
    return this.rotationsService.findByColocation(colocationId);
  }

  @Post(':colocationId/generate')
  generate(@Param('colocationId') colocationId: string) {
    return this.rotationsService.generate(colocationId);
  }

  @Patch('swap')
  swap(@Body() dto: SwapRotationDto) {
    return this.rotationsService.swap(dto.myRotationId, dto.theirRotationId);
  }
}
