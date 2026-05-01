import { Request, Response } from "express";
import { auditLogsService } from "./audit-logs.service.js";

export const auditLogsController = {
  async list(_req: Request, res: Response) {
    return res.json(await auditLogsService.listLogs());
  }
};
