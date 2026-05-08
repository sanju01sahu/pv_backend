import { Request, Response } from "express";
import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { AuthRequest } from "../../middleware/auth.js";
import { paymentsService } from "./payments.service.js";
import { parseListQuery } from "../../lib/pagination.js";

const createPaymentSchema = z.object({ userId: z.string().uuid(), totalAmount: z.coerce.number().positive(), status: z.enum([PaymentStatus.PENDING, PaymentStatus.DISPUTED, PaymentStatus.CANCELLED]).optional() });
const addTxSchema = z.object({ amount: z.coerce.number().positive(), method: z.enum([PaymentMethod.BANK_TRANSFER, PaymentMethod.UPI, PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.OTHER]), referenceNumber: z.string().optional(), proofUrl: z.string().url().optional(), adminNote: z.string().optional() });

export const paymentsController = {
  async create(req: Request, res: Response) {
    const performedBy = (req as AuthRequest).user!.userId;
    return res.status(201).json(await paymentsService.createPayment(createPaymentSchema.parse(req.body), performedBy));
  },

  async addTransaction(req: Request, res: Response) {
    const performedBy = (req as AuthRequest).user!.userId;
    return res.status(201).json(await paymentsService.addTransaction(String(req.params.id), addTxSchema.parse(req.body), performedBy));
  },

  async list(req: Request, res: Response) {
    return res.json(await paymentsService.listPayments(parseListQuery(req.query)));
  }
};
