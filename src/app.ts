import cors from "cors";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { apiRouter } from "./router.js";
import { openApiSpec } from "./docs/swagger.js";
import { HttpError } from "./lib/http-error.js";
import { sendApiResponse } from "./lib/api-response.js";

export const app = express();
const configuredCorsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const defaultCorsOrigins = ["http://localhost:3000", "http://localhost", "https://localhost"];
const backendOrigin = process.env.PV_BACKEND_ORIGIN?.trim();
const corsOrigins = new Set<string>([
  ...defaultCorsOrigins,
  ...configuredCorsOrigins,
  ...(backendOrigin ? [backendOrigin] : [])
]);

function isLocalhostOrigin(origin: string) {
  try {
    const parsed = new URL(origin);
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  } catch {
    return false;
  }
}

app.set("trust proxy", 1);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.has("*") || corsOrigins.has(origin) || isLocalhostOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed by CORS"));
    },
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"]
  })
);
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 400,
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => sendApiResponse(res, "Service is healthy and reachable.", { ok: true }));
app.get("/docs.json", (_req, res) => {
  res.set("X-Message", "OpenAPI specification retrieved successfully.");
  return res.json(openApiSpec);
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use(apiRouter);
app.use((req, res) =>
  res.status(404).json({
    message: `Route not found for ${req.method} ${req.originalUrl}`
  })
);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {})
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      details: err.flatten()
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        message: "Unique constraint violation. The resource already exists.",
        code: err.code,
        meta: err.meta
      });
    }

    if (err.code === "P2025") {
      return res.status(404).json({
        message: "The requested resource was not found.",
        code: err.code,
        meta: err.meta
      });
    }

    return res.status(400).json({
      message: "Database request failed.",
      code: err.code,
      meta: err.meta
    });
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  const status = message === "Origin not allowed by CORS" ? 403 : 500;
  return res.status(status).json({ message });
});
