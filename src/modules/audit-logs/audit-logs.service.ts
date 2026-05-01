import { prisma } from "../../lib/prisma.js";

export const auditLogsService = {
  async listLogs() {
    return prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 500 });
  }
};
