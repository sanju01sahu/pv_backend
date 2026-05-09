import { Request, Response } from "express";
import { ContractStatus } from "@prisma/client";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.js";
import { contractsService } from "./contracts.service.js";
import { parseListQuery } from "../../lib/pagination.js";
import { sendApiResponse } from "../../lib/api-response.js";

const createSchema = z.object({
  solutionId: z.string().uuid(),
  customerDetails: z
    .object({
      name: z.string().min(2),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      site: z.string().optional(),
      city: z.string().optional()
    })
    .passthrough(),
  installationDate: z.coerce.date(),
  status: z.enum([ContractStatus.DRAFT, ContractStatus.ACTIVE, ContractStatus.COMPLETED, ContractStatus.CANCELLED]).default(ContractStatus.ACTIVE),
  agentId: z.string().uuid().optional()
});

export const contractsController = {
  async create(req: Request, res: Response) {
    const body = createSchema.parse(req.body);
    const user = (req as AuthRequest).user!;
    return sendApiResponse(
      res,
      "Contract created successfully.",
      await contractsService.createContract({ ...body, callerRole: user.role, callerUserId: user.userId }),
      201
    );
  },

  async list(req: Request, res: Response) {
    const user = (req as AuthRequest).user!;
    return sendApiResponse(
      res,
      "Contracts retrieved successfully.",
      await contractsService.listContracts(user.role, user.userId, parseListQuery(req.query))
    );
  }
};
