import { Router } from "express";
import {
  userRouter,
  solutionRouter,
  contractRouter,
  commissionRouter,
  bonusRouter,
  paymentRouter,
  auditRouter,
  reportRouter
} from "./modules/index.js";

export const apiRouter = Router();

apiRouter.use("/users", userRouter);
apiRouter.use("/solutions", solutionRouter);
apiRouter.use("/contracts", contractRouter);
apiRouter.use("/commissions", commissionRouter);
apiRouter.use("/bonuses", bonusRouter);
apiRouter.use("/payments", paymentRouter);
apiRouter.use("/audit-logs", auditRouter);
apiRouter.use("/reports", reportRouter);
