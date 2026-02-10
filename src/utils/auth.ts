import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, originalHash] = stored.split(":");
  if (!salt || !originalHash) {
    return false;
  }
  const hashed = scryptSync(password, salt, 64);
  const originalBuffer = Buffer.from(originalHash, "hex");
  if (originalBuffer.length !== hashed.length) {
    return false;
  }
  return timingSafeEqual(originalBuffer, hashed);
}

export function generateResetToken() {
  return randomBytes(32).toString("hex");
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
