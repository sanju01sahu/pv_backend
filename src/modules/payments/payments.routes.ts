import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { paymentsController } from "./payments.controller.js";

export const paymentRouter = Router();
paymentRouter.post("/", requireAuth, requireRole(Role.ADMIN), paymentsController.create);
paymentRouter.post("/:id/transactions", requireAuth, requireRole(Role.ADMIN), paymentsController.addTransaction);
paymentRouter.get("/", requireAuth, requireRole(Role.ADMIN, Role.AREA_MANAGER), paymentsController.list);
