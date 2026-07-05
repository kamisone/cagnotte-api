import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SuperAdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(SuperAdminSeeder.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const name = process.env.SUPER_ADMIN_NAME ?? 'Super Admin';

    if (!email || !password) {
      this.logger.warn('SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set — skipping super-admin seed');
      return;
    }

    // Already have a super-admin → nothing to do
    const existing = await this.userRepo.findOne({ where: { isSuperAdmin: true } });
    if (existing) {
      this.logger.log(`Super-admin already exists (${existing.email}) — skipping seed`);
      return;
    }

    // User with that email already exists → just promote them
    const byEmail = await this.userRepo.findOne({ where: { email } });
    if (byEmail) {
      await this.userRepo.update(byEmail.id, { isSuperAdmin: true });
      this.logger.log(`Promoted existing user ${email} to super-admin`);
      return;
    }

    // Create a fresh super-admin account
    const initial = this.buildInitial(name);
    const hashed = await bcrypt.hash(password, 10);

    await this.userRepo.save(
      this.userRepo.create({
        email,
        password: hashed,
        name,
        initial,
        colorHex: '#17A877',
        isAdmin: false,
        isSuperAdmin: true,
        profileCompleted: true,
      }),
    );

    this.logger.log(`Super-admin account created for ${email}`);
  }

  private buildInitial(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
}