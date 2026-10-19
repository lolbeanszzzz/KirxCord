import { PERM, type Role, type Server } from './types';

/** Mirrors the database's has_perm(): owner is admin; otherwise the @everyone role plus assigned roles. */
export function computePerms(server: Server, userId: string, roles: Role[], myRoleIds: string[]): number {
  if (server.owner_id === userId) return PERM.ADMINISTRATOR;
  return roles.reduce((acc, r) => (r.is_default || myRoleIds.includes(r.id) ? acc | r.permissions : acc), 0);
}
