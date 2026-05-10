import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/auth.js";
import { createAuditLog } from "../../services/audit.service.js";
import { AuditAction } from "@prisma/client";
import { ListQueryOptions, toExclusiveEndDate, toPaginatedResponse } from "../../lib/pagination.js";
import { HttpError } from "../../lib/http-error.js";

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
    const attempt = await prisma.loginAttempt.findUnique({ where: { userId: user.id } });

    if (attempt?.lockedUntil && attempt.lockedUntil > now) {
      void createAuditLog({
        entityType: "Auth",
        entityId: user.id,
        action: AuditAction.UPDATE,
        oldValue: null,
        newValue: { event: "LOGIN_BLOCKED_LOCKOUT", ipAddress },
        performedBy: user.id
      }).catch((error) => {
        console.error("Failed to write login lockout audit log", error);
      });
      return { locked: true as const, lockedUntil: attempt.lockedUntil };
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const failedCount = (attempt?.failedCount ?? 0) + 1;
      const lockedUntil = failedCount >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) : null;
      await Promise.all([
        attempt
          ? prisma.loginAttempt.update({ where: { userId: user.id }, data: { failedCount, lockedUntil } })
          : prisma.loginAttempt.create({ data: { userId: user.id, failedCount, lockedUntil } }),
        createAuditLog({
          entityType: "Auth",
          entityId: user.id,
          action: AuditAction.UPDATE,
          oldValue: null,
          newValue: { event: "LOGIN_FAILED", failedCount, lockedUntil, ipAddress },
          performedBy: user.id
        })
      ]);
      return null;
    }

    const payload = { userId: user.id, role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await Promise.all([
      attempt && (attempt.failedCount > 0 || attempt.lockedUntil)
        ? prisma.loginAttempt.update({ where: { userId: user.id }, data: { failedCount: 0, lockedUntil: null } })
        : Promise.resolve(),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      }),
      createAuditLog({
        entityType: "Auth",
        entityId: user.id,
        action: AuditAction.CREATE,
        oldValue: null,
        newValue: { event: "LOGIN_SUCCESS", ipAddress },
        performedBy: user.id
      })
    ]);

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
    const statusRoleMatch = Object.values(Role).find((role) => role === options.status.toUpperCase());
    const endDateExclusive = toExclusiveEndDate(options.endDate);
    const whereClauses: Prisma.UserWhereInput[] = [];

    if (options.search) {
      whereClauses.push({
        OR: [
          { name: { contains: options.search, mode: "insensitive" as const } },
          { email: { contains: options.search, mode: "insensitive" as const } },
          { manager: { name: { contains: options.search, mode: "insensitive" as const } } },
          { manager: { email: { contains: options.search, mode: "insensitive" as const } } },
          ...(roleMatch ? [{ role: roleMatch }] : [])
        ]
      });
    }

    if (statusRoleMatch) {
      whereClauses.push({ role: statusRoleMatch });
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
    const orderBy: Prisma.UserOrderByWithRelationInput =
      options.sortBy === "name"
        ? { name: options.sortOrder }
        : { createdAt: options.sortBy === "createdAt" ? options.sortOrder : "desc" };

    const [items, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: {
          ...safeUserSelect,
          manager: { select: safeUserSelect },
          team: { select: safeUserSelect }
        },
        orderBy,
        skip: options.skip,
        take: options.limit
      }),
      prisma.user.count({ where })
    ]);

    return toPaginatedResponse(items, total, options.page, options.limit);
  },

  async updateUser(
    id: string,
    patch: { name?: string; email?: string; role?: Role; managerId?: string | null; password?: string },
    performedBy: string
  ) {
    const before = await prisma.user.findUnique({ where: { id } });
    if (!before) throw new HttpError(404, "User not found.");

    const nextRole = patch.role ?? before.role;
    const requestedManagerId = patch.managerId === undefined ? before.managerId : patch.managerId;
    const nextManagerId = nextRole === Role.AGENT ? requestedManagerId : null;

    if (nextManagerId === id) {
      throw new HttpError(400, "A user cannot be assigned as their own manager.");
    }

    if (nextRole === Role.AGENT && !nextManagerId) {
      throw new HttpError(400, "Agent users must be assigned to a manager.");
    }

    if (nextManagerId) {
      const manager = await prisma.user.findUnique({
        where: { id: nextManagerId },
        select: { id: true, role: true }
      });
      if (!manager || (manager.role !== Role.ADMIN && manager.role !== Role.AREA_MANAGER)) {
        throw new HttpError(400, "Assigned manager must be an admin or area manager.");
      }
    }

    const passwordHash = patch.password ? await bcrypt.hash(patch.password, 10) : undefined;
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.role !== undefined ? { role: patch.role } : {}),
        ...(patch.managerId !== undefined || patch.role !== undefined ? { managerId: nextManagerId } : {}),
        ...(passwordHash ? { passwordHash } : {})
      },
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

    if (patch.password) {
      await prisma.refreshToken.updateMany({
        where: { userId: updated.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });

      await createAuditLog({
        entityType: "Auth",
        entityId: updated.id,
        action: AuditAction.UPDATE,
        oldValue: null,
        newValue: { event: "PASSWORD_RESET_BY_ADMIN" },
        performedBy
      });
    }

    return updated;
  }
};
