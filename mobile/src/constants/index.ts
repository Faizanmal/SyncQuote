// Constants for app-wide configuration
export const API_CONFIG = {
  BASE_URL: 'https://api.syncquote.com',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  SYNC_QUEUE: 'sync_queue',
  LAST_SYNC: 'last_sync',
  THEME: 'theme',
  LANGUAGE: 'language',
  ONBOARDING_COMPLETED: 'onboarding_completed',
};

export const THEME = {
  COLORS: {
    PRIMARY: '#3B82F6',
    PRIMARY_DARK: '#1D4ED8',
    SECONDARY: '#10B981',
    ERROR: '#EF4444',
    WARNING: '#F59E0B',
    SUCCESS: '#10B981',
    INFO: '#3B82F6',
    BACKGROUND: '#F9FAFB',
    SURFACE: '#FFFFFF',
    TEXT_PRIMARY: '#1F2937',
    TEXT_SECONDARY: '#6B7280',
    TEXT_MUTED: '#9CA3AF',
    BORDER: '#E5E7EB',
    BORDER_LIGHT: '#F3F4F6',
  },
  SPACING: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
    XXL: 48,
  },
  FONT_SIZES: {
    XS: 12,
    SM: 14,
    MD: 16,
    LG: 18,
    XL: 20,
    XXL: 24,
    XXXL: 32,
  },
  FONT_WEIGHTS: {
    REGULAR: '400',
    MEDIUM: '500',
    SEMIBOLD: '600',
    BOLD: '700',
  },
  BORDER_RADIUS: {
    SM: 4,
    MD: 8,
    LG: 12,
    XL: 16,
    FULL: 9999,
  },
  SHADOWS: {
    SM: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.1,
      shadowRadius: 3,
      elevation: 2,
    },
    MD: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    LG: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 8,
    },
  },
};

export const PROPOSAL_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const;

export const PROPOSAL_STATUS_LABELS = {
  [PROPOSAL_STATUS.DRAFT]: 'Draft',
  [PROPOSAL_STATUS.SENT]: 'Sent',
  [PROPOSAL_STATUS.VIEWED]: 'Viewed',
  [PROPOSAL_STATUS.ACCEPTED]: 'Accepted',
  [PROPOSAL_STATUS.REJECTED]: 'Rejected',
  [PROPOSAL_STATUS.EXPIRED]: 'Expired',
};

export const PROPOSAL_STATUS_COLORS = {
  [PROPOSAL_STATUS.DRAFT]: '#6B7280',
  [PROPOSAL_STATUS.SENT]: '#3B82F6',
  [PROPOSAL_STATUS.VIEWED]: '#F59E0B',
  [PROPOSAL_STATUS.ACCEPTED]: '#10B981',
  [PROPOSAL_STATUS.REJECTED]: '#EF4444',
  [PROPOSAL_STATUS.EXPIRED]: '#9CA3AF',
};

export const CLIENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PROSPECT: 'prospect',
} as const;

export const CLIENT_STATUS_LABELS = {
  [CLIENT_STATUS.ACTIVE]: 'Active',
  [CLIENT_STATUS.INACTIVE]: 'Inactive',
  [CLIENT_STATUS.PROSPECT]: 'Prospect',
};

export const NOTIFICATION_TYPES = {
  PROPOSAL_VIEWED: 'proposal_viewed',
  PROPOSAL_SIGNED: 'proposal_signed',
  PROPOSAL_REJECTED: 'proposal_rejected',
  REMINDER: 'reminder',
  SYSTEM: 'system',
} as const;

export const CURRENCIES = [
  {code: 'USD', symbol: '$', name: 'US Dollar'},
  {code: 'EUR', symbol: '€', name: 'Euro'},
  {code: 'GBP', symbol: '£', name: 'British Pound'},
  {code: 'CAD', symbol: 'C$', name: 'Canadian Dollar'},
  {code: 'AUD', symbol: 'A$', name: 'Australian Dollar'},
  {code: 'JPY', symbol: '¥', name: 'Japanese Yen'},
];

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

export const SYNC_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  BACKGROUND_SYNC_INTERVAL: 300000, // 5 minutes
  OFFLINE_STORAGE_LIMIT: 100, // Max items in sync queue
};

export const NOTIFICATION_CONFIG = {
  CHANNELS: {
    DEFAULT: 'syncquote-default',
    PROPOSALS: 'syncquote-proposals',
    REMINDERS: 'syncquote-reminders',
    SYSTEM: 'syncquote-system',
  },
  IMPORTANCE: {
    LOW: 2,
    DEFAULT: 3,
    HIGH: 4,
  },
};

export const VALIDATION_RULES = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[\+]?[1-9][\d]{0,15}$/,
  PASSWORD_MIN_LENGTH: 8,
  PROPOSAL_TITLE_MAX_LENGTH: 100,
  PROPOSAL_DESCRIPTION_MAX_LENGTH: 500,
  CLIENT_NAME_MAX_LENGTH: 50,
  COMPANY_NAME_MAX_LENGTH: 100,
};

export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  DISPLAY_LONG: 'MMMM dd, yyyy',
  DISPLAY_WITH_TIME: 'MMM dd, yyyy h:mm a',
  API: 'yyyy-MM-dd',
  API_WITH_TIME: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
};

export const ANALYTICS_PERIODS = [
  {label: 'Last 7 days', value: '7d'},
  {label: 'Last 30 days', value: '30d'},
  {label: 'Last 3 months', value: '3m'},
  {label: 'Last 6 months', value: '6m'},
  {label: 'Last year', value: '1y'},
  {label: 'All time', value: 'all'},
];

export const PROPOSAL_SECTIONS = {
  TEXT: 'text',
  IMAGE: 'image',
  TABLE: 'table',
  PRICING: 'pricing',
  TERMS: 'terms',
} as const;

export const DOCUMENT_TYPES = {
  PDF: 'pdf',
  IMAGE: 'image',
  DOCUMENT: 'document',
} as const;

export const MAX_FILE_SIZES = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  PDF: 20 * 1024 * 1024, // 20MB
};

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export const DRAWER_WIDTH = 280;
export const HEADER_HEIGHT = 56;
export const TAB_BAR_HEIGHT = 60;

export const HAPTIC_FEEDBACK_TYPES = {
  IMPACT_LIGHT: 'impactLight',
  IMPACT_MEDIUM: 'impactMedium',
  IMPACT_HEAVY: 'impactHeavy',
  NOTIFICATION_SUCCESS: 'notificationSuccess',
  NOTIFICATION_WARNING: 'notificationWarning',
  NOTIFICATION_ERROR: 'notificationError',
  SELECTION: 'selection',
} as const;