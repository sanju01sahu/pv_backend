import { AuditAction, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { createAuditLog } from "../../services/audit.service.js";
import { ListQueryOptions, toExclusiveEndDate, toPaginatedResponse } from "../../lib/pagination.js";

export function derivePaymentStatus(total: Decimal, paid: Decimal, forced?: PaymentStatus | null) {
  if (forced === PaymentStatus.CANCELLED || forced === PaymentStatus.DISPUTED) return forced;
  if (paid.equals(0)) return PaymentStatus.PENDING;
  if (paid.greaterThanOrEqualTo(total)) return PaymentStatus.FULLY_PAID;
  return PaymentStatus.PARTIALLY_PAID;
}

function withEffectiveStatus<T extends { totalAmount: Decimal; status: PaymentStatus; transactions: Array<{ amount: Decimal }> }>(payment: T) {
  const paidAmount = payment.transactions.reduce((acc, tx) => acc.plus(tx.amount), new Decimal(0));
  const effectiveStatus = derivePaymentStatus(payment.totalAmount, paidAmount, payment.status);
  return { ...payment, effectiveStatus };
}

async function getPaymentWithEffectiveStatus(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { transactions: true } });
  if (!payment) return null;
  return withEffectiveStatus(payment);
}

export const paymentsService = {
  async createPayment(input: { userId: string; totalAmount: number; status?: PaymentStatus }, performedBy: string) {
    const payment = await prisma.payment.create({ data: { userId: input.userId, totalAmount: input.totalAmount, status: input.status ?? PaymentStatus.PENDING } });
    await createAuditLog({ entityType: "Payment", entityId: payment.id, action: AuditAction.CREATE, newValue: payment, performedBy });
    return { ...payment, effectiveStatus: payment.status };
  },

  async addTransaction(paymentId: string, input: { amount: number; method: PaymentMethod; referenceNumber?: string; proofUrl?: string; adminNote?: string }, performedBy: string) {
    const tx = await prisma.paymentTransaction.create({ data: { paymentId, ...input } });
    const payment = await getPaymentWithEffectiveStatus(paymentId);
    await createAuditLog({ entityType: "PaymentTransaction", entityId: tx.id, action: AuditAction.CREATE, newValue: tx, performedBy });
    return { tx, payment };
  },

  async listPayments(options: ListQueryOptions) {
    const statusMatch = Object.values(PaymentStatus).find((status) => status === options.search.toUpperCase());
    const explicitStatusMatch = Object.values(PaymentStatus).find((status) => status === options.status.toUpperCase());
    const parsedAmount = Number(options.search);
    const hasAmountSearch = Number.isFinite(parsedAmount);
    const parsedDate = new Date(options.search);
    const hasDateSearch = !Number.isNaN(parsedDate.getTime());
    const dateStart = hasDateSearch
      ? new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate()))
      : null;
    const dateEnd = hasDateSearch && dateStart ? new Date(dateStart.getTime() + 24 * 60 * 60 * 1000) : null;
    const endDateExclusive = toExclusiveEndDate(options.endDate);
    const whereClauses: Prisma.PaymentWhereInput[] = [];
    if (options.search) {
      whereClauses.push({
        OR: [
          { id: { contains: options.search, mode: "insensitive" as const } },
          { userId: { contains: options.search, mode: "insensitive" as const } },
          { user: { name: { contains: options.search, mode: "insensitive" as const } } },
          { user: { email: { contains: options.search, mode: "insensitive" as const } } },
          ...(hasAmountSearch ? [{ totalAmount: parsedAmount }] : []),
          ...(hasDateSearch && dateStart && dateEnd ? [{ createdAt: { gte: dateStart, lt: dateEnd } }] : []),
          ...(statusMatch ? [{ status: statusMatch }] : [])
        ]
      });
    }
    if (explicitStatusMatch) {
      whereClauses.push({ status: explicitStatusMatch });
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
    const orderBy: Prisma.PaymentOrderByWithRelationInput =
      options.sortBy === "name"
        ? { user: { name: options.sortOrder } }
        : { createdAt: options.sortBy === "createdAt" ? options.sortOrder : "desc" };

    const [payments, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        include: { transactions: true, user: true },
        orderBy,
        skip: options.skip,
        take: options.limit
      }),
      prisma.payment.count({ where })
    ]);

    return toPaginatedResponse(
      payments.map(withEffectiveStatus),
      total,
      options.page,
      options.limit
    );
  }
};
