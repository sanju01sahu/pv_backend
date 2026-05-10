import { prisma } from "../../lib/prisma.js";
import { AuditAction, Prisma } from "@prisma/client";
import { ListQueryOptions, toExclusiveEndDate, toPaginatedResponse } from "../../lib/pagination.js";

export const auditLogsService = {
  async listLogs(options: ListQueryOptions) {
    const actionMatch = Object.values(AuditAction).find((action) => action === options.search.toUpperCase());
    const endDateExclusive = toExclusiveEndDate(options.endDate);
    const whereClauses: Prisma.AuditLogWhereInput[] = [];
    if (options.search) {
      whereClauses.push({
        OR: [
          { entityType: { contains: options.search, mode: "insensitive" as const } },
          { entityId: { contains: options.search, mode: "insensitive" as const } },
          { performedBy: { contains: options.search, mode: "insensitive" as const } },
          { performer: { name: { contains: options.search, mode: "insensitive" as const } } },
          { performer: { email: { contains: options.search, mode: "insensitive" as const } } },
          ...(actionMatch ? [{ action: actionMatch }] : [])
        ]
      });
    }
    if (options.startDate || endDateExclusive) {
      whereClauses.push({
        timestamp: {
          ...(options.startDate ? { gte: options.startDate } : {}),
          ...(endDateExclusive ? { lt: endDateExclusive } : {})
        }
      });
    }
    const where = whereClauses.length > 0 ? { AND: whereClauses } : undefined;
    const orderBy: Prisma.AuditLogOrderByWithRelationInput =
      options.sortBy === "timestamp" ? { timestamp: options.sortOrder } : { timestamp: "desc" };

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy,
        skip: options.skip,
        take: options.limit
      }),
      prisma.auditLog.count({ where })
    ]);

    return toPaginatedResponse(items, total, options.page, options.limit);
  }
};
