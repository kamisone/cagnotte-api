import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateReportStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved']),
});

export class UpdateReportStatusDto extends createZodDto(
  UpdateReportStatusSchema,
) {}
