import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const SwapRotationSchema = z.object({
  myRotationId: z.string().uuid(),
  theirRotationId: z.string().uuid(),
});

export class SwapRotationDto extends createZodDto(SwapRotationSchema) {}
