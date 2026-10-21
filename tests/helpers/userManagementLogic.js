// tests/helpers/userManagementLogic.js
// Pure domain logic for User Management, RBAC separation, SuperAdminRoute guards, and Profile governance

/**
 * Validates new user registration input and prepares default profile attributes
 */
export function validateUserRegistration({ email, password, displayName, phone }) {
  const errors = [];

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
      created_at: new Date().toISOString()
    }
  };
}

/**
 * Generates referral code matching database trigger pattern: VN-XXXXXX
 */
export function generateReferralCode(customSuffix) {
  if (customSuffix && /^[A-Z0-9]{6}$/.test(customSuffix)) {
    return `VN-${customSuffix}`;
  }
  const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
  const padded = (randomChars + 'ABCDEF').substring(0, 6);
  return `VN-${padded}`;
}

/**
 * Filters user directory according to UserManager.jsx multi-field search rule
 */
export function filterUsersDirectory(users, searchTerm) {
  if (!Array.isArray(users)) return [];
  if (!searchTerm || !String(searchTerm).trim()) return users;

  const query = String(searchTerm).trim().toLowerCase();

  return users.filter(u => {
    if (!u) return false;
    const nameMatch = u.display_name && u.display_name.toLowerCase().includes(query);
    const emailMatch = u.email && u.email.toLowerCase().includes(query);
    const phoneMatch = u.phone && u.phone.toLowerCase().includes(query);
    return nameMatch || emailMatch || phoneMatch;
  });
}

/**
 * Resolves visual badge and icon for user role
 */
export function calculateUserRoleBadge(role) {
  const normalized = (role || 'user').toLowerCase();

  if (normalized === 'super_admin') {
    return {
      text: 'Super Admin',
      icon: 'ShieldAlert',
      badgeClass: 'text-purple-700 bg-purple-50',
      isSuperAdmin: true,
      isAdmin: true
    };
  }

  if (normalized === 'admin') {
    return {
      text: 'Admin',
      icon: 'Shield',
      badgeClass: 'text-blue-700 bg-blue-50',
      isSuperAdmin: false,
      isAdmin: true
    };
  }

  return {
    text: 'User',
    icon: null,
    badgeClass: 'text-gray-700 bg-gray-100',
    isSuperAdmin: false,
    isAdmin: false
  };
}

/**
 * Resolves visual badge and status for banned state
 */
export function calculateUserBanStatus(isBanned) {
  if (isBanned) {
    return {
      text: 'Banned',
      badgeClass: 'bg-red-100 text-red-800',
      actionTitle: 'Unban User',
      icon: 'UserCheck',
      isBanned: true
    };
  }

  return {
    text: 'Active',
    badgeClass: 'bg-green-100 text-green-800',
    actionTitle: 'Ban User',
    icon: 'UserX',
    isBanned: false
  };
}

/**
 * Evaluates Super Admin Immunity and Self-Protection guards for UserManager.jsx
 */
export function evaluateSuperAdminGuards({ targetUser, currentUser }) {
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
      error: 'Cannot modify or ban your own account.'
    };
  }

  if (isSuperAdminUser) {
    return {
      isSelf: false,
      isSuperAdminUser: true,
      canModify: false,
      canBan: false,
      error: 'Cannot ban or modify another super admin.'
    };
  }

  return {
    isSelf: false,
    isSuperAdminUser: false,
    canModify: true,
    canBan: true,
    error: null
  };
}

/**
 * Evaluates access to SuperAdminRoute
 */
export function evaluateSuperAdminRouteAccess({ isLoggedIn, userRole }) {
  if (!isLoggedIn) {
    return {
      allowed: false,
      status: 'redirect',
      target: '/admin'
    };
  }

  if (userRole !== 'super_admin') {
    return {
      allowed: false,
      status: 'permission_denied',
      errorMessage: 'You need Super Admin privileges to access this page.'
    };
  }

  return {
    allowed: true,
    status: 'granted'
  };
}

/**
 * Evaluates banned user authentication lockout and real-time suspension
 */
export function evaluateBannedUserSession(userProfile) {
  if (!userProfile) return { allowed: false, action: 'unauthenticated' };

  if (userProfile.is_banned) {
    return {
      allowed: false,
      action: 'force_sign_out',
      errorMessage: 'Your account has been suspended.'
    };
  }

  return {
    allowed: true,
    action: 'continue_session'
  };
}

/**
 * Evaluates Database Row Level Security (RLS) on public.profiles
 */
export function evaluateProfilesRLS(userRole, action, targetUserId, currentUserId) {
  const isSelf = currentUserId && targetUserId && currentUserId === targetUserId;
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
