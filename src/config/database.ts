import { PrismaClient } from "@prisma/client";
import logger from "./logger";

const prisma = new PrismaClient({
  log: ["query", "error", "warn"],
});

prisma
  .$connect()
  .then(() => {
    logger.info("Database connected successfully");
  })
  .catch((error: unknown) => {
    logger.error("Database connection failed:", error);
    process.exit(1);
  });

export default prisma;
