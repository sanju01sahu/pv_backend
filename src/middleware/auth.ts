import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/auth.js";

export type RequestUser = { userId: string; role: "ADMIN" | "AREA_MANAGER" | "AGENT" };

export type AuthRequest = Request & { user?: RequestUser };

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authorization token is required. Provide a valid Bearer token." });
  }
  try {
    req.user = verifyAccessToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ message: "Access token is invalid or expired. Please login again." });
  }
};

export const requireRole = (...roles: RequestUser["role"][]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "You do not have permission to perform this action." });
  }
  next();
};
