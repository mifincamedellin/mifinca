import app from "./app";
import { logger } from "./lib/logger";
import { ensureDemoAuthUser, ensureDemoFarmData } from "./routes/seed.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureDemoAuthUser()
  .then(() => {
    logger.info("Demo user ready");
    return ensureDemoFarmData();
  })
  .then(() => logger.info("Demo farm data ready"))
  .catch((err) => logger.warn({ err }, "Could not seed demo data"));

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
