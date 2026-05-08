import cors from "cors";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { apiRouter } from "./router.js";
import { openApiSpec } from "./docs/swagger.js";

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

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/docs.json", (_req, res) => res.json(openApiSpec));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use(apiRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(400).json({ message: err?.message || "Unexpected error" });
});
