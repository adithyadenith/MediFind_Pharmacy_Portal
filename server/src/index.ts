import path from "node:path";
import { existsSync } from "node:fs";
import app from "./app";
import { ensureDatabaseSchema } from "./db";
import { logger } from "./lib/logger";

const localEnvPath = path.resolve(process.cwd(), "..", ".env");

if (typeof process.loadEnvFile === "function" && existsSync(localEnvPath)) {
  process.loadEnvFile(localEnvPath);
}

const rawPort = process.env["PORT"] || "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  await ensureDatabaseSchema();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

startServer().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
