import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateColocationSchema = z.object({
  name: z.string(),
  contributionAmount: z.number().optional(),
});

export class CreateColocationDto extends createZodDto(CreateColocationSchema) {}
