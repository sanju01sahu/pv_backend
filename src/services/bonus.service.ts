import { CommissionType, ContractStatus, Role } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma.js";

export const runMonthlyBonus = async (year: number, month: number) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const contracts = await prisma.contract.findMany({
    where: { installationDate: { gte: start, lt: end }, status: { not: ContractStatus.CANCELLED } },
    include: { commissions: true, agent: true }
  });

  const byAgent = new Map<string, { count: number; base: Decimal }>();
  for (const c of contracts) {
    const base = c.commissions
      .filter((x) => x.type === CommissionType.BASE && x.userId === c.agentId)
      .reduce((acc, x) => acc.plus(x.amount), new Decimal(0));
    const prev = byAgent.get(c.agentId) || { count: 0, base: new Decimal(0) };
    byAgent.set(c.agentId, { count: prev.count + 1, base: prev.base.plus(base) });
  }

  const created = [];

  for (const [agentId, agg] of byAgent.entries()) {
    if (agg.count > 10) {
      const agentBonus = agg.base.mul(0.15);
      const firstContract = contracts.find((c) => c.agentId === agentId);
      if (firstContract) {
        created.push(await prisma.commission.create({ data: { contractId: firstContract.id, userId: agentId, amount: agentBonus, type: CommissionType.BONUS } }));
      }
    }
  }

  const managers = await prisma.user.findMany({ where: { role: Role.AREA_MANAGER }, include: { team: true } });
  for (const m of managers) {
    const agentIds = m.team.map((a) => a.id);
    const netContracts = contracts.filter((c) => agentIds.includes(c.agentId));
    if (netContracts.length > 20) {
      const networkCommission = netContracts
        .flatMap((c) => c.commissions)
        .filter((x) => x.type === CommissionType.BASE)
        .reduce((acc, x) => acc.plus(x.amount), new Decimal(0));
      const managerBonus = networkCommission.mul(0.15);
      if (netContracts[0]) {
        created.push(await prisma.commission.create({ data: { contractId: netContracts[0].id, userId: m.id, amount: managerBonus, type: CommissionType.BONUS } }));
      }
    }
  }

  return created;
};
