import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RegisterDeviceSchema = z.object({
  platform: z.enum(['android', 'ios']),
  fcmToken: z.string().min(1),
});

export class RegisterDeviceDto extends createZodDto(RegisterDeviceSchema) {}
