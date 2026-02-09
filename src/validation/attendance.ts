import { z } from "zod";

export const flagSchema = z.object({
  comment: z
    .string()
    .trim()
    .max(280, "Comment must be 280 characters or less")
    .optional()
});

export type FlagInput = z.infer<typeof flagSchema>;
