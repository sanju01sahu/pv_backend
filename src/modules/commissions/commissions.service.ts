import { CommissionType, ContractStatus, Role } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { createAuditLog } from "../../services/audit.service.js";
import { AuditAction } from "@prisma/client";

export const commissionsService = {
  async listAll() {
    return prisma.commission.findMany({ include: { user: true, contract: true } });
  },

  async listByUser(userId: string) {
    return prisma.commission.findMany({ where: { userId }, include: { contract: true } });
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
    for (const [agentId, agg] of byAgent.entries()) {
      if (agg.count > 10) {
        const firstContract = contracts.find((c) => c.agentId === agentId);
        if (firstContract) {
          const bonus = await prisma.commission.create({ data: { contractId: firstContract.id, userId: agentId, amount: agg.base.mul(0.15), type: CommissionType.BONUS } });
          created.push(bonus);
          await createAuditLog({ entityType: "Commission", entityId: bonus.id, action: AuditAction.CREATE, newValue: bonus, performedBy });
        }
      }
    }

    const managers = await prisma.user.findMany({ where: { role: Role.AREA_MANAGER }, include: { team: true } });
    for (const m of managers) {
      const agentIds = m.team.map((a) => a.id);
      const netContracts = contracts.filter((c) => agentIds.includes(c.agentId));
      if (netContracts.length > 20) {
        const networkCommission = netContracts.flatMap((c) => c.commissions).filter((x) => x.type === CommissionType.BASE).reduce((acc, x) => acc.plus(x.amount), new Decimal(0));
        if (netContracts[0]) {
          const bonus = await prisma.commission.create({ data: { contractId: netContracts[0].id, userId: m.id, amount: networkCommission.mul(0.15), type: CommissionType.BONUS } });
          created.push(bonus);
          await createAuditLog({ entityType: "Commission", entityId: bonus.id, action: AuditAction.CREATE, newValue: bonus, performedBy });
        }
      }
    }

    return created;
  }
};
