import { app } from "./app.ts";
import { env } from "./config/env.ts";
import { logger } from "./logger.ts";

app.listen(env.PORT, () => {
  logger.info(`Server listening on http://localhost:${env.PORT}`);
});

function exitOnFatal(reason: unknown, message: string): never {
  logger.fatal({ err: reason }, message);
  process.exit(1);
}

process.on("uncaughtException", (err) => exitOnFatal(err, "Uncaught exception"));
process.on("unhandledRejection", (reason) => exitOnFatal(reason, "Unhandled rejection"));
