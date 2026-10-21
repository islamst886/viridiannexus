// tests/helpers/progressLogic.js
// Pure domain logic for public timeline, user investor tracking, admin ProgressManager, and super admin governance

/**
 * Validates milestone input form according to ProgressManager domain rules
 */
export function validateMilestoneForm(form) {
  const errors = [];
  if (!form || typeof form !== 'object') {
    return { valid: false, errors: ['Form data is required'] };
  }

  if (!form.title || !String(form.title).trim()) {
    errors.push('Title is required');
  }

  if (!form.date || !String(form.date).trim()) {
    errors.push('Date is required');
  }

  if (!form.description || !String(form.description).trim()) {
    errors.push('Description is required');
  }

  const validStatuses = ['upcoming', 'current', 'completed'];
  const status = form.status || 'upcoming';
  if (!validStatuses.includes(status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  let percentage = Number(form.percentage);
  if (isNaN(percentage)) percentage = 0;
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
      ...form,
      title: form.title ? String(form.title).trim() : '',
      date: form.date ? String(form.date).trim() : '',
      description: form.description ? String(form.description).trim() : '',
      status,
      percentage,
      images: Array.isArray(form.images) ? form.images : []
    }
  };
}

/**
 * Filters properties to only those that contain a non-empty milestones array
 */
export function filterPropertiesWithMilestones(properties) {
  if (!Array.isArray(properties)) return [];
  return properties.filter(p => p && Array.isArray(p.milestones) && p.milestones.length > 0);
}

/**
 * Resolves the default selected project id in public and admin views
 */
export function resolveDefaultProject(propertiesWithMilestones, currentSelectedId) {
  if (currentSelectedId) return currentSelectedId;
  if (Array.isArray(propertiesWithMilestones) && propertiesWithMilestones.length > 0) {
    return propertiesWithMilestones[0].id;
  }
  return '';
}

/**
 * Resolves visual node presentation attributes for public timeline display
 */
export function calculateMilestoneNodeState(milestone) {
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
    showProgressBar: isCurrent
  };
}

/**
 * Normalizes milestone images supporting modern string[] images array
 * and legacy single string imageUrl
 */
export function resolveMilestoneImages(milestone) {
  if (!milestone) return [];
  if (Array.isArray(milestone.images) && milestone.images.length > 0) {
    return milestone.images;
  }
  if (milestone.imageUrl && typeof milestone.imageUrl === 'string') {
    return [milestone.imageUrl];
  }
  return [];
}

/**
 * Calculates responsive image grid configuration based on image count
 */
export function calculateMilestoneGridLayout(images) {
  const count = Array.isArray(images) ? images.length : 0;
  if (count <= 1) {
    return {
      cols: 1,
      gridClass: 'grid-cols-1',
      imageClass: 'max-h-[400px]'
    };
  }
  return {
    cols: count === 2 ? 2 : 3,
    gridClass: 'grid-cols-2 md:grid-cols-3',
    imageClass: 'h-48'
  };
}

/**
 * Resolves the active / current milestone using waterfall priority:
 * 1. Milestone with status === 'current'
 * 2. Or latest completed milestone (reversed find)
 * 3. Or first milestone in list
 */
export function resolveCurrentPhaseMilestone(milestones) {
  if (!Array.isArray(milestones) || milestones.length === 0) return null;

  return (
    milestones.find(m => m.status === 'current') ||
    [...milestones].reverse().find(m => m.status === 'completed') ||
    milestones[0]
  );
}

/**
 * Calculates overall weighted project completion percentage
 * Formula:
 * base = (completed / total) * 100
 * currentPartial = (current.percentage / 100) * (100 / total)
 * overall = min(100, max(0, round(base + currentPartial)))
 */
export function calculateOverallProjectProgress(milestones) {
  if (!Array.isArray(milestones) || milestones.length === 0) return 0;

  const total = milestones.length;
  const completed = milestones.filter(m => m.status === 'completed').length;
  const currentMilestone = resolveCurrentPhaseMilestone(milestones);

  const basePercentage = (completed / total) * 100;
  const currentPartial = (currentMilestone && currentMilestone.status === 'current')
    ? ((Math.max(0, Math.min(100, Number(currentMilestone.percentage) || 0))) / 100) * (100 / total)
    : 0;

  return Math.min(100, Math.max(0, Math.round(basePercentage + currentPartial)));
}

/**
 * Reorders milestone images array (@dnd-kit arrayMove implementation)
 */
export function sortMilestoneImages(images, oldIndex, newIndex) {
  if (!Array.isArray(images)) return images;
  if (images.length <= 1) return images;
  if (oldIndex === newIndex) return [...images];
  if (oldIndex < 0 || oldIndex >= images.length) return [...images];

  const result = [...images];
  const [removed] = result.splice(oldIndex, 1);
  const targetIndex = Math.max(0, Math.min(result.length, newIndex));
  result.splice(targetIndex, 0, removed);
  return result;
}

/**
 * Manages media garbage collection queues for ProgressManager
 */
export function manageMediaGarbageCollection({ imagesToDelete = [], newlyUploadedImages = [], action, url }) {
  let updatedToDelete = [...imagesToDelete];
  let updatedNewlyUploaded = [...newlyUploadedImages];
  let toPurge = [];

  switch (action) {
    case 'upload_success':
      if (url) updatedNewlyUploaded.push(url);
      break;

    case 'remove_image':
      if (url) {
        updatedToDelete.push(url);
        updatedNewlyUploaded = updatedNewlyUploaded.filter(u => u !== url);
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
    toPurge
  };
}

/**
 * Evaluates unsaved changes guard before switching tabs, projects, or milestones
 */
export function evaluateUnsavedChangesGuard({ isDirty, userConfirmed }) {
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
export function evaluateProgressRLS(userRole, action, target = 'properties') {
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
