import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { bonusesController } from "./bonuses.controller.js";

export const bonusRouter = Router();
bonusRouter.post("/run-monthly", requireAuth, requireRole(Role.ADMIN), bonusesController.runMonthly);
