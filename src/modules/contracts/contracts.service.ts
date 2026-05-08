import { AuditAction, CommissionType, ContractStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { createAuditLog } from "../../services/audit.service.js";
import { ListQueryOptions, toPaginatedResponse } from "../../lib/pagination.js";

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

  async listContracts(callerRole: Role, callerUserId: string, options: ListQueryOptions) {
    const where: Prisma.ContractWhereInput = callerRole === Role.AGENT ? { agentId: callerUserId } : {};

    if (options.search) {
      const statusMatch = Object.values(ContractStatus).find((status) => status === options.search.toUpperCase());
      where.OR = [
        { id: { contains: options.search, mode: "insensitive" } },
        { solutionVersionId: { contains: options.search, mode: "insensitive" } },
        { agentId: { contains: options.search, mode: "insensitive" } },
        { agent: { name: { contains: options.search, mode: "insensitive" } } },
        { agent: { email: { contains: options.search, mode: "insensitive" } } },
        { solutionVersion: { solution: { name: { contains: options.search, mode: "insensitive" } } } },
        ...(statusMatch ? [{ status: statusMatch }] : [])
      ];
    }

    const [items, total] = await prisma.$transaction([
      prisma.contract.findMany({
        where,
        include: {
          solutionVersion: { include: { solution: true } },
          commissions: true,
          agent: true
        },
        orderBy: { createdAt: "desc" },
        skip: options.skip,
        take: options.limit
      }),
      prisma.contract.count({ where })
    ]);

    return toPaginatedResponse(items, total, options.page, options.limit);
  }
};
