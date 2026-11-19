// tests/helpers/userManagementLogic.ts
// Pure domain logic for User Management, RBAC separation, SuperAdminRoute guards, and Profile governance

const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function secureRandomSuffix(length = 6): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHANUMERIC_CHARS[b % ALPHANUMERIC_CHARS.length]).join('');
}

export interface UserRegistrationInput {
  email?: string | null;
  password?: string | null;
  displayName?: string | null;
  phone?: string | null;
}

export interface DefaultUserProfileResult {
  email: string;
  displayName: string;
  phone: string;
  role: 'user';
  is_banned: boolean;
  referral_code: string;
  created_at: string;
}

/**
 * Validates new user registration input and prepares default profile attributes
 */
export function validateUserRegistration({
  email,
  password,
  displayName,
  phone,
}: UserRegistrationInput): {
  valid: boolean;
  errors: string[];
  defaultProfile: DefaultUserProfileResult;
} {
  const errors: string[] = [];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Valid email address is required.');
  }

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters.');
  }

  if (!displayName || !displayName.trim()) {
    errors.push('Display name is required.');
  }

  const referralCode = generateReferralCode();

  return {
    valid: errors.length === 0,
    errors,
    defaultProfile: {
      email: email ? email.trim().toLowerCase() : '',
      displayName: displayName ? displayName.trim() : '',
      phone: phone ? phone.trim() : '',
      role: 'user',
      is_banned: false,
      referral_code: referralCode,
      created_at: new Date().toISOString(),
    },
  };
}

/**
 * Generates referral code matching database trigger pattern: VN-XXXXXX
 */
export function generateReferralCode(customSuffix?: string): string {
  if (customSuffix && /^[A-Z0-9]{6}$/.test(customSuffix)) {
    return `VN-${customSuffix}`;
  }
  return `VN-${secureRandomSuffix(6)}`;
}

export interface DirectoryUserLike {
  id?: string;
  uid?: string;
  display_name?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  is_banned?: boolean;
  [key: string]: unknown;
}

/**
 * Filters user directory according to UserManager.tsx multi-field search rule
 */
export function filterUsersDirectory<T extends DirectoryUserLike>(
  users: T[] | null | undefined,
  searchTerm: unknown
): T[] {
  if (!Array.isArray(users)) return [];
  if (!searchTerm || !String(searchTerm).trim()) return users;

  const query = String(searchTerm).trim().toLowerCase();

  return users.filter((u) => {
    if (!u) return false;
    const nameMatch = Boolean(u.display_name && u.display_name.toLowerCase().includes(query));
    const emailMatch = Boolean(u.email && u.email.toLowerCase().includes(query));
    const phoneMatch = Boolean(u.phone && u.phone.toLowerCase().includes(query));
    return nameMatch || emailMatch || phoneMatch;
  });
}

/**
 * Resolves visual badge and icon for user role
 */
export function calculateUserRoleBadge(role: string | null | undefined): {
  text: string;
  icon: string | null;
  badgeClass: string;
  isSuperAdmin: boolean;
  isAdmin: boolean;
} {
  const normalized = (role || 'user').toLowerCase();

  if (normalized === 'super_admin') {
    return {
      text: 'Super Admin',
      icon: 'ShieldAlert',
      badgeClass: 'text-purple-700 bg-purple-50',
      isSuperAdmin: true,
      isAdmin: true,
    };
  }

  if (normalized === 'admin') {
    return {
      text: 'Admin',
      icon: 'Shield',
      badgeClass: 'text-blue-700 bg-blue-50',
      isSuperAdmin: false,
      isAdmin: true,
    };
  }

  return {
    text: 'User',
    icon: null,
    badgeClass: 'text-gray-700 bg-gray-100',
    isSuperAdmin: false,
    isAdmin: false,
  };
}

/**
 * Resolves visual badge and status for banned state
 */
