import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';

@Controller('super-admin')
@UseGuards(JwtAuthGuard)
export class SuperAdminController {
  constructor(
    private readonly superAdminService: SuperAdminService,
    private readonly usersService: UsersService,
  ) {}

  @Post('bootstrap')
  async bootstrap(@CurrentUser() user: { id: string }, @Body('secret') secret: string) {
    await this.superAdminService.bootstrap(user.id, secret);
    return { ok: true };
  }

  @UseGuards(SuperAdminGuard)
  @Get('overview')
  getOverview() { return this.superAdminService.getOverview(); }

  @UseGuards(SuperAdminGuard)
  @Get('analytics')
  getAnalytics(@Query('period') period: 'week' | 'month' | '3months' = 'month') {
    return this.superAdminService.getAnalytics(period);
  }

  @UseGuards(SuperAdminGuard)
  @Get('colocations')
  getColocations(@Query('search') search?: string, @Query('status') status?: 'active' | 'suspended') {
    return this.superAdminService.getColocations(search, status);
  }

  @UseGuards(SuperAdminGuard)
  @Post('colocations/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendColocation(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    const u = await this.usersService.findById(actor.id);
    await this.superAdminService.suspendColocation(id, actor.id, u.name);
    return { ok: true };
  }

  @UseGuards(SuperAdminGuard)
  @Post('colocations/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activateColocation(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    const u = await this.usersService.findById(actor.id);
    await this.superAdminService.activateColocation(id, actor.id, u.name);
    return { ok: true };
  }

  @UseGuards(SuperAdminGuard)
  @Delete('colocations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteColocation(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    const u = await this.usersService.findById(actor.id);
    return this.superAdminService.deleteColocation(id, actor.id, u.name);
  }

  @UseGuards(SuperAdminGuard)
  @Get('users')
  getUsers(
    @Query('search') search?: string,
    @Query('role') role?: 'admin' | 'super_admin' | 'member',
    @Query('status') status?: 'active' | 'suspended',
  ) { return this.superAdminService.getUsers(search, role, status); }

  @UseGuards(SuperAdminGuard)
  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendUser(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    const u = await this.usersService.findById(actor.id);
    await this.superAdminService.suspendUser(id, actor.id, u.name);
    return { ok: true };
  }

  @UseGuards(SuperAdminGuard)
  @Post('users/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activateUser(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    const u = await this.usersService.findById(actor.id);
    await this.superAdminService.activateUser(id, actor.id, u.name);
    return { ok: true };
  }

  @UseGuards(SuperAdminGuard)
  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string, @CurrentUser() actor: { id: string }) {
    const u = await this.usersService.findById(actor.id);
    return this.superAdminService.deleteUser(id, actor.id, u.name);
  }

  @UseGuards(SuperAdminGuard)
  @Get('reports')
  getReports(@Query('search') search?: string, @Query('colocationId') colocationId?: string, @Query('page') page?: string) {
    return this.superAdminService.getReports(search, colocationId, page ? parseInt(page, 10) : 1);
  }

  @UseGuards(SuperAdminGuard)
  @Get('notifications')
  getNotifications(@Query('type') type?: string, @Query('page') page?: string) {
    return this.superAdminService.getNotificationHistory(type, page ? parseInt(page, 10) : 1);
  }

  @UseGuards(SuperAdminGuard)
  @Post('notifications/broadcast')
  async broadcast(
    @CurrentUser() actor: { id: string },
    @Body() dto: { title: string; message: string; colocationId?: string },
  ) {
    const u = await this.usersService.findById(actor.id);
    return this.superAdminService.broadcastNotification(actor.id, u.name, dto.title, dto.message, dto.colocationId);
  }

  @UseGuards(SuperAdminGuard)
  @Get('audit-logs')
  getAuditLogs(@Query('action') action?: string, @Query('page') page?: string) {
    return this.superAdminService.getAuditLogs(action, page ? parseInt(page, 10) : 1);
  }
}
