import { Request, Response } from "express";
import { auditLogsService } from "./audit-logs.service.js";
import { parseListQuery } from "../../lib/pagination.js";

export const auditLogsController = {
  async list(req: Request, res: Response) {
    return res.json(await auditLogsService.listLogs(parseListQuery(req.query)));
  }
};
