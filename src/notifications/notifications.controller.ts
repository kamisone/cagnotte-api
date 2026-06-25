import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { DeviceService } from './device.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly deviceService: DeviceService,
  ) {}

  @Get()
  findByUser(@CurrentUser() user: any) {
    return this.notificationsService.findByUser(user.id);
  }

  @Get('since/:lastId')
  findSince(@CurrentUser() user: any, @Param('lastId') lastId: string) {
    return this.notificationsService.findSince(user.id, lastId);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: any) {
    return this.notificationsService.countUnread(user.id).then((count) => ({ count }));
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markRead(id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllRead(user.id).then(() => ({ success: true }));
  }

  @Post('devices')
  registerDevice(@CurrentUser() user: any, @Body() dto: RegisterDeviceDto) {
    return this.deviceService.register(user.id, dto.platform, dto.fcmToken);
  }

  @Delete('devices/:token')
  unregisterDevice(@CurrentUser() user: any, @Param('token') token: string) {
    return this.deviceService.unregister(user.id, token).then(() => ({ success: true }));
  }
}
