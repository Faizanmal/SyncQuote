// User & Authentication Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: 'owner' | 'admin' | 'member';
  workspaceId: string;
  lastLoginAt: string;
  createdAt: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  notifications: {
    push: boolean;
    email: boolean;
    sms: boolean;
  };
  theme: 'light' | 'dark' | 'system';
  language: string;
  biometricAuth: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
}

// Proposal Types
export interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired';
  clientId: string;
  amount: number;
  currency: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
  sections: ProposalSection[];
  signatures: Signature[];
  documents: Document[];
  activities: Activity[];
  metadata: ProposalMetadata;
}

export interface ProposalSection {
  id: string;
  type: 'text' | 'image' | 'table' | 'pricing' | 'terms';
  title: string;
  content: any;
  order: number;
}

export interface Signature {
  id: string;
  signerName: string;
  signerEmail: string;
  signedAt: string;
  signatureData: string;
  ipAddress: string;
}

export interface ProposalMetadata {
  views: number;
  lastViewedAt?: string;
  timeSpentViewing: number;
  downloadCount: number;
  shareCount: number;
}

// Client Types
export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company: string;
  address?: Address;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  proposals: string[];
  totalValue: number;
  status: 'active' | 'inactive' | 'prospect';
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Document Types
export interface Document {
  id: string;
  name: string;
  type: 'pdf' | 'image' | 'document';
  url: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

// Activity Types
export interface Activity {
  id: string;
  type: 'created' | 'updated' | 'sent' | 'viewed' | 'signed' | 'rejected' | 'expired' | 'comment';
  description: string;
  userId?: string;
  clientId?: string;
  timestamp: string;
  metadata?: any;
}

// Analytics Types
export interface Analytics {
  overview: {
    totalProposals: number;
    acceptedProposals: number;
    pendingProposals: number;
    totalRevenue: number;
    conversionRate: number;
    averageProposalValue: number;
  };
  trends: {
    proposalsOverTime: DataPoint[];
    revenueOverTime: DataPoint[];
    conversionRateOverTime: DataPoint[];
  };
  performance: {
    topClients: ClientPerformance[];
    proposalStatusDistribution: StatusDistribution[];
    monthlyTargets: Target[];
  };
}

export interface DataPoint {
  date: string;
  value: number;
}

export interface ClientPerformance {
  clientId: string;
  clientName: string;
  totalProposals: number;
  acceptedProposals: number;
  totalRevenue: number;
  conversionRate: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface Target {
  month: string;
  target: number;
  actual: number;
  percentage: number;
}

// Notification Types
export interface Notification {
  id: string;
  type: 'proposal_viewed' | 'proposal_signed' | 'proposal_rejected' | 'reminder' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: any;
}

// Offline & Sync Types
export interface OfflineState {
  isOnline: boolean;
  syncQueue: SyncItem[];
  lastSyncAt: string | null;
  syncInProgress: boolean;
}

export interface SyncItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'proposal' | 'client' | 'document';
  data: any;
  timestamp: string;
  retryCount: number;
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  ProposalDetail: {proposalId: string};
  ClientDetail: {clientId: string};
  CreateProposal: {clientId?: string};
  EditProposal: {proposalId: string};
  SignatureCapture: {proposalId: string};
  DocumentViewer: {documentId: string; title: string};
  Settings: undefined;
  Profile: undefined;
  Notifications: undefined;
  Analytics: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  BiometricSetup: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Proposals: undefined;
  Clients: undefined;
  Analytics: undefined;
  More: undefined;
};

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface ProposalForm {
  title: string;
  description: string;
  clientId: string;
  amount: number;
  currency: string;
  validUntil: string;
  sections: ProposalSection[];
}

export interface ClientForm {
  name: string;
  email: string;
  phone?: string;
  company: string;
  address?: Address;
}

// Theme Types
export interface Theme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    success: string;
    warning: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  typography: {
    h1: TextStyle;
    h2: TextStyle;
    h3: TextStyle;
    body: TextStyle;
    caption: TextStyle;
  };
}