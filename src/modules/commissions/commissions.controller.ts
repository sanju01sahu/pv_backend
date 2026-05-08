import { Request, Response } from "express";
import { z } from "zod";
import { commissionsService } from "./commissions.service.js";
import { AuthRequest } from "../../middleware/auth.js";
import { parseListQuery } from "../../lib/pagination.js";

export const commissionsController = {
  async list(req: Request, res: Response) {
    return res.json(await commissionsService.listAll(parseListQuery(req.query)));
  },

  async listByUser(req: Request, res: Response) {
    return res.json(await commissionsService.listByUser(String(req.params.userId), parseListQuery(req.query)));
  },

  async runMonthlyBonus(req: Request, res: Response) {
    const body = z.object({ year: z.coerce.number().int().min(2000), month: z.coerce.number().int().min(1).max(12) }).parse(req.body);
    const performedBy = (req as AuthRequest).user!.userId;
    const created = await commissionsService.runMonthlyBonus(body.year, body.month, performedBy);
    return res.json({ createdCount: created.length, created });
  }
};
