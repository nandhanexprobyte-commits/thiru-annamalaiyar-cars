import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  AnalyticsEvent,
  AnalyticsSummary,
  AppNotification,
  Enquiry,
  SiteContent,
  StaffPermissions,
  ThemeColors,
  UserAccount,
  Vehicle,
} from '../shared/types.ts';

export interface StoredUser extends UserAccount {
  passwordHash: string;
}

export interface DataStore {
  users: StoredUser[];
  vehicles: Vehicle[];
  enquiries: Enquiry[];
  siteContent: SiteContent;
  themeColors: ThemeColors;
  analyticsEvents: AnalyticsEvent[];
  notifications: AppNotification[];
  catalogTrimmedToTen?: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const MAX_SAMPLE_VEHICLES = 10;

const IMG_HERO = '/src/assets/images/hero_showroom_luxury_1795250937369.jpg';
const IMG_SUV = '/src/assets/images/vehicle_suv_flagship_1795250937139.jpg';
const IMG_CROSSOVER = '/src/assets/images/vehicle_crossover_silver_1795250937315.jpg';
const IMG_EV_RED = '/src/assets/images/vehicle_electric_crimson_1795250939150.jpg';

function pickVehicleImage(brand: string, model: string, colour: string, fuel: string): string {
  const m = model.toUpperCase();
  const c = colour.toUpperCase();
  const f = fuel.toUpperCase();
  if (c.includes('RED') || c.includes('MEROON') || f === 'EV' || m.includes('THAR')) {
    return IMG_EV_RED;
  }
  if (
    m.includes('CRYSTA') ||
    m.includes('FORTUNER') ||
    m.includes('XUV') ||
    m.includes('SCORPIO') ||
    m.includes('HECTOR') ||
    m.includes('VELLARE') ||
    m.includes('HYCROSS') ||
    m.includes('X7') ||
    m.includes('X1') ||
    m.includes('ALCAZAR')
  ) {
    return IMG_SUV;
  }
  return IMG_CROSSOVER;
}

const RAW_SEED_VEHICLES = [
  { brand: 'Maruti', model: 'XL6', year: '2022', variant: 'ALFA', reg: 'TN-82-U-7520', owner: '1', colour: 'SILVER', fuel: 'PETROL', trans: 'AT', km: '51000', price: 1200000, finalPrice: 1160000, dealer: 'TN-82-C-MOHAMMED ASFAQ (96296-29493)', phone: '96296-29493', featured: false },
  { brand: 'Maruti', model: 'WAGON-R', year: '2021', variant: 'VXI', reg: 'TN-78-P-5454', owner: '1', colour: 'SILVER', fuel: 'PET / CNG', trans: 'MT', km: '21000', price: 550000, finalPrice: 525000, dealer: 'TN-45-B-MURUGESH [ BRAMMA CARS ]', phone: '', featured: false },
  { brand: 'Toyota', model: 'CRYSTA', year: '2024', variant: 'ZX', reg: 'TN-41-BQ-0007', owner: '1', colour: 'WHITE', fuel: 'DIESEL', trans: 'MT', km: '18000', price: 3350000, finalPrice: 3300000, dealer: 'TN-41-D-GOPALA KRISHNAN', phone: '', featured: true },
  { brand: 'Hyundai', model: 'VENUE', year: '2025', variant: 'S+', reg: 'TN-83-MF-3377', owner: '1', colour: 'WHITE', fuel: 'DIESEL', trans: 'MT', km: '21000', price: 1050000, finalPrice: 1000000, dealer: 'TN-83-M-SELVARAJ', phone: '', featured: false },
  { brand: 'Skoda', model: 'KYLAQ', year: '2025', variant: 'PRESTIGE', reg: 'TN-49-CS-2526', owner: '1', colour: 'RED', fuel: 'PETROL', trans: 'AT', km: '15000', price: 1300000, finalPrice: 1300000, dealer: 'SARAVANAN (98941-40215) [ THANJAVUR ]', phone: '98941-40215', featured: true },
  { brand: 'Hyundai', model: 'I 10', year: '2014 / 2015', variant: 'SPORTZ', reg: 'TN-45-BF-4197', owner: '1', colour: 'SILVER', fuel: 'PETROL', trans: 'MT', km: '54000', price: 350000, finalPrice: 350000, dealer: 'TN-32-D-ABDULLA', phone: '', featured: false },
  { brand: 'Mahindra', model: 'XUV 700', year: '2024', variant: 'AX7', reg: 'TN-48-BM-8194', owner: '1', colour: 'WHITE', fuel: 'DIESEL', trans: 'MT', km: '42000', price: 2250000, finalPrice: 2200000, dealer: 'MUBARAK', phone: '98424-85432', featured: true },
  { brand: 'Hyundai', model: 'VENUE', year: '2024', variant: 'S [ O ]', reg: 'TN-46', owner: '1', colour: 'WHITE', fuel: 'PETROL', trans: 'MT', km: '18000', price: 925000, finalPrice: 850000, dealer: 'PRASHATH MAGNUM LIGHTS', phone: '', featured: false },
  { brand: 'Hyundai', model: 'CRETA', year: '2024', variant: 'SX [ O ]', reg: 'TN-76-BC-7272', owner: '1', colour: 'GREY', fuel: 'DIESEL', trans: 'AT', km: '60000', price: 1900000, finalPrice: 1850000, dealer: 'TN-72-D-AM-CARS', phone: '', featured: true },
  { brand: 'Volvo', model: 'ELECTRIC C 40', year: '2023', variant: 'E 80', reg: 'TN-49', owner: '1', colour: 'RED', fuel: 'EV', trans: 'AT', km: '45000', price: 3500000, finalPrice: 3200000, dealer: 'TN-49-D-SANJAY', phone: '', featured: true },
  { brand: 'Toyota', model: 'CRYSTA', year: '2026', variant: 'ZX', reg: 'TN-42', owner: '1', colour: 'SILVER', fuel: 'DIESEL', trans: 'MT', km: '4500', price: 3500000, finalPrice: 3400000, dealer: 'CBE-D-CHALSON', phone: '', featured: true },
  { brand: 'Mahindra', model: 'SCORPIO', year: '2011', variant: 'VLX', reg: 'TN-38-BF-0919', owner: '2', colour: 'WHITE', fuel: 'DIESEL', trans: 'MT', km: '145000', price: 650000, finalPrice: 600000, dealer: 'TN-33-D-VIJAYA KUMAR [ NAMBIYUR ]', phone: '', featured: false },
  { brand: 'Maruti', model: 'ERTIGA', year: '2024', variant: 'VXI', reg: 'TN-49', owner: '1', colour: 'SILVER', fuel: 'PETROL', trans: 'MT', km: '10000', price: 1150000, finalPrice: 1150000, dealer: 'TN-68-D-KARTHI', phone: '', featured: false },
  { brand: 'Maruti', model: 'ERTIGA', year: '2019', variant: 'ZDI +', reg: 'TN-66', owner: '1', colour: 'SILVER', fuel: 'DIESEL', trans: 'MT', km: '100000', price: 1150000, finalPrice: 1100000, dealer: 'TN-30-D-JEEVA', phone: '', featured: false },
  { brand: 'Mahindra', model: 'THAR ROXX', year: '2025', variant: '4*2 AX7 L', reg: 'TN-43-U-7799', owner: '1', colour: 'BLACK', fuel: 'DIESEL', trans: 'MT', km: '40000', price: 2050000, finalPrice: 1975000, dealer: 'TN-60-D-VENKATESH [ BALAJI CARS ]', phone: '', featured: true },
  { brand: 'Hyundai', model: 'CRETA', year: '2023', variant: 'E', reg: 'TN-65', owner: '1', colour: 'BLACK', fuel: 'DIESEL', trans: 'MT', km: '67000', price: 1200000, finalPrice: 1175000, dealer: 'TN-58-M-AGAAMED [ FORD ]', phone: '', featured: false },
  { brand: 'Mahindra', model: 'XUV 500', year: '2012', variant: 'W8', reg: 'TN-37-CB-2727', owner: '1', colour: 'WHITE', fuel: 'DIESEL', trans: 'MT', km: '195000', price: 650000, finalPrice: 625000, dealer: 'CBE-D-RENGANATHAN [ GANAPATHY ]', phone: '', featured: false },
  { brand: 'Ford', model: 'ECO SPORT', year: '2020', variant: 'TITANIUM', reg: 'TN-99-TT-5776', owner: '1', colour: 'BLACK', fuel: 'DIESEL', trans: 'MT', km: '48000', price: 850000, finalPrice: 800000, dealer: 'MANOJ', phone: '', featured: false },
  { brand: 'Mahindra', model: 'SCORPIO - N', year: '2023', variant: 'Z8', reg: 'TN-45-BF-4884', owner: '1', colour: 'WHITE', fuel: 'DIESEL', trans: 'AT', km: '70000', price: 2050000, finalPrice: 1950000, dealer: 'MANOJ', phone: '', featured: true },
  { brand: 'Honda', model: 'JAZZ', year: '2020', variant: 'VX', reg: 'TN-99', owner: '1', colour: 'WHITE', fuel: 'PETROL', trans: 'MT', km: '50000', price: 725000, finalPrice: 685000, dealer: 'SIVA - SIVAM CARS', phone: '', featured: false },
  { brand: 'Toyota', model: 'RUMION', year: '2024', variant: 'V', reg: 'TN-68-AQ-0613', owner: '1', colour: 'E-GREY', fuel: 'PETROL', trans: 'AT', km: '19000', price: 1360000, finalPrice: 1350000, dealer: 'ISMAYIL', phone: '', featured: false },
  { brand: 'Toyota', model: 'FORTUNER', year: '2020', variant: '4*2', reg: 'TN-57-BV-6888', owner: '1', colour: 'WHITE', fuel: 'DIESEL', trans: 'AT', km: '60000', price: 3350000, finalPrice: 3300000, dealer: 'ISMAYIL', phone: '', featured: true },
  { brand: 'Maruti', model: 'SWIFT', year: '2023', variant: 'ZXI', reg: 'TN-82-M-6836', owner: '1', colour: 'RED', fuel: 'PETROL', trans: 'MT', km: '40000', price: 750000, finalPrice: 725000, dealer: 'GANESH ARASU CARS', phone: '', featured: false },
  { brand: 'Maruti', model: 'SWIFT', year: '2024', variant: 'VXI', reg: 'TN-82-P-8725', owner: '1', colour: 'E-GREY', fuel: 'PETROL', trans: 'MT', km: '36000', price: 730000, finalPrice: 700000, dealer: 'GANESH ARASU CARS', phone: '', featured: false },
  { brand: 'MG', model: 'HECTOR', year: '2023', variant: 'SHARP', reg: 'TN-47-BV-7410', owner: '1', colour: 'WHITE', fuel: 'DIESEL', trans: 'MT', km: '26000', price: 1650000, finalPrice: 1600000, dealer: 'GANESH ARASU CARS', phone: '', featured: false },
  { brand: 'Mahindra', model: 'THAR', year: '2023', variant: '4*4', reg: 'TN-51-AR-5110', owner: '1', colour: 'RED', fuel: 'DIESEL', trans: 'MT', km: '28000', price: 1575000, finalPrice: 1500000, dealer: 'KEERTHI', phone: '', featured: false },
  { brand: 'Kia', model: 'SONET', year: '2022', variant: 'GT LINE', reg: 'TN-33-BW-6509', owner: '1', colour: 'WHITE', fuel: 'DIESEL', trans: 'MT', km: '44000', price: 1100000, finalPrice: 1075000, dealer: 'RAJAN FINANCE', phone: '', featured: false },
  { brand: 'Kia', model: 'CARENS', year: '2024 / 2025', variant: 'PREM [ O ]', reg: 'TN-81-AY-9273', owner: '1', colour: 'GREY', fuel: 'PET / CNG', trans: 'MT', km: '32000', price: 1325000, finalPrice: 1300000, dealer: 'GANESH ARASU CARS', phone: '', featured: false },
  { brand: 'BMW', model: 'X1', year: '2022', variant: 'X LINE', reg: 'TN-59', owner: '1', colour: 'BLACK', fuel: 'DIESEL', trans: 'AT', km: '56000', price: 3400000, finalPrice: 3200000, dealer: 'CBE-D-DEVA', phone: '', featured: true },
  { brand: 'Range Rover', model: 'VELAR', year: '2020 / 2021', variant: 'DYNAMIC S', reg: 'TN-48', owner: '1', colour: 'WHITE', fuel: 'PETROL', trans: 'AT', km: '70000', price: 5000000, finalPrice: 5000000, dealer: 'TN-45-R-GNANA SEKAR', phone: '', featured: true },
  { brand: 'Volkswagen', model: 'VIRTUS', year: '2023', variant: 'TOP LINE', reg: 'TN-51-AT-1251', owner: '1', colour: 'WHITE', fuel: 'PETROL', trans: 'MT', km: '30000', price: 1100000, finalPrice: 1100000, dealer: 'VIGNESH', phone: '', featured: false },
  { brand: 'Ford', model: 'ASPIRE', year: '2017', variant: 'TITANIUM', reg: 'TN-32-AK-7195', owner: '1', colour: 'MAROON', fuel: 'DIESEL', trans: 'MT', km: '98000', price: 325000, finalPrice: 315000, dealer: 'PALANI SWAMY', phone: '', featured: false },
  { brand: 'Tata', model: 'PUNCH EV', year: '2024', variant: 'ADVENTURE', reg: 'TN-63-CV-9358', owner: '2', colour: 'E-GREY', fuel: 'EV', trans: 'AT', km: '45000', price: 650000, finalPrice: 650000, dealer: 'GNANA SEKAR LOAN', phone: '', featured: false },
  { brand: 'MG', model: 'WINDSOR EV', year: '2025', variant: 'TOP END', reg: 'TN-12-BU-5555', owner: '1', colour: 'BLACK', fuel: 'EV', trans: 'AT', km: '22000', price: 1500000, finalPrice: 1500000, dealer: 'TN-55-B-MURALI', phone: '', featured: true },
  { brand: 'Hyundai', model: 'CRETA', year: '2021', variant: 'E', reg: 'TN-37', owner: '1', colour: 'MAROON', fuel: 'PETROL', trans: 'MT', km: '82000', price: 850000, finalPrice: 850000, dealer: 'AKIL', phone: '', featured: false },
  { brand: 'Toyota', model: 'FORTUNER', year: '2023', variant: '2 WHEEL DRIVE', reg: 'TN-69', owner: '1', colour: 'WHITE', fuel: 'DIESEL', trans: 'MT', km: '50000', price: 3600000, finalPrice: 3600000, dealer: 'TN-69-M-KARTHIK [ HYUNDAI ]', phone: '', featured: true },
  { brand: 'Hyundai', model: 'CRETA', year: '2024', variant: 'S OPTIONAL', reg: 'TN-69', owner: '1', colour: 'WHITE', fuel: 'DIESEL', trans: 'MT', km: '95000', price: 1350000, finalPrice: 1350000, dealer: 'TN-69-M-KARTHIK [ HYUNDAI ]', phone: '', featured: false },
  { brand: 'Hyundai', model: 'VENUE', year: '2023', variant: 'N LINE 1 LITRE TURBO', reg: 'TN-63-CX-9779', owner: '1', colour: 'WHITE', fuel: 'PETROL', trans: 'AT', km: '85000', price: 1000000, finalPrice: 1000000, dealer: 'TN-63-B-KIRUBA', phone: '', featured: false },
  { brand: 'Maruti', model: 'GRAND VITARA', year: '2022', variant: 'ALPHA+ STRONG HYBRID', reg: 'TN-38-DC-9757', owner: '1', colour: 'BLUE', fuel: 'PET / HYBRID', trans: 'AT', km: '14500', price: 1450000, finalPrice: 1450000, dealer: 'TN-46-D-UMER FAROOK', phone: '', featured: false },
  { brand: 'Kia', model: 'SELTOS', year: '2020', variant: 'HTE', reg: 'TN-66-AD-9037', owner: '1', colour: 'SILVER', fuel: 'DIESEL', trans: 'MT', km: '98000', price: 750000, finalPrice: 700000, dealer: 'TN-45-R-SURESH [ TOYOTA ]', phone: '', featured: false },
  { brand: 'Kia', model: 'SONET', year: '2022', variant: 'HTX', reg: 'TN-99-W-5801', owner: '1', colour: 'E-GREY', fuel: 'DIESEL', trans: 'MT', km: '78000', price: 875000, finalPrice: 850000, dealer: 'TN-45-R-SURESH [ TOYOTA ]', phone: '', featured: false },
  { brand: 'BMW', model: 'X7', year: '2023', variant: '40 D', reg: 'TN-58', owner: '1', colour: 'E-GREY', fuel: 'DIESEL', trans: 'AT', km: '34000', price: 12500000, finalPrice: 11000000, dealer: 'TN-72-D-SURESH', phone: '', featured: true },
  { brand: 'Tata', model: 'NEXON EV', year: '2025 / 2026', variant: 'FEARLESS 45 KW', reg: 'TN-72', owner: '1', colour: 'GREY', fuel: 'EV', trans: 'AT', km: '21000', price: 1000000, finalPrice: 1000000, dealer: 'TN-72-D-SURESH', phone: '', featured: false },
  { brand: 'Mahindra', model: 'THAR', year: '2026', variant: 'AXD', reg: 'TN-72', owner: '1', colour: 'RED', fuel: 'DIESEL', trans: 'MT', km: '600', price: 1325000, finalPrice: 1300000, dealer: 'TN-72-D-SURESH', phone: '', featured: true },
  { brand: 'Hyundai', model: 'ALCAZAR', year: '2022', variant: 'SIGNATURE [ O ]', reg: 'TN-63', owner: '1', colour: 'BLUE', fuel: 'DIESEL', trans: 'AT', km: '160000', price: 1100000, finalPrice: 900000, dealer: 'ARANTHANGI-D-VELAVAN', phone: '', featured: false },
  { brand: 'Tata', model: 'BOLT', year: '2017', variant: 'XE', reg: 'TN-49-BL-4467', owner: '2', colour: 'WHITE', fuel: 'DIESEL', trans: 'MT', km: '185000', price: 160000, finalPrice: 140000, dealer: 'MELVIN JOE', phone: '', featured: false },
  { brand: 'Maruti', model: 'FRONX', year: '2023', variant: 'DELTA +', reg: 'TN-55-BM-2210', owner: '1', colour: 'BLUE', fuel: 'PETROL', trans: 'MT', km: '104000', price: 710000, finalPrice: 675000, dealer: 'TN-49-D-SAKTHI VELAN', phone: '', featured: false },
  { brand: 'Kia', model: 'SONET', year: '2024', variant: 'HTK', reg: 'TN-49', owner: '1', colour: 'WHITE', fuel: 'PETROL', trans: 'MT', km: '45000', price: 725000, finalPrice: 700000, dealer: 'TN-49-D-SAKTHI VELAN', phone: '', featured: false },
  { brand: 'Maruti', model: 'SWIFT', year: '2023', variant: 'ZXI', reg: 'TN-02-BY-4307', owner: '1', colour: 'WHITE', fuel: 'PETROL', trans: 'MT', km: '20000', price: 750000, finalPrice: 750000, dealer: 'KESAVAN', phone: '', featured: false },
  { brand: 'Toyota', model: 'HYCROSS', year: '2025', variant: 'VX', reg: 'TN-24', owner: '1', colour: 'WHITE', fuel: 'HYBRID', trans: 'AT', km: '97000', price: 2500000, finalPrice: 2500000, dealer: 'TN-24-D-SIRANJIVI', phone: '', featured: false },
  { brand: 'Maruti', model: 'XL6', year: '2021', variant: 'ZETA', reg: 'TN-58-BF-1441', owner: '2', colour: 'WHITE', fuel: 'PET / CNG', trans: 'AT', km: '86000', price: 950000, finalPrice: 900000, dealer: 'KUMAR', phone: '', featured: false },
  { brand: 'Hyundai', model: 'CRETA', year: '2020', variant: 'SX [ O ]', reg: 'TN-84-K-3784', owner: '1', colour: 'BLUE', fuel: 'DIESEL', trans: 'AT', km: '102000', price: 1050000, finalPrice: 1050000, dealer: 'VIJAYAKUMAR LALITHA CARS', phone: '', featured: false },
  { brand: 'Tata', model: 'NEXON', year: '2025', variant: 'CREATIVE 45 KWT', reg: 'TN-99-AE-7652', owner: '1', colour: 'WHITE', fuel: 'EV', trans: 'AT', km: '56000', price: 1000000, finalPrice: 1000000, dealer: 'TN-55-B-ABU', phone: '', featured: false },
  { brand: 'BMW', model: '5 SERIES', year: '2023', variant: 'TOP END', reg: 'TN-55', owner: '1', colour: 'WHITE', fuel: 'DIESEL', trans: 'AT', km: '96000', price: 3500000, finalPrice: 3500000, dealer: 'TN-58-D-SEKAR', phone: '', featured: true },
  { brand: 'Hyundai', model: 'CRETA', year: '2023', variant: 'EX', reg: 'TN-61', owner: '1', colour: 'BLACK', fuel: 'PETROL', trans: 'MT', km: '37000', price: 900000, finalPrice: 900000, dealer: 'ROSHAN', phone: '', featured: false },
];

export const DEFAULT_THEME_COLORS: ThemeColors = {
  presetId: 'obsidian-gold',
  mode: 'dark',
  bg: '#0b0b0c',
  surface: '#161514',
  surfaceAlt: '#1d1b19',
  border: '#2c251e',
  text: '#f6efe6',
  muted: '#a99f92',
  accent: '#c98a4b',
  accentBright: '#e8b06a',
  accentContrast: '#12100e',
};

export const DEFAULT_SITE_CONTENT: SiteContent = {
  brandName: 'Thiru Annamalaiyar Cars',
  tagline: 'The Auto Choice',
  logoUrl: '/assets/aistudio/image_20261121_123728_f2e9b349.jpg',
  bannerUrl: '/assets/aistudio/WhatsApp_Image_2026-11-21_at_12.27.17_6ac12c63.jpeg',
  announcementEnabled: true,
  announcementText: 'Verified 150-point inspected pre-owned vehicles in Trichy · Instant RTO transfer & financing available.',
  heroKicker: 'Trusted Pre-Owned Showroom · Cantonment, Trichy-1',
  heroHeadline: 'Find the car that fits your journey.',
  heroSubheadline:
    'Every vehicle in our gallery undergoes mechanical verification, verified odometer auditing, and transparent pricing with zero hidden fees.',
  heroPrimaryCta: 'Browse Inventory',
  heroSecondaryCta: 'Book Showroom Visit',
  heroImageUrl: IMG_HERO,
  trustMetrics: [
    { value: 'All Live', label: 'Verified Pre-Owned Cars' },
    { value: '14+ Brands', label: 'Hatchbacks to Flagship SUVs' },
    { value: '₹1.40 L+', label: 'Starting Showroom Price' },
    { value: '100% Check', label: 'RC & History Verified' },
  ],
  catalogTitle: 'Curated Pre-Owned Inventory',
  catalogSubtitle:
    'Filter by brand, fuel type, transmission, ownership history, colour, year, or budget in Lakhs. Save favourites to compare or send an enquiry directly.',
  storyTitle: 'Talk to the Auto Choice team',
  storyBody:
    'A wide, hand-checked selection across Trichy — from dependable daily cars to premium SUVs. Tell us your budget and we will help you shortlist the right match.',
  storyHighlights: [
    {
      title: 'Verified Ownership Records',
      detail: 'RC authenticity, hypothecation clearance, and insurance validity checked prior to listing.',
    },
    {
      title: 'Direct Dealership Pricing',
      detail: 'Clear asking and final showroom rates in INR Lakhs with instant savings breakdown.',
    },
    {
      title: 'Same-Day Test Drives',
      detail: 'Visit our Jenne Plaza, Cantonment showroom or call ahead for quick vehicle inspection.',
    },
  ],
  showroomAddress: 'A-2, Ground Floor, Jenne Plaza, Cantonment',
  showroomCity: 'Trichy-1, Tamil Nadu',
  contactPhone: '04312410888 / 9385588888 / 9884588880',
  contactEmail: 'thiruannamalaiyarcars1981@gmail.com',
  whatsappNumber: '919385588888',
  cardCallNumber: '9385588888',
  cardWhatsappNumber: '9385588888',
  businessHours: 'Monday – Sunday · 9:30 AM – 7:30 PM',
  footerNote: 'Thiru Annamalaiyar Cars — The Auto Choice. A-2 Ground Floor, Jenne Plaza, Cantonment, Trichy-1.',
};

export const FULL_ADMIN_PERMISSIONS: StaffPermissions = {
  canAddCar: true,
  canEditCar: true,
  canDeleteCar: true,
  canEditPrice: true,
  canViewAllEnquiries: true,
  canEditSiteContent: true,
};

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  canAddCar: true,
  canEditCar: true,
  canDeleteCar: false,
  canEditPrice: false,
  canViewAllEnquiries: false,
  canEditSiteContent: false,
};

