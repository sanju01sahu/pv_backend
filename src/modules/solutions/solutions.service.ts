import { AuditAction } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { createAuditLog } from "../../services/audit.service.js";

export const solutionsService = {
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

  async listVersions(solutionId: string) {
    return prisma.solutionVersion.findMany({ where: { solutionId }, orderBy: { validFrom: "desc" } });
  }
};
