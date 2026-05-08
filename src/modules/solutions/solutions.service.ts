import { AuditAction } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { createAuditLog } from "../../services/audit.service.js";
import { ListQueryOptions, toPaginatedResponse } from "../../lib/pagination.js";

export const solutionsService = {
  async listSolutions(options: ListQueryOptions) {
    const where = options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: "insensitive" as const } },
            { id: { contains: options.search, mode: "insensitive" as const } }
          ]
        }
      : undefined;

    const [items, total] = await prisma.$transaction([
      prisma.solution.findMany({
        where,
        orderBy: { name: "asc" },
        skip: options.skip,
        take: options.limit
      }),
      prisma.solution.count({ where })
    ]);

    return toPaginatedResponse(items, total, options.page, options.limit);
  },

  async createSolution(name: string, performedBy: string) {
    const solution = await prisma.solution.create({ data: { name } });
    await createAuditLog({ entityType: "Solution", entityId: solution.id, action: AuditAction.CREATE, newValue: solution, performedBy });
    return solution;
  },

  async createVersion(input: { solutionId: string; price: number; baseCommission: number; validFrom: Date; validTo?: Date; createdBy: string; retroactive?: boolean }) {
    const version = await prisma.solutionVersion.create({
      data: {
        solutionId: input.solutionId,
        price: input.price,
        baseCommission: input.baseCommission,
        validFrom: input.validFrom,
        validTo: input.validTo,
        createdBy: input.createdBy
      }
    });
    await createAuditLog({ entityType: "SolutionVersion", entityId: version.id, action: AuditAction.CREATE, newValue: version, performedBy: input.createdBy });

    if (!input.retroactive) return { version, recalculatedContracts: 0, adjustmentsCreated: 0 };

    const affectedContracts = await prisma.contract.findMany({
      where: {
        solutionVersion: { solutionId: input.solutionId },
        installationDate: {
          gte: input.validFrom,
          ...(input.validTo ? { lte: input.validTo } : {})
        }
      },
      include: { commissions: true }
    });

    let adjustmentsCreated = 0;
    const expectedBase = new Decimal(input.baseCommission);

    for (const contract of affectedContracts) {
      const currentBase = contract.commissions
        .filter((c) => c.type === "BASE" && c.userId === contract.agentId)
        .reduce((acc, c) => acc.plus(c.amount), new Decimal(0));

      const delta = expectedBase.minus(currentBase);
      if (delta.equals(0)) continue;

      const adjustment = await prisma.commission.create({
        data: { contractId: contract.id, userId: contract.agentId, amount: delta, type: "BASE" }
      });
      adjustmentsCreated += 1;

      await createAuditLog({
        entityType: "CommissionRecalculation",
        entityId: adjustment.id,
        action: AuditAction.CREATE,
        oldValue: { previousBase: currentBase.toString() },
        newValue: { expectedBase: expectedBase.toString(), delta: delta.toString(), contractId: contract.id },
        performedBy: input.createdBy
      });
    }

    return { version, recalculatedContracts: affectedContracts.length, adjustmentsCreated };
  },

  async listVersions(solutionId: string, options: ListQueryOptions) {
    const where = {
      solutionId,
      ...(options.search
        ? {
            OR: [
              { id: { contains: options.search, mode: "insensitive" as const } },
              { createdBy: { contains: options.search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.solutionVersion.findMany({
        where,
        orderBy: { validFrom: "desc" },
        skip: options.skip,
        take: options.limit
      }),
      prisma.solutionVersion.count({ where })
    ]);

    return toPaginatedResponse(items, total, options.page, options.limit);
  }
};
