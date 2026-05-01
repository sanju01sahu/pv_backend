import { Request, Response } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { userService } from "./users.service.js";
import { AuthRequest } from "../../middleware/auth.js";

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
const patchSchema = z.object({ name: z.string().optional(), managerId: z.string().uuid().nullable().optional() });

export const userController = {
  async login(req: Request, res: Response) {
    const { email, password } = loginSchema.parse(req.body);
    const result = await userService.login(email, password, req.ip);
    if (result && "locked" in result) return res.status(423).json({ message: "Account temporarily locked", lockedUntil: result.lockedUntil });
    if (!result) return res.status(401).json({ message: "Invalid credentials" });
    return res.json(result);
  },

  async refresh(req: Request, res: Response) {
    const { refreshToken } = refreshSchema.parse(req.body);
    const next = await userService.refresh(refreshToken);
    if (!next) return res.status(401).json({ message: "Invalid refresh token" });
    return res.json(next);
  },

  async logout(req: Request, res: Response) {
    const { refreshToken } = refreshSchema.parse(req.body);
    await userService.logout(refreshToken);
    return res.status(204).send();
  },

  async create(req: Request, res: Response) {
    const body = createSchema.parse(req.body);
    const user = await userService.createUser(body);
    return res.status(201).json(user);
  },

  async list(_req: Request, res: Response) {
    return res.json(await userService.listUsers());
  },

  async update(req: Request, res: Response) {
    const patch = patchSchema.parse(req.body);
    const performedBy = (req as AuthRequest).user!.userId;
    return res.json(await userService.updateUser(String(req.params.id), patch, performedBy));
  }
};
