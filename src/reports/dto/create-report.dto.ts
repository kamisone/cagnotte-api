import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateReportSchema = z.object({
  colocationId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum([
    'cleaning',
    'safety',
    'maintenance',
    'information',
    'other',
  ]),
  photoUrls: z.array(z.string()).optional(),
});

export class CreateReportDto extends createZodDto(CreateReportSchema) {}
