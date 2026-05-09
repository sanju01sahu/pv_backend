import { Request, Response } from "express";
import { reportsService } from "./reports.service.js";
import { sendApiResponse } from "../../lib/api-response.js";

export const reportsController = {
  async monthlyEarnings(req: Request, res: Response) {
    return sendApiResponse(
      res,
      "Monthly earnings report retrieved successfully.",
      await reportsService.monthlyEarnings(Number(req.query.year), Number(req.query.month))
    );
  },

  async managerNetworkPerformance(_req: Request, res: Response) {
    return sendApiResponse(
      res,
      "Manager network performance report retrieved successfully.",
      await reportsService.managerNetworkPerformance()
    );
  },

  async paymentSummary(_req: Request, res: Response) {
    return sendApiResponse(
      res,
      "Payment summary report retrieved successfully.",
      await reportsService.paymentSummary()
    );
  },

  async bonusSummary(_req: Request, res: Response) {
    return sendApiResponse(
      res,
      "Bonus summary report retrieved successfully.",
      await reportsService.bonusSummary()
    );
  }
};
