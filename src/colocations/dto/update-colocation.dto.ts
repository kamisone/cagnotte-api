import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateColocationSchema = z.object({
  name: z.string().min(1).optional(),
  spendingGapThreshold: z.number().min(0).optional(),
  notificationsEnabled: z.boolean().optional(),
});

export class UpdateColocationDto extends createZodDto(UpdateColocationSchema) {}
