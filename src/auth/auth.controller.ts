import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { UpdateNameDto } from './dto/update-name.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register-admin')
  async registerAdmin(@Body() dto: RegisterDto) {
    return this.authService.register(dto, true);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    const payload = JSON.parse(
      Buffer.from(dto.refreshToken.split('.')[1], 'base64').toString(),
    );
    return this.authService.refreshTokens(payload.sub, dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: { id: string; email: string },
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.id, dto);
    return { message: 'Password changed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async completeProfile(
    @CurrentUser() user: { id: string; email: string },
    @Body() dto: CompleteProfileDto,
  ) {
    return this.authService.completeProfile(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateName(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateNameDto,
  ) {
    return this.authService.updateName(user.id, dto.name);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(@CurrentUser() user: { id: string }) {
    await this.authService.deleteAccount(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: { id: string; email: string }) {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser) {
      return null;
    }
    const { password, refreshToken, ...profile } = fullUser;
    return profile;
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('users/:userId/toggle-admin')
  async toggleAdmin(
    @CurrentUser() currentUser: { id: string },
    @Param('userId') userId: string,
  ) {
    if (userId === currentUser.id) {
      throw new ForbiddenException('Cannot change your own admin status');
    }
    const target = await this.usersService.findById(userId);
    if (!target) {
      throw new NotFoundException('User not found');
    }
    const newValue = !target.isAdmin;
    await this.usersService.update(userId, { isAdmin: newValue });
    return { isAdmin: newValue };
  }
}
