import { CommissionType, ContractStatus, Prisma, Role } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { createAuditLog } from "../../services/audit.service.js";
import { AuditAction } from "@prisma/client";
import { ListQueryOptions, toExclusiveEndDate, toPaginatedResponse } from "../../lib/pagination.js";

export const commissionsService = {
  async listAll(options: ListQueryOptions) {
    const typeMatch = Object.values(CommissionType).find((type) => type === options.search.toUpperCase());
    const parsedDate = new Date(options.search);
    const hasDateSearch = !Number.isNaN(parsedDate.getTime());
    const dateStart = hasDateSearch
      ? new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()))
      : null;
    const dateEnd = hasDateSearch && dateStart ? new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) : null;
    const endDateExclusive = toExclusiveEndDate(options.endDate);
    const whereClauses: Prisma.CommissionWhereInput[] = [];
    if (options.search) {
      whereClauses.push({
        OR: [
          { id: { contains: options.search, mode: "insensitive" as const } },
          { contractId: { contains: options.search, mode: "insensitive" as const } },
          { userId: { contains: options.search, mode: "insensitive" as const } },
          { user: { name: { contains: options.search, mode: "insensitive" as const } } },
          { user: { email: { contains: options.search, mode: "insensitive" as const } } },
          ...(hasDateSearch && dateStart && dateEnd ? [{ createdAt: { gte: dateStart, lt: dateEnd } }] : []),
          ...(typeMatch ? [{ type: typeMatch }] : [])
        ]
      });
    }
    if (options.startDate || endDateExclusive) {
      whereClauses.push({
        createdAt: {
          ...(options.startDate ? { gte: options.startDate } : {}),
          ...(endDateExclusive ? { lt: endDateExclusive } : {})
        }
      });
    }
    const where = whereClauses.length > 0 ? { AND: whereClauses } : undefined;
    const orderBy: Prisma.CommissionOrderByWithRelationInput =
      options.sortBy === "name"
        ? { user: { name: options.sortOrder } }
        : { createdAt: options.sortBy === "createdAt" ? options.sortOrder : "desc" };

    const [items, total] = await prisma.$transaction([
      prisma.commission.findMany({
        where,
        include: { user: true, contract: true },
        orderBy,
        skip: options.skip,
        take: options.limit
      }),
      prisma.commission.count({ where })
    ]);

    return toPaginatedResponse(items, total, options.page, options.limit);
  },

  async listByUser(userId: string, options: ListQueryOptions) {
    const typeMatch = Object.values(CommissionType).find((type) => type === options.search.toUpperCase());
    const parsedDate = new Date(options.search);
    const hasDateSearch = !Number.isNaN(parsedDate.getTime());
    const dateStart = hasDateSearch
      ? new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()))
      : null;
    const dateEnd = hasDateSearch && dateStart ? new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) : null;
    const endDateExclusive = toExclusiveEndDate(options.endDate);
    const whereClauses: Prisma.CommissionWhereInput[] = [{ userId }];
    if (options.search) {
      whereClauses.push({
        OR: [
          { id: { contains: options.search, mode: "insensitive" as const } },
          { contractId: { contains: options.search, mode: "insensitive" as const } },
          ...(hasDateSearch && dateStart && dateEnd ? [{ createdAt: { gte: dateStart, lt: dateEnd } }] : []),
          ...(typeMatch ? [{ type: typeMatch }] : [])
        ]
      });
    }
    if (options.startDate || endDateExclusive) {
      whereClauses.push({
        createdAt: {
          ...(options.startDate ? { gte: options.startDate } : {}),
          ...(endDateExclusive ? { lt: endDateExclusive } : {})
        }
      });
    }
    const where: Prisma.CommissionWhereInput = { AND: whereClauses };
    const orderBy: Prisma.CommissionOrderByWithRelationInput =
      options.sortBy === "createdAt" ? { createdAt: options.sortOrder } : { createdAt: "desc" };

    const [items, total] = await prisma.$transaction([
      prisma.commission.findMany({
        where,
        include: { contract: true, user: true },
        orderBy,
        skip: options.skip,
        take: options.limit
      }),
      prisma.commission.count({ where })
    ]);

    return toPaginatedResponse(items, total, options.page, options.limit);
  },

  async runMonthlyBonus(year: number, month: number, performedBy = "system") {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));

    const contracts = await prisma.contract.findMany({
      where: { installationDate: { gte: start, lt: end }, status: { not: ContractStatus.CANCELLED } },
      include: { commissions: true, agent: true }
    });

    const byAgent = new Map<string, { count: number; base: Decimal }>();
    for (const c of contracts) {
      const base = c.commissions.filter((x) => x.type === CommissionType.BASE && x.userId === c.agentId).reduce((acc, x) => acc.plus(x.amount), new Decimal(0));
      const prev = byAgent.get(c.agentId) || { count: 0, base: new Decimal(0) };
      byAgent.set(c.agentId, { count: prev.count + 1, base: prev.base.plus(base) });
    }

    const created = [];
    let agentsQualified = 0;
    for (const [agentId, agg] of byAgent.entries()) {
      if (agg.count > 10) {
        agentsQualified += 1;
        const firstContract = contracts.find((c) => c.agentId === agentId);
        if (firstContract) {
          const bonus = await prisma.commission.create({ data: { contractId: firstContract.id, userId: agentId, amount: agg.base.mul(0.15), type: CommissionType.BONUS } });
          created.push(bonus);
          await createAuditLog({ entityType: "Commission", entityId: bonus.id, action: AuditAction.CREATE, newValue: bonus, performedBy });
        }
      }
    }

    const managers = await prisma.user.findMany({ where: { role: Role.AREA_MANAGER }, include: { team: true } });
    let managersQualified = 0;
    for (const m of managers) {
      const agentIds = m.team.map((a) => a.id);
      const netContracts = contracts.filter((c) => agentIds.includes(c.agentId));
      if (netContracts.length > 20) {
        managersQualified += 1;
        const networkCommission = netContracts.flatMap((c) => c.commissions).filter((x) => x.type === CommissionType.BASE).reduce((acc, x) => acc.plus(x.amount), new Decimal(0));
        if (netContracts[0]) {
          const bonus = await prisma.commission.create({ data: { contractId: netContracts[0].id, userId: m.id, amount: networkCommission.mul(0.15), type: CommissionType.BONUS } });
          created.push(bonus);
          await createAuditLog({ entityType: "Commission", entityId: bonus.id, action: AuditAction.CREATE, newValue: bonus, performedBy });
        }
      }
    }

    const createdCount = created.length;
    const monthLabel = `${String(month).padStart(2, "0")}/${year}`;
    const message =
      createdCount > 0
        ? `Bonus run completed for ${monthLabel}. Created ${createdCount} bonus commission entries.`
        : `Bonus run completed for ${monthLabel}. No bonuses were created because eligibility thresholds were not met.`;

    return {
      message,
      createdCount,
      created,
      period: {
        year,
        month
      },
      summary: {
        installationContractsConsidered: contracts.length,
        agentsEvaluated: byAgent.size,
        agentsQualified,
        managersEvaluated: managers.length,
        managersQualified,
        agentRule: "More than 10 installations in month => 15% of agent base commission total",
        managerRule: "More than 20 network installations in month => 15% of network base commission total"
      }
    };
  }
};
