import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingItem } from './entities/shopping-item.entity';
import { ShoppingService } from './shopping.service';
import { ShoppingController } from './shopping.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingItem])],
  controllers: [ShoppingController],
  providers: [ShoppingService],
  exports: [ShoppingService],
})
export class ShoppingModule {}
