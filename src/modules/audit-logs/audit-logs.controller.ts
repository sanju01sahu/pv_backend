import { Request, Response } from "express";
import { auditLogsService } from "./audit-logs.service.js";
import { parseListQuery } from "../../lib/pagination.js";
import { sendApiResponse } from "../../lib/api-response.js";

export const auditLogsController = {
  async list(req: Request, res: Response) {
    return sendApiResponse(
      res,
      "Audit logs retrieved successfully.",
      await auditLogsService.listLogs(parseListQuery(req.query))
    );
  }
};
