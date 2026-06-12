import express, { type Express } from "express";
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
  origin: (origin, callback) => {
    // Allow Replit, Vercel, localhost, and any configured frontend URL
    const allowed = [
      process.env["FRONTEND_URL"],       // set in Render dashboard
      /\.vercel\.app$/,                  // any Vercel preview/prod URL
      /\.replit\.dev$/,                  // Replit dev
      /\.replit\.app$/,                  // Replit deployment
      /^http:\/\/localhost/,             // local dev
      /^http:\/\/127\.0\.0\.1/,
    ].filter(Boolean);

    if (!origin) return callback(null, true); // same-origin / server-to-server
    const ok = allowed.some((p) =>
      typeof p === "string" ? p === origin : (p as RegExp).test(origin)
    );
    callback(ok ? null : new Error("CORS: origin not allowed"), ok);
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
