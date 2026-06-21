import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateCatalogArticleSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  colocationId: z.string().uuid(),
});

export class CreateCatalogArticleDto extends createZodDto(CreateCatalogArticleSchema) {}
