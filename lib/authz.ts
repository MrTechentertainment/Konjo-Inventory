import type { UserProfile } from './types';

export const ROOT_OWNER_ID = '4b36aa09-11b2-4b2e-9322-69e4f1a80001';
export const ROOT_OWNER_USERNAME = 'natanim';
export const ROOT_OWNER_EMAIL = 'natanim@konjo.com';

export function isAdminProfile(profile: UserProfile | null | undefined): boolean {
  return profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';
}

export function isRootProfile(profile: UserProfile | null | undefined): boolean {
  return Boolean(
    profile &&
      profile.id === ROOT_OWNER_ID &&
      profile.role === 'SUPER_ADMIN' &&
      profile.username.trim().toLowerCase() === ROOT_OWNER_USERNAME
  );
}

export function usernameEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  return normalized === ROOT_OWNER_USERNAME ? ROOT_OWNER_EMAIL : `${normalized}@konjo.internal`;
}