export const CUSTOMER_PERMISSIONS: StaffPermissions = {
  canAddCar: false,
  canEditCar: false,
  canDeleteCar: false,
  canEditPrice: false,
  canViewAllEnquiries: false,
  canEditSiteContent: false,
};

function createInitialStore(): DataStore {
  const now = new Date();
  const vehicles: Vehicle[] = RAW_SEED_VEHICLES.slice(0, MAX_SAMPLE_VEHICLES).map((item, idx) => {
    const createdAt = new Date(now.getTime() - (RAW_SEED_VEHICLES.length - idx) * 3600_000 * 6).toISOString();
    return {
      id: `veh-${String(idx + 1).padStart(3, '0')}`,
      brand: item.brand,
      model: item.model,
      year: item.year,
      variant: item.variant,
      reg: item.reg,
      owner: item.owner,
      colour: item.colour,
      fuel: item.fuel,
      trans: item.trans,
      km: item.km,
      price: item.price,
      finalPrice: item.finalPrice,
      dealer: item.dealer,
      phone: item.phone,
      fc: '',
      insurance: '',
      permit: '',
      boardType: 'Non Tboard Vehicles',
      status: 'Available',
      featured: item.featured,
      imageUrl: pickVehicleImage(item.brand, item.model, item.colour, item.fuel),
      views: Math.max(12, 180 - idx * 4),
      createdAt,
      updatedAt: createdAt,
    };
  });

  const enquiries: Enquiry[] = [
    {
      id: 'enq-1001',
      vehicleId: 'veh-004',
      vehicleLabel: '2024 Toyota Innova Crysta ZX',
      customerName: 'Karthikeyan S.',
      phone: '+91 98421 44019',
      email: 'karthikeyan.s@example.in',
      budget: '₹32.5 L',
      location: 'Trichy',
      date: new Date(now.getTime() - 1000 * 60 * 95).toISOString().slice(0, 10),
      olxId: 'OLX-204817',
      message: 'Interested in inspecting the Crysta ZX this Saturday morning. Need loan quotation for 5 years.',
      source: 'website',
      status: 'Hot',
      notes: 'Scheduled showroom test drive at 11:00 AM.',
      createdAt: new Date(now.getTime() - 1000 * 60 * 95).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 40).toISOString(),
    },
    {
      id: 'enq-1002',
      vehicleId: 'veh-007',
      vehicleLabel: '2024 Mahindra XUV700 AX7',
      customerName: 'Priyadharshini R.',
      phone: '+91 94430 89211',
      email: 'priya.r@example.in',
      budget: '₹21.5 L',
      location: 'Srirangam',
      date: new Date(now.getTime() - 1000 * 60 * 35).toISOString().slice(0, 10),
      olxId: 'OLX-204822',
      message: 'Please share service history PDF and confirm whether exchange for 2019 Swift is accepted.',
      source: 'website',
      status: 'Just Enquiry',
      createdAt: new Date(now.getTime() - 1000 * 60 * 35).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 35).toISOString(),
    },
    {
      id: 'enq-1003',
      vehicleLabel: '2025 MG Windsor EV Essence Top End',
      customerName: 'Aravind Kumar M.',
      phone: '+91 96291 77402',
      budget: '₹14.5 L',
      location: 'Trichy',
      date: new Date(now.getTime() - 1000 * 60 * 60 * 14).toISOString().slice(0, 10),
      olxId: 'OLX-204836',
      message: 'Checking battery warranty transfer process and fast charger inclusion.',
      source: 'walk-in',
      status: 'Enquiry',
      createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 14).toISOString(),
      updatedAt: new Date(now.getTime() - 1000 * 60 * 60 * 8).toISOString(),
    },
  ];

  // Seed realistic 7-day analytics baseline so charts are populated on day 1 while live events append dynamically
  const analyticsEvents: AnalyticsEvent[] = [];
  const devices = ['Desktop Chrome', 'Mobile Safari', 'Mobile Android', 'Desktop Edge'];
  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    const dayDate = new Date(now.getTime() - dayOffset * 86400_000);
    const viewsForDay = 18 + (6 - dayOffset) * 4;
    for (let i = 0; i < viewsForDay; i++) {
      const evTime = new Date(dayDate.getTime() - i * 900_000).toISOString();
      const targetVeh = vehicles[(i + dayOffset) % 10];
      analyticsEvents.push({
        id: `evt-seed-${dayOffset}-${i}`,
        type: i % 3 === 0 ? 'vehicle_view' : 'page_view',
        path: i % 3 === 0 ? `/inventory/${targetVeh.id}` : '/',
        vehicleId: i % 3 === 0 ? targetVeh.id : undefined,
        label: i % 3 === 0 ? `${targetVeh.year} ${targetVeh.brand} ${targetVeh.model}` : 'Storefront Home',
        sessionId: `sess-${dayOffset}-${Math.floor(i / 2)}`,
        device: devices[i % devices.length],
        createdAt: evTime,
      });
    }
  }

  const notifications: AppNotification[] = [
    {
      id: 'notif-seed-1',
      type: 'enquiry',
      title: 'New Website Enquiry',
      message: 'Priyadharshini R. enquired about 2024 Mahindra XUV700 AX7.',
      actorName: 'Priyadharshini R.',
      targetRole: 'staff',
      readBy: [],
      createdAt: new Date(now.getTime() - 1000 * 60 * 35).toISOString(),
    },
    {
      id: 'notif-seed-2',
      type: 'system',
      title: 'Live Showroom Console Ready',
      message: 'Real-time WebSocket notifications and full-page CMS controls are active.',
      targetRole: 'all',
      readBy: [],
      createdAt: new Date(now.getTime() - 1000 * 60 * 120).toISOString(),
    },
  ];

  return {
    users: [],
    vehicles,
    enquiries,
    siteContent: DEFAULT_SITE_CONTENT,
    themeColors: DEFAULT_THEME_COLORS,
    analyticsEvents,
    notifications,
    catalogTrimmedToTen: true,
  };
}

