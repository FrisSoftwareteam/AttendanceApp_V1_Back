export function isMongoDuplicate(err: unknown) {
  return Boolean(err && typeof err === "object" && (err as { code?: number }).code === 11000);
}
