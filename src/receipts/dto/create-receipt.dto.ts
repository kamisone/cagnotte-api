import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateReceiptItemSchema = z.object({
  name: z.string(),
  price: z.number(),
  quantity: z.number().optional(),
  category: z.string().optional(),
});

const CreateReceiptSchema = z.object({
  colocationId: z.string(),
  store: z.string(),
  date: z.string(),
  totalAmount: z.number(),
  items: z.array(CreateReceiptItemSchema),
});

export class CreateReceiptDto extends createZodDto(CreateReceiptSchema) {}
