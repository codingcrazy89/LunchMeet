import { pino } from "pino";
import { env } from "../env.js";

/**
 * Structured logging.
 *
 * v1's only logging was console statements, plus an in-app buffer that patched
 * console methods and captured auth deep links with session tokens in them.
 * Nothing reached a queryable destination.
 *
 * The redaction list is not decoration: `authorization` and `cookie` carry
 * session tokens, and logging them would recreate exactly the v1 problem in a
 * place that is harder to notice.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "headers.authorization",
      "headers.cookie",
      "*.password",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
    ],
    censor: "[redacted]",
  },
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
});

export type Logger = typeof logger;