export function calculateUserBanStatus(isBanned: boolean): {
  text: string;
  badgeClass: string;
  actionTitle: string;
  icon: string;
  isBanned: boolean;
} {
  if (isBanned) {
    return {
      text: 'Banned',
      badgeClass: 'bg-red-100 text-red-800',
      actionTitle: 'Unban User',
      icon: 'UserCheck',
      isBanned: true,
    };
  }

  return {
    text: 'Active',
    badgeClass: 'bg-green-100 text-green-800',
    actionTitle: 'Ban User',
    icon: 'UserX',
    isBanned: false,
  };
}

export interface SuperAdminGuardResult {
  isSelf?: boolean;
  isSuperAdminUser?: boolean;
  canModify: boolean;
  canBan: boolean;
  error: string | null;
}

/**
 * Evaluates Super Admin Immunity and Self-Protection guards for UserManager.tsx
 */
export function evaluateSuperAdminGuards({
  targetUser,
  currentUser,
}: {
  targetUser: DirectoryUserLike | null | undefined;
  currentUser: DirectoryUserLike | null | undefined;
}): SuperAdminGuardResult {
  if (!targetUser || !currentUser) {
    return { canModify: false, canBan: false, error: 'User context missing.' };
  }

  const currentId = currentUser.uid || currentUser.id;
  const targetId = targetUser.id || targetUser.uid;
  const isSelf = currentId === targetId;
  const isSuperAdminUser = targetUser.role === 'super_admin';

  if (isSelf) {
    return {
      isSelf: true,
      isSuperAdminUser,
      canModify: false,
      canBan: false,
      error: 'Cannot modify or ban your own account.',
    };
  }

  if (isSuperAdminUser) {
    return {
      isSelf: false,
      isSuperAdminUser: true,
      canModify: false,
      canBan: false,
      error: 'Cannot ban or modify another super admin.',
    };
  }

  return {
    isSelf: false,
    isSuperAdminUser: false,
    canModify: true,
    canBan: true,
    error: null,
  };
}

/**
 * Evaluates access to SuperAdminRoute
 */
export function evaluateSuperAdminRouteAccess({
  isLoggedIn,
  userRole,
}: {
  isLoggedIn: boolean;
  userRole?: string | null;
}): {
  allowed: boolean;
  status: 'redirect' | 'permission_denied' | 'granted';
  target?: string;
  errorMessage?: string;
} {
  if (!isLoggedIn) {
    return {
      allowed: false,
      status: 'redirect',
      target: '/admin',
    };
  }

  if (userRole !== 'super_admin') {
    return {
      allowed: false,
      status: 'permission_denied',
      errorMessage: 'You need Super Admin privileges to access this page.',
    };
  }

  return {
    allowed: true,
    status: 'granted',
  };
}

/**
 * Evaluates banned user authentication lockout and real-time suspension
 */
export function evaluateBannedUserSession(
  userProfile: { is_banned?: boolean } | null | undefined
): {
  allowed: boolean;
  action: 'unauthenticated' | 'force_sign_out' | 'continue_session';
  errorMessage?: string;
} {
  if (!userProfile) return { allowed: false, action: 'unauthenticated' };

  if (userProfile.is_banned) {
    return {
      allowed: false,
      action: 'force_sign_out',
      errorMessage: 'Your account has been suspended.',
    };
  }

  return {
    allowed: true,
    action: 'continue_session',
  };
}

/**
 * Evaluates Database Row Level Security (RLS) on public.profiles
 */
export function evaluateProfilesRLS(
  userRole: string | null | undefined,
  action: string,
  targetUserId?: string | null,
  currentUserId?: string | null
): boolean {
  const isSelf = Boolean(currentUserId && targetUserId && currentUserId === targetUserId);
  const isSuperAdmin = userRole === 'super_admin';
  const isAdmin = userRole === 'admin' || isSuperAdmin;

  // CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR is_admin());
  if (action === 'SELECT') {
    return isSelf || isAdmin;
  }

  // CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  if (action === 'INSERT') {
    return isSelf;
  }

  // CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR is_super_admin());
  if (action === 'UPDATE') {
    return isSelf || isSuperAdmin;
  }

  // CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (is_super_admin());
  if (action === 'DELETE') {
    return isSuperAdmin;
  }

  return false;
}
