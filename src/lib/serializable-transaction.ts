import { Prisma } from "@prisma/client";

export async function runSerializableTransaction<T>(
  client: {
    $transaction<R>(
      operation: (tx: Prisma.TransactionClient) => Promise<R>,
      options: { isolationLevel: Prisma.TransactionIsolationLevel }
    ): Promise<R>;
  },
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = 3
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await client.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      const retryable = typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
      if (!retryable || attempt === maxAttempts) throw error;
    }
  }

  throw new Error("Serializable transaction retry limit was exhausted.");
}
