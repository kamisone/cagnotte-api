import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const JoinColocationSchema = z.object({
  inviteCode: z.string(),
});

export class JoinColocationDto extends createZodDto(JoinColocationSchema) {}
