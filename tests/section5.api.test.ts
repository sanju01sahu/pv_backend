import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Role, ContractStatus, CommissionType, PaymentStatus } from "@prisma/client";
import { app } from "../src/app.js";
import { prisma } from "../src/lib/prisma.js";

const toNum = (v: unknown) => Number(v as string);

async function resetDb() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog", "PaymentTransaction", "Payment", "Commission", "Contract", "SolutionVersion", "Solution", "User" CASCADE;'
  );
}

async function createUser(input: { name: string; email: string; password: string; role: Role; managerId?: string }) {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await bcrypt.hash(input.password, 10),
      role: input.role,
      managerId: input.managerId
    }
  });
}

async function login(email: string, password: string) {
  const res = await request(app).post("/users/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.accessToken as string;
}

describe("Section 5 business rules", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("5.1 and 5.2: creates contract with active version and immutable base commission", async () => {
    const admin = await createUser({ name: "Admin", email: "admin1@test.com", password: "pass123", role: Role.ADMIN });
    const agent = await createUser({ name: "Agent", email: "agent1@test.com", password: "pass123", role: Role.AGENT });

    const adminToken = await login(admin.email, "pass123");
    const agentToken = await login(agent.email, "pass123");

    const solRes = await request(app).post("/solutions").set("Authorization", `Bearer ${adminToken}`).send({ name: "A" });
    expect(solRes.status).toBe(201);
    const solutionId = solRes.body.id as string;

    await request(app).post(`/solutions/${solutionId}/version`).set("Authorization", `Bearer ${adminToken}`).send({
      price: 1000,
      baseCommission: 100,
      validFrom: "2026-01-01T00:00:00.000Z"
    });

    await request(app).post(`/solutions/${solutionId}/version`).set("Authorization", `Bearer ${adminToken}`).send({
      price: 1200,
      baseCommission: 150,
      validFrom: "2026-02-01T00:00:00.000Z"
    });

    const contractRes = await request(app).post("/contracts").set("Authorization", `Bearer ${agentToken}`).send({
      solutionId,
      customerDetails: { name: "Cust" },
      installationDate: "2026-02-15T00:00:00.000Z",
      status: ContractStatus.ACTIVE
    });

    expect(contractRes.status).toBe(201);
    const contractId = contractRes.body.id as string;

    const commissions = await prisma.commission.findMany({ where: { contractId, userId: agent.id, type: CommissionType.BASE } });
    expect(commissions.length).toBe(1);
    expect(toNum(commissions[0].amount)).toBe(150);
  }, 30000);

  it("5.3: monthly bonus creates separate immutable bonus commissions", async () => {
    const admin = await createUser({ name: "Admin", email: "admin2@test.com", password: "pass123", role: Role.ADMIN });
    const manager = await createUser({ name: "Manager", email: "manager@test.com", password: "pass123", role: Role.AREA_MANAGER });
    const agent1 = await createUser({ name: "Agent1", email: "agent2@test.com", password: "pass123", role: Role.AGENT, managerId: manager.id });
    const agent2 = await createUser({ name: "Agent2", email: "agent3@test.com", password: "pass123", role: Role.AGENT, managerId: manager.id });

    const adminToken = await login(admin.email, "pass123");

    const solution = await prisma.solution.create({ data: { name: "B" } });
    const version = await prisma.solutionVersion.create({
      data: {
        solutionId: solution.id,
        price: 1000,
        baseCommission: 100,
        validFrom: new Date("2026-03-01T00:00:00.000Z"),
        createdBy: admin.id
      }
    });

    for (let i = 0; i < 11; i += 1) {
      const c = await prisma.contract.create({
        data: {
          agentId: agent1.id,
          solutionVersionId: version.id,
          customerDetails: { i },
          installationDate: new Date("2026-03-10T00:00:00.000Z"),
          status: ContractStatus.ACTIVE
        }
      });
      await prisma.commission.create({ data: { contractId: c.id, userId: agent1.id, amount: 100, type: CommissionType.BASE } });
    }

    for (let i = 0; i < 10; i += 1) {
      const c = await prisma.contract.create({
        data: {
          agentId: agent2.id,
          solutionVersionId: version.id,
          customerDetails: { i },
          installationDate: new Date("2026-03-11T00:00:00.000Z"),
          status: ContractStatus.ACTIVE
        }
      });
      await prisma.commission.create({ data: { contractId: c.id, userId: agent2.id, amount: 100, type: CommissionType.BASE } });
    }

    const bonusRun = await request(app)
      .post("/bonuses/run-monthly")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ year: 2026, month: 3 });

    expect(bonusRun.status).toBe(200);

    const agentBonus = await prisma.commission.findFirst({ where: { userId: agent1.id, type: CommissionType.BONUS } });
    const managerBonus = await prisma.commission.findFirst({ where: { userId: manager.id, type: CommissionType.BONUS } });
    expect(toNum(agentBonus!.amount)).toBe(165);
    expect(toNum(managerBonus!.amount)).toBe(315);
  }, 30000);

  it("5.4: retroactive versioning recalculates affected contract commissions and audits it", async () => {
    const admin = await createUser({ name: "Admin", email: "admin3@test.com", password: "pass123", role: Role.ADMIN });
    const agent = await createUser({ name: "Agent", email: "agent4@test.com", password: "pass123", role: Role.AGENT });
    const adminToken = await login(admin.email, "pass123");
    const agentToken = await login(agent.email, "pass123");

    const solution = await prisma.solution.create({ data: { name: "C" } });
    await prisma.solutionVersion.create({
      data: {
        solutionId: solution.id,
        price: 900,
        baseCommission: 100,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        createdBy: admin.id
      }
    });

    const contractRes = await request(app).post("/contracts").set("Authorization", `Bearer ${agentToken}`).send({
      solutionId: solution.id,
      customerDetails: { name: "Retro Cust" },
      installationDate: "2026-01-15T00:00:00.000Z",
      status: ContractStatus.ACTIVE
    });
    expect(contractRes.status).toBe(201);

    const retroRes = await request(app)
      .post(`/solutions/${solution.id}/version`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        price: 950,
        baseCommission: 150,
        validFrom: "2026-01-01T00:00:00.000Z",
        validTo: "2026-01-31T00:00:00.000Z",
        retroactive: true
      });

    expect(retroRes.status).toBe(201);
    expect(retroRes.body.adjustmentsCreated).toBe(1);

    const baseRows = await prisma.commission.findMany({ where: { contractId: contractRes.body.id, userId: agent.id, type: CommissionType.BASE } });
    expect(baseRows.length).toBe(2);
    const total = baseRows.reduce((acc, row) => acc + toNum(row.amount), 0);
    expect(total).toBe(150);

    const recalcLog = await prisma.auditLog.findFirst({ where: { entityType: "CommissionRecalculation" } });
    expect(recalcLog).toBeTruthy();
  }, 30000);

  it("5.5: payment statuses are derived from transactions", async () => {
    const admin = await createUser({ name: "Admin", email: "admin4@test.com", password: "pass123", role: Role.ADMIN });
    const agent = await createUser({ name: "Agent", email: "agent5@test.com", password: "pass123", role: Role.AGENT });
    const adminToken = await login(admin.email, "pass123");

    const payRes = await request(app)
      .post("/payments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: agent.id, totalAmount: 1000 });
    expect(payRes.status).toBe(201);
    expect(payRes.body.effectiveStatus).toBe(PaymentStatus.PENDING);

    await request(app)
      .post(`/payments/${payRes.body.id}/transactions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 300, method: "BANK_TRANSFER" });

    let payment = await prisma.payment.findUnique({ where: { id: payRes.body.id } });
    expect(payment?.status).toBe(PaymentStatus.PENDING);

    await request(app)
      .post(`/payments/${payRes.body.id}/transactions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 700, method: "BANK_TRANSFER" });

    payment = await prisma.payment.findUnique({ where: { id: payRes.body.id } });
    expect(payment?.status).toBe(PaymentStatus.PENDING);

    const listRes = await request(app).get("/payments").set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.status).toBe(200);
    const listed = listRes.body.items.find((p: { id: string }) => p.id === payRes.body.id);
    expect(listed.effectiveStatus).toBe(PaymentStatus.FULLY_PAID);

    const disputedRes = await request(app)
      .post("/payments")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: agent.id, totalAmount: 1000, status: PaymentStatus.DISPUTED });

    await request(app)
      .post(`/payments/${disputedRes.body.id}/transactions`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ amount: 1000, method: "BANK_TRANSFER" });

    const disputedPayment = await prisma.payment.findUnique({ where: { id: disputedRes.body.id } });
    expect(disputedPayment?.status).toBe(PaymentStatus.DISPUTED);

    const listedDisputed = (
      await request(app).get("/payments").set("Authorization", `Bearer ${adminToken}`)
    ).body.items.find((p: { id: string }) => p.id === disputedRes.body.id);
    expect(listedDisputed.effectiveStatus).toBe(PaymentStatus.DISPUTED);
  }, 30000);
});
