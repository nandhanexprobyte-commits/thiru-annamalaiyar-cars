import 'dotenv/config';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
// vite is loaded lazily (dev only) so production installs can omit it.
import {
  CUSTOMER_PERMISSIONS,
  DEFAULT_SITE_CONTENT,
  DEFAULT_STAFF_PERMISSIONS,
  DEFAULT_THEME_COLORS,
  FULL_ADMIN_PERMISSIONS,
  store,
  type StoredUser,
} from './server/store.ts';
import {
  createAuthMiddleware,
  hashPassword,
  signToken,
  verifyEnvAdminPasscode,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
import { attachWebSocketServer } from './server/ws.ts';
import type {
  EnquiryStatus,
  SiteContent,
  StaffPermissions,
  ThemeColors,
  Vehicle,
  VehicleBoardType,
} from './shared/types.ts';

const IS_VERCEL = Boolean(process.env.VERCEL);
const UPLOADS_DIR = IS_VERCEL ? path.join('/tmp', 'uploads') : path.resolve(process.cwd(), 'data', 'uploads');
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('/assets/') || trimmed.startsWith('/uploads/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function hasImageSignature(buffer: Buffer, ext: string): boolean {
  if (ext === 'png') {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (ext === 'jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (ext === 'gif') {
    const header = buffer.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (ext === 'webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function isHexColor(val: unknown): val is string {
  return typeof val === 'string' && /^#[0-9a-fA-F]{6}$/.test(val.trim());
}

function cleanText(val: unknown, maxLen = 200): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

const VALID_BOARD_TYPES: VehicleBoardType[] = ['Tboard Vehicles', 'Non Tboard Vehicles'];

const VALID_ENQUIRY_STATUSES: EnquiryStatus[] = [
  'New',
  'Contacted',
  'Test Drive',
  'Negotiation',
  'Closed',
  'Just Enquiry',
  'Enquiry',
  'Hot',
];

let httpServer: http.Server;

export async function createApp(): Promise<express.Application> {
  await store.init();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '6mb' }));

  httpServer = http.createServer(app);
  const wsHub = IS_VERCEL
    ? { broadcastAll() {}, broadcastStaffOrAdmin() {}, broadcastAdminOnly() {}, getClientCount() { return 0; } }
    : attachWebSocketServer(httpServer);
  const { requireAuth, requireRoles, requirePermission } = createAuthMiddleware((id) => store.getUserById(id));

  async function emitNotification(params: {
    type: 'enquiry' | 'inventory' | 'user' | 'cms' | 'system';
    title: string;
    message: string;
    actorName?: string;
    targetRole: 'all' | 'staff' | 'admin';
  }) {
    const notif = await store.addNotification({
      id: `notif-${crypto.randomUUID().slice(0, 8)}`,
      type: params.type,
      title: params.title,
      message: params.message,
      actorName: params.actorName,
      targetRole: params.targetRole,
      readBy: [],
      createdAt: new Date().toISOString(),
    });
    if (params.targetRole === 'all') {
      wsHub.broadcastAll('notification:new', notif);
    } else if (params.targetRole === 'staff') {
      wsHub.broadcastStaffOrAdmin('notification:new', notif);
    } else {
      wsHub.broadcastAdminOnly('notification:new', notif);
    }
    return notif;
  }

  // --- Health ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, wsClients: wsHub.getClientCount() });
  });

  // --- Uploaded Vehicle Images ---
  app.use('/uploads', express.static(UPLOADS_DIR));

  app.post('/api/upload-image', requireAuth, async (req: AuthenticatedRequest, res) => {
    const raw = req.body?.image;
    if (typeof raw !== 'string') {
      return res.status(400).json({ error: 'Image data is required.' });
    }
    const match = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(raw.trim());
    if (!match) {
      return res.status(400).json({ error: 'Only JPEG, PNG, WEBP, or GIF images are supported.' });
    }
    const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) {
      return res.status(400).json({ error: 'Image must be non-empty and under 4 MB.' });
    }
    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    if (!hasImageSignature(buffer, ext)) {
      return res.status(400).json({ error: 'The file content does not match its image type.' });
    }
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const fileName = `car-${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(path.join(UPLOADS_DIR, fileName), buffer);
    res.status(201).json({ url: `/uploads/${fileName}` });
  });

  // --- Public Site Content & Theme ---
  app.get('/api/site', (_req, res) => {
    res.json({
      content: store.getSiteContent(),
      theme: store.getThemeColors(),
    });
  });

  // --- Protected Vehicles Catalog (requires portal sign-in) ---
  app.get('/api/vehicles', requireAuth, (_req, res) => {
    res.json({ vehicles: store.getVehicles() });
  });

  // --- Auth Bootstrap Status ---
  app.get('/api/auth/bootstrap-status', (_req, res) => {
    const envOverrideActive = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    const adminClaimed = store.hasAdminUser();
    res.json({ adminClaimed, envOverrideActive });
  });

  const normalizeUsername = (raw: unknown): string => {
    if (typeof raw !== 'string') return '';
    return raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 40);
  };

  // --- First-Run Admin Claim ---
  app.post('/api/auth/claim-admin', async (req, res) => {
    const envOverrideActive = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
    if (envOverrideActive || store.hasAdminUser()) {
      return res.status(409).json({ error: 'Admin account has already been claimed. Please sign in.' });
    }

    const name = cleanText(req.body?.name, 80);
    const rawEmail = cleanText(req.body?.email, 120).toLowerCase();
    const rawUsername = normalizeUsername(req.body?.username);
    const username = rawUsername || normalizeUsername(rawEmail.split('@')[0]) || 'admin';
    const email = rawEmail && rawEmail.includes('@') ? rawEmail : `${username}@annamalaiyarcars.in`;
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2 || username.length < 3 || password.length < 8) {
      return res
        .status(400)
        .json({ error: 'Provide a valid name, username (3+ chars), and password (minimum 8 characters).' });
    }

    if (store.getStoredUserByEmail(email) || store.getStoredUserByUsername(username)) {
      return res.status(409).json({ error: 'An account with this username or email already exists.' });
    }

    const adminUser: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      name,
      username,
      email,
      role: 'admin',
      staffCode: 'OWNER-01',
      title: 'Showroom Administrator',
      active: true,
      permissions: { ...FULL_ADMIN_PERMISSIONS },
      shortlistedIds: [],
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    const publicUser = await store.addUser(adminUser);
    const token = signToken(publicUser);

    await emitNotification({
      type: 'system',
      title: 'Admin Account Initialized',
      message: `${publicUser.name} (@${username}) claimed primary Administrator access.`,
      actorName: publicUser.name,
      targetRole: 'admin',
    });

    res.status(201).json({ user: publicUser, token });
  });

  // --- Customer / Member Self-Registration ---
  app.post('/api/auth/register', async (req, res) => {
    const name = cleanText(req.body?.name, 80);
    const rawEmail = cleanText(req.body?.email, 120).toLowerCase();
    const rawUsername = normalizeUsername(req.body?.username);
    const username = rawUsername || normalizeUsername(rawEmail.split('@')[0]);
    const email = rawEmail && rawEmail.includes('@') ? rawEmail : `${username}@member.annamalaiyarcars.in`;
    const phone = cleanText(req.body?.phone, 24);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2 || username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Valid name, username (3+ chars), and password (6+ chars) are required.' });
    }

    if (store.getStoredUserByUsername(username) || (rawEmail && store.getStoredUserByEmail(email))) {
      return res.status(409).json({ error: 'An account with this username or email already exists.' });
    }

    const customer: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      name,
      username,
      email,
      phone,
      role: 'customer',
      active: true,
      permissions: { ...CUSTOMER_PERMISSIONS },
      shortlistedIds: [],
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    const publicUser = await store.addUser(customer);
    const token = signToken(publicUser);

    await emitNotification({
      type: 'user',
      title: 'New Member Registered',
      message: `${publicUser.name} (@${username}) created a showroom portal account.`,
      actorName: publicUser.name,
      targetRole: 'staff',
    });

    res.status(201).json({ user: publicUser, token });
  });

  // --- Login (Username, Email, or Staff Code + Password / ADMIN_PASSCODE override) ---
  app.post('/api/auth/login', async (req, res) => {
    const identifier = cleanText(req.body?.username ?? req.body?.identifier ?? req.body?.email, 120).toLowerCase();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Check configured ADMIN_PASSCODE override first
    if (verifyEnvAdminPasscode(password)) {
      let existingAdmin = store.getUsers().find((u) => u.role === 'admin');
      if (!existingAdmin) {
        const fallbackUsername = normalizeUsername(identifier.split('@')[0]) || 'admin';
        const fallbackEmail = identifier.includes('@') ? identifier : `${fallbackUsername}@annamalaiyarcars.in`;
        const created = await store.addUser({
          id: `usr-${crypto.randomUUID().slice(0, 8)}`,
          name: 'Showroom Owner',
          username: fallbackUsername,
          email: fallbackEmail,
          role: 'admin',
          staffCode: 'OWNER-01',
          title: 'Showroom Administrator',
          active: true,
          permissions: { ...FULL_ADMIN_PERMISSIONS },
          shortlistedIds: [],
          passwordHash: hashPassword(password),
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        });
        existingAdmin = created;
      } else {
        await store.updateUser(existingAdmin.id, { lastLoginAt: new Date().toISOString() });
      }
      const token = signToken(existingAdmin);
      return res.json({ user: existingAdmin, token });
    }

    const stored = store.getStoredUserByIdentifier(identifier);
    if (!stored || !verifyPassword(password, stored.passwordHash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (!stored.active) {
      return res.status(403).json({ error: 'This account has been deactivated by an administrator.' });
    }

    const updated = await store.updateUser(stored.id, { lastLoginAt: new Date().toISOString() });
    const user = updated || store.toPublicUser(stored);
    const token = signToken(user);
    res.json({ user, token });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: req.authUser });
  });

  // --- Customer Shortlist Sync ---
  app.post('/api/me/shortlist', requireAuth, async (req: AuthenticatedRequest, res) => {
    const vehicleId = cleanText(req.body?.vehicleId, 40);
    if (!vehicleId || !store.getVehicleById(vehicleId)) {
      return res.status(400).json({ error: 'Invalid vehicleId' });
    }
    const user = req.authUser!;
    const exists = user.shortlistedIds.includes(vehicleId);
    const nextList = exists
      ? user.shortlistedIds.filter((id) => id !== vehicleId)
      : [...user.shortlistedIds, vehicleId];

    const updated = await store.updateUser(user.id, { shortlistedIds: nextList });
    res.json({ user: updated });
  });

  // --- Analytics Ingestion (Public) ---
  app.post('/api/analytics/track', async (req, res) => {
    const allowedTypes = ['page_view', 'vehicle_view', 'search', 'shortlist', 'enquiry'] as const;
    const type = req.body?.type;
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    const event = {
      id: `evt-${crypto.randomUUID().slice(0, 8)}`,
      type,
      path: cleanText(req.body?.path, 120) || '/',
      vehicleId: cleanText(req.body?.vehicleId, 40) || undefined,
      label: cleanText(req.body?.label, 120) || undefined,
      sessionId: cleanText(req.body?.sessionId, 64) || 'anonymous',
      device: cleanText(req.body?.device, 64) || 'Web Browser',
      createdAt: new Date().toISOString(),
    };

    await store.trackEvent(event);
    wsHub.broadcastStaffOrAdmin('analytics:tick', {
      event,
      summary: store.getAnalyticsSummary(),
    });
    res.status(202).json({ tracked: true });
  });

  // --- Vehicle CRUD ---
  app.post('/api/vehicles', requireAuth, requirePermission('canAddCar'), async (req: AuthenticatedRequest, res) => {
    const brand = cleanText(req.body?.brand, 60);
    const model = cleanText(req.body?.model, 80);
    const year = cleanText(req.body?.year, 20);
    const variant = cleanText(req.body?.variant, 80);
    const reg = cleanText(req.body?.reg, 40);
    const owner = cleanText(req.body?.owner, 10) || '1';
    const colour = cleanText(req.body?.colour, 40) || 'White';
    const fuel = cleanText(req.body?.fuel, 30) || 'Petrol';
    const trans = cleanText(req.body?.trans, 20) || 'MT';
    const km = cleanText(req.body?.km, 24) || '0';
    const price = Number(req.body?.price);
    const finalPrice = Number(req.body?.finalPrice || req.body?.price);
    const dealer = cleanText(req.body?.dealer, 80) || req.authUser!.name;
    const phone = cleanText(req.body?.phone, 30);
    const fc = cleanText(req.body?.fc, 40);
    const insurance = cleanText(req.body?.insurance, 60);
    const permit = cleanText(req.body?.permit, 60);
    const requestedBoardType = req.body?.boardType as VehicleBoardType;
    const boardType: VehicleBoardType = VALID_BOARD_TYPES.includes(requestedBoardType)
      ? requestedBoardType
      : 'Non Tboard Vehicles';
    const featured = Boolean(req.body?.featured);
    const rawImg = cleanText(req.body?.imageUrl, 300);
    const imageUrl = rawImg && isSafeImageUrl(rawImg) ? rawImg : '/src/assets/images/vehicle_suv_flagship_1795250937139.jpg';

    if (!brand || !model || !year || Number.isNaN(price) || price <= 0) {
      return res.status(400).json({ error: 'Brand, model, year, and valid price are required.' });
    }

    const now = new Date().toISOString();
    const vehicle: Vehicle = {
      id: `veh-${crypto.randomUUID().slice(0, 8)}`,
      brand,
      model,
      year,
      variant,
      reg,
      owner,
      colour,
      fuel,
      trans,
      km,
      price,
      finalPrice: Number.isNaN(finalPrice) || finalPrice <= 0 ? price : finalPrice,
      dealer,
      phone,
      fc,
      insurance,
      permit,
      boardType,
      status: 'Available',
      featured,
      imageUrl,
      views: 0,
      createdAt: now,
      updatedAt: now,
    };

    const created = await store.addVehicle(vehicle);
    wsHub.broadcastAll('inventory:updated', { action: 'create', vehicle: created });
    await emitNotification({
      type: 'inventory',
      title: 'New Vehicle Added',
      message: `${created.year} ${created.brand} ${created.model} added by ${req.authUser!.name}.`,
      actorName: req.authUser!.name,
      targetRole: 'staff',
    });

    res.status(201).json({ vehicle: created });
  });

  app.patch('/api/vehicles/:id', requireAuth, requirePermission('canEditCar'), async (req: AuthenticatedRequest, res) => {
    const existing = store.getVehicleById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const isChangingPrice =
      (req.body?.price !== undefined && Number(req.body.price) !== existing.price) ||
      (req.body?.finalPrice !== undefined && Number(req.body.finalPrice) !== existing.finalPrice);

    if (isChangingPrice && req.authUser!.role !== 'admin' && !req.authUser!.permissions.canEditPrice) {
      return res.status(403).json({ error: 'You do not have permission to modify vehicle pricing.' });
    }

    const patch: Partial<Vehicle> = {};
    if (req.body?.brand !== undefined) patch.brand = cleanText(req.body.brand, 60) || existing.brand;
    if (req.body?.model !== undefined) patch.model = cleanText(req.body.model, 80) || existing.model;
    if (req.body?.year !== undefined) patch.year = cleanText(req.body.year, 20) || existing.year;
    if (req.body?.variant !== undefined) patch.variant = cleanText(req.body.variant, 80);
    if (req.body?.reg !== undefined) patch.reg = cleanText(req.body.reg, 40);
    if (req.body?.owner !== undefined) patch.owner = cleanText(req.body.owner, 10);
    if (req.body?.colour !== undefined) patch.colour = cleanText(req.body.colour, 40);
    if (req.body?.fuel !== undefined) patch.fuel = cleanText(req.body.fuel, 30);
    if (req.body?.trans !== undefined) patch.trans = cleanText(req.body.trans, 20);
    if (req.body?.km !== undefined) patch.km = cleanText(req.body.km, 24);
    if (req.body?.dealer !== undefined) patch.dealer = cleanText(req.body.dealer, 80);
    if (req.body?.phone !== undefined) patch.phone = cleanText(req.body.phone, 30);
    if (req.body?.fc !== undefined) patch.fc = cleanText(req.body.fc, 40);
    if (req.body?.insurance !== undefined) patch.insurance = cleanText(req.body.insurance, 60);
    if (req.body?.permit !== undefined) patch.permit = cleanText(req.body.permit, 60);
    if (req.body?.boardType !== undefined && VALID_BOARD_TYPES.includes(req.body.boardType as VehicleBoardType)) {
      patch.boardType = req.body.boardType as VehicleBoardType;
    }
    if (req.body?.featured !== undefined) patch.featured = Boolean(req.body.featured);
    if (req.body?.status && ['Available', 'Reserved', 'Sold'].includes(req.body.status)) {
      patch.status = req.body.status;
    }
    if (req.body?.price !== undefined && !Number.isNaN(Number(req.body.price)) && Number(req.body.price) > 0) {
      patch.price = Number(req.body.price);
    }
    if (req.body?.finalPrice !== undefined && !Number.isNaN(Number(req.body.finalPrice)) && Number(req.body.finalPrice) > 0) {
      patch.finalPrice = Number(req.body.finalPrice);
    }
    if (req.body?.imageUrl && isSafeImageUrl(String(req.body.imageUrl))) {
      patch.imageUrl = String(req.body.imageUrl).trim();
    }

    const updated = await store.updateVehicle(existing.id, patch);
    wsHub.broadcastAll('inventory:updated', { action: 'update', vehicle: updated });
    await emitNotification({
      type: 'inventory',
      title: 'Vehicle Updated',
      message: `${updated!.year} ${updated!.brand} ${updated!.model} (${updated!.status}) updated by ${req.authUser!.name}.`,
      actorName: req.authUser!.name,
      targetRole: 'staff',
    });

    res.json({ vehicle: updated });
  });

  app.delete('/api/vehicles/:id', requireAuth, requirePermission('canDeleteCar'), async (req: AuthenticatedRequest, res) => {
    const existing = store.getVehicleById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    await store.deleteVehicle(existing.id);
    wsHub.broadcastAll('inventory:updated', { action: 'delete', id: existing.id });
    await emitNotification({
      type: 'inventory',
      title: 'Vehicle Removed',
      message: `${existing.year} ${existing.brand} ${existing.model} was removed from inventory by ${req.authUser!.name}.`,
      actorName: req.authUser!.name,
      targetRole: 'admin',
    });
    res.json({ deleted: true });
  });

  // --- Enquiries ---
  app.post('/api/enquiries', requireAuth, async (req: AuthenticatedRequest, res) => {
    const customerName = cleanText(req.body?.customerName, 80);
    const phone = cleanText(req.body?.phone, 30);
    const email = cleanText(req.body?.email, 120);
    const budget = cleanText(req.body?.budget, 40);
    const location = cleanText(req.body?.location, 120);
    const date = cleanText(req.body?.date, 20);
    const olxId = cleanText(req.body?.olxId, 60);
    const message = cleanText(req.body?.message, 600);
    const vehicleId = cleanText(req.body?.vehicleId, 40) || undefined;
    const vehicleLabel = cleanText(req.body?.vehicleLabel, 120) || 'General Showroom Enquiry';
    const source = req.body?.source === 'staff' || req.body?.source === 'walk-in' ? req.body.source : 'website';
    const requestedStatus = req.body?.status;
    const status: EnquiryStatus =
      typeof requestedStatus === 'string' && (VALID_ENQUIRY_STATUSES as string[]).includes(requestedStatus)
        ? (requestedStatus as EnquiryStatus)
        : 'Just Enquiry';

    if (customerName.length < 2 || phone.length < 6) {
      return res.status(400).json({ error: 'Customer name and valid phone number are required.' });
    }

    const now = new Date().toISOString();
    const enquiry = await store.addEnquiry({
      id: `enq-${crypto.randomUUID().slice(0, 8)}`,
      vehicleId,
      vehicleLabel,
      customerName,
      phone,
      email: email || undefined,
      budget: budget || undefined,
      location: location || undefined,
      date: date || undefined,
      olxId: olxId || undefined,
      message: message || 'Requested callback from showroom advisor.',
      source,
      status,
      createdByUserId: req.authUser?.id,
      createdAt: now,
      updatedAt: now,
    });

    await store.trackEvent({
      id: `evt-${crypto.randomUUID().slice(0, 8)}`,
      type: 'enquiry',
      path: vehicleId ? `/inventory/${vehicleId}` : '/enquire',
      vehicleId,
      label: vehicleLabel,
      sessionId: cleanText(req.body?.sessionId, 64) || 'website',
      device: 'Web Browser',
      createdAt: now,
    });

    wsHub.broadcastStaffOrAdmin('enquiry:updated', { action: 'create', enquiry });
    wsHub.broadcastStaffOrAdmin('analytics:tick', { summary: store.getAnalyticsSummary() });
    await emitNotification({
      type: 'enquiry',
      title: 'New Customer Enquiry',
      message: `${customerName} (${phone}) enquired about ${vehicleLabel}.`,
      actorName: customerName,
      targetRole: 'staff',
    });

    res.status(201).json({ enquiry });
  });

  app.get('/api/me/enquiries', requireAuth, (req: AuthenticatedRequest, res) => {
    const mine = store.getEnquiries().filter((e) => e.createdByUserId === req.authUser!.id);
    res.json({ enquiries: mine });
  });

  app.get('/api/enquiries', requireAuth, requireRoles(['admin', 'staff']), (req: AuthenticatedRequest, res) => {
    const all = store.getEnquiries();
    const user = req.authUser!;
    if (user.role === 'admin' || user.permissions.canViewAllEnquiries) {
      return res.json({ enquiries: all });
    }
    const scoped = all.filter((e) => e.assignedStaffId === user.id || e.createdByUserId === user.id || e.status === 'New');
    res.json({ enquiries: scoped });
  });

  app.patch('/api/enquiries/:id', requireAuth, requireRoles(['admin', 'staff']), async (req: AuthenticatedRequest, res) => {
    const existing = store.getEnquiries().find((e) => e.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }
    const patch: Record<string, unknown> = {};
    if (req.body?.customerName !== undefined) {
      const customerName = cleanText(req.body.customerName, 80);
      if (customerName.length < 2) {
        return res.status(400).json({ error: 'Customer name must contain at least 2 characters.' });
      }
      patch.customerName = customerName;
    }
    if (req.body?.phone !== undefined) {
      const phone = cleanText(req.body.phone, 30);
      if (phone.length < 6) {
        return res.status(400).json({ error: 'A valid phone number is required.' });
      }
      patch.phone = phone;
    }
    if (req.body?.email !== undefined) patch.email = cleanText(req.body.email, 120) || undefined;
    if (req.body?.budget !== undefined) patch.budget = cleanText(req.body.budget, 40) || undefined;
    if (req.body?.location !== undefined) patch.location = cleanText(req.body.location, 120) || undefined;
    if (req.body?.date !== undefined) patch.date = cleanText(req.body.date, 20) || undefined;
    if (req.body?.olxId !== undefined) patch.olxId = cleanText(req.body.olxId, 60) || undefined;
    if (req.body?.message !== undefined) patch.message = cleanText(req.body.message, 600) || 'Requested callback from showroom advisor.';
    if (req.body?.vehicleId !== undefined) {
      const vehicleId = cleanText(req.body.vehicleId, 40);
      if (!vehicleId) {
        patch.vehicleId = undefined;
        patch.vehicleLabel = cleanText(req.body?.vehicleLabel, 120) || 'General Showroom Enquiry';
      } else {
        const vehicle = store.getVehicleById(vehicleId);
        if (!vehicle) return res.status(400).json({ error: 'Selected vehicle was not found.' });
        patch.vehicleId = vehicle.id;
        if (vehicle.id !== existing.vehicleId) {
          patch.vehicleLabel = `${vehicle.year} ${vehicle.brand} ${vehicle.model}`;
        }
      }
    }
    if (req.body?.vehicleLabel !== undefined && patch.vehicleLabel === undefined) {
      patch.vehicleLabel = cleanText(req.body.vehicleLabel, 120) || existing.vehicleLabel;
    }
    if (req.body?.status && VALID_ENQUIRY_STATUSES.includes(req.body.status)) {
      patch.status = req.body.status;
    }
    if (req.body?.notes !== undefined) {
      patch.notes = cleanText(req.body.notes, 500);
    }
    if (req.body?.assignedStaffId !== undefined) {
      const staffId = cleanText(req.body.assignedStaffId, 40);
      const staffUser = staffId ? store.getUserById(staffId) : undefined;
      patch.assignedStaffId = staffUser?.id || undefined;
      patch.assignedStaffName = staffUser?.name || undefined;
    }

    const updated = await store.updateEnquiry(req.params.id, patch);
    if (!updated) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    wsHub.broadcastStaffOrAdmin('enquiry:updated', { action: 'update', enquiry: updated });
    await emitNotification({
      type: 'enquiry',
      title: 'Enquiry Status Updated',
      message: `${updated.customerName} (${updated.vehicleLabel}) moved to ${updated.status} by ${req.authUser!.name}.`,
      actorName: req.authUser!.name,
      targetRole: 'staff',
    });

    res.json({ enquiry: updated });
  });

  app.delete('/api/enquiries/:id', requireAuth, requireRoles(['admin']), async (req: AuthenticatedRequest, res) => {
    const existing = store.getEnquiries().find((enquiry) => enquiry.id === req.params.id);
    if (!existing) return res.status(404).json({ error: 'Enquiry not found' });

    await store.deleteEnquiry(existing.id);
    wsHub.broadcastStaffOrAdmin('enquiry:updated', { action: 'delete', id: existing.id });
    await emitNotification({
      type: 'enquiry',
      title: 'Enquiry Removed',
      message: `${existing.customerName}'s enquiry was removed by ${req.authUser!.name}.`,
      actorName: req.authUser!.name,
      targetRole: 'admin',
    });
    res.json({ deleted: true });
  });

  // --- Admin Analytics ---
  app.get('/api/admin/analytics', requireAuth, requireRoles(['admin', 'staff']), (_req, res) => {
    res.json({ summary: store.getAnalyticsSummary(), wsClients: wsHub.getClientCount() });
  });

  // --- Admin User & Staff Management ---
  app.get('/api/admin/users', requireAuth, requireRoles(['admin', 'staff']), (req: AuthenticatedRequest, res) => {
    const users = store.getUsers();
    if (req.authUser!.role === 'admin') {
      return res.json({ users });
    }
    return res.json({ users: users.filter((u) => u.role === 'customer') });
  });

  app.patch('/api/admin/users/:id', requireAuth, requireRoles(['admin']), async (req: AuthenticatedRequest, res) => {
    const target = store.getStoredUserById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (target.id === req.authUser!.id && req.body?.active === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own active admin account.' });
    }

    const patch: Partial<StoredUser> = {};
    if (req.body?.name !== undefined) patch.name = cleanText(req.body.name, 80) || target.name;
    if (req.body?.phone !== undefined) patch.phone = cleanText(req.body.phone, 30);
    if (req.body?.active !== undefined) patch.active = Boolean(req.body.active);
    if (req.body?.title !== undefined) patch.title = cleanText(req.body.title, 80);
    if (req.body?.staffCode !== undefined) patch.staffCode = cleanText(req.body.staffCode, 30);
    if (req.body?.permissions && typeof req.body.permissions === 'object') {
      const p = req.body.permissions as Partial<StaffPermissions>;
      patch.permissions = {
        canAddCar: p.canAddCar ?? target.permissions.canAddCar,
        canEditCar: p.canEditCar ?? target.permissions.canEditCar,
        canDeleteCar: p.canDeleteCar ?? target.permissions.canDeleteCar,
        canEditPrice: p.canEditPrice ?? target.permissions.canEditPrice,
        canViewAllEnquiries: p.canViewAllEnquiries ?? target.permissions.canViewAllEnquiries,
        canEditSiteContent: p.canEditSiteContent ?? target.permissions.canEditSiteContent,
      };
    }
    if (typeof req.body?.newPassword === 'string' && req.body.newPassword.length >= 6) {
      patch.passwordHash = hashPassword(req.body.newPassword);
    }

    const updated = await store.updateUser(target.id, patch);
    await emitNotification({
      type: 'user',
      title: 'User Account Updated',
      message: `Account settings for ${updated!.name} were updated by ${req.authUser!.name}.`,
      actorName: req.authUser!.name,
      targetRole: 'admin',
    });
    res.json({ user: updated });
  });

  app.delete('/api/admin/users/:id', requireAuth, requireRoles(['admin']), async (req: AuthenticatedRequest, res) => {
    if (req.params.id === req.authUser!.id) {
      return res.status(400).json({ error: 'You cannot delete your own active admin account.' });
    }
    const target = store.getUserById(req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    await store.deleteUser(target.id);
    res.json({ deleted: true });
  });

  // --- Admin Staff & Portal User Onboarding ---
  app.post('/api/admin/staff', requireAuth, requireRoles(['admin']), async (req: AuthenticatedRequest, res) => {
    const name = cleanText(req.body?.name, 80);
    const rawEmail = cleanText(req.body?.email, 120).toLowerCase();
    const rawUsername = normalizeUsername(req.body?.username);
    const username = rawUsername || normalizeUsername(rawEmail.split('@')[0]);
    const email = rawEmail && rawEmail.includes('@') ? rawEmail : `${username}@annamalaiyarcars.in`;
    const phone = cleanText(req.body?.phone, 30);
    const targetRole = req.body?.role === 'customer' ? 'customer' : 'staff';
    const staffCode =
      targetRole === 'staff'
        ? cleanText(req.body?.staffCode, 30) || `STF-${Math.floor(100 + Math.random() * 900)}`
        : undefined;
    const title = targetRole === 'staff' ? cleanText(req.body?.title, 80) || 'Sales Advisor' : 'Portal Member';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (name.length < 2 || username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Valid name, username (3+ chars), and password (6+ chars) are required.' });
    }
    if (store.getStoredUserByUsername(username) || (rawEmail && store.getStoredUserByEmail(email))) {
      return res.status(409).json({ error: 'An account with this username or email already exists.' });
    }

    const rawPerms = (req.body?.permissions || {}) as Partial<StaffPermissions>;
    const permissions: StaffPermissions =
      targetRole === 'customer'
        ? { ...CUSTOMER_PERMISSIONS }
        : {
            canAddCar: rawPerms.canAddCar ?? DEFAULT_STAFF_PERMISSIONS.canAddCar,
            canEditCar: rawPerms.canEditCar ?? DEFAULT_STAFF_PERMISSIONS.canEditCar,
            canDeleteCar: rawPerms.canDeleteCar ?? DEFAULT_STAFF_PERMISSIONS.canDeleteCar,
            canEditPrice: rawPerms.canEditPrice ?? DEFAULT_STAFF_PERMISSIONS.canEditPrice,
            canViewAllEnquiries: rawPerms.canViewAllEnquiries ?? DEFAULT_STAFF_PERMISSIONS.canViewAllEnquiries,
            canEditSiteContent: rawPerms.canEditSiteContent ?? DEFAULT_STAFF_PERMISSIONS.canEditSiteContent,
          };

    const staffUser: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      name,
      username,
      email,
      phone,
      role: targetRole,
      staffCode,
      title,
      active: true,
      permissions,
      shortlistedIds: [],
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    const created = await store.addUser(staffUser);
    await emitNotification({
      type: 'user',
      title: targetRole === 'staff' ? 'Staff Member Added' : 'Portal Member Added',
      message: `${created.name} (@${username}) onboarded by ${req.authUser!.name}.`,
      actorName: req.authUser!.name,
      targetRole: 'admin',
    });

    res.status(201).json({ user: created });
  });

  // --- Full-Page Edit Control (CMS) ---
  app.put('/api/admin/content', requireAuth, requirePermission('canEditSiteContent'), async (req: AuthenticatedRequest, res) => {
    const incoming = req.body as Partial<SiteContent>;
    const current = store.getSiteContent();

    const heroImageUrl =
      incoming.heroImageUrl && isSafeImageUrl(incoming.heroImageUrl)
        ? incoming.heroImageUrl.trim()
        : current.heroImageUrl;

    const logoUrl =
      incoming.logoUrl && isSafeImageUrl(incoming.logoUrl)
        ? incoming.logoUrl.trim()
        : current.logoUrl;

    const bannerUrl =
      incoming.bannerUrl && isSafeImageUrl(incoming.bannerUrl)
        ? incoming.bannerUrl.trim()
        : current.bannerUrl;

    const updated = await store.updateSiteContent({
      brandName: cleanText(incoming.brandName ?? current.brandName, 80) || current.brandName,
      tagline: cleanText(incoming.tagline ?? current.tagline, 80),
      logoUrl,
      bannerUrl,
      announcementEnabled: incoming.announcementEnabled ?? current.announcementEnabled,
      announcementText: cleanText(incoming.announcementText ?? current.announcementText, 240),
      heroKicker: cleanText(incoming.heroKicker ?? current.heroKicker, 100),
      heroHeadline: cleanText(incoming.heroHeadline ?? current.heroHeadline, 140) || current.heroHeadline,
      heroSubheadline: cleanText(incoming.heroSubheadline ?? current.heroSubheadline, 360),
      heroPrimaryCta: cleanText(incoming.heroPrimaryCta ?? current.heroPrimaryCta, 40) || current.heroPrimaryCta,
      heroSecondaryCta: cleanText(incoming.heroSecondaryCta ?? current.heroSecondaryCta, 40) || current.heroSecondaryCta,
      heroImageUrl,
      trustMetrics: Array.isArray(incoming.trustMetrics)
        ? incoming.trustMetrics.slice(0, 4).map((m) => ({
            value: cleanText(m.value, 30),
            label: cleanText(m.label, 60),
          }))
        : current.trustMetrics,
      catalogTitle: cleanText(incoming.catalogTitle ?? current.catalogTitle, 100),
      catalogSubtitle: cleanText(incoming.catalogSubtitle ?? current.catalogSubtitle, 300),
      storyTitle: cleanText(incoming.storyTitle ?? current.storyTitle, 140),
      storyBody: cleanText(incoming.storyBody ?? current.storyBody, 500),
      storyHighlights: Array.isArray(incoming.storyHighlights)
        ? incoming.storyHighlights.slice(0, 3).map((h) => ({
            title: cleanText(h.title, 80),
            detail: cleanText(h.detail, 240),
          }))
        : current.storyHighlights,
      showroomAddress: cleanText(incoming.showroomAddress ?? current.showroomAddress, 180),
      showroomCity: cleanText(incoming.showroomCity ?? current.showroomCity, 120),
      contactPhone: cleanText(incoming.contactPhone ?? current.contactPhone, 40),
      contactEmail: cleanText(incoming.contactEmail ?? current.contactEmail, 120),
      whatsappNumber: cleanText(incoming.whatsappNumber ?? current.whatsappNumber, 30),
      cardCallNumber: cleanText(incoming.cardCallNumber ?? current.cardCallNumber, 30),
      cardWhatsappNumber: cleanText(incoming.cardWhatsappNumber ?? current.cardWhatsappNumber, 30),
      businessHours: cleanText(incoming.businessHours ?? current.businessHours, 100),
      footerNote: cleanText(incoming.footerNote ?? current.footerNote, 200),
    });

    wsHub.broadcastAll('content:updated', { content: updated });
    await emitNotification({
      type: 'cms',
      title: 'Website Content Updated',
      message: `Full-page storefront copy published by ${req.authUser!.name}.`,
      actorName: req.authUser!.name,
      targetRole: 'all',
    });

    res.json({ content: updated });
  });

  app.post('/api/admin/content/reset', requireAuth, requireRoles(['admin']), async (req: AuthenticatedRequest, res) => {
    const reset = await store.updateSiteContent(DEFAULT_SITE_CONTENT);
    wsHub.broadcastAll('content:updated', { content: reset });
    res.json({ content: reset });
  });

  // --- Website Color & Theme Studio ---
  app.put('/api/admin/theme', requireAuth, requirePermission('canEditSiteContent'), async (req: AuthenticatedRequest, res) => {
    const incoming = req.body as Partial<ThemeColors>;
    const current = store.getThemeColors();

    const updated = await store.updateThemeColors({
      presetId: cleanText(incoming.presetId ?? current.presetId, 40) || 'custom',
      mode: incoming.mode === 'light' || incoming.mode === 'dark' ? incoming.mode : current.mode,
      bg: isHexColor(incoming.bg) ? incoming.bg : current.bg,
      surface: isHexColor(incoming.surface) ? incoming.surface : current.surface,
      surfaceAlt: isHexColor(incoming.surfaceAlt) ? incoming.surfaceAlt : current.surfaceAlt,
      border: isHexColor(incoming.border) ? incoming.border : current.border,
      text: isHexColor(incoming.text) ? incoming.text : current.text,
      muted: isHexColor(incoming.muted) ? incoming.muted : current.muted,
      accent: isHexColor(incoming.accent) ? incoming.accent : current.accent,
      accentBright: isHexColor(incoming.accentBright) ? incoming.accentBright : current.accentBright,
      accentContrast: isHexColor(incoming.accentContrast) ? incoming.accentContrast : current.accentContrast,
    });

    wsHub.broadcastAll('theme:updated', { theme: updated });
    await emitNotification({
      type: 'cms',
      title: 'Website Colors Updated',
      message: `Theme palette "${updated.presetId}" applied live by ${req.authUser!.name}.`,
      actorName: req.authUser!.name,
      targetRole: 'all',
    });

    res.json({ theme: updated });
  });

  app.post('/api/admin/theme/reset', requireAuth, requireRoles(['admin']), async (_req, res) => {
    const reset = await store.updateThemeColors(DEFAULT_THEME_COLORS);
    wsHub.broadcastAll('theme:updated', { theme: reset });
    res.json({ theme: reset });
  });

  // --- Notifications ---
  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
    const list = store.getNotifications(req.authUser!.role);
    res.json({ notifications: list });
  });

  app.post('/api/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
    await store.markNotificationRead(req.params.id, req.authUser!.id);
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
    await store.markAllNotificationsRead(req.authUser!.id);
    res.json({ ok: true });
  });

  // --- Vite / Static Serving (local / non-Vercel only) ---
  if (!IS_VERCEL) {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      const distDir = path.resolve(process.cwd(), 'dist');
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  return app;
}

async function bootstrap() {
  try {
    const app = await createApp();
    if (IS_VERCEL) return;
    const PORT = 3000;
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Auto-start only in non-Vercel (local) environments.
if (!IS_VERCEL) {
  bootstrap();
}
