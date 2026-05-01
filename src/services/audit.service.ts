import { AuditAction } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const normalizeForJson = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeForJson);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.toJSON === "function") return normalizeForJson(obj.toJSON());
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = normalizeForJson(v);
    return out;
  }
  return value;
};

export const createAuditLog = async (input: {
  entityType: string;
  entityId: string;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
  performedBy: string;
}) => {
  await prisma.auditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      oldValue: normalizeForJson(input.oldValue) as any,
      newValue: normalizeForJson(input.newValue) as any,
      performedBy: input.performedBy
    }
  });
};
