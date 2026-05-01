import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { contractsController } from "./contracts.controller.js";

export const contractRouter = Router();
contractRouter.post("/", requireAuth, contractsController.create);
contractRouter.get("/", requireAuth, contractsController.list);
