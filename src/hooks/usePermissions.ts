import { useDSStore } from '@/store/useDSStore';

export type RoleType = 'ORGANIZATION_ADMIN' | 'LOCATION_ADMIN' | 'USER' | 'READ_ONLY';

export const usePermissions = () => {
  const currentUser = useDSStore((state) => state.currentUser);
  
  // Get active role name from profile (case insensitive comparison)
  const roleName = (currentUser?.roles?.[0]?.name || 'READ_ONLY').toUpperCase() as RoleType;

  const isOrgAdmin = roleName === 'ORGANIZATION_ADMIN';
  const isLocAdmin = roleName === 'LOCATION_ADMIN';
  const isUser = roleName === 'USER';
  const isReadOnly = roleName === 'READ_ONLY';

  const hasRole = (roles: RoleType[]): boolean => {
    return roles.includes(roleName);
  };

  // Action capabilities mapping
  const canPerform = (action: 'INVITE_USER' | 'MANAGE_BILLING' | 'PAIR_SCREEN' | 'CREATE_CONTENT' | 'MUTATE_SCHEDULES'): boolean => {
    switch (action) {
      case 'MANAGE_BILLING':
      case 'INVITE_USER':
        return isOrgAdmin;
      case 'PAIR_SCREEN':
        return isOrgAdmin || isLocAdmin; // User role cannot pair screens or screen groups
      case 'CREATE_CONTENT':
      case 'MUTATE_SCHEDULES':
        return isOrgAdmin || isLocAdmin || isUser; // Read-only cannot mutate
      default:
        return false;
    }
  };

  return {
    role: roleName,
    isOrgAdmin,
    isLocAdmin,
    isUser,
    isReadOnly,
    hasRole,
    canPerform,
  };
};
export default usePermissions;
