export function buildCertificateReference(attemptId: string, completedAt: string) {
  const year = new Date(completedAt).getUTCFullYear();
  const identifier = attemptId.replaceAll("-", "").slice(0, 12).toUpperCase();
  return `IFI-${year}-${identifier}`;
}
