import { AuditAction, CommissionType, ContractStatus, Prisma, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { createAuditLog } from "../../services/audit.service.js";
import { ListQueryOptions, toExclusiveEndDate, toPaginatedResponse } from "../../lib/pagination.js";
import { HttpError } from "../../lib/http-error.js";

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
    if (!agentId) throw new HttpError(400, "agentId is required for non-agent caller");

    const version = await prisma.solutionVersion.findFirst({
      where: {
        solutionId: input.solutionId,
        validFrom: { lte: input.installationDate },
        OR: [{ validTo: null }, { validTo: { gte: input.installationDate } }]
      },
      orderBy: { validFrom: "desc" }
    });
    if (!version) {
      throw new HttpError(404, "No active solution version found for the provided installation date");
    }

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
    const whereClauses: Prisma.ContractWhereInput[] = [];
    if (callerRole === Role.AGENT) {
      whereClauses.push({ agentId: callerUserId });
    }
    const statusMatch = Object.values(ContractStatus).find((status) => status === options.status.toUpperCase());
    const endDateExclusive = toExclusiveEndDate(options.endDate);

    if (options.search) {
      const parsedDate = new Date(options.search);
      const hasDateSearch = !Number.isNaN(parsedDate.getTime());
      const dateStart = hasDateSearch
        ? new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()))
        : null;
      const dateEnd = hasDateSearch && dateStart ? new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) : null;

      const searchStatusMatch = Object.values(ContractStatus).find((status) => status === options.search.toUpperCase());
      whereClauses.push({
        OR: [
          { id: { contains: options.search, mode: "insensitive" } },
          { solutionVersionId: { contains: options.search, mode: "insensitive" } },
          { agentId: { contains: options.search, mode: "insensitive" } },
          { agent: { name: { contains: options.search, mode: "insensitive" } } },
          { agent: { email: { contains: options.search, mode: "insensitive" } } },
          { solutionVersion: { solution: { name: { contains: options.search, mode: "insensitive" } } } },
          ...(hasDateSearch && dateStart && dateEnd ? [{ installationDate: { gte: dateStart, lt: dateEnd } }] : []),
          ...(searchStatusMatch ? [{ status: searchStatusMatch }] : [])
        ]
      });
    }

    if (statusMatch) {
      whereClauses.push({ status: statusMatch });
    }

    if (options.startDate || endDateExclusive) {
      whereClauses.push({
        installationDate: {
          ...(options.startDate ? { gte: options.startDate } : {}),
          ...(endDateExclusive ? { lt: endDateExclusive } : {})
        }
      });
    }

    const where: Prisma.ContractWhereInput = whereClauses.length > 0 ? { AND: whereClauses } : {};
    const orderBy: Prisma.ContractOrderByWithRelationInput =
      options.sortBy === "installationDate"
        ? { installationDate: options.sortOrder }
        : { createdAt: options.sortBy === "createdAt" ? options.sortOrder : "desc" };

    const [items, total] = await prisma.$transaction([
      prisma.contract.findMany({
        where,
        include: {
          solutionVersion: { include: { solution: true } },
          commissions: true,
          agent: true
        },
        orderBy,
        skip: options.skip,
        take: options.limit
      }),
      prisma.contract.count({ where })
    ]);

    return toPaginatedResponse(items, total, options.page, options.limit);
  }
};
