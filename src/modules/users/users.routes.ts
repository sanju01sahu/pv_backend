import { Router } from "express";
import { Role } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { userController } from "./users.controller.js";

export const userRouter = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

userRouter.post("/login", loginLimiter, userController.login);
userRouter.post("/refresh", userController.refresh);
userRouter.post("/logout", userController.logout);
userRouter.post("/", requireAuth, requireRole(Role.ADMIN), userController.create);
userRouter.get("/", requireAuth, userController.list);
userRouter.patch("/:id", requireAuth, requireRole(Role.ADMIN), userController.update);
