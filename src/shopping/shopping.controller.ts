import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ShoppingService } from './shopping.service';
import { CreateShoppingItemDto } from './dto/create-shopping-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('shopping')
@UseGuards(JwtAuthGuard)
export class ShoppingController {
  constructor(private readonly shoppingService: ShoppingService) {}

  @Get(':colocationId')
  findByColocation(@Param('colocationId') colocationId: string) {
    return this.shoppingService.findByColocation(colocationId);
  }

  @Post()
  create(@Body() dto: CreateShoppingItemDto) {
    return this.shoppingService.create(dto);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @CurrentUser() user: any) {
    return this.shoppingService.toggle(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shoppingService.remove(id);
  }
}
