import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CompleteProfileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  colorHex: z.string().optional(),
  phone: z.string().optional(),
});

export class CompleteProfileDto extends createZodDto(CompleteProfileSchema) {}
