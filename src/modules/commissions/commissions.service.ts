import { CommissionType, ContractStatus, Role } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { createAuditLog } from "../../services/audit.service.js";
import { AuditAction } from "@prisma/client";
import { ListQueryOptions, toPaginatedResponse } from "../../lib/pagination.js";

export const commissionsService = {
  async listAll(options: ListQueryOptions) {
    const typeMatch = Object.values(CommissionType).find((type) => type === options.search.toUpperCase());
    const where = options.search
      ? {
          OR: [
            { id: { contains: options.search, mode: "insensitive" as const } },
            { contractId: { contains: options.search, mode: "insensitive" as const } },
            { userId: { contains: options.search, mode: "insensitive" as const } },
            { user: { name: { contains: options.search, mode: "insensitive" as const } } },
            { user: { email: { contains: options.search, mode: "insensitive" as const } } },
            ...(typeMatch ? [{ type: typeMatch }] : [])
          ]
        }
      : undefined;

    const [items, total] = await prisma.$transaction([
      prisma.commission.findMany({
        where,
        include: { user: true, contract: true },
        orderBy: { createdAt: "desc" },
        skip: options.skip,
        take: options.limit
      }),
      prisma.commission.count({ where })
    ]);

    return toPaginatedResponse(items, total, options.page, options.limit);
  },

  async listByUser(userId: string, options: ListQueryOptions) {
    const typeMatch = Object.values(CommissionType).find((type) => type === options.search.toUpperCase());
    const where = {
      userId,
      ...(options.search
        ? {
            OR: [
              { id: { contains: options.search, mode: "insensitive" as const } },
              { contractId: { contains: options.search, mode: "insensitive" as const } },
              ...(typeMatch ? [{ type: typeMatch }] : [])
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.commission.findMany({
        where,
        include: { contract: true, user: true },
        orderBy: { createdAt: "desc" },
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
