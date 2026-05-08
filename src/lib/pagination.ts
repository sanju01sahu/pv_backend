const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

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
  const search = typeof searchRaw === "string" ? searchRaw.trim() : "";
  const page = parsePositiveInt(query.page, DEFAULT_PAGE, "page");
  const limit = parsePositiveInt(query.limit, DEFAULT_LIMIT, "limit", MAX_LIMIT);
  return {
    search,
    page,
    limit,
    skip: (page - 1) * limit
  };
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
