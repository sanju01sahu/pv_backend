import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/auth.js";

export type RequestUser = { userId: string; role: "ADMIN" | "AREA_MANAGER" | "AGENT" };

export type AuthRequest = Request & { user?: RequestUser };

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireRole = (...roles: RequestUser["role"][]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: "Forbidden" });
  next();
};
