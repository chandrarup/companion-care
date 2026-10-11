/**
 * Wrap a database / provider error so the client only sees a generic message
 * while full detail is preserved in server logs. Raw Postgres errors leak
 * constraint names, column names, and schema structure.
 */
export function safeDbError(
  err: unknown,
  clientMessage = "Operation failed. Please try again.",
): Error {
  // Server-only logging — TanStack Start server functions run on the worker.
  // eslint-disable-next-line no-console
  console.error("[db error]", err);
  return new Error(clientMessage);
}