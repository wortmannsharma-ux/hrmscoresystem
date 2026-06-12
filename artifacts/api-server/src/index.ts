import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "./lib/migrate.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run DB migrations before accepting requests
runMigrations()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Migration failed — starting server anyway");
    // Start anyway so non-DB routes still work
    app.listen(port, () => {
      logger.info({ port }, "Server listening (migrations may have failed)");
    });
  });
