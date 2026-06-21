import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { ColocationMember } from '../colocations/entities/colocation-member.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(ColocationMember)
    private readonly memberRepository: Repository<ColocationMember>,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const plainPassword = dto.password ?? crypto.randomBytes(9).toString('base64url');
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const initial = dto.name[0].toUpperCase();

    const user = await this.usersService.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      phone: dto.phone,
      colorHex: dto.colorHex,
      initial,
    });

    const { password, refreshToken, ...profile } = user;
    return {
      user: profile,
      generatedPassword: dto.password ? null : plainPassword,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    return tokens;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const passwordValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(userId, hashedPassword);
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshToken) {
      throw new ForbiddenException('Access denied');
    }

    const tokenMatches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!tokenMatches) {
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.generateTokens(user.id, user.email);
    return tokens;
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.memberRepository.delete({ userId });
    await this.usersService.delete(userId);
  }

  async completeProfile(userId: string, dto: CompleteProfileDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing && existing.id !== userId) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.usersService.update(userId, {
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      colorHex: dto.colorHex,
      phone: dto.phone,
      initial: dto.name[0].toUpperCase(),
      profileCompleted: true,
    });

    const tokens = await this.generateTokens(userId, dto.email);
    return tokens;
  }

  async updateName(userId: string, name: string) {
    await this.usersService.update(userId, {
      name,
      initial: name[0].toUpperCase(),
    });
    const user = await this.usersService.findById(userId);
    const { password, refreshToken, ...profile } = user;
    return profile;
  }

  async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(userId, hashedRefreshToken);

    return { accessToken, refreshToken };
  }
}
