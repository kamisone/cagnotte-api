import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateColocationSchema = z.object({
  name: z.string().min(1).optional(),
  contributionAmount: z.number().positive().optional(),
  lowBalanceThreshold: z.number().min(0).optional(),
});

export class UpdateColocationDto extends createZodDto(UpdateColocationSchema) {}
