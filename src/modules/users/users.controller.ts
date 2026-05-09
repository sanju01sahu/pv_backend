import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { userService } from "./users.service.js";
import { AuthRequest } from "../../middleware/auth.js";
import { parseListQuery } from "../../lib/pagination.js";
import { sendApiResponse } from "../../lib/api-response.js";

const loginSchema = z.object({ email: z.string().email(), password: z.string() });
const refreshSchema = z.object({ refreshToken: z.string().min(20) });
const passwordSchema = z
  .string()
  .min(12)
  .regex(/[A-Z]/, "Password must include uppercase letter")
  .regex(/[a-z]/, "Password must include lowercase letter")
  .regex(/[0-9]/, "Password must include number")
  .regex(/[^A-Za-z0-9]/, "Password must include special character");
const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: passwordSchema,
  role: z.enum([Role.ADMIN, Role.AREA_MANAGER, Role.AGENT]),
  managerId: z.string().uuid().optional()
});
const patchSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    role: z.enum([Role.ADMIN, Role.AREA_MANAGER, Role.AGENT]).optional(),
    managerId: z.string().uuid().nullable().optional(),
    password: passwordSchema.optional()
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.email !== undefined ||
      value.role !== undefined ||
      value.managerId !== undefined ||
      value.password !== undefined,
    { message: "At least one field is required for update." }
  );

export const userController = {
  async login(req: Request, res: Response) {
    const { email, password } = loginSchema.parse(req.body);
    const result = await userService.login(email, password, req.ip);
    if (result && "locked" in result) {
      return res.status(423).json({
        message: "Login blocked due to multiple failed attempts. Try again after lockout ends.",
        lockedUntil: result.lockedUntil
      });
    }
    if (!result) return res.status(401).json({ message: "Invalid email or password. Please try again." });
    return sendApiResponse(res, "Login successful.", result);
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = refreshSchema.parse(req.body);
    const next = await userService.refresh(refreshToken);
    if (!next) return res.status(401).json({ message: "Refresh token is invalid, expired, or already revoked." });
    return sendApiResponse(res, "Session refreshed successfully.", next);
  },

  async logout(req: Request, res: Response) {
    const { refreshToken } = refreshSchema.parse(req.body);
    await userService.logout(refreshToken);
    return sendApiResponse(res, "Logout completed. The refresh token was revoked if it existed.", undefined, 204);
  },

  async create(req: Request, res: Response) {
    const body = createSchema.parse(req.body);
    const user = await userService.createUser(body);
    return sendApiResponse(res, "User account created successfully.", user, 201);
  },

  async list(req: Request, res: Response) {
    return sendApiResponse(res, "Users retrieved successfully.", await userService.listUsers(parseListQuery(req.query)));
  },

  async update(req: Request, res: Response) {
    const patch = patchSchema.parse(req.body);
    const performedBy = (req as AuthRequest).user!.userId;
    return sendApiResponse(res, "User updated successfully.", await userService.updateUser(String(req.params.id), patch, performedBy));
  }
};
