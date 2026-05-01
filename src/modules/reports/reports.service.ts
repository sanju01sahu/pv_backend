import { CommissionType, ContractStatus, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { Decimal } from "@prisma/client/runtime/library";
import { derivePaymentStatus } from "../payments/payments.service.js";

export const reportsService = {
  async monthlyEarnings(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    return prisma.commission.groupBy({ by: ["userId", "type"], where: { createdAt: { gte: start, lt: end } }, _sum: { amount: true } });
  },

  async managerNetworkPerformance() {
    const managers = await prisma.user.findMany({ where: { role: Role.AREA_MANAGER }, include: { team: true } });
    const all = [];
    for (const m of managers) {
      const ids = m.team.map((a) => a.id);
      const installs = await prisma.contract.count({ where: { agentId: { in: ids }, status: { not: ContractStatus.CANCELLED } } });
      all.push({ managerId: m.id, managerName: m.name, installations: installs });
    }
    return all;
  },

  async paymentSummary() {
    const payments = await prisma.payment.findMany({ include: { transactions: true } });
    const counts = new Map<string, number>();
    for (const p of payments) {
      const paid = p.transactions.reduce((acc, tx) => acc.plus(tx.amount), new Decimal(0));
      const status = derivePaymentStatus(p.totalAmount, paid, p.status);
      counts.set(status, (counts.get(status) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, count]) => ({ status, _count: { _all: count } }));
  },

  async bonusSummary() {
    return prisma.commission.groupBy({ by: ["userId"], where: { type: CommissionType.BONUS }, _sum: { amount: true }, _count: { _all: true } });
  }
};
