import { AuditAction, CommissionType, ContractStatus, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { createAuditLog } from "../../services/audit.service.js";

export const contractsService = {
  async createContract(input: {
    solutionId: string;
    customerDetails: unknown;
    installationDate: Date;
    status: ContractStatus;
    callerRole: Role;
    callerUserId: string;
    agentId?: string;
  }) {
    const agentId = input.callerRole === Role.AGENT ? input.callerUserId : input.agentId;
    if (!agentId) throw new Error("agentId required for non-agent caller");

    const version = await prisma.solutionVersion.findFirst({
      where: {
        solutionId: input.solutionId,
        validFrom: { lte: input.installationDate },
        OR: [{ validTo: null }, { validTo: { gte: input.installationDate } }]
      },
      orderBy: { validFrom: "desc" }
    });
    if (!version) throw new Error("No active solution version found for contract date");

    const contract = await prisma.contract.create({
      data: {
        agentId,
        solutionVersionId: version.id,
        customerDetails: input.customerDetails as any,
        installationDate: input.installationDate,
        status: input.status
      }
    });

    await prisma.commission.create({
      data: { contractId: contract.id, userId: agentId, amount: version.baseCommission, type: CommissionType.BASE }
    });

    await createAuditLog({ entityType: "Contract", entityId: contract.id, action: AuditAction.CREATE, newValue: contract, performedBy: input.callerUserId });
    return contract;
  },

  async listContracts(callerRole: Role, callerUserId: string) {
    const where = callerRole === Role.AGENT ? { agentId: callerUserId } : {};
    return prisma.contract.findMany({ where, include: { solutionVersion: true, commissions: true } });
  }
};
