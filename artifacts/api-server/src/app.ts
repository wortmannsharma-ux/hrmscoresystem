import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Global error handler ─────────────────────────────────────────────────────
// Catches any unhandled error thrown inside route handlers.
// Without this, Express returns its default HTML error page instead of JSON.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  const status = (err as any)?.status ?? (err as any)?.statusCode ?? 500;
  const message = (err as any)?.message ?? "Internal server error";

  // Postgres unique constraint violation
  if ((err as any)?.code === "23505") {
    res.status(400).json({ message: "A record with these details already exists." });
    return;
  }

  logger.error({ err }, "Unhandled route error");
  res.status(status).json({ message });
});

export default app;