class StoreManager {
  private data: DataStore = createInitialStore();
  private initialized = false;
  private writeChain: Promise<void> = Promise.resolve();

  async init(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      const raw = await fs.readFile(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DataStore>;
      const initial = createInitialStore();
      const rawContent = parsed.siteContent ? { ...initial.siteContent, ...parsed.siteContent } : initial.siteContent;
      const needsBrandSync =
        !parsed.siteContent?.logoUrl ||
        parsed.siteContent?.contactEmail === 'sales@annamalaiyarcars.in';
      const syncedContent: SiteContent = needsBrandSync
        ? {
            ...rawContent,
            logoUrl: initial.siteContent.logoUrl,
            bannerUrl: initial.siteContent.bannerUrl,
            heroKicker: initial.siteContent.heroKicker,
            showroomAddress: initial.siteContent.showroomAddress,
            showroomCity: initial.siteContent.showroomCity,
            contactPhone: initial.siteContent.contactPhone,
            contactEmail: initial.siteContent.contactEmail,
            whatsappNumber: initial.siteContent.whatsappNumber,
            footerNote: initial.siteContent.footerNote,
          }
        : rawContent;

      const existingVehicles = Array.isArray(parsed.vehicles) ? parsed.vehicles : [];
      const baseVehicles = existingVehicles.length > 0 ? existingVehicles : initial.vehicles;
      const needsVehicleFieldsUpgrade = baseVehicles.some(
        (v) =>
          v.fc === undefined ||
          v.insurance === undefined ||
          v.permit === undefined ||
          (v.boardType !== 'Tboard Vehicles' && v.boardType !== 'Non Tboard Vehicles')
      );
      const normalizedVehicles = baseVehicles.map((v) => ({
        ...v,
        fc: v.fc ?? '',
        insurance: v.insurance ?? '',
        permit: v.permit ?? '',
        boardType:
          v.boardType === 'Tboard Vehicles' || v.boardType === 'Non Tboard Vehicles'
            ? v.boardType
            : 'Non Tboard Vehicles',
      }));
      const needsCatalogMarker = parsed.catalogTrimmedToTen !== true;
      const shouldTrimSampleCatalog = needsCatalogMarker && normalizedVehicles.length > MAX_SAMPLE_VEHICLES;
      const keptVehicles = shouldTrimSampleCatalog
        ? normalizedVehicles.slice(0, MAX_SAMPLE_VEHICLES)
        : normalizedVehicles;
      const keptVehicleIds = new Set(keptVehicles.map((v) => v.id));

      const rawEnquiries = Array.isArray(parsed.enquiries) ? parsed.enquiries : initial.enquiries;
      const syncedEnquiries = shouldTrimSampleCatalog
        ? rawEnquiries.map((e) =>
            e.vehicleId && !keptVehicleIds.has(e.vehicleId) ? { ...e, vehicleId: undefined } : e
          )
        : rawEnquiries;
      const rawEvents = Array.isArray(parsed.analyticsEvents) ? parsed.analyticsEvents : initial.analyticsEvents;
      const syncedEvents = shouldTrimSampleCatalog
        ? rawEvents.map((ev) =>
            ev.vehicleId && !keptVehicleIds.has(ev.vehicleId) ? { ...ev, vehicleId: undefined } : ev
          )
        : rawEvents;
      const needsReferenceCleanup =
        shouldTrimSampleCatalog &&
        (syncedEnquiries.some((e, i) => e !== rawEnquiries[i]) ||
          syncedEvents.some((ev, i) => ev !== rawEvents[i]));

      this.data = {
        users: Array.isArray(parsed.users) ? parsed.users : initial.users,
        vehicles: keptVehicles,
        enquiries: syncedEnquiries,
        siteContent: syncedContent,
        themeColors: parsed.themeColors ? { ...initial.themeColors, ...parsed.themeColors } : initial.themeColors,
        analyticsEvents: syncedEvents,
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : initial.notifications,
        catalogTrimmedToTen: true,
      };
      if (needsBrandSync || needsVehicleFieldsUpgrade || shouldTrimSampleCatalog || needsCatalogMarker || needsReferenceCleanup) {
        await this.persist();
      }
    } catch {
      this.data = createInitialStore();
      await this.persist();
    }
    this.initialized = true;
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.data, null, 2);
    this.writeChain = this.writeChain
      .then(async () => {
        const tmp = `${STORE_PATH}.${crypto.randomUUID()}.tmp`;
        await fs.writeFile(tmp, snapshot, 'utf8');
        await fs.rename(tmp, STORE_PATH);
      })
      .catch((err) => {
        console.error('Failed to persist data store:', err);
      });
    return this.writeChain;
  }

  toPublicUser(user: StoredUser): UserAccount {
    const { passwordHash: _omit, ...rest } = user;
    return rest;
  }

  getUsers(): UserAccount[] {
    return this.data.users.map((u) => this.toPublicUser(u));
  }

  getStoredUserByEmail(email: string): StoredUser | undefined {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return undefined;
    return this.data.users.find((u) => u.email.toLowerCase() === normalized);
  }

  getStoredUserByUsername(username: string): StoredUser | undefined {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return undefined;
    return this.data.users.find((u) => u.username?.toLowerCase() === normalized);
  }

  getStoredUserByIdentifier(identifier: string): StoredUser | undefined {
    const normalized = identifier.trim().toLowerCase();
    if (!normalized) return undefined;
    return this.data.users.find(
      (u) =>
        u.username?.toLowerCase() === normalized ||
        u.email.toLowerCase() === normalized ||
        u.staffCode?.toLowerCase() === normalized
    );
  }

  getUserById(id: string): UserAccount | undefined {
    const found = this.data.users.find((u) => u.id === id);
    return found ? this.toPublicUser(found) : undefined;
  }

  getStoredUserById(id: string): StoredUser | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  hasAdminUser(): boolean {
    return this.data.users.some((u) => u.role === 'admin');
  }

  async addUser(user: StoredUser): Promise<UserAccount> {
    this.data.users.unshift(user);
    await this.persist();
    return this.toPublicUser(user);
  }

  async updateUser(id: string, patch: Partial<StoredUser>): Promise<UserAccount | null> {
    const idx = this.data.users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    this.data.users[idx] = { ...this.data.users[idx], ...patch };
    await this.persist();
    return this.toPublicUser(this.data.users[idx]);
  }

  async deleteUser(id: string): Promise<boolean> {
    const before = this.data.users.length;
    this.data.users = this.data.users.filter((u) => u.id !== id);
    if (this.data.users.length === before) return false;
    await this.persist();
    return true;
  }

  getVehicles(): Vehicle[] {
    return this.data.vehicles;
  }

  getVehicleById(id: string): Vehicle | undefined {
    return this.data.vehicles.find((v) => v.id === id);
  }

  async addVehicle(vehicle: Vehicle): Promise<Vehicle> {
    this.data.vehicles.unshift(vehicle);
    await this.persist();
    return vehicle;
  }

  async updateVehicle(id: string, patch: Partial<Vehicle>): Promise<Vehicle | null> {
    const idx = this.data.vehicles.findIndex((v) => v.id === id);
    if (idx === -1) return null;
    this.data.vehicles[idx] = {
      ...this.data.vehicles[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.persist();
    return this.data.vehicles[idx];
  }

  async deleteVehicle(id: string): Promise<boolean> {
    const before = this.data.vehicles.length;
    this.data.vehicles = this.data.vehicles.filter((v) => v.id !== id);
    if (this.data.vehicles.length === before) return false;
    await this.persist();
    return true;
  }

  getEnquiries(): Enquiry[] {
    return this.data.enquiries;
  }

  async addEnquiry(enquiry: Enquiry): Promise<Enquiry> {
    this.data.enquiries.unshift(enquiry);
    await this.persist();
    return enquiry;
  }

  async updateEnquiry(id: string, patch: Partial<Enquiry>): Promise<Enquiry | null> {
    const idx = this.data.enquiries.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    this.data.enquiries[idx] = {
      ...this.data.enquiries[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.persist();
    return this.data.enquiries[idx];
  }

  async deleteEnquiry(id: string): Promise<boolean> {
    const before = this.data.enquiries.length;
    this.data.enquiries = this.data.enquiries.filter((enquiry) => enquiry.id !== id);
    if (this.data.enquiries.length === before) return false;
    await this.persist();
    return true;
  }

  getSiteContent(): SiteContent {
    return this.data.siteContent;
  }

  async updateSiteContent(patch: Partial<SiteContent>): Promise<SiteContent> {
    this.data.siteContent = { ...this.data.siteContent, ...patch };
    await this.persist();
    return this.data.siteContent;
  }

  getThemeColors(): ThemeColors {
    return this.data.themeColors;
  }

  async updateThemeColors(patch: Partial<ThemeColors>): Promise<ThemeColors> {
    this.data.themeColors = { ...this.data.themeColors, ...patch };
    await this.persist();
    return this.data.themeColors;
  }

  async trackEvent(event: AnalyticsEvent): Promise<void> {
    this.data.analyticsEvents.unshift(event);
    if (this.data.analyticsEvents.length > 2500) {
      this.data.analyticsEvents = this.data.analyticsEvents.slice(0, 2500);
    }
    if (event.type === 'vehicle_view' && event.vehicleId) {
      const veh = this.data.vehicles.find((v) => v.id === event.vehicleId);
      if (veh) veh.views += 1;
    }
    await this.persist();
  }

  getAnalyticsSummary(): AnalyticsSummary {
    const events = this.data.analyticsEvents;
    const totalPageViews = events.filter((e) => e.type === 'page_view' || e.type === 'vehicle_view').length;
    const uniqueSessions = new Set(events.map((e) => e.sessionId)).size;
    const totalVehicleViews = events.filter((e) => e.type === 'vehicle_view').length;
    const totalEnquiries = this.data.enquiries.length;
    const conversionRate = totalPageViews > 0 ? Number(((totalEnquiries / totalPageViews) * 100).toFixed(1)) : 0;

    // Last 7 days daily series
    const dailyMap = new Map<string, { views: number; enquiries: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      dailyMap.set(d, { views: 0, enquiries: 0 });
    }
    for (const ev of events) {
      const day = ev.createdAt.slice(0, 10);
      const bucket = dailyMap.get(day);
      if (bucket && (ev.type === 'page_view' || ev.type === 'vehicle_view')) {
        bucket.views += 1;
      }
    }
    for (const enq of this.data.enquiries) {
      const day = enq.createdAt.slice(0, 10);
      const bucket = dailyMap.get(day);
      if (bucket) {
        bucket.enquiries += 1;
      }
    }

    const dailySeries = Array.from(dailyMap.entries()).map(([date, val]) => ({
      date,
      views: val.views,
      enquiries: val.enquiries,
    }));

    const topVehicles = [...this.data.vehicles]
      .sort((a, b) => b.views - a.views)
      .slice(0, 6)
      .map((v) => ({
        id: v.id,
        label: `${v.year} ${v.brand} ${v.model}`,
        views: v.views,
        enquiries: this.data.enquiries.filter((e) => e.vehicleId === v.id).length,
      }));

    const fuelCounts = new Map<string, number>();
    for (const v of this.data.vehicles) {
      fuelCounts.set(v.fuel, (fuelCounts.get(v.fuel) || 0) + 1);
    }
    const fuelBreakdown = Array.from(fuelCounts.entries())
      .map(([fuel, count]) => ({ fuel, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalPageViews,
      uniqueSessions,
      totalVehicleViews,
      totalEnquiries,
      conversionRate,
      dailySeries,
      topVehicles,
      fuelBreakdown,
      recentEvents: events.slice(0, 20),
    };
  }

  getNotifications(role: 'admin' | 'staff' | 'customer'): AppNotification[] {
    return this.data.notifications.filter((n) => {
      if (role === 'admin') return true;
      if (role === 'staff') return n.targetRole === 'all' || n.targetRole === 'staff';
      return n.targetRole === 'all';
    });
  }

  async addNotification(notif: AppNotification): Promise<AppNotification> {
    this.data.notifications.unshift(notif);
    if (this.data.notifications.length > 200) {
      this.data.notifications = this.data.notifications.slice(0, 200);
    }
    await this.persist();
    return notif;
  }

  async markNotificationRead(id: string, userId: string): Promise<void> {
    const n = this.data.notifications.find((item) => item.id === id);
    if (n && !n.readBy.includes(userId)) {
      n.readBy.push(userId);
      await this.persist();
    }
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    for (const n of this.data.notifications) {
      if (!n.readBy.includes(userId)) {
        n.readBy.push(userId);
      }
    }
    await this.persist();
  }
}

export const store = new StoreManager();
