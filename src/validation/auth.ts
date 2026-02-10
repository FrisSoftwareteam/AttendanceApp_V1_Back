import { z } from "zod";
import type { Role } from "../types";

const roleSchema = z.enum(["user", "admin"]);

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
    email: z.string().trim().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(64, "Password must be at most 64 characters"),
    role: roleSchema,
    inviteCode: z.string().trim().optional()
  })
  .superRefine((data, ctx) => {
    if (data.role === "admin" && !data.inviteCode) {
      ctx.addIssue({
        path: ["inviteCode"],
        code: z.ZodIssueCode.custom,
        message: "Admin invite code is required"
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email")
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Invalid reset token"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(64, "Password must be at most 64 characters")
});

export type SignupInput = z.infer<typeof signupSchema> & { role: Role };
export type LoginInput = z.infer<typeof loginSchema>;

export function formatZodErrors(error: z.ZodError) {
  const flattened = error.flatten();
  const fieldErrors: Record<string, string> = {};
  for (const [field, messages] of Object.entries(flattened.fieldErrors)) {
    if (messages && messages.length > 0) {
      fieldErrors[field] = messages[0] ?? "Invalid value";
    }
  }
  const formError = flattened.formErrors[0];
  return {
    fieldErrors,
    formError
  };
}
