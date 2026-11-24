export type UserRole = 'admin' | 'staff' | 'customer';

export interface StaffPermissions {
  canAddCar: boolean;
  canEditCar: boolean;
  canDeleteCar: boolean;
  canEditPrice: boolean;
  canViewAllEnquiries: boolean;
  canEditSiteContent: boolean;
}

export interface UserAccount {
  id: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  role: UserRole;
  staffCode?: string;
  title?: string;
  active: boolean;
  permissions: StaffPermissions;
  shortlistedIds: string[];
  createdAt: string;
  lastLoginAt?: string;
}

export type VehicleBoardType = 'Tboard Vehicles' | 'Non Tboard Vehicles';

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: string;
  variant: string;
  reg: string;
  owner: string;
  colour: string;
  fuel: string;
  trans: string;
  km: string;
  price: number;
  finalPrice: number;
  dealer: string;
  phone: string;
  fc: string;
  insurance: string;
  permit: string;
  boardType: VehicleBoardType;
  status: 'Available' | 'Reserved' | 'Sold';
  featured: boolean;
  imageUrl: string;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export type EnquiryStatus =
  | 'New'
  | 'Contacted'
  | 'Test Drive'
  | 'Negotiation'
  | 'Closed'
  | 'Just Enquiry'
  | 'Enquiry'
  | 'Hot';

export interface Enquiry {
  id: string;
  vehicleId?: string;
  vehicleLabel: string;
  customerName: string;
  phone: string;
  email?: string;
  budget?: string;
  location?: string;
  date?: string;
  olxId?: string;
  message: string;
  source: 'website' | 'staff' | 'walk-in';
  status: EnquiryStatus;
  assignedStaffId?: string;
  assignedStaffName?: string;
  createdByUserId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeColors {
  presetId: string;
  mode: 'dark' | 'light';
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accentBright: string;
  accentContrast: string;
}

export interface TrustMetric {
  value: string;
  label: string;
}

export interface StoryHighlight {
  title: string;
  detail: string;
}

export interface SiteContent {
  brandName: string;
  tagline: string;
  logoUrl: string;
  bannerUrl: string;
  announcementEnabled: boolean;
  announcementText: string;
  heroKicker: string;
  heroHeadline: string;
  heroSubheadline: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroImageUrl: string;
  trustMetrics: TrustMetric[];
  catalogTitle: string;
  catalogSubtitle: string;
  storyTitle: string;
  storyBody: string;
  storyHighlights: StoryHighlight[];
  showroomAddress: string;
  showroomCity: string;
  contactPhone: string;
  contactEmail: string;
  whatsappNumber: string;
  cardCallNumber: string;
  cardWhatsappNumber: string;
  businessHours: string;
  footerNote: string;
}

export interface AnalyticsEvent {
  id: string;
  type: 'page_view' | 'vehicle_view' | 'search' | 'shortlist' | 'enquiry';
  path: string;
  vehicleId?: string;
  label?: string;
  sessionId: string;
  device: string;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalPageViews: number;
  uniqueSessions: number;
  totalVehicleViews: number;
  totalEnquiries: number;
  conversionRate: number;
  dailySeries: Array<{ date: string; views: number; enquiries: number }>;
  topVehicles: Array<{ id: string; label: string; views: number; enquiries: number }>;
  fuelBreakdown: Array<{ fuel: string; count: number }>;
  recentEvents: AnalyticsEvent[];
}

export interface AppNotification {
  id: string;
  type: 'enquiry' | 'inventory' | 'user' | 'cms' | 'system';
  title: string;
  message: string;
  actorName?: string;
  targetRole: 'all' | 'staff' | 'admin';
  readBy: string[];
  createdAt: string;
}

export interface BootstrapStatus {
  adminClaimed: boolean;
  envOverrideActive: boolean;
}
