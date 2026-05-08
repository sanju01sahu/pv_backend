import { AuditAction, PaymentMethod, PaymentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../../lib/prisma.js";
import { createAuditLog } from "../../services/audit.service.js";
import { ListQueryOptions, toPaginatedResponse } from "../../lib/pagination.js";

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
    const where = options.search
      ? {
          OR: [
            { id: { contains: options.search, mode: "insensitive" as const } },
            { userId: { contains: options.search, mode: "insensitive" as const } },
            { user: { name: { contains: options.search, mode: "insensitive" as const } } },
            { user: { email: { contains: options.search, mode: "insensitive" as const } } },
            ...(statusMatch ? [{ status: statusMatch }] : [])
          ]
        }
      : undefined;

    const [payments, total] = await prisma.$transaction([
      prisma.payment.findMany({
        where,
        include: { transactions: true, user: true },
        orderBy: { createdAt: "desc" },
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
