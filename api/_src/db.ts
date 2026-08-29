/**
 * Prisma client singleton.
 *
 * A single client is reused across warm serverless invocations to avoid
 * exhausting database connections (important on Vercel). Prefer a pooled
 * connection string (e.g. Neon's pooled URL) in production.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** The transaction-client type accepted inside `prisma.$transaction(async (tx) => …)`. */
export type PrismaTransaction = Parameters<
  Parameters<PrismaClient["$transaction"]>[0]
>[0];
