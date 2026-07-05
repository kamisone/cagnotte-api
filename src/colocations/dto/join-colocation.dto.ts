import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const JoinColocationSchema = z.object({
  inviteCode: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional(),
});

export class JoinColocationDto extends createZodDto(JoinColocationSchema) {}
