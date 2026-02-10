import { Router } from "express";
import { randomUUID } from "crypto";
import { UserModel } from "../models/User";
import { SessionModel } from "../models/Session";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { generateResetToken, hashPassword, hashResetToken, verifyPassword } from "../utils/auth";
import { isMongoDuplicate } from "../utils/mongo";
import { toPublicUser } from "../utils/serializers";
import {
  forgotPasswordSchema,
  formatZodErrors,
  loginSchema,
  resetPasswordSchema,
  signupSchema
} from "../validation/auth";
import { sendPasswordResetEmail } from "../utils/email";

const router = Router();

router.post("/auth/signup", async (req, res) => {
  try {
    const parsed = signupSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const { fieldErrors, formError } = formatZodErrors(parsed.error);
      res.status(400).json({ error: formError ?? "Invalid input", fieldErrors });
      return;
    }

    const { name, email, password, role, inviteCode } = parsed.data;

    if (role === "admin") {
      const requiredInvite = process.env.ADMIN_INVITE_CODE?.trim();
      if (!requiredInvite) {
        res.status(500).json({ error: "Admin invite not configured" });
        return;
      }
      if (inviteCode !== requiredInvite) {
        res.status(403).json({ error: "Invalid admin invite code" });
        return;
      }
    }

    const newUser = await UserModel.create({
      name,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      role
    });

    const token = await createSession(newUser._id);

    res.status(201).json({ token, user: toPublicUser(newUser) });
  } catch (err) {
    if (isMongoDuplicate(err)) {
      res.status(409).json({ error: "Email already in use" });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const { fieldErrors, formError } = formatZodErrors(parsed.error);
      res.status(400).json({ error: formError ?? "Invalid input", fieldErrors });
      return;
    }

    const { email, password } = parsed.data;
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = await createSession(user._id);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/logout", requireAuth, async (req, res) => {
  const token = getBearerToken(req);
  if (token) {
    await SessionModel.deleteOne({ token });
  }
  res.status(204).send();
});

router.post("/auth/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const { fieldErrors, formError } = formatZodErrors(parsed.error);
    res.status(400).json({ error: formError ?? "Invalid input", fieldErrors });
    return;
  }

  try {
    const email = parsed.data.email.toLowerCase();
    const user = await UserModel.findOne({ email });

    if (!user) {
      res.status(404).json({ error: "Email not registered" });
      return;
    }

    const token = generateResetToken();
    user.resetTokenHash = hashResetToken(token);
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const appBase = process.env.APP_BASE_URL?.replace(/\/$/, "") || "http://localhost:5173";
    const resetUrl = `${appBase}/?resetToken=${token}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (mailError) {
      console.error("Failed to send reset email", mailError);
    }

    res.json({ message: "Reset link sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const { fieldErrors, formError } = formatZodErrors(parsed.error);
    res.status(400).json({ error: formError ?? "Invalid input", fieldErrors });
    return;
  }

  try {
    const { token, password } = parsed.data;
    const tokenHash = hashResetToken(token);
    const user = await UserModel.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() }
    });

    if (!user) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    user.passwordHash = hashPassword(password);
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    await user.save();
    await SessionModel.deleteMany({ userId: user._id });

    res.json({ message: "Password updated. Please log in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: toPublicUser(req.user!) });
});

export default router;

async function createSession(userId: string | { toString(): string }) {
  const token = randomUUID();
  await SessionModel.create({ token, userId });
  return token;
}

function getBearerToken(req: { headers: { authorization?: string } }) {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return null;
  }
  return token;
}
