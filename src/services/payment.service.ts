import { Decimal } from "@prisma/client/runtime/library";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const derivePaymentStatus = (total: Decimal, paid: Decimal, forced?: PaymentStatus | null) => {
  if (forced === PaymentStatus.CANCELLED || forced === PaymentStatus.DISPUTED) return forced;
  if (paid.equals(0)) return PaymentStatus.PENDING;
  if (paid.greaterThanOrEqualTo(total)) return PaymentStatus.FULLY_PAID;
  return PaymentStatus.PARTIALLY_PAID;
};

export const recalcPaymentStatus = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { transactions: true } });
  if (!payment) return null;

  const paidAmount = payment.transactions.reduce((acc, tx) => acc.plus(tx.amount), new Decimal(0));
  const status = derivePaymentStatus(payment.totalAmount, paidAmount, payment.status);

  return prisma.payment.update({ where: { id: payment.id }, data: { status } });
};
