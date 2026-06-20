import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateContributionSchema = z.object({
  colocationId: z.string().uuid(),
  amount: z.number().optional(),
});

export class CreateContributionDto extends createZodDto(CreateContributionSchema) {}
