import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateReportCommentSchema = z.object({
  content: z.string().min(1),
});

export class CreateReportCommentDto extends createZodDto(
  CreateReportCommentSchema,
) {}
