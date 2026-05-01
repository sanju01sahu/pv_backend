import jwt from "jsonwebtoken";
import crypto from "crypto";

const accessSecret = process.env.JWT_SECRET || "change-me";
const refreshSecret = process.env.JWT_REFRESH_SECRET || "change-refresh-me";
const issuer = process.env.JWT_ISSUER || "pv-sales-platform";
const audience = process.env.JWT_AUDIENCE || "pv-sales-api";

export type AuthToken = {
  userId: string;
  role: "ADMIN" | "AREA_MANAGER" | "AGENT";
};

export const signAccessToken = (payload: AuthToken) =>
  jwt.sign(payload, accessSecret, { expiresIn: "15m", issuer, audience });

export const signRefreshToken = (payload: AuthToken) =>
  jwt.sign(payload, refreshSecret, { expiresIn: "30d", issuer, audience, jwtid: crypto.randomUUID() });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, accessSecret, { issuer, audience }) as AuthToken;

export const verifyRefreshToken = (token: string) =>
  jwt.verify(token, refreshSecret, { issuer, audience }) as AuthToken;

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
