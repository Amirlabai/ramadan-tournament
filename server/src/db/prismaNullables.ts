/** Map optional auth token fields for Prisma: undefined → omit on create paths; null clears in DB. */
export function prismaNullableTokenField<T>(value: T | undefined | null): T | null {
  return value ?? null;
}
