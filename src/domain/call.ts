export function initiatesOffer(userId: string, partnerId: string): boolean {
  if (!userId || !partnerId || userId === partnerId) return false;
  return String(userId) < String(partnerId);
}
