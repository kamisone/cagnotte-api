import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateShoppingItemSchema = z.object({
  name: z.string(),
  quantity: z.number().optional(),
  assigneeId: z.string().uuid().optional(),
  colocationId: z.string().uuid(),
});

export class CreateShoppingItemDto extends createZodDto(CreateShoppingItemSchema) {}
