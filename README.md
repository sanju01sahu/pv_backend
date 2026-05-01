# Edilteca Backend API

Production-ready backend for photovoltaic sales network operations, including user hierarchy, solution versioning, contracts, commissions, bonuses, payments, audit logging, and reporting.

## Stack
- Node.js + Express 5 + TypeScript
- PostgreSQL + Prisma ORM
- JWT auth (access + refresh token rotation)
- Zod request validation
- Swagger/OpenAPI docs (`/docs`, `/docs.json`)
- Vitest + Supertest API tests
- Cron job for monthly bonus automation

## Repository Layout
- `src/server.ts`: boots HTTP server and schedules cron jobs
- `src/app.ts`: middleware, rate limiting, docs, global error handler
- `src/router.ts`: top-level API mount points
- `src/modules/*`: feature modules (route/controller/service)
- `src/middleware/auth.ts`: bearer auth + role authorization
- `src/lib/auth.ts`: JWT sign/verify and refresh-token hashing
- `src/lib/prisma.ts`: Prisma client singleton
- `src/services/jobs.ts`: monthly scheduled bonus run
- `prisma/schema.prisma`: relational model and enums
- `prisma/seed.ts`: admin bootstrap script
- `tests/section5.api.test.ts`: business-rule integration tests

## API Base Paths
Mounted from `src/router.ts`:
- `/users`
- `/solutions`
- `/contracts`
- `/commissions`
- `/bonuses`
- `/payments`
- `/audit-logs`
- `/reports`

System routes:
- `GET /health`
- `GET /docs`
- `GET /docs.json`

## Security and Access Model
- Auth header: `Authorization: Bearer <access_token>`
- Access token TTL: `15m`
- Refresh token TTL: `30d`
- Login rate limit: 20 attempts / 15 minutes per IP (`/users/login`)
- Global API rate limit: 400 requests / 15 minutes per IP
- Login lockout (configurable): failed logins tracked per user and account lock applied after threshold

Roles:
- `ADMIN`
- `AREA_MANAGER`
- `AGENT`

## Environment Variables
Reference `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pv_sales"
JWT_SECRET="change-me"
JWT_REFRESH_SECRET="change-refresh-me"
JWT_ISSUER="pv-sales-platform"
JWT_AUDIENCE="pv-sales-api"
MAX_FAILED_LOGINS=5
LOGIN_LOCKOUT_MINUTES=15
PORT=3000
```

## Domain and Business Rules
1. Solution versioning is immutable. New pricing/commission requires a new `SolutionVersion`.
2. Contract creation resolves active version by installation date (`validFrom <= installationDate <= validTo/null`).
3. Base commission entries are created at contract creation time and are append-only.
4. Retroactive version updates can create adjustment commission rows (delta-based, immutable).
5. Bonuses are separate `Commission` rows with type `BONUS`.
6. Payment `effectiveStatus` is derived from transaction totals unless status is forced to `DISPUTED` or `CANCELLED`.
7. Critical writes create `AuditLog` entries.

## API Reference

### 1) Users
- `POST /users/login` (public)
  - Body: `{ "email": string, "password": string }`
  - `200`: `{ accessToken, refreshToken }`
  - `401`: invalid credentials
  - `423`: account temporarily locked

- `POST /users/refresh` (public)
  - Body: `{ "refreshToken": string }`
  - Rotates refresh token and returns a new token pair.

- `POST /users/logout` (public)
  - Body: `{ "refreshToken": string }`
  - Revokes refresh token; returns `204`.

- `POST /users` (`ADMIN`)
  - Body: `{ name, email, password, role, managerId? }`
  - Password policy: min 12 chars + upper + lower + digit + special char.

- `GET /users` (authenticated)
  - Returns users including `manager` and `team` relations.

- `PATCH /users/:id` (`ADMIN`)
  - Body: `{ name?, managerId?: string | null }`
  - Manager hierarchy changes are audited.

### 2) Solutions
- `POST /solutions` (`ADMIN`)
  - Body: `{ "name": string }`

- `POST /solutions/:id/version` (`ADMIN`)
  - Body: `{ price, baseCommission, validFrom, validTo?, retroactive? }`
  - If `retroactive=true`, recalculates affected contract base commissions by creating adjustment records.

