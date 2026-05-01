import { Request, Response } from "express";
import { reportsService } from "./reports.service.js";

export const reportsController = {
  async monthlyEarnings(req: Request, res: Response) {
    return res.json(await reportsService.monthlyEarnings(Number(req.query.year), Number(req.query.month)));
  },

  async managerNetworkPerformance(_req: Request, res: Response) {
    return res.json(await reportsService.managerNetworkPerformance());
  },

  async paymentSummary(_req: Request, res: Response) {
    return res.json(await reportsService.paymentSummary());
  },

  async bonusSummary(_req: Request, res: Response) {
    return res.json(await reportsService.bonusSummary());
  }
};
