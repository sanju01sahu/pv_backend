import { Request, Response } from "express";
import { z } from "zod";
import { bonusesService } from "./bonuses.service.js";
import { AuthRequest } from "../../middleware/auth.js";
import { sendApiResponse } from "../../lib/api-response.js";

export const bonusesController = {
  async runMonthly(req: Request, res: Response) {
    const body = z.object({ year: z.coerce.number().int().min(2000), month: z.coerce.number().int().min(1).max(12) }).parse(req.body);
    const performedBy = (req as AuthRequest).user!.userId;
    const result = await bonusesService.runMonthlyBonus(body.year, body.month, performedBy);
    return sendApiResponse(res, "Monthly bonus run completed successfully.", result);
  }
};
