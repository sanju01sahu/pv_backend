const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;
const DAY_MS = 24 * 60 * 60 * 1000;

function pickFirst(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInt(value: unknown, fallback: number, name: string, max?: number) {
  const picked = pickFirst(value);
  if (picked === undefined || picked === null || picked === "") return fallback;

  const parsed = Number(picked);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  if (typeof max === "number" && parsed > max) {
    throw new Error(`${name} must be less than or equal to ${max}`);
  }
  return parsed;
}

export interface ListQueryOptions {
  search: string;
  status: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  startDate: Date | null;
  endDate: Date | null;
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export function parseListQuery(input: unknown): ListQueryOptions {
  const query = (input ?? {}) as Record<string, unknown>;
  const searchRaw = pickFirst(query.search);
  const statusRaw = pickFirst(query.status);
  const sortByRaw = pickFirst(query.sortBy);
  const sortOrderRaw = pickFirst(query.sortOrder);
  const startDateRaw = pickFirst(query.startDate);
  const endDateRaw = pickFirst(query.endDate);
  const search = typeof searchRaw === "string" ? searchRaw.trim() : "";
  const status = typeof statusRaw === "string" ? statusRaw.trim() : "";
  const sortBy = typeof sortByRaw === "string" ? sortByRaw.trim() : "";
  const sortOrder = sortOrderRaw === "asc" ? "asc" : "desc";
  const startDate = parseDate(startDateRaw, "startDate");
  const endDate = parseDate(endDateRaw, "endDate");
  if (startDate && endDate && startDate > endDate) {
    throw new Error("startDate must be before or equal to endDate");
  }
  const page = parsePositiveInt(query.page, DEFAULT_PAGE, "page");
  const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT, "limit", MAX_LIMIT);
  return {
    search,
    status,
    sortBy,
    sortOrder,
    startDate,
    endDate,
    page,
    limit,
    skip: (page - 1) * limit
  };
}

function parseDate(value: unknown, name: string) {
  const picked = pickFirst(value);
  if (picked === undefined || picked === null || picked === "") return null;
  if (typeof picked !== "string") {
    throw new Error(`${name} must be a valid date string`);
  }
  const parsed = new Date(picked);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${name} must be a valid date string`);
  }
  return parsed;
}

export function toExclusiveEndDate(endDate: Date | null) {
  if (!endDate) return null;
  return new Date(endDate.getTime() + DAY_MS);
}

export function toPaginatedResponse<T>(items: T[], total: number, page: number, limit: number): PaginatedResponse<T> {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit)
    }
  };
}
