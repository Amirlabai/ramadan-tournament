/** @deprecated Use record.id — kept for one release of API responses that still send _id. */
export function entityId(
  record: { id?: string | number; _id?: string | number } | null | undefined,
): string {
  const value = record?.id ?? record?._id;
  return value == null ? '' : String(value);
}
