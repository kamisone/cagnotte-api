import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Device } from './entities/device.entity';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

  async register(userId: string, platform: string, fcmToken: string): Promise<Device> {
    let device = await this.deviceRepository.findOne({ where: { fcmToken } });
    if (device) {
      device.userId = userId;
      device.platform = platform;
      device.isActive = true;
      device.lastSeenAt = new Date();
      return this.deviceRepository.save(device);
    }
    device = this.deviceRepository.create({
      userId,
      platform,
      fcmToken,
      isActive: true,
      lastSeenAt: new Date(),
    });
    return this.deviceRepository.save(device);
  }

  async unregister(userId: string, fcmToken: string): Promise<void> {
    await this.deviceRepository.update({ userId, fcmToken }, { isActive: false });
  }

  async getActiveTokensForUser(userId: string): Promise<string[]> {
    const devices = await this.deviceRepository.find({
      where: { userId, isActive: true },
    });
    return devices.map((d) => d.fcmToken);
  }

  async getActiveTokensForUsers(userIds: string[]): Promise<string[]> {
    if (userIds.length === 0) return [];
    const devices = await this.deviceRepository.find({
      where: { userId: In(userIds), isActive: true },
    });
    return devices.map((d) => d.fcmToken);
  }

  async deactivateStaleTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.deviceRepository.update({ fcmToken: In(tokens) }, { isActive: false });
  }
}
