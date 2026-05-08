import { prisma } from "../../lib/prisma.js";
import { AuditAction } from "@prisma/client";
import { ListQueryOptions, toPaginatedResponse } from "../../lib/pagination.js";

export const auditLogsService = {
  async listLogs(options: ListQueryOptions) {
    const actionMatch = Object.values(AuditAction).find((action) => action === options.search.toUpperCase());
    const where = options.search
      ? {
          OR: [
            { entityType: { contains: options.search, mode: "insensitive" as const } },
            { entityId: { contains: options.search, mode: "insensitive" as const } },
            { performedBy: { contains: options.search, mode: "insensitive" as const } },
            { performer: { name: { contains: options.search, mode: "insensitive" as const } } },
            { performer: { email: { contains: options.search, mode: "insensitive" as const } } },
            ...(actionMatch ? [{ action: actionMatch }] : [])
          ]
        }
      : undefined;

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        skip: options.skip,
        take: options.limit
      }),
      prisma.auditLog.count({ where })
    ]);

    return toPaginatedResponse(items, total, options.page, options.limit);
  }
};
