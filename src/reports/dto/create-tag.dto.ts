import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateTagSchema = z.object({
  title: z.string().min(1),
  color: z.string().min(1),
  colocationId: z.string().uuid(),
});

export class CreateTagDto extends createZodDto(CreateTagSchema) {}
