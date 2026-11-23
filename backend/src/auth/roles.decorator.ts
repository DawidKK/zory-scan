import { SetMetadata } from '@nestjs/common';

export type Role = 'scanner' | 'admin';
export const ROLES_KEY = 'roles';

/** Admin ma dostęp do wszystkiego, scanner tylko do endpointów oznaczonych 'scanner'. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
