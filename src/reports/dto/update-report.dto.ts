import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateReportSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  photoUrls: z.array(z.string()).optional().nullable(),
});

export class UpdateReportDto extends createZodDto(UpdateReportSchema) {}