- `GET /solutions/:id/versions` (authenticated)
  - Returns versions ordered by `validFrom DESC`.

### 3) Contracts
- `POST /contracts` (authenticated)
  - Body: `{ solutionId, customerDetails, installationDate, status?, agentId? }`
  - `AGENT` callers automatically create for themselves.
  - Non-agent callers must provide `agentId`.
  - Creates contract + base commission row.

- `GET /contracts` (authenticated)
  - `AGENT`: only own contracts.
  - `ADMIN`/`AREA_MANAGER`: all contracts.

### 4) Commissions
- `GET /commissions` (`ADMIN`, `AREA_MANAGER`)
- `GET /commissions/:userId` (authenticated)

### 5) Bonuses
- `POST /bonuses/run-monthly` (`ADMIN`)
  - Body: `{ year, month }`
  - Rules:
    - Agent bonus: if monthly contract count > 10, bonus = 15% of monthly base commission total.
    - Manager bonus: if network contract count > 20, bonus = 15% of network base commission total.

### 6) Payments
- `POST /payments` (`ADMIN`)
  - Body: `{ userId, totalAmount, status? }`
  - Optional status can be forced to `DISPUTED` or `CANCELLED`.

- `POST /payments/:id/transactions` (`ADMIN`)
  - Body: `{ amount, method, referenceNumber?, proofUrl?, adminNote? }`

- `GET /payments` (`ADMIN`, `AREA_MANAGER`)
  - Returns each payment with computed `effectiveStatus`.

### 7) Audit Logs
- `GET /audit-logs` (`ADMIN`)
  - Returns latest 500 audit entries ordered by timestamp descending.

### 8) Reports
- `GET /reports/monthly-earnings?year=YYYY&month=MM` (`ADMIN`, `AREA_MANAGER`)
- `GET /reports/manager-network-performance` (`ADMIN`)
- `GET /reports/payments-summary` (`ADMIN`)
- `GET /reports/bonus-summary` (`ADMIN`, `AREA_MANAGER`)

## Local Development

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Default seed values (override via env):
- email: `admin@pv.local`
- password: `admin123`

## Testing

Run all API tests:

```bash
npm run test:api
```

Watch mode:

```bash
npm run test:api:watch
```

What the current integration suite validates:
- Active solution version resolution by install date
- Immutable base commission behavior
- Monthly bonus generation (agent + manager)
- Retroactive recalculation with audit trail
- Derived payment status behavior

## Build and Run (Production Mode)

```bash
npm run build
npm run start
```

## Deployment Guide

### 1) Infrastructure
- PostgreSQL instance (managed or self-hosted)
- Node.js runtime (LTS recommended)
- Process manager (PM2/systemd) or container runtime
- Secure secret store for environment variables

### 2) CI/CD Pipeline (recommended)
1. Install dependencies: `npm ci`
2. Generate Prisma client: `npm run prisma:generate`
3. Run tests: `npm run test:api`
4. Build artifact: `npm run build`
5. Deploy artifact + environment
6. Run migrations in target environment
7. Start service and validate `/health`

### 3) Database Migration Strategy
- Use `prisma migrate dev` only for local development.
- For deployment, run generated migrations in the target environment and fail deployment on migration errors.
- Take DB backups before applying production migrations.

### 4) Runtime Hardening Checklist
- Set strong `JWT_SECRET` and `JWT_REFRESH_SECRET`.
- Restrict DB network access by security groups/firewall.
- Run app behind reverse proxy / load balancer.
- Enable centralized logs and alerts for 4xx/5xx spikes.
- Monitor lockout and auth failure audit events.

### 5) Monthly Bonus Automation
- Cron schedule: `5 0 1 * *` (runs on day 1 at 00:05 server time)
- Job computes previous UTC month and executes bonus creation.
- Ensure only one scheduler instance runs at a time in multi-replica deployments (leader election / single worker pattern).

## Operational Notes
- Global error middleware returns `400` for unhandled thrown errors; keep this in mind for client behavior.
- Payment `status` in DB may remain `PENDING`; clients should use `effectiveStatus` from API responses.
- Swagger spec is defined in code (`src/docs/swagger.ts`) and served directly by the app.
