import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateNameSchema = z.object({
  name: z.string().min(1).max(50),
});

export class UpdateNameDto extends createZodDto(UpdateNameSchema) {}
