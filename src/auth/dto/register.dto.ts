import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string(),
  phone: z.string().optional(),
  colorHex: z.string().optional(),
});

export class RegisterDto extends createZodDto(RegisterSchema) {}
