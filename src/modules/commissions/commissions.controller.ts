import { Request, Response } from "express";
import { z } from "zod";
import { commissionsService } from "./commissions.service.js";
import { AuthRequest } from "../../middleware/auth.js";
import { parseListQuery } from "../../lib/pagination.js";
import { sendApiResponse } from "../../lib/api-response.js";

export const commissionsController = {
  async list(req: Request, res: Response) {
    return sendApiResponse(
      res,
      "Commissions retrieved successfully.",
      await commissionsService.listAll(parseListQuery(req.query))
    );
  },

  async listByUser(req: Request, res: Response) {
    return sendApiResponse(
      res,
      "User commissions retrieved successfully.",
      await commissionsService.listByUser(String(req.params.userId), parseListQuery(req.query))
    );
  },

  async runMonthlyBonus(req: Request, res: Response) {
    const body = z.object({ year: z.coerce.number().int().min(2000), month: z.coerce.number().int().min(1).max(12) }).parse(req.body);
    const performedBy = (req as AuthRequest).user!.userId;
    const result = await commissionsService.runMonthlyBonus(body.year, body.month, performedBy);
    return sendApiResponse(res, "Monthly bonus run completed successfully.", result);
  }
};
