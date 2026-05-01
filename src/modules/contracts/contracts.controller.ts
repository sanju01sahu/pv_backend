import { Request, Response } from "express";
import { ContractStatus } from "@prisma/client";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.js";
import { contractsService } from "./contracts.service.js";

const createSchema = z.object({
  solutionId: z.string().uuid(),
  customerDetails: z.any(),
  installationDate: z.coerce.date(),
  status: z.enum([ContractStatus.DRAFT, ContractStatus.ACTIVE, ContractStatus.COMPLETED, ContractStatus.CANCELLED]).default(ContractStatus.ACTIVE),
  agentId: z.string().uuid().optional()
});

export const contractsController = {
  async create(req: Request, res: Response) {
    const body = createSchema.parse(req.body);
    const user = (req as AuthRequest).user!;
    return res.status(201).json(await contractsService.createContract({ ...body, callerRole: user.role, callerUserId: user.userId }));
  },

  async list(req: Request, res: Response) {
    const user = (req as AuthRequest).user!;
    return res.json(await contractsService.listContracts(user.role, user.userId));
  }
};
