import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { commissionsController } from "./commissions.controller.js";

export const commissionRouter = Router();
export const bonusRouter = Router();

commissionRouter.get("/", requireAuth, requireRole(Role.ADMIN, Role.AREA_MANAGER), commissionsController.list);
commissionRouter.get("/:userId", requireAuth, commissionsController.listByUser);
bonusRouter.post("/run-monthly", requireAuth, requireRole(Role.ADMIN), commissionsController.runMonthlyBonus);
