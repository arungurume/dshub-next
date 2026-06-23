'use client';

import React from 'react';
import { usePermissions, RoleType } from '@/hooks/usePermissions';

interface PermissionGuardProps {
  children: React.ReactNode;
  allowedRoles?: RoleType[];
  requiredAction?: 'INVITE_USER' | 'MANAGE_BILLING' | 'PAIR_SCREEN' | 'CREATE_CONTENT' | 'MUTATE_SCHEDULES';
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  allowedRoles,
  requiredAction,
  fallback = null,
}) => {
  const { hasRole, canPerform } = usePermissions();

  let hasAccess = true;

  if (allowedRoles && !hasRole(allowedRoles)) {
    hasAccess = false;
  }

  if (requiredAction && !canPerform(requiredAction)) {
    hasAccess = false;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
export default PermissionGuard;
