import { z } from "zod";

export const cutoffSchema = z.object({
  cutoffTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Cutoff time must be HH:mm")
});

export type CutoffInput = z.infer<typeof cutoffSchema>;
