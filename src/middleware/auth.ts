import type { NextFunction, Request, Response } from "express";
import type { Role } from "../types";
import { SessionModel } from "../models/Session";
import { UserModel, type UserDocument } from "../models/User";

export type AuthedRequest = Request & { user?: UserDocument };

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Missing auth token" });
      return;
    }
    const session = await SessionModel.findOne({ token });
    if (!session) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }
    const user = await UserModel.findById(session.userId);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}

export function requireRole(role: Role) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

function getBearerToken(req: Request) {
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
