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
  time: z.string().optional(),
  totalAmount: z.number(),
  photoUrl: z.string().url().optional(),
  items: z.array(CreateReceiptItemSchema),
});

export class CreateReceiptDto extends createZodDto(CreateReceiptSchema) {}
