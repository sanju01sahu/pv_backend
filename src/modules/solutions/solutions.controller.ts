import { Request, Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.js";
import { solutionsService } from "./solutions.service.js";
import { parseListQuery } from "../../lib/pagination.js";

const createSolutionSchema = z.object({ name: z.string().min(1) });
const createVersionSchema = z.object({
  price: z.coerce.number().positive(),
  baseCommission: z.coerce.number().nonnegative(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  retroactive: z.coerce.boolean().optional().default(false)
});

export const solutionsController = {
  async listSolutions(req: Request, res: Response) {
    return res.json(await solutionsService.listSolutions(parseListQuery(req.query)));
  },

  async createSolution(req: Request, res: Response) {
    const { name } = createSolutionSchema.parse(req.body);
    const performedBy = (req as AuthRequest).user!.userId;
    return res.status(201).json(await solutionsService.createSolution(name, performedBy));
  },

  async createVersion(req: Request, res: Response) {
    const body = createVersionSchema.parse(req.body);
    const createdBy = (req as AuthRequest).user!.userId;
    return res.status(201).json(
      await solutionsService.createVersion({ solutionId: String(req.params.id), ...body, createdBy })
    );
  },

  async listVersions(req: Request, res: Response) {
    return res.json(await solutionsService.listVersions(String(req.params.id), parseListQuery(req.query)));
  }
};
