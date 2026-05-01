import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { auditLogsController } from "./audit-logs.controller.js";

export const auditRouter = Router();
auditRouter.get("/", requireAuth, requireRole(Role.ADMIN), auditLogsController.list);
