import winston from "winston";

const isProduction = process.env.NODE_ENV === "production";

const transports: winston.transport[] = [];

// ✅ Always log to console (Vercel-friendly)
transports.push(
  new winston.transports.Console({
    format: isProduction
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple(),
        ),
  }),
);

// ✅ Only use file logging in local/dev
if (!isProduction) {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
    }),
  );
}

const logger = winston.createLogger({
  level: isProduction ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
  ),
  defaultMeta: { service: "quickshare-api" },
  transports,
});

export default logger;
