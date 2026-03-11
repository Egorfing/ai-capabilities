import { z } from "zod";

export const createOrderSchema = z.object({
  customerId: z.string(),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number(),
      }),
    )
    .min(1),
  comment: z.string().optional(),
  status: z.enum(["draft", "confirmed"]),
});
