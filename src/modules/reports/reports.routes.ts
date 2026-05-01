import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { reportsController } from "./reports.controller.js";

export const reportRouter = Router();
reportRouter.get("/monthly-earnings", requireAuth, requireRole(Role.ADMIN, Role.AREA_MANAGER), reportsController.monthlyEarnings);
reportRouter.get("/manager-network-performance", requireAuth, requireRole(Role.ADMIN), reportsController.managerNetworkPerformance);
reportRouter.get("/payments-summary", requireAuth, requireRole(Role.ADMIN), reportsController.paymentSummary);
reportRouter.get("/bonus-summary", requireAuth, requireRole(Role.ADMIN, Role.AREA_MANAGER), reportsController.bonusSummary);
