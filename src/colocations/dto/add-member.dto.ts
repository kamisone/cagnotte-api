import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const AddMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  colorHex: z.string().optional(),
});

export class AddMemberDto extends createZodDto(AddMemberSchema) {}
