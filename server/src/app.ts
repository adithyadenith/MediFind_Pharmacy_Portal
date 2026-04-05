import path from "node:path";
import { existsSync } from "node:fs";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = "dev-secret-change-in-production";
  console.warn("WARNING: SESSION_SECRET not set. Using default dev secret — change this in production!");
}

const app: Express = express();
const clientDistPath = path.resolve(process.cwd(), "..", "client", "dist");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use("/api", router);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const errorObject = typeof err === "object" && err !== null ? err as Record<string, unknown> : null;
  const errorCode =
    typeof errorObject?.code === "string"
      ? errorObject.code
      : typeof errorObject?.cause === "object" &&
          errorObject.cause !== null &&
          typeof (errorObject.cause as Record<string, unknown>).code === "string"
        ? String((errorObject.cause as Record<string, unknown>).code)
        : null;

  const status =
    typeof errorObject?.status === "number"
      ? errorObject.status
      : errorCode === "ENOTFOUND" || errorCode === "ECONNREFUSED" || errorCode === "ETIMEDOUT"
        ? 503
        : 500;

  const message =
    err instanceof SyntaxError && "body" in err
      ? "Invalid JSON request body"
      : errorCode === "ENOTFOUND"
        ? "Database host could not be resolved. Check DATABASE_URL."
      : errorCode === "ECONNREFUSED" || errorCode === "ETIMEDOUT"
        ? "Database connection failed. Check DATABASE_URL and network access."
      : err instanceof Error && status < 500
        ? err.message
        : "Internal server error";

  req.log?.error?.({ err }, "Unhandled API error");

  if (res.headersSent) {
    return;
  }

  res.status(status).json({ error: message });
});

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

export default app;
