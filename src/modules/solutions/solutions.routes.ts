import { Router } from "express";
import { Role } from "@prisma/client";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { solutionsController } from "./solutions.controller.js";

export const solutionRouter = Router();
solutionRouter.get("/", requireAuth, solutionsController.listSolutions);
solutionRouter.post("/", requireAuth, requireRole(Role.ADMIN), solutionsController.createSolution);
solutionRouter.post("/:id/version", requireAuth, requireRole(Role.ADMIN), solutionsController.createVersion);
solutionRouter.get("/:id/versions", requireAuth, solutionsController.listVersions);
