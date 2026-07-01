export function isBearerAuthorized(authorizationHeader: string | null, adminToken?: string): boolean {
  if (!adminToken) return false;
  return authorizationHeader === `Bearer ${adminToken}`;
}
