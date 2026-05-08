import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/auth.js";
import { createAuditLog } from "../../services/audit.service.js";
import { AuditAction } from "@prisma/client";
import { ListQueryOptions, toPaginatedResponse } from "../../lib/pagination.js";

const MAX_FAILED_LOGINS = Number(process.env.MAX_FAILED_LOGINS || 5);
const LOCKOUT_MINUTES = Number(process.env.LOGIN_LOCKOUT_MINUTES || 15);
const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  managerId: true,
  createdAt: true
} as const;

export const userService = {
  async login(email: string, password: string, ipAddress?: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;

    const now = new Date();
    const attempt = await prisma.loginAttempt.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, failedCount: 0 }
    });

    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      await createAuditLog({
        entityType: "Auth",
        entityId: user.id,
        action: AuditAction.UPDATE,
        oldValue: null,
        newValue: { event: "LOGIN_BLOCKED_LOCKOUT", ipAddress },
        performedBy: user.id
      });
      return { locked: true as const, lockedUntil: attempt.lockedUntil };
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const failedCount = attempt.failedCount + 1;
      const lockedUntil = failedCount >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
      await prisma.loginAttempt.update({ where: { userId: user.id }, data: { failedCount, lockedUntil } });
      await createAuditLog({
        entityType: "Auth",
        entityId: user.id,
        action: AuditAction.UPDATE,
        oldValue: null,
        newValue: { event: "LOGIN_FAILED", failedCount, lockedUntil, ipAddress },
        performedBy: user.id
      });
      return null;
    }

    await prisma.loginAttempt.update({ where: { userId: user.id }, data: { failedCount: 0, lockedUntil: null } });
    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: hashToken(refreshToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
    });

    await createAuditLog({
      entityType: "Auth",
      entityId: user.id,
      action: AuditAction.CREATE,
      oldValue: null,
      newValue: { event: "LOGIN_SUCCESS", ipAddress },
      performedBy: user.id
    });

    return { accessToken, refreshToken };
  },

  async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) return null;

    await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
    const nextPayload = { userId: payload.userId, role: payload.role };
    const newAccessToken = signAccessToken(nextPayload);
    const newRefreshToken = signRefreshToken(nextPayload);
    await prisma.refreshToken.create({
      data: { userId: payload.userId, tokenHash: hashToken(newRefreshToken), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
    });
    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  },

  async logout(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing) return;
    await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  },

  async createUser(input: { name: string; email: string; password: string; role: Role; managerId?: string }) {
    const { password, ...userData } = input;
    const managerId = userData.managerId ?? null;
    const passwordHash = await bcrypt.hash(input.password, 10);
    return prisma.user.create({
      data: { ...userData, managerId, passwordHash },
      select: safeUserSelect
    });
  },

  async listUsers(options: ListQueryOptions) {
    const roleMatch = Object.values(Role).find((role) => role.includes(options.search.toUpperCase()));
    const where = options.search
      ? {
          OR: [
            { name: { contains: options.search, mode: "insensitive" as const } },
            { email: { contains: options.search, mode: "insensitive" as const } },
            ...(roleMatch ? [{ role: roleMatch }] : [])
          ]
        }
      : undefined;

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          ...safeUserSelect,
          manager: { select: safeUserSelect },
          team: { select: safeUserSelect }
        },
        orderBy: { createdAt: "desc" },
        skip: options.skip,
        take: options.limit
      }),
      prisma.user.count({ where })
    ]);

    return toPaginatedResponse(items, total, options.page, options.limit);
  },

  async updateUser(id: string, patch: { name?: string; managerId?: string | null }, performedBy: string) {
    const before = await prisma.user.findUnique({ where: { id } });
    const updated = await prisma.user.update({
      where: { id },
      data: patch,
      select: safeUserSelect
    });

    if (before && before.managerId !== updated.managerId) {
      await createAuditLog({
        entityType: "UserHierarchy",
        entityId: updated.id,
        action: AuditAction.UPDATE,
        oldValue: { managerId: before.managerId },
        newValue: { managerId: updated.managerId },
        performedBy
      });
    }

    return updated;
  }
};
