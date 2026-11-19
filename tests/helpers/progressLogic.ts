// tests/helpers/progressLogic.ts
// Pure domain logic for public timeline, user investor tracking, admin ProgressManager, and super admin governance

export interface MilestoneFormInput {
  id?: string;
  title?: unknown;
  date?: unknown;
  description?: unknown;
  status?: string;
  percentage?: number | string;
  images?: unknown;
  imageUrl?: string;
  [key: string]: unknown;
}

export interface ProgressPropertyLike {
  id: string;
  name?: string;
  status?: string;
  milestones?: MilestoneFormInput[];
  [key: string]: unknown;
}

/**
 * Validates milestone input form according to ProgressManager domain rules
 */
export function validateMilestoneForm(form: unknown): {
  valid: boolean;
  errors: string[];
  sanitized?: {
    title: string;
    date: string;
    description: string;
    status: string;
    percentage: number;
    images: string[];
    [key: string]: unknown;
  };
} {
  const errors: string[] = [];
  if (!form || typeof form !== 'object') {
    return { valid: false, errors: ['Form data is required'] };
  }

  const record = form as MilestoneFormInput;

  if (!record.title || !String(record.title).trim()) {
    errors.push('Title is required');
  }

  if (!record.date || !String(record.date).trim()) {
    errors.push('Date is required');
  }

  if (!record.description || !String(record.description).trim()) {
    errors.push('Description is required');
  }

  const validStatuses = ['upcoming', 'current', 'completed'];
  const status = record.status || 'upcoming';
  if (!validStatuses.includes(status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  let percentage = Number(record.percentage);
  if (Number.isNaN(percentage)) percentage = 0;
  percentage = Math.max(0, Math.min(100, Math.round(percentage)));

  if (status === 'completed') {
    percentage = 100;
  } else if (status === 'upcoming') {
    percentage = 0;
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized: {
      ...record,
      title: record.title ? String(record.title).trim() : '',
      date: record.date ? String(record.date).trim() : '',
      description: record.description ? String(record.description).trim() : '',
      status,
      percentage,
      images: Array.isArray(record.images)
        ? record.images.filter((img): img is string => typeof img === 'string')
        : [],
    },
  };
}

/**
 * Filters properties to only those that contain a non-empty milestones array
 */
export function filterPropertiesWithMilestones<T extends ProgressPropertyLike>(
  properties: T[] | null | undefined
): T[] {
  if (!Array.isArray(properties)) return [];
  return properties.filter((p) => p && Array.isArray(p.milestones) && p.milestones.length > 0);
}

/**
 * Resolves the default selected project id in public and admin views
 */
export function resolveDefaultProject(
  propertiesWithMilestones: Array<{ id: string }> | null | undefined,
  currentSelectedId?: string | null
): string {
  if (currentSelectedId) return currentSelectedId;
  if (Array.isArray(propertiesWithMilestones) && propertiesWithMilestones.length > 0) {
    return propertiesWithMilestones[0]?.id ?? '';
  }
  return '';
}

export interface MilestoneNodeState {
  status: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isUpcoming: boolean;
  icon: string;
  badgeText: string;
  badgeClass: string;
  nodeClass: string;
  hasPulse: boolean;
  showProgressBar: boolean;
}

/**
 * Resolves visual node presentation attributes for public timeline display
 */
export function calculateMilestoneNodeState(
  milestone: { status?: string } | null | undefined
): MilestoneNodeState {
  const status = milestone?.status || 'upcoming';
  const isCompleted = status === 'completed';
  const isCurrent = status === 'current';
  const isUpcoming = !isCompleted && !isCurrent;

  let icon = 'Calendar';
  let badgeText = 'Upcoming';
  let badgeClass = 'bg-gray-100 text-gray-600';
  let nodeClass = 'bg-gray-200 text-gray-500';

  if (isCompleted) {
    icon = 'CheckCircle';
    badgeText = 'Completed';
    badgeClass = 'bg-viridian-100 text-viridian-800';
    nodeClass = 'bg-viridian-600 text-white';
  } else if (isCurrent) {
    icon = 'Activity';
    badgeText = 'In Progress';
    badgeClass = 'bg-blue-100 text-blue-800';
    nodeClass = 'bg-blue-600 text-white animate-pulse';
  }

  return {
    status,
    isCompleted,
    isCurrent,
    isUpcoming,
    icon,
    badgeText,
    badgeClass,
    nodeClass,
    hasPulse: isCurrent,
    showProgressBar: isCurrent,
  };
}

/**
 * Normalizes milestone images supporting modern string[] images array
 * and legacy single string imageUrl
 */
export function resolveMilestoneImages(
  milestone: { images?: unknown; imageUrl?: unknown } | null | undefined
): string[] {
  if (!milestone) return [];
  if (Array.isArray(milestone.images) && milestone.images.length > 0) {
    return milestone.images.filter((img): img is string => typeof img === 'string');
  }
  if (milestone.imageUrl && typeof milestone.imageUrl === 'string') {
    return [milestone.imageUrl];
  }
  return [];
}

/**
 * Calculates responsive image grid configuration based on image count
 */
export function calculateMilestoneGridLayout(images: unknown[] | null | undefined): {
  cols: number;
  gridClass: string;
  imageClass: string;
} {
  const count = Array.isArray(images) ? images.length : 0;
  if (count <= 1) {
    return {
      cols: 1,
      gridClass: 'grid-cols-1',
      imageClass: 'max-h-[400px]',
    };
  }
  return {
    cols: count === 2 ? 2 : 3,
    gridClass: 'grid-cols-2 md:grid-cols-3',
    imageClass: 'h-48',
  };
}

/**
 * Resolves the active / current milestone using waterfall priority:
 * 1. Milestone with status === 'current'
 * 2. Or latest completed milestone (reversed find)
 * 3. Or first milestone in list
 */
export function resolveCurrentPhaseMilestone<T extends { status?: string }>(
  milestones: T[] | null | undefined
): T | null {
  if (!Array.isArray(milestones) || milestones.length === 0) return null;

  return (
    milestones.find((m) => m.status === 'current') ||
    [...milestones].reverse().find((m) => m.status === 'completed') ||
    milestones[0] ||
    null
  );
}

/**
 * Calculates overall weighted project completion percentage
 * Formula:
 * base = (completed / total) * 100
 * currentPartial = (current.percentage / 100) * (100 / total)
 * overall = min(100, max(0, round(base + currentPartial)))
 */
export function calculateOverallProjectProgress(
  milestones: Array<{ status?: string; percentage?: number | string }> | null | undefined
): number {
  if (!Array.isArray(milestones) || milestones.length === 0) return 0;

  const total = milestones.length;
  const completed = milestones.filter((m) => m.status === 'completed').length;
  const currentMilestone = resolveCurrentPhaseMilestone(milestones);

  const basePercentage = (completed / total) * 100;
  const currentPartial =
    currentMilestone && currentMilestone.status === 'current'
      ? (Math.max(0, Math.min(100, Number(currentMilestone.percentage) || 0)) / 100) * (100 / total)
      : 0;

  return Math.min(100, Math.max(0, Math.round(basePercentage + currentPartial)));
}

/**
 * Reorders milestone images array (@dnd-kit arrayMove implementation)
 */
export function sortMilestoneImages<T>(images: T[], oldIndex: number, newIndex: number): T[];
export function sortMilestoneImages(images: null, oldIndex: number, newIndex: number): null;
export function sortMilestoneImages<T>(
  images: T[] | null | undefined,
  oldIndex: number,
  newIndex: number
): T[] | null | undefined {
  if (!Array.isArray(images)) return images;
  if (images.length <= 1) return images;
  if (oldIndex === newIndex) return [...images];
  if (oldIndex < 0 || oldIndex >= images.length) return [...images];

  const result = [...images];
  const [removed] = result.splice(oldIndex, 1);
  if (removed === undefined) return result;
  const targetIndex = Math.max(0, Math.min(result.length, newIndex));
  result.splice(targetIndex, 0, removed);
  return result;
}

export type MediaGCAction =
  | 'upload_success'
  | 'remove_image'
  | 'cancel_edit'
  | 'save_success'
  | 'beacon_unmount'
  | string;

/**
 * Manages media garbage collection queues for ProgressManager
 */
export function manageMediaGarbageCollection({
  imagesToDelete = [],
  newlyUploadedImages = [],
  action,
  url,
}: {
  imagesToDelete?: string[];
  newlyUploadedImages?: string[];
  action: MediaGCAction;
  url?: string;
}): {
  imagesToDelete: string[];
  newlyUploadedImages: string[];
  toPurge: string[];
} {
  let updatedToDelete = [...imagesToDelete];
  let updatedNewlyUploaded = [...newlyUploadedImages];
  let toPurge: string[] = [];

  switch (action) {
    case 'upload_success':
      if (url) updatedNewlyUploaded.push(url);
      break;

    case 'remove_image':
      if (url) {
        updatedToDelete.push(url);
        updatedNewlyUploaded = updatedNewlyUploaded.filter((u) => u !== url);
      }
      break;

    case 'cancel_edit':
      // Rollback all newly uploaded images that were never committed
      toPurge = [...updatedNewlyUploaded];
      updatedNewlyUploaded = [];
      updatedToDelete = []; // discard delete queue without executing
      break;

    case 'save_success':
      // Images queued for deletion are purged from storage
      toPurge = [...updatedToDelete];
      updatedToDelete = [];
      updatedNewlyUploaded = []; // committed
      break;

    case 'beacon_unmount':
      // If unmounted with uncommitted new images, beacon purges them
      toPurge = [...updatedNewlyUploaded];
      break;

    default:
      break;
  }

  return {
    imagesToDelete: updatedToDelete,
    newlyUploadedImages: updatedNewlyUploaded,
    toPurge,
  };
}

/**
 * Evaluates unsaved changes guard before switching tabs, projects, or milestones
 */
export function evaluateUnsavedChangesGuard({
  isDirty,
  userConfirmed,
}: {
  isDirty: boolean;
  userConfirmed: boolean;
}): { canProceed: boolean; action: 'proceed_clean' | 'proceed_discarded' | 'stay_blocked' } {
  if (!isDirty) {
    return { canProceed: true, action: 'proceed_clean' };
  }
  if (userConfirmed) {
    return { canProceed: true, action: 'proceed_discarded' };
  }
  return { canProceed: false, action: 'stay_blocked' };
}

/**
 * Evaluates Database and Storage RLS policies for Milestones
 */
export function evaluateProgressRLS(
  userRole: string | null | undefined,
  action: string,
  target: 'properties' | 'storage_milestones' | string = 'properties'
): boolean {
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  if (target === 'properties') {
    if (action === 'SELECT') return true; // public read
    if (action === 'UPDATE' || action === 'INSERT' || action === 'DELETE') {
      return isAdmin; // admin write
    }
  }

  if (target === 'storage_milestones') {
    if (action === 'SELECT') return true; // public read
    if (action === 'INSERT' || action === 'UPDATE' || action === 'DELETE') {
      return isAdmin; // admin write
    }
  }

  return false;
}
