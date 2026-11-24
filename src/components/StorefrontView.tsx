import React, { useEffect, useMemo, useState } from 'react';
import {
  Car,
  CheckCircle2,
  Clock,
  Download,
  Heart,
  ImagePlus,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext.tsx';
import { apiRequest, uploadVehicleImage } from '../lib/api.ts';
import { formatInrFull, formatInrLakhs, formatKm, formatRelativeTime, safeExternalHref } from '../lib/format.ts';
import type { Enquiry, EnquiryStatus, Vehicle, VehicleBoardType } from '../../shared/types.ts';

const CAR_IMAGE_PRESETS = [
  { label: 'Flagship SUV Studio', url: '/src/assets/images/vehicle_suv_flagship_1795250937139.jpg' },
  { label: 'Silver Crossover Studio', url: '/src/assets/images/vehicle_crossover_silver_1795250937315.jpg' },
  { label: 'Crimson EV / Sport Studio', url: '/src/assets/images/vehicle_electric_crimson_1795250939150.jpg' },
];

const ENQUIRY_STATUS_LIST: EnquiryStatus[] = [
  'New',
  'Contacted',
  'Test Drive',
  'Negotiation',
  'Closed',
  'Just Enquiry',
  'Enquiry',
  'Hot',
];
const NEW_ENQUIRY_STATUS_LIST: EnquiryStatus[] = ['Just Enquiry', 'Enquiry', 'Hot'];
const VEHICLE_BOARD_TYPES: VehicleBoardType[] = ['Tboard Vehicles', 'Non Tboard Vehicles'];
const TODAY_ISO = () => new Date().toISOString().slice(0, 10);
const INITIAL_VISIBLE_CARDS = 8;

interface StorefrontViewProps {
  externalEnquiryTrigger?: number;
  onOpenManageStaff?: () => void;
}

export function StorefrontView({ externalEnquiryTrigger, onOpenManageStaff }: StorefrontViewProps) {
  const {
    siteContent,
    vehicles,
    enquiries,
    shortlist,
    toggleShortlist,
    trackAnalytics,
    pushToast,
    user,
    token,
    prependEnquiry,
    refreshProtected,
  } = useApp();

  const isAdmin = user?.role === 'admin';
  const isOperator = user?.role === 'admin' || user?.role === 'staff';
  const canAddCar = isAdmin || Boolean(user?.permissions.canAddCar);
  const canEditCar = isAdmin || Boolean(user?.permissions.canEditCar);
  const canEditPrice = isAdmin || Boolean(user?.permissions.canEditPrice);
  const canDeleteCar = isAdmin || Boolean(user?.permissions.canDeleteCar);

  const [workspaceTab, setWorkspaceTab] = useState<'all-cars' | 'add-car' | 'add-enquiry' | 'all-enquiries'>('all-cars');

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [collectionTab, setCollectionTab] = useState<'all' | 'luxury' | 'budget' | 'ev' | 'tboard' | 'shortlist'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'featured' | 'price-low' | 'price-high' | 'year' | 'km'>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCardCount, setVisibleCardCount] = useState<number>(INITIAL_VISIBLE_CARDS);

  // Full multi-facet filters matching reference site
  const [brandFilter, setBrandFilter] = useState('all');
  const [fuelFilter, setFuelFilter] = useState('all');
  const [transFilter, setTransFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [colourFilter, setColourFilter] = useState('all');
  const [yearMin, setYearMin] = useState('all');
  const [yearMax, setYearMax] = useState('all');
  const [minPriceLakhs, setMinPriceLakhs] = useState(0);
  const [maxPriceLakhs, setMaxPriceLakhs] = useState(130);
  const [kmMax, setKmMax] = useState(200000);

  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [enquiryModalOpen, setEnquiryModalOpen] = useState(false);
  const [enquiryVehicle, setEnquiryVehicle] = useState<Vehicle | null>(null);

  // Inline Frontend "Add Enquiry" Section State
  const [inlineCustomer, setInlineCustomer] = useState('');
  const [inlinePhone, setInlinePhone] = useState('');
  const [inlineEmail, setInlineEmail] = useState('');
  const [inlineVehicle, setInlineVehicle] = useState('');
  const [inlineManualVehicle, setInlineManualVehicle] = useState('');
  const [inlineBudget, setInlineBudget] = useState('');
  const [inlineLocation, setInlineLocation] = useState('');
  const [inlineDate, setInlineDate] = useState(TODAY_ISO());
  const [inlineOlxId, setInlineOlxId] = useState('');
  const [inlineStatus, setInlineStatus] = useState<EnquiryStatus>('Just Enquiry');
  const [inlineFuel, setInlineFuel] = useState('Any Fuel');
  const [inlineTrans, setInlineTrans] = useState('Any Transmission');
  const [inlineMessage, setInlineMessage] = useState('');
  const [inlineSubmitting, setInlineSubmitting] = useState(false);
  const [inlineSuccess, setInlineSuccess] = useState(false);

  // Modal Enquiry Form State
  const [enqName, setEnqName] = useState('');
  const [enqPhone, setEnqPhone] = useState('');
  const [enqEmail, setEnqEmail] = useState('');
  const [enqBudget, setEnqBudget] = useState('');
  const [enqLocation, setEnqLocation] = useState('');
  const [enqDate, setEnqDate] = useState(TODAY_ISO());
  const [enqOlxId, setEnqOlxId] = useState('');
  const [enqStatus, setEnqStatus] = useState<EnquiryStatus>('Just Enquiry');
  const [enqMessage, setEnqMessage] = useState('');
  const [enqSubmitting, setEnqSubmitting] = useState(false);
  const [enqSuccess, setEnqSuccess] = useState(false);

  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  // Frontend Add / Edit Car State
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [carSaving, setCarSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [carSuccess, setCarSuccess] = useState<string | null>(null);
  const [carForm, setCarForm] = useState({
    brand: '',
    model: '',
    year: '2024',
    variant: '',
    reg: 'TN-',
    owner: '1',
    colour: 'White',
    fuel: 'Petrol',
    trans: 'MT',
    km: '',
    price: '',
    finalPrice: '',
    dealer: '',
    phone: '',
    fc: '',
    insurance: '',
    permit: '',
    boardType: 'Non Tboard Vehicles' as VehicleBoardType,
    status: 'Available' as Vehicle['status'],
    featured: false,
    imageUrl: CAR_IMAGE_PRESETS[0].url,
  });

  // Frontend View All Enquiries Filter State
  const [enqSearch, setEnqSearch] = useState('');
  const [enqStatusFilter, setEnqStatusFilter] = useState<'All' | EnquiryStatus>('All');
  const [editingEnquiry, setEditingEnquiry] = useState<Enquiry | null>(null);
  const [enquiryEditSaving, setEnquiryEditSaving] = useState(false);
  const [enquiryEditForm, setEnquiryEditForm] = useState({
    customerName: '',
    phone: '',
    email: '',
    vehicleId: '',
    vehicleLabel: '',
    budget: '',
    location: '',
    date: '',
    olxId: '',
    message: '',
    notes: '',
    status: 'New' as EnquiryStatus,
  });

  useEffect(() => {
    trackAnalytics({ type: 'page_view', path: '/', label: 'Storefront Home' });
  }, [trackAnalytics]);

  useEffect(() => {
    if (externalEnquiryTrigger && externalEnquiryTrigger > 0) {
      setEnquiryVehicle(null);
      setEnqSuccess(false);
      setEnquiryModalOpen(true);
    }
  }, [externalEnquiryTrigger]);

  useEffect(() => {
    if (user) {
      setEnqName((prev) => prev || user.name);
      setEnqEmail((prev) => prev || user.email);
      setEnqPhone((prev) => prev || user.phone || '');
      setInlineCustomer((prev) => prev || user.name);
      setInlineEmail((prev) => prev || user.email);
      setInlinePhone((prev) => prev || user.phone || '');
    }
  }, [user]);

  const brands = useMemo(() => Array.from(new Set(vehicles.map((v) => v.brand))).sort(), [vehicles]);
  const fuels = useMemo(() => Array.from(new Set(vehicles.map((v) => v.fuel))).sort(), [vehicles]);
  const colours = useMemo(() => Array.from(new Set(vehicles.map((v) => v.colour))).sort(), [vehicles]);
  const years = useMemo(() => {
    const yrs = vehicles
      .map((v) => Number(String(v.year).match(/\d{4}/)?.[0] || 0))
      .filter((y) => y > 2000);
    return Array.from(new Set(yrs)).sort((a, b) => a - b);
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = vehicles.filter((v) => {
      if (collectionTab === 'shortlist' && !shortlist.includes(v.id)) return false;
      if (collectionTab === 'tboard' && v.boardType !== 'Tboard Vehicles') return false;
      if (collectionTab === 'luxury' && v.finalPrice < 2000000) return false;
      if (collectionTab === 'budget' && v.finalPrice > 1000000) return false;
      if (
        collectionTab === 'ev' &&
        !v.fuel.toUpperCase().includes('EV') &&
        !v.fuel.toUpperCase().includes('HYBRID')
      ) {
        return false;
      }

      if (brandFilter !== 'all' && v.brand !== brandFilter) return false;
      if (fuelFilter !== 'all' && v.fuel !== fuelFilter) return false;
      if (transFilter !== 'all' && v.trans !== transFilter) return false;
      if (ownerFilter !== 'all' && v.owner !== ownerFilter) return false;
      if (colourFilter !== 'all' && v.colour !== colourFilter) return false;

      const vYear = Number(String(v.year).match(/\d{4}/)?.[0] || 0);
      if (yearMin !== 'all' && vYear < Number(yearMin)) return false;
      if (yearMax !== 'all' && vYear > Number(yearMax)) return false;

      if (v.finalPrice < minPriceLakhs * 100_000) return false;
      if (v.finalPrice > maxPriceLakhs * 100_000) return false;

      const vKm = Number(String(v.km).replace(/[^0-9]/g, '') || 0);
      if (kmMax < 200000 && vKm > kmMax) return false;

      if (q) {
        const hay = `${v.brand} ${v.model} ${v.variant} ${v.reg} ${v.year} ${v.fuel} ${v.colour} ${v.dealer}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sortBy === 'newest') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'price-low') {
      sorted.sort((a, b) => a.finalPrice - b.finalPrice);
    } else if (sortBy === 'price-high') {
      sorted.sort((a, b) => b.finalPrice - a.finalPrice);
    } else if (sortBy === 'year') {
      sorted.sort(
        (a, b) =>
          Number(String(b.year).match(/\d{4}/)?.[0] || 0) - Number(String(a.year).match(/\d{4}/)?.[0] || 0)
      );
    } else if (sortBy === 'km') {
      sorted.sort(
        (a, b) =>
          Number(a.km.replace(/[^0-9]/g, '') || 999999) - Number(b.km.replace(/[^0-9]/g, '') || 999999)
      );
    } else {
      sorted.sort((a, b) => Number(b.featured) - Number(a.featured));
    }
    return sorted;
  }, [
    vehicles,
    collectionTab,
    shortlist,
    brandFilter,
    fuelFilter,
    transFilter,
    ownerFilter,
    colourFilter,
    yearMin,
    yearMax,
    minPriceLakhs,
    maxPriceLakhs,
    kmMax,
    searchQuery,
    sortBy,
  ]);

  useEffect(() => {
    setVisibleCardCount(INITIAL_VISIBLE_CARDS);
  }, [
    collectionTab,
    searchQuery,
    sortBy,
    brandFilter,
    fuelFilter,
    transFilter,
    ownerFilter,
    colourFilter,
    yearMin,
    yearMax,
    minPriceLakhs,
    maxPriceLakhs,
    kmMax,
  ]);

  const handleOpenVehicle = (v: Vehicle) => {
    setSelectedVehicle(v);
    trackAnalytics({
      type: 'vehicle_view',
      path: `/inventory/${v.id}`,
      vehicleId: v.id,
      label: `${v.year} ${v.brand} ${v.model}`,
    });
  };

  const handleOpenEnquiryForVehicle = (v: Vehicle) => {
    setSelectedVehicle(null);
    setEnquiryVehicle(v);
    setEnqBudget(formatInrLakhs(v.finalPrice));
    setEnqMessage(`I am interested in the ${v.year} ${v.brand} ${v.model} (${v.reg}). Please share full details.`);
    setEnqSuccess(false);
    setEnquiryModalOpen(true);
  };

  const filteredEnquiries = useMemo(() => {
    const q = enqSearch.trim().toLowerCase();
    return enquiries.filter((e) => {
      if (enqStatusFilter !== 'All' && e.status !== enqStatusFilter) return false;
      if (!q) return true;
      return `${e.customerName} ${e.phone} ${e.vehicleLabel} ${e.location || ''} ${e.olxId || ''} ${e.message} ${e.budget || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [enquiries, enqSearch, enqStatusFilter]);

  const scrollToSection = (id: string) => {
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleSelectWorkspaceTab = (tab: 'all-cars' | 'add-car' | 'add-enquiry' | 'all-enquiries') => {
    setWorkspaceTab(tab);
    if (tab === 'all-cars') scrollToSection('inventory');
    if (tab === 'add-car') {
      setCarSuccess(null);
      scrollToSection('add-car');
    }
    if (tab === 'add-enquiry') scrollToSection('enquiries');
    if (tab === 'all-enquiries') scrollToSection('all-enquiries');
  };

  const handleOpenAddCarForm = () => {
    setEditingVehicle(null);
    setCarSuccess(null);
    setCarForm({
      brand: '',
      model: '',
      year: '2024',
      variant: '',
      reg: 'TN-',
      owner: '1',
      colour: 'White',
      fuel: 'Petrol',
      trans: 'MT',
      km: '',
      price: '',
      finalPrice: '',
      dealer: user?.name || '',
      phone: '',
      fc: '',
      insurance: '',
      permit: '',
      boardType: 'Non Tboard Vehicles',
      status: 'Available',
      featured: false,
      imageUrl: CAR_IMAGE_PRESETS[0].url,
    });
    handleSelectWorkspaceTab('add-car');
  };

  const handleStartEditCar = (v: Vehicle) => {
    setSelectedVehicle(null);
    setEditingVehicle(v);
    setCarSuccess(null);
    setCarForm({
      brand: v.brand,
      model: v.model,
      year: v.year,
      variant: v.variant,
      reg: v.reg,
      owner: v.owner,
      colour: v.colour,
      fuel: v.fuel,
      trans: v.trans,
      km: v.km,
      price: String(v.price),
      finalPrice: String(v.finalPrice),
      dealer: v.dealer,
      phone: v.phone,
      fc: v.fc || '',
      insurance: v.insurance || '',
      permit: v.permit || '',
      boardType: v.boardType || 'Non Tboard Vehicles',
      status: v.status,
      featured: v.featured,
      imageUrl: v.imageUrl,
    });
    handleSelectWorkspaceTab('add-car');
  };

  const handleSaveFrontendCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setCarSaving(true);
    setCarSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        brand: carForm.brand,
        model: carForm.model,
        year: carForm.year,
        variant: carForm.variant,
        reg: carForm.reg,
        owner: carForm.owner,
        colour: carForm.colour,
        fuel: carForm.fuel,
        trans: carForm.trans,
        km: carForm.km,
        dealer: carForm.dealer,
        phone: carForm.phone,
        fc: carForm.fc,
        insurance: carForm.insurance,
        permit: carForm.permit,
        boardType: carForm.boardType,
        status: carForm.status,
        featured: carForm.featured,
        imageUrl: carForm.imageUrl,
      };
      if (!editingVehicle || canEditPrice) {
        payload.price = Number(carForm.price);
        payload.finalPrice = Number(carForm.finalPrice || carForm.price);
      }

      if (editingVehicle) {
        await apiRequest(`/api/vehicles/${editingVehicle.id}`, {
          method: 'PATCH',
          body: payload,
          token,
        });
        setCarSuccess(`${carForm.year} ${carForm.brand} ${carForm.model} updated successfully.`);
        pushToast({
          title: 'Vehicle Updated',
          message: `${carForm.year} ${carForm.brand} ${carForm.model} saved.`,
          type: 'inventory',
        });
        setEditingVehicle(null);
      } else {
        await apiRequest('/api/vehicles', {
          method: 'POST',
          body: payload,
          token,
        });
        setCarSuccess(`${carForm.year} ${carForm.brand} ${carForm.model} added to live inventory.`);
        pushToast({
          title: 'Vehicle Added',
          message: `${carForm.year} ${carForm.brand} ${carForm.model} published.`,
          type: 'inventory',
        });
        setCarForm((prev) => ({
          ...prev,
          brand: '',
          model: '',
          variant: '',
          reg: 'TN-',
          km: '',
          price: '',
          finalPrice: '',
          phone: '',
          fc: '',
          insurance: '',
          permit: '',
          boardType: 'Non Tboard Vehicles',
        }));
        resetFilters();
        setSortBy('newest');
        setWorkspaceTab('all-cars');
        scrollToSection('inventory');
      }
      await refreshProtected();
    } catch (err: unknown) {
      pushToast({
        title: 'Vehicle Save Failed',
        message: err instanceof Error ? err.message : 'Unable to save vehicle',
        type: 'system',
      });
    } finally {
      setCarSaving(false);
    }
  };

  const handleCarImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setImageUploading(true);
    try {
      const { url } = await uploadVehicleImage(file, token);
      setCarForm((prev) => ({ ...prev, imageUrl: url }));
      pushToast({ title: 'Image Uploaded', message: 'Car image is ready to publish.', type: 'inventory' });
    } catch (err: unknown) {
      pushToast({
        title: 'Upload Failed',
        message: err instanceof Error ? err.message : 'Unable to upload image',
        type: 'system',
      });
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteFrontendCar = async (v: Vehicle) => {
    if (!token || !canDeleteCar) return;
    if (!window.confirm(`Delete ${v.year} ${v.brand} ${v.model} from the inventory? This cannot be undone.`)) return;
    try {
      await apiRequest(`/api/vehicles/${v.id}`, { method: 'DELETE', token });
      setSelectedVehicle(null);
      await refreshProtected();
      pushToast({
        title: 'Vehicle Removed',
        message: `${v.year} ${v.brand} ${v.model} removed from catalog.`,
        type: 'inventory',
      });
    } catch (err: unknown) {
      pushToast({
        title: 'Delete Failed',
        message: err instanceof Error ? err.message : 'Unable to delete vehicle',
        type: 'system',
      });
    }
  };

  const handleUpdateEnquiryStatus = async (id: string, status: EnquiryStatus) => {
    if (!token || !isOperator) return;
    try {
      await apiRequest(`/api/enquiries/${id}`, {
        method: 'PATCH',
        body: { status },
        token,
      });
      await refreshProtected();
    } catch (err: unknown) {
      pushToast({
        title: 'Status Update Failed',
        message: err instanceof Error ? err.message : 'Unable to update status',
        type: 'system',
      });
    }
  };

  const handleStartEditEnquiry = (enquiry: Enquiry) => {
    setEditingEnquiry(enquiry);
    setEnquiryEditForm({
      customerName: enquiry.customerName,
      phone: enquiry.phone,
      email: enquiry.email || '',
      vehicleId: enquiry.vehicleId || '',
      vehicleLabel: enquiry.vehicleLabel,
      budget: enquiry.budget || '',
      location: enquiry.location || '',
      date: enquiry.date || '',
      olxId: enquiry.olxId || '',
      message: enquiry.message,
      notes: enquiry.notes || '',
      status: enquiry.status,
    });
  };

  const handleSaveEnquiryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingEnquiry || !isOperator) return;
    setEnquiryEditSaving(true);
    try {
      await apiRequest(`/api/enquiries/${editingEnquiry.id}`, {
        method: 'PATCH',
        body: enquiryEditForm,
        token,
      });
      await refreshProtected();
      setEditingEnquiry(null);
      pushToast({ title: 'Enquiry Updated', message: `${enquiryEditForm.customerName}'s enquiry was saved.`, type: 'enquiry' });
    } catch (err: unknown) {
      pushToast({ title: 'Update Failed', message: err instanceof Error ? err.message : 'Unable to update enquiry', type: 'system' });
    } finally {
      setEnquiryEditSaving(false);
    }
  };

  const handleDeleteEnquiry = async (enquiry: Enquiry) => {
    if (!token || !isAdmin) return;
    if (!window.confirm(`Delete ${enquiry.customerName}'s enquiry? This cannot be undone.`)) return;
    try {
      await apiRequest(`/api/enquiries/${enquiry.id}`, { method: 'DELETE', token });
      await refreshProtected();
      pushToast({ title: 'Enquiry Deleted', message: `${enquiry.customerName}'s enquiry was removed.`, type: 'enquiry' });
    } catch (err: unknown) {
      pushToast({ title: 'Delete Failed', message: err instanceof Error ? err.message : 'Unable to delete enquiry', type: 'system' });
    }
  };

  const handleExportEnquiriesCsv = () => {
    const rows = [
      ['ID', 'Customer', 'Phone', 'Email', 'Vehicle', 'Budget', 'Location', 'Date', 'OLX ID', 'Status', 'Source', 'Message', 'Created'],
      ...filteredEnquiries.map((e) => [
        e.id,
        e.customerName,
        e.phone,
        e.email || '',
        e.vehicleLabel,
        e.budget || '',
        e.location || '',
        e.date || '',
        e.olxId || '',
        e.status,
        e.source,
        e.message,
        e.createdAt,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enquiries-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmitModalEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setEnqSubmitting(true);
    try {
      const res = await apiRequest<{ enquiry: Enquiry }>('/api/enquiries', {
        method: 'POST',
        body: {
          vehicleId: enquiryVehicle?.id,
          vehicleLabel: enquiryVehicle
            ? `${enquiryVehicle.year} ${enquiryVehicle.brand} ${enquiryVehicle.model} ${enquiryVehicle.variant}`
            : 'Showroom Visit / General Consultation',
          customerName: enqName,
          phone: enqPhone,
          email: enqEmail,
          budget: enqBudget,
          location: enqLocation,
          date: enqDate,
          olxId: enqOlxId,
          status: enqStatus,
          message: enqMessage,
          source: 'website',
        },
        token,
      });
      prependEnquiry(res.enquiry);
      setEnqSuccess(true);
      pushToast({
        title: 'Enquiry Submitted',
        message: 'Our Trichy showroom team received your request.',
        type: 'enquiry',
      });
      setEnqMessage('');
    } catch (err: unknown) {
      pushToast({
        title: 'Submission Error',
        message: err instanceof Error ? err.message : 'Unable to submit enquiry',
        type: 'system',
      });
    } finally {
      setEnqSubmitting(false);
    }
  };

  const handleSubmitInlineEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setInlineSubmitting(true);
    setInlineSuccess(false);
    try {
      const isManualVehicle = inlineVehicle === 'manual';
      const matchedVehicle = isManualVehicle ? undefined : vehicles.find((v) => v.id === inlineVehicle);
      const vehicleLabel = matchedVehicle
        ? `${matchedVehicle.year} ${matchedVehicle.brand} ${matchedVehicle.model} (${matchedVehicle.reg})`
        : isManualVehicle
          ? inlineManualVehicle.trim() || 'Custom Vehicle Request'
          : 'Custom Vehicle Request';

      const composedMessage = [
        inlineMessage.trim(),
        inlineFuel !== 'Any Fuel' ? `Preferred Fuel: ${inlineFuel}` : '',
        inlineTrans !== 'Any Transmission' ? `Transmission: ${inlineTrans}` : '',
      ]
        .filter(Boolean)
        .join(' · ');

      const res = await apiRequest<{ enquiry: Enquiry }>('/api/enquiries', {
        method: 'POST',
        body: {
          vehicleId: matchedVehicle?.id,
          vehicleLabel,
          customerName: inlineCustomer,
          phone: inlinePhone,
          email: inlineEmail,
          budget: inlineBudget,
          location: inlineLocation,
          date: inlineDate,
          olxId: inlineOlxId,
          status: inlineStatus,
          message: composedMessage || 'Customer submitted an enquiry via the storefront form.',
          source: 'website',
        },
        token,
      });

      prependEnquiry(res.enquiry);
      setInlineSuccess(true);
      setInlineMessage('');
      setInlineBudget('');
      setInlineVehicle('');
      setInlineManualVehicle('');
      pushToast({
        title: 'Enquiry Saved',
        message: `Enquiry for ${vehicleLabel} sent to the Auto Choice team.`,
        type: 'enquiry',
      });
    } catch (err: unknown) {
      pushToast({
        title: 'Submission Error',
        message: err instanceof Error ? err.message : 'Unable to submit enquiry',
        type: 'system',
      });
    } finally {
      setInlineSubmitting(false);
    }
  };

  const resetFilters = () => {
    setVisibleCardCount(INITIAL_VISIBLE_CARDS);
    setSearchQuery('');
    setBrandFilter('all');
    setFuelFilter('all');
    setTransFilter('all');
    setOwnerFilter('all');
    setColourFilter('all');
    setYearMin('all');
    setYearMax('all');
    setMinPriceLakhs(0);
    setMaxPriceLakhs(130);
    setKmMax(200000);
    setCollectionTab('all');
  };

  if (!siteContent) return null;

  const phoneNumbers = siteContent.contactPhone
    .split('/')
    .map((num) => num.trim())
    .filter(Boolean);

  const getCardCallNumber = () => {
    const digits = (siteContent.cardCallNumber || '').replace(/[^0-9]/g, '');
    return digits.length >= 10 ? digits.slice(-10) : '9385588888';
  };

  const getCardWhatsappNumber = () => {
    const digits = (siteContent.cardWhatsappNumber || '').replace(/[^0-9]/g, '');
    if (digits.length >= 12) return digits;
    if (digits.length >= 10) return `91${digits.slice(-10)}`;
    return '919385588888';
  };

  return (
    <div style={{ backgroundColor: 'var(--site-bg)', color: 'var(--site-text)' }}>
      {/* Slim Dismissible Announcement Bar */}
      {siteContent.announcementEnabled && !bannerDismissed && siteContent.announcementText && (
        <div
          className="border-b px-4 py-2 text-xs"
          style={{
            backgroundColor: 'var(--site-surface)',
            borderColor: 'var(--site-border)',
            color: 'var(--site-muted)',
          }}
        >
          <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-4">
            <p className="truncate">{siteContent.announcementText}</p>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss announcement"
              className="shrink-0 p-1 hover:opacity-80"
              style={{ color: 'var(--site-muted)' }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Hero Split */}
      <section className="mx-auto max-w-[1360px] px-6 pt-10 pb-12 lg:pt-14 lg:pb-16">
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          <div className="flex flex-col justify-between gap-8 lg:col-span-6 lg:py-4">
            <div>
              <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--site-accent-bright)' }}>
                {siteContent.heroKicker}
              </p>
              <h1
                className="mt-4 font-display font-bold tracking-tight"
                style={{
                  fontSize: 'clamp(2.25rem, 4vw, 3.6rem)',
                  lineHeight: 1.08,
                  textWrap: 'balance',
                  color: 'var(--site-text)',
                }}
              >
                {siteContent.heroHeadline}
              </h1>
              <p
                className="mt-5 max-w-xl text-base leading-relaxed"
                style={{ color: 'var(--site-muted)' }}
              >
                {siteContent.heroSubheadline}
              </p>
            </div>

            {/* Showroom Quick-Action Switcher Card matching reference UI */}
            <div
              className="rounded-2xl border p-4 sm:p-5 space-y-3"
              style={{
                backgroundColor: 'var(--site-surface)',
                borderColor: 'var(--site-border)',
              }}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSelectWorkspaceTab('all-cars')}
                  className="rounded-full px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border"
                  style={
                    workspaceTab === 'all-cars'
                      ? {
                          backgroundColor: 'var(--site-accent-bright)',
                          borderColor: 'var(--site-accent-bright)',
                          color: 'var(--site-accent-contrast)',
                        }
                      : {
                          backgroundColor: 'var(--site-bg)',
                          borderColor: 'var(--site-border)',
                          color: 'var(--site-text)',
                        }
                  }
                >
                  View All Cars ({vehicles.length})
                </button>

                {canAddCar && (
                  <button
                    type="button"
                    onClick={handleOpenAddCarForm}
                    className="rounded-full px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border"
                    style={
                      workspaceTab === 'add-car'
                        ? {
                            backgroundColor: 'var(--site-accent-bright)',
                            borderColor: 'var(--site-accent-bright)',
                            color: 'var(--site-accent-contrast)',
                          }
                        : {
                            backgroundColor: 'var(--site-bg)',
                            borderColor: 'var(--site-border)',
                            color: 'var(--site-text)',
                          }
                    }
                  >
                    Add New Car
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSelectWorkspaceTab('add-enquiry')}
                  className="rounded-full px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border"
                  style={
                    workspaceTab === 'add-enquiry'
                      ? {
                          backgroundColor: 'var(--site-accent-bright)',
                          borderColor: 'var(--site-accent-bright)',
                          color: 'var(--site-accent-contrast)',
                        }
                      : {
                          backgroundColor: 'var(--site-bg)',
                          borderColor: 'var(--site-border)',
                          color: 'var(--site-text)',
                        }
                  }
                >
                  Add Enquiry
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectWorkspaceTab('all-enquiries')}
                  className="rounded-full px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border"
                  style={
                    workspaceTab === 'all-enquiries'
                      ? {
                          backgroundColor: 'var(--site-accent-bright)',
                          borderColor: 'var(--site-accent-bright)',
                          color: 'var(--site-accent-contrast)',
                        }
                      : {
                          backgroundColor: 'var(--site-bg)',
                          borderColor: 'var(--site-border)',
                          color: 'var(--site-text)',
                        }
                  }
                >
                  {isOperator ? `View All Enquiries (${enquiries.length})` : `My Enquiries (${enquiries.length})`}
                </button>

                {isAdmin && onOpenManageStaff && (
                  <button
                    type="button"
                    onClick={onOpenManageStaff}
                    className="rounded-full px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  >
                    Manage Staff
                  </button>
                )}
              </div>

              <p className="text-xs leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                {isAdmin
                  ? 'Owner can add, edit, delete cars, view every enquiry and manage staff.'
                  : isOperator
                  ? 'Staff can browse all cars, add vehicles per role permissions, log leads, and manage enquiries.'
                  : 'Browse all verified cars, add showroom enquiries, and view your submitted enquiries.'}
              </p>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div
              className="relative h-full min-h-[280px] overflow-hidden rounded-2xl border"
              style={{
                borderColor: 'var(--site-border)',
                backgroundColor: 'var(--site-surface)',
              }}
            >
              {!failedImages['hero'] ? (
                <img
                  src={siteContent.heroImageUrl}
                  alt={`${siteContent.brandName} showroom`}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedImages((prev) => ({ ...prev, hero: true }))}
                  className="h-full w-full object-cover lg:h-full"
                />
              ) : (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-8 text-center">
                  <Car className="h-12 w-12 mb-3" style={{ color: 'var(--site-accent)' }} />
                  <p className="font-display text-lg font-semibold">{siteContent.brandName}</p>
                </div>
              )}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    'linear-gradient(to top, rgba(11,11,12,0.72) 0%, rgba(11,11,12,0.12) 45%, transparent 100%)',
                }}
              />
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-medium" style={{ color: '#e8b06a' }}>
                    {siteContent.tagline}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-white">
                    {vehicles.filter((v) => v.status === 'Available').length} Verified Vehicles Ready for Delivery
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Column Showroom Proof Strip */}
        <div
          className="mt-8 grid grid-cols-2 gap-4 rounded-2xl border p-5 sm:grid-cols-4"
          style={{
            backgroundColor: 'var(--site-surface)',
            borderColor: 'var(--site-border)',
          }}
        >
          {siteContent.trustMetrics.map((metric, idx) => {
            const metricValue = idx === 0 ? `${vehicles.length} Live` : metric.value;
            return (
              <div key={idx} className="px-2 py-1">
                <p className="font-display text-xl font-bold font-mono-tabular" style={{ color: 'var(--site-accent-bright)' }}>
                  {metricValue}
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--site-muted)' }}>
                  {metric.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Frontend Add / Edit New Car Section */}
        {(workspaceTab === 'add-car' || editingVehicle) && (canAddCar || (editingVehicle && canEditCar)) && (
          <div
            id="add-car"
            className="mt-8 rounded-2xl border p-6 sm:p-7"
            style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-accent)' }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--site-accent-bright)' }}>
                  {editingVehicle ? 'Edit Existing Listing' : 'Publish to Live Inventory'}
                </p>
                <h2 className="mt-1 font-display text-xl font-bold">
                  {editingVehicle
                    ? `Edit ${editingVehicle.year} ${editingVehicle.brand} ${editingVehicle.model}`
                    : 'Add New Car'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingVehicle(null);
                  setWorkspaceTab('all-cars');
                }}
                aria-label="Close Add Car panel"
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: 'var(--site-border)', color: 'var(--site-muted)' }}
              >
                Close
              </button>
            </div>

            {carSuccess && (
              <div
                className="mt-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  borderColor: '#22c55e',
                  color: '#86efac',
                }}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{carSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveFrontendCar} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Brand</label>
                <input
                  required
                  value={carForm.brand}
                  onChange={(e) => setCarForm({ ...carForm, brand: e.target.value })}
                  placeholder="e.g. Toyota"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Model</label>
                <input
                  required
                  value={carForm.model}
                  onChange={(e) => setCarForm({ ...carForm, model: e.target.value })}
                  placeholder="e.g. Crysta"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Year</label>
                <input
                  required
                  value={carForm.year}
                  onChange={(e) => setCarForm({ ...carForm, year: e.target.value })}
                  placeholder="2024"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Variant</label>
                <input
                  value={carForm.variant}
                  onChange={(e) => setCarForm({ ...carForm, variant: e.target.value })}
                  placeholder="e.g. ZX"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Registration</label>
                <input
                  value={carForm.reg}
                  onChange={(e) => setCarForm({ ...carForm, reg: e.target.value })}
                  placeholder="TN-45-AB-1234"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Odometer (KM)</label>
                <input
                  value={carForm.km}
                  onChange={(e) => setCarForm({ ...carForm, km: e.target.value })}
                  placeholder="25000"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Fuel</label>
                <select
                  value={carForm.fuel}
                  onChange={(e) => setCarForm({ ...carForm, fuel: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                >
                  <option value="PETROL">PETROL</option>
                  <option value="DIESEL">DIESEL</option>
                  <option value="EV">EV</option>
                  <option value="HYBRID">HYBRID</option>
                  <option value="PET / CNG">PET / CNG</option>
                  <option value="PET / HYBRID">PET / HYBRID</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Transmission</label>
                <select
                  value={carForm.trans}
                  onChange={(e) => setCarForm({ ...carForm, trans: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                >
                  <option value="MT">MT (Manual)</option>
                  <option value="AT">AT (Automatic)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Owner</label>
                <select
                  value={carForm.owner}
                  onChange={(e) => setCarForm({ ...carForm, owner: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                >
                  <option value="1">1st Owner</option>
                  <option value="2">2nd Owner</option>
                  <option value="3">3rd Owner</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Colour</label>
                <input
                  value={carForm.colour}
                  onChange={(e) => setCarForm({ ...carForm, colour: e.target.value })}
                  placeholder="WHITE"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>
                  Asking Price (₹) {!canEditPrice && editingVehicle ? '(Locked)' : ''}
                </label>
                <input
                  type="number"
                  required
                  disabled={Boolean(editingVehicle) && !canEditPrice}
                  value={carForm.price}
                  onChange={(e) => setCarForm({ ...carForm, price: e.target.value })}
                  placeholder="1250000"
                  className="w-full rounded-xl border px-3 py-2 text-xs font-mono-tabular outline-none disabled:opacity-50"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>
                  Final Price (₹) {!canEditPrice && editingVehicle ? '(Locked)' : ''}
                </label>
                <input
                  type="number"
                  required
                  disabled={Boolean(editingVehicle) && !canEditPrice}
                  value={carForm.finalPrice}
                  onChange={(e) => setCarForm({ ...carForm, finalPrice: e.target.value })}
                  placeholder="1200000"
                  className="w-full rounded-xl border px-3 py-2 text-xs font-mono-tabular outline-none disabled:opacity-50"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Dealer / Source</label>
                <input
                  value={carForm.dealer}
                  onChange={(e) => setCarForm({ ...carForm, dealer: e.target.value })}
                  placeholder="Showroom Direct"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Contact Phone</label>
                <input
                  value={carForm.phone}
                  onChange={(e) => setCarForm({ ...carForm, phone: e.target.value })}
                  placeholder="9385588888"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>FC</label>
                <input
                  value={carForm.fc}
                  onChange={(e) => setCarForm({ ...carForm, fc: e.target.value })}
                  placeholder="e.g. 04/2028"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Insurance</label>
                <input
                  value={carForm.insurance}
                  onChange={(e) => setCarForm({ ...carForm, insurance: e.target.value })}
                  placeholder="e.g. 12/2026 · Full Coverage"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Permit</label>
                <input
                  value={carForm.permit}
                  onChange={(e) => setCarForm({ ...carForm, permit: e.target.value })}
                  placeholder="e.g. TN · 05/2027"
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Vehicle Board Type</label>
                <select
                  value={carForm.boardType}
                  onChange={(e) => setCarForm({ ...carForm, boardType: e.target.value as VehicleBoardType })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                >
                  {VEHICLE_BOARD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-4 space-y-3 rounded-xl border p-3" style={{ borderColor: 'var(--site-border)' }}>
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer"
                    style={{ borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    <span>{imageUploading ? 'Uploading…' : 'Upload Car Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={imageUploading}
                      onChange={(e) => void handleCarImageUpload(e)}
                    />
                  </label>
                  <span className="text-[11px]" style={{ color: 'var(--site-muted)' }}>
                    JPG, PNG, WEBP or GIF · up to 4 MB
                  </span>
                </div>
                {carForm.imageUrl && (
                  <img
                    src={carForm.imageUrl}
                    alt="Selected car preview"
                    referrerPolicy="no-referrer"
                    className="h-32 w-full rounded-lg object-cover"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--site-muted)' }}>Or choose a studio image preset</label>
                <select
                  value={carForm.imageUrl}
                  onChange={(e) => setCarForm({ ...carForm, imageUrl: e.target.value })}
                  className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                  style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
                >
                  {CAR_IMAGE_PRESETS.map((p) => (
                    <option key={p.url} value={p.url}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={carForm.featured}
                    onChange={(e) => setCarForm({ ...carForm, featured: e.target.checked })}
                  />
                  <span>Mark as Featured</span>
                </label>
              </div>

              <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingVehicle(null);
                    setWorkspaceTab('all-cars');
                  }}
                  className="rounded-xl border px-4 py-2.5 text-xs font-semibold"
                  style={{ borderColor: 'var(--site-border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={carSaving}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold"
                  style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{carSaving ? 'Saving…' : editingVehicle ? 'Update Car' : 'Add New Car'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Catalog Section (All Cars) */}
      <section id="inventory" className="mx-auto max-w-[1360px] px-6 py-12 border-t" style={{ borderColor: 'var(--site-border)' }}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {siteContent.catalogTitle}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--site-muted)' }}>
              {siteContent.catalogSubtitle}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {canAddCar && (
              <button
                type="button"
                onClick={handleOpenAddCarForm}
                className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
                style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add New Car</span>
              </button>
            )}
            <p className="text-xs font-mono-tabular shrink-0" style={{ color: 'var(--site-muted)' }}>
              Showing {filteredVehicles.length === 0 ? 0 : 1}–{Math.min(filteredVehicles.length, visibleCardCount)} of{' '}
              {filteredVehicles.length} cars
            </p>
          </div>
        </div>

        {/* Collection Tabs & Search/Filter Toolbar */}
        <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="flex items-center gap-1 overflow-x-auto rounded-xl border p-1"
            style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
            role="tablist"
            aria-label="Vehicle collections"
          >
            {(
              [
                ['all', 'All Cars'],
                ['luxury', 'Premium (₹20L+)'],
                ['budget', 'Budget (Under ₹10L)'],
                ['ev', 'EV & Hybrid'],
                ['tboard', `Tboard Vehicles (${vehicles.filter((v) => v.boardType === 'Tboard Vehicles').length})`],
                ['shortlist', `My Shortlist (${shortlist.length})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={collectionTab === key}
                onClick={() => setCollectionTab(key)}
                className="rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                style={
                  collectionTab === key
                    ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }
                    : { color: 'var(--site-muted)' }
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] sm:w-64">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--site-muted)' }}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length === 3) {
                    trackAnalytics({ type: 'search', path: '/inventory', label: e.target.value });
                  }
                }}
                placeholder="Search brand, model, reg. no…"
                aria-label="Search inventory"
                className="w-full rounded-xl border py-2.5 pl-10 pr-3 text-sm outline-none"
                style={{
                  backgroundColor: 'var(--site-surface)',
                  borderColor: 'var(--site-border)',
                  color: 'var(--site-text)',
                }}
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              aria-label="Sort vehicles"
              className="rounded-xl border px-3.5 py-2.5 text-xs font-medium outline-none"
              style={{
                backgroundColor: 'var(--site-surface)',
                borderColor: 'var(--site-border)',
                color: 'var(--site-text)',
              }}
            >
              <option value="newest">Sort: Newest First</option>
              <option value="featured">Sort: Featured</option>
                <option value="price-low">Price: Low – High</option>
              <option value="price-high">Price: High – Low</option>
              <option value="year">Year: Newest</option>
              <option value="km">KM: Lowest</option>
            </select>

            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              aria-expanded={filtersOpen}
              className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap shrink-0"
              style={{
                backgroundColor: filtersOpen ? 'var(--site-accent)' : 'var(--site-surface)',
                borderColor: 'var(--site-border)',
                color: filtersOpen ? 'var(--site-accent-contrast)' : 'var(--site-text)',
              }}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Refine Search</span>
            </button>
          </div>
        </div>

        {/* Multi-Facet Filter Panel (Full set from target site) */}
        {filtersOpen && (
          <div
            className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border p-5 sm:grid-cols-2 lg:grid-cols-5"
            style={{
              backgroundColor: 'var(--site-surface)',
              borderColor: 'var(--site-border)',
            }}
          >
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                Brand
              </label>
              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
              >
                <option value="all">All Brands</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                Fuel Type
              </label>
              <select
                value={fuelFilter}
                onChange={(e) => setFuelFilter(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
              >
                <option value="all">All Fuels</option>
                {fuels.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                Transmission
              </label>
              <select
                value={transFilter}
                onChange={(e) => setTransFilter(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
              >
                <option value="all">MT & AT</option>
                <option value="MT">Manual (MT)</option>
                <option value="AT">Automatic (AT)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                Ownership
              </label>
              <select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
              >
                <option value="all">Any Owner</option>
                <option value="1">1st Owner</option>
                <option value="2">2nd Owner</option>
                <option value="3">3rd Owner</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                Colour
              </label>
              <select
                value={colourFilter}
                onChange={(e) => setColourFilter(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
              >
                <option value="all">All Colours</option>
                {colours.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                From Year
              </label>
              <select
                value={yearMin}
                onChange={(e) => setYearMin(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
              >
                <option value="all">Any Year</option>
                {years.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                To Year
              </label>
              <select
                value={yearMax}
                onChange={(e) => setYearMax(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-xs outline-none"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
              >
                <option value="all">Any Year</option>
                {years.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                Price Range: <span className="font-mono-tabular">₹{minPriceLakhs} L – ₹{maxPriceLakhs} L</span>
              </label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="range"
                  min={0}
                  max={130}
                  value={minPriceLakhs}
                  aria-label="Minimum price in lakhs"
                  onChange={(e) => setMinPriceLakhs(Math.min(Number(e.target.value), maxPriceLakhs))}
                  className="w-full accent-amber-500"
                />
                <input
                  type="range"
                  min={1}
                  max={130}
                  value={maxPriceLakhs}
                  aria-label="Maximum price in lakhs"
                  onChange={(e) => setMaxPriceLakhs(Math.max(Number(e.target.value), minPriceLakhs))}
                  className="w-full accent-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                Max KM: <span className="font-mono-tabular">{kmMax >= 200000 ? 'Any' : `${kmMax.toLocaleString('en-IN')} km`}</span>
              </label>
              <input
                type="range"
                min={5000}
                max={200000}
                step={5000}
                value={kmMax}
                aria-label="Maximum kilometres"
                onChange={(e) => setKmMax(Number(e.target.value))}
                className="w-full accent-amber-500 mt-2"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-xl border px-4 py-2 text-xs font-semibold transition-colors hover:opacity-80"
                style={{
                  borderColor: 'var(--site-border)',
                  backgroundColor: 'var(--site-bg)',
                  color: 'var(--site-text)',
                }}
              >
                Clear All ({filteredVehicles.length})
              </button>
            </div>
          </div>
        )}

        {/* Vehicle Grid */}
        {filteredVehicles.length === 0 ? (
          <div
            className="mt-10 rounded-2xl border p-12 text-center"
            style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
          >
            <p className="font-display text-lg font-semibold">No cars found</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--site-muted)' }}>
              Adjust your brand, fuel, year, or budget filter to explore verified Tamil Nadu vehicles.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-5 rounded-xl px-5 py-2.5 text-xs font-semibold"
              style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
            >
              Show All Cars
            </button>
          </div>
        ) : (
          <>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {filteredVehicles.slice(0, visibleCardCount).map((v) => {
              const isShortlisted = shortlist.includes(v.id);
              const saving = v.price - v.finalPrice;
              const dial = getCardCallNumber();
              return (
                <article
                  key={v.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border transition-transform duration-200 hover:-translate-y-0.5"
                  style={{
                    backgroundColor: 'var(--site-surface)',
                    borderColor: 'var(--site-border)',
                  }}
                >
                  {/* 4:3 Image Container */}
                  <div
                    className="relative aspect-[4/3] w-full overflow-hidden cursor-pointer"
                    style={{ backgroundColor: 'var(--site-surface-alt)' }}
                    onClick={() => handleOpenVehicle(v)}
                  >
                    {!failedImages[v.id] ? (
                      <img
                        src={v.imageUrl}
                        alt={`${v.year} ${v.brand} ${v.model}`}
                        referrerPolicy="no-referrer"
                        onError={() => setFailedImages((prev) => ({ ...prev, [v.id]: true }))}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                        <Car className="h-10 w-10 mb-2" style={{ color: 'var(--site-accent)' }} />
                        <span className="text-sm font-semibold">{v.brand} {v.model}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleShortlist(v.id);
                      }}
                      aria-label={isShortlisted ? `Remove ${v.model} from shortlist` : `Add ${v.model} to shortlist`}
                      className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm transition-colors hover:bg-black/85"
                    >
                      <Heart
                        className="h-4 w-4"
                        fill={isShortlisted ? '#e8b06a' : 'none'}
                        style={{ color: isShortlisted ? '#e8b06a' : '#ffffff' }}
                      />
                    </button>
                  </div>

                  {/* Clean Metadata & Price */}
                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => handleOpenVehicle(v)}
                          className="text-left font-display text-base font-bold leading-snug hover:underline"
                          style={{ color: 'var(--site-text)' }}
                        >
                          {v.year} {v.brand} {v.model}
                        </button>
                        {v.status !== 'Available' && (
                          <span
                            className="text-xs font-semibold shrink-0"
                            style={{ color: v.status === 'Reserved' ? '#fbbf24' : '#f87171' }}
                          >
                            {v.status}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs" style={{ color: 'var(--site-muted)' }}>
                        {v.variant || 'Standard'} <span aria-hidden="true">·</span> {v.reg} <span aria-hidden="true">·</span> {v.colour}
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'var(--site-muted)' }}>
                        <span>{v.fuel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{v.trans}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">{formatKm(v.km)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{v.owner === '1' ? '1st Owner' : `${v.owner}nd Owner`}</span>
                      </div>

                      {(v.fc || v.insurance || v.permit || v.boardType) && (
                        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                          Board: <span style={{ color: 'var(--site-text)' }}>{v.boardType || '—'}</span>
                          {' · '}FC: <span style={{ color: 'var(--site-text)' }}>{v.fc || '—'}</span>
                          {' · '}Insurance: <span style={{ color: 'var(--site-text)' }}>{v.insurance || '—'}</span>
                          {' · '}Permit: <span style={{ color: 'var(--site-text)' }}>{v.permit || '—'}</span>
                        </p>
                      )}
                      <p className="mt-2 truncate text-[11px]" style={{ color: 'var(--site-muted)' }}>
                        Dealer: {v.dealer}
                      </p>
                    </div>

                    <div
                      className="mt-4 border-t pt-4"
                      style={{ borderColor: 'var(--site-border)' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--site-muted)' }}>
                            Asking Price
                          </p>
                          <p className="font-mono-tabular text-sm font-semibold line-through" style={{ color: '#f87171' }}>
                            {formatInrLakhs(v.price)}
                          </p>
                          <p className="mt-1 font-mono-tabular text-[11px] font-semibold" style={{ color: '#ffffff' }}>
                            You Save {saving > 0 ? formatInrLakhs(saving) : '₹0'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--site-muted)' }}>
                            Final Price
                          </p>
                          <p className="font-mono-tabular text-lg font-bold" style={{ color: '#4ade80' }}>
                            {formatInrLakhs(v.finalPrice)}
                          </p>
                        </div>
                      </div>

                      <div
                        className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3"
                        style={{ borderColor: 'var(--site-border)' }}
                      >
                        {canEditCar && (
                          <button
                            type="button"
                            onClick={() => handleStartEditCar(v)}
                            aria-label={`Edit ${v.brand} ${v.model}`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:opacity-80"
                            style={{ borderColor: 'var(--site-border)', backgroundColor: 'var(--site-bg)', color: 'var(--site-text)' }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canDeleteCar && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteFrontendCar(v)}
                            aria-label={`Delete ${v.brand} ${v.model}`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:opacity-80"
                            style={{ borderColor: 'var(--site-border)', backgroundColor: 'var(--site-bg)', color: '#f87171' }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <a
                          href={safeExternalHref(`tel:${dial}`)}
                          aria-label={`Call about ${v.brand} ${v.model}`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:opacity-80"
                          style={{ borderColor: 'var(--site-border)', backgroundColor: 'var(--site-bg)', color: 'var(--site-text)' }}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                        <a
                          href={safeExternalHref(
                            `https://wa.me/${getCardWhatsappNumber()}?text=${encodeURIComponent(
                              `Hello, I am interested in the ${v.year} ${v.brand} ${v.model} (${v.reg}) listed at ${formatInrLakhs(v.finalPrice)}.`
                            )}`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`WhatsApp about ${v.brand} ${v.model}`}
                          className="flex h-9 w-9 items-center justify-center rounded-xl border transition-colors hover:opacity-80"
                          style={{ borderColor: 'var(--site-border)', backgroundColor: 'var(--site-bg)', color: '#4ade80' }}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleOpenVehicle(v)}
                          className="ml-auto rounded-xl border px-3 py-2 text-xs font-semibold transition-colors hover:opacity-90 whitespace-nowrap"
                          style={{
                            borderColor: 'var(--site-border)',
                            backgroundColor: 'var(--site-bg)',
                            color: 'var(--site-text)',
                          }}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {(filteredVehicles.length > visibleCardCount || visibleCardCount > INITIAL_VISIBLE_CARDS) && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {filteredVehicles.length > visibleCardCount && (
                <button
                  type="button"
                  onClick={() => setVisibleCardCount(filteredVehicles.length)}
                  className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
                >
                  <span>View All Cars</span>
                  <span className="font-mono-tabular text-xs opacity-80">
                    ({filteredVehicles.length - visibleCardCount} more)
                  </span>
                </button>
              )}
              {visibleCardCount > INITIAL_VISIBLE_CARDS && (
                <button
                  type="button"
                  onClick={() => setVisibleCardCount(INITIAL_VISIBLE_CARDS)}
                  className="rounded-xl border px-5 py-3 text-xs font-semibold"
                  style={{ borderColor: 'var(--site-border)', color: 'var(--site-muted)' }}
                >
                  Show Less
                </button>
              )}
            </div>
          )}
          </>
        )}
      </section>

      {/* Dedicated Frontend "Add Enquiry" Section */}
      <section
        id="enquiries"
        className="mx-auto max-w-[1360px] px-6 py-14 border-t"
        style={{ borderColor: 'var(--site-border)' }}
      >
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5 space-y-4">
            <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--site-accent-bright)' }}>
              Add Enquiry · Instant Showroom Callback
            </p>
            <h2
              className="font-display text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ textWrap: 'balance' }}
            >
              Tell us your preferred car or target budget
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--site-muted)' }}>
              Looking for a specific registration, financing option, exchange valuation, or test drive slot? Submit an enquiry directly here and our Cantonment, Trichy-1 team receives it immediately.
            </p>

            <div
              className="rounded-2xl border p-5 space-y-3"
              style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
            >
              <div className="flex items-center gap-3 text-xs">
                <Clock className="h-4 w-4 shrink-0" style={{ color: 'var(--site-accent)' }} />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--site-text)' }}>Showroom Timings</p>
                  <p style={{ color: 'var(--site-muted)' }}>{siteContent.businessHours}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <Phone className="h-4 w-4 shrink-0" style={{ color: 'var(--site-accent)' }} />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--site-text)' }}>Direct Desk</p>
                  <p className="font-mono-tabular" style={{ color: 'var(--site-muted)' }}>{siteContent.contactPhone}</p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="lg:col-span-7 rounded-2xl border p-6 sm:p-7"
            style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
          >
            <h3 className="font-display text-lg font-bold">Add Customer Enquiry</h3>
            <p className="mt-1 text-xs" style={{ color: 'var(--site-muted)' }}>
              Every submitted enquiry syncs straight to our showroom CRM and advisor alerts.
            </p>

            {inlineSuccess && (
              <div
                className="mt-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium"
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                  borderColor: '#22c55e',
                  color: '#86efac',
                }}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Enquiry submitted successfully! An advisor will reach out to you shortly.</span>
              </div>
            )}

            <form onSubmit={handleSubmitInlineEnquiry} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    Customer Name
                  </label>
                  <input
                    type="text"
                    required
                    value={inlineCustomer}
                    onChange={(e) => setInlineCustomer(e.target.value)}
                    placeholder="Your full name"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={inlinePhone}
                    onChange={(e) => setInlinePhone(e.target.value)}
                    placeholder="e.g. 93855 88888"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    Select Vehicle / Model
                  </label>
                  <select
                    value={inlineVehicle}
                    onChange={(e) => setInlineVehicle(e.target.value)}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  >
                    <option value="">Any matching vehicle / Custom requirement</option>
                    <option value="manual">Enter vehicle / model manually</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.year} {v.brand} {v.model} ({formatInrLakhs(v.finalPrice)})
                      </option>
                    ))}
                  </select>
                  {inlineVehicle === 'manual' && (
                    <input
                      type="text"
                      required
                      value={inlineManualVehicle}
                      onChange={(e) => setInlineManualVehicle(e.target.value)}
                      placeholder="e.g. 2022 Honda City ZX"
                      className="mt-2 w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                      style={{
                        backgroundColor: 'var(--site-bg)',
                        borderColor: 'var(--site-border)',
                        color: 'var(--site-text)',
                      }}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    Target Budget
                  </label>
                  <input
                    type="text"
                    value={inlineBudget}
                    onChange={(e) => setInlineBudget(e.target.value)}
                    placeholder="e.g. ₹10 L – ₹15 L"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    Customer Location
                  </label>
                  <input
                    type="text"
                    value={inlineLocation}
                    onChange={(e) => setInlineLocation(e.target.value)}
                    placeholder="e.g. Trichy"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={inlineDate}
                    onChange={(e) => setInlineDate(e.target.value)}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    OLX ID
                  </label>
                  <input
                    type="text"
                    value={inlineOlxId}
                    onChange={(e) => setInlineOlxId(e.target.value)}
                    placeholder="e.g. OLX-123456"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    Status
                  </label>
                  <select
                    value={inlineStatus}
                    onChange={(e) => setInlineStatus(e.target.value as EnquiryStatus)}
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  >
                    {NEW_ENQUIRY_STATUS_LIST.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    Preferred Fuel
                  </label>
                  <select
                    value={inlineFuel}
                    onChange={(e) => setInlineFuel(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  >
                    <option value="Any Fuel">Any Fuel</option>
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="EV">Electric (EV)</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="PET / CNG">Petrol + CNG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    Transmission
                  </label>
                  <select
                    value={inlineTrans}
                    onChange={(e) => setInlineTrans(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2.5 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  >
                    <option value="Any Transmission">Any Transmission</option>
                    <option value="Manual (MT)">Manual (MT)</option>
                    <option value="Automatic (AT)">Automatic (AT)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={inlineEmail}
                    onChange={(e) => setInlineEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                  Enquiry Details / Test Drive Note
                </label>
                <textarea
                  rows={3}
                  value={inlineMessage}
                  onChange={(e) => setInlineMessage(e.target.value)}
                  placeholder="Share preferred visit day, bank loan requirement, or exchange car details…"
                  className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none resize-none"
                  style={{
                    backgroundColor: 'var(--site-bg)',
                    borderColor: 'var(--site-border)',
                    color: 'var(--site-text)',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={inlineSubmitting}
                className="w-full rounded-xl px-5 py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
                style={{
                  backgroundColor: 'var(--site-accent)',
                  color: 'var(--site-accent-contrast)',
                }}
              >
                {inlineSubmitting ? 'Submitting Enquiry…' : 'Submit Enquiry'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Frontend View All Enquiries Section */}
      <section
        id="all-enquiries"
        className="mx-auto max-w-[1360px] px-6 py-14 border-t"
        style={{ borderColor: 'var(--site-border)' }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--site-accent-bright)' }}>
              {isOperator ? 'Showroom Enquiries Ledger' : 'Your Submitted Enquiries'}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {isOperator ? `All Enquiries (${enquiries.length})` : `My Enquiries (${enquiries.length})`}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative w-60">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: 'var(--site-muted)' }}
              />
              <input
                type="search"
                value={enqSearch}
                onChange={(e) => setEnqSearch(e.target.value)}
                placeholder="Search customer, car, phone…"
                className="w-full rounded-xl border py-2 pl-8 pr-3 text-xs outline-none"
                style={{
                  backgroundColor: 'var(--site-surface)',
                  borderColor: 'var(--site-border)',
                  color: 'var(--site-text)',
                }}
              />
            </div>

            {isOperator && (
              <button
                type="button"
                onClick={handleExportEnquiriesCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--site-surface)',
                  borderColor: 'var(--site-border)',
                  color: 'var(--site-text)',
                }}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSelectWorkspaceTab('add-enquiry')}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
              style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Enquiry</span>
            </button>
          </div>
        </div>

        <div
          className="mt-5 inline-flex items-center gap-1 overflow-x-auto rounded-xl border p-1"
          style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
        >
          {(['All', ...ENQUIRY_STATUS_LIST] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setEnqStatusFilter(status)}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
              style={
                enqStatusFilter === status
                  ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }
                  : { color: 'var(--site-muted)' }
              }
            >
              {status}
            </button>
          ))}
        </div>

        {filteredEnquiries.length === 0 ? (
          <div
            className="mt-5 rounded-2xl border p-10 text-center text-sm"
            style={{
              backgroundColor: 'var(--site-surface)',
              borderColor: 'var(--site-border)',
              color: 'var(--site-muted)',
            }}
          >
            {enquiries.length === 0
              ? 'No enquiries recorded yet. Use the Add Enquiry form above to log your first enquiry.'
              : 'No enquiries match your active search or status filter.'}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredEnquiries.map((enq) => (
              <div
                key={enq.id}
                className="rounded-2xl border p-5 flex flex-col justify-between gap-4"
                style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)' }}
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-display text-base font-bold">{enq.customerName}</span>
                      <span aria-hidden="true" style={{ color: 'var(--site-muted)' }}>·</span>
                      <a
                        href={safeExternalHref(`tel:${enq.phone.replace(/\s+/g, '')}`)}
                        className="font-mono-tabular font-medium hover:underline"
                        style={{ color: 'var(--site-accent-bright)' }}
                      >
                        {enq.phone}
                      </a>
                    </div>
                    <span className="text-[11px] font-mono-tabular" style={{ color: 'var(--site-muted)' }}>
                      {formatRelativeTime(enq.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs font-medium" style={{ color: 'var(--site-accent-bright)' }}>
                    {enq.vehicleLabel} {enq.budget ? `· Budget ${enq.budget}` : ''} · {enq.source}
                  </p>
                  {(enq.location || enq.date || enq.olxId) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--site-muted)' }}>
                      {enq.location && <span>Location: {enq.location}</span>}
                      {enq.date && <span>Date: {enq.date}</span>}
                      {enq.olxId && <span>OLX ID: {enq.olxId}</span>}
                    </div>
                  )}
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--site-text)' }}>
                    {enq.message}
                  </p>
                </div>

                <div
                  className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs"
                  style={{ borderColor: 'var(--site-border)' }}
                >
                  <span style={{ color: 'var(--site-muted)' }}>
                    Status: <strong style={{ color: 'var(--site-text)' }}>{enq.status}</strong>
                  </span>
                  {isOperator && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Change status for ${enq.customerName}`}
                        value={enq.status}
                        onChange={(e) => void handleUpdateEnquiryStatus(enq.id, e.target.value as EnquiryStatus)}
                        className="rounded-lg border px-2.5 py-1 text-xs font-semibold outline-none"
                        style={{
                          backgroundColor: 'var(--site-bg)',
                          borderColor: 'var(--site-border)',
                          color: 'var(--site-accent-bright)',
                        }}
                      >
                        {ENQUIRY_STATUS_LIST.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleStartEditEnquiry(enq)}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                        style={{ borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteEnquiry(enq)}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold"
                          style={{ borderColor: 'var(--site-border)', color: '#f87171' }}
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editingEnquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-6 shadow-2xl"
            style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">Edit Enquiry</h3>
              <button type="button" onClick={() => setEditingEnquiry(null)} aria-label="Close" style={{ color: 'var(--site-muted)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEnquiryEdit} className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>Customer Name</label>
                <input required value={enquiryEditForm.customerName} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, customerName: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>Phone</label>
                <input required value={enquiryEditForm.phone} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, phone: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>Email</label>
                <input type="email" value={enquiryEditForm.email} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, email: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>Budget</label>
                <input value={enquiryEditForm.budget} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, budget: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>Customer Location</label>
                <input value={enquiryEditForm.location} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, location: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>Date</label>
                <input type="date" value={enquiryEditForm.date} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, date: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>OLX ID</label>
                <input value={enquiryEditForm.olxId} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, olxId: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>Vehicle / Model</label>
                <input value={enquiryEditForm.vehicleLabel} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, vehicleLabel: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>Interested Vehicle</label>
                <select value={enquiryEditForm.vehicleId} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, vehicleId: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}>
                  <option value="">General Showroom Consultation</option>
                  {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.year} {vehicle.brand} {vehicle.model} ({vehicle.reg})</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>Customer Message</label>
                <textarea rows={3} value={enquiryEditForm.message} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, message: e.target.value })} className="w-full resize-none rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>Status</label>
                <select value={enquiryEditForm.status} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, status: e.target.value as EnquiryStatus })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}>
                  {ENQUIRY_STATUS_LIST.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs" style={{ color: 'var(--site-muted)' }}>Advisor Notes</label>
                <input value={enquiryEditForm.notes} onChange={(e) => setEnquiryEditForm({ ...enquiryEditForm, notes: e.target.value })} className="w-full rounded-xl border px-3 py-2 text-xs outline-none" style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2 sm:col-span-2">
                <button type="button" onClick={() => setEditingEnquiry(null)} className="rounded-xl border px-4 py-2 text-xs font-semibold" style={{ borderColor: 'var(--site-border)' }}>Cancel</button>
                <button type="submit" disabled={enquiryEditSaving} className="rounded-xl px-5 py-2 text-xs font-semibold" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}>{enquiryEditSaving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dealership Story & Why Choose Us */}
      <section id="process" className="mx-auto max-w-[1360px] px-6 py-16 border-t" style={{ borderColor: 'var(--site-border)' }}>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--site-accent-bright)' }}>
              Why Choose Us
            </p>
            <h2
              className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ textWrap: 'balance' }}
            >
              {siteContent.storyTitle}
            </h2>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--site-muted)' }}>
              {siteContent.storyBody}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:col-span-7">
            {siteContent.storyHighlights.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-2xl border p-5"
                style={{
                  backgroundColor: 'var(--site-surface)',
                  borderColor: 'var(--site-border)',
                }}
              >
                <div>
                  <p className="font-mono-tabular text-xs font-semibold" style={{ color: 'var(--site-accent-bright)' }}>
                    0{idx + 1}.
                  </p>
                  <h3 className="mt-2 font-display text-base font-semibold">{item.title}</h3>
                </div>
                <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Showroom & Footer */}
      <footer id="showroom" className="border-t" style={{ borderColor: 'var(--site-border)', backgroundColor: 'var(--site-surface)' }}>
        <div className="mx-auto max-w-[1360px] px-6 py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12 items-start">
            <div className="md:col-span-4 space-y-3">
              <div className="flex items-center gap-3">
                {siteContent.logoUrl && (
                  <img
                    src={siteContent.logoUrl}
                    alt={`${siteContent.brandName} logo`}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-full object-cover border shrink-0"
                    style={{ borderColor: 'var(--site-accent)' }}
                  />
                )}
                <div>
                  <h3 className="font-display text-lg font-bold">{siteContent.brandName}</h3>
                  <p className="text-xs" style={{ color: 'var(--site-accent-bright)' }}>
                    {siteContent.tagline}
                  </p>
                </div>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                {siteContent.footerNote}
              </p>
            </div>

            <div className="md:col-span-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--site-muted)' }}>
                Visit Us · Showroom Location
              </h4>
              <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--site-accent)' }} />
                <span>
                  {siteContent.showroomAddress}
                  <br />
                  <span style={{ color: 'var(--site-muted)' }}>{siteContent.showroomCity}</span>
                </span>
              </p>
              <p className="mt-3 text-xs" style={{ color: 'var(--site-muted)' }}>
                {siteContent.businessHours} · Call before visiting for a test drive.
              </p>
            </div>

            <div className="md:col-span-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--site-muted)' }}>
                Direct Contact
              </h4>
              <div className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--site-accent)' }} />
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono-tabular">
                    {phoneNumbers.map((num, idx) => (
                      <React.Fragment key={num}>
                        <a href={safeExternalHref(`tel:${num.replace(/\s+/g, '')}`)} className="hover:underline">
                          {num}
                        </a>
                        {idx < phoneNumbers.length - 1 && (
                          <span aria-hidden="true" style={{ color: 'var(--site-muted)' }}>
                            /
                          </span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
                <a
                  href={safeExternalHref(`mailto:${siteContent.contactEmail}`)}
                  className="flex items-center gap-2 text-xs hover:underline"
                  style={{ color: 'var(--site-muted)' }}
                >
                  <Mail className="h-4 w-4 shrink-0" style={{ color: 'var(--site-accent)' }} />
                  <span>{siteContent.contactEmail}</span>
                </a>
              </div>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <a
                  href={safeExternalHref(`tel:${phoneNumbers[0]?.replace(/\s+/g, '') || '04312410888'}`)}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--site-accent)',
                    color: 'var(--site-accent-contrast)',
                  }}
                >
                  Call Showroom
                </a>
                <a
                  href="#enquiries"
                  className="rounded-xl border px-4 py-2.5 text-xs font-semibold"
                  style={{
                    borderColor: 'var(--site-border)',
                    color: 'var(--site-text)',
                  }}
                >
                  Add Enquiry
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Vehicle Specification & Price Breakdown Modal */}
      {selectedVehicle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl"
            style={{
              backgroundColor: 'var(--site-surface)',
              borderColor: 'var(--site-border)',
              color: 'var(--site-text)',
            }}
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden" style={{ backgroundColor: 'var(--site-surface-alt)' }}>
              <img
                src={selectedVehicle.imageUrl}
                alt={`${selectedVehicle.year} ${selectedVehicle.brand} ${selectedVehicle.model}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setSelectedVehicle(null)}
                aria-label="Close vehicle details"
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--site-accent-bright)' }}>
                    {selectedVehicle.reg} · {selectedVehicle.colour} · {selectedVehicle.status}
                  </p>
                  <h3 className="mt-1 font-display text-2xl font-bold">
                    {selectedVehicle.year} {selectedVehicle.brand} {selectedVehicle.model}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--site-muted)' }}>
                    Variant: {selectedVehicle.variant || 'Standard'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-mono-tabular text-2xl font-bold" style={{ color: '#4ade80' }}>
                    {formatInrLakhs(selectedVehicle.finalPrice)}
                  </p>
                  <p className="font-mono-tabular text-xs" style={{ color: 'var(--site-muted)' }}>
                    Exact: {formatInrFull(selectedVehicle.finalPrice)}
                  </p>
                </div>
              </div>

              {/* Specification Grid */}
              <div
                className="grid grid-cols-2 gap-4 rounded-xl border p-4 sm:grid-cols-4"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              >
                <div>
                  <p className="text-xs" style={{ color: 'var(--site-muted)' }}>Fuel</p>
                  <p className="mt-1 text-sm font-semibold">{selectedVehicle.fuel}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--site-muted)' }}>Transmission</p>
                  <p className="mt-1 text-sm font-semibold">{selectedVehicle.trans}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--site-muted)' }}>Kilometres</p>
                  <p className="mt-1 font-mono-tabular text-sm font-semibold">{formatKm(selectedVehicle.km)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--site-muted)' }}>Ownership</p>
                  <p className="mt-1 text-sm font-semibold">
                    {selectedVehicle.owner === '1' ? '1st Owner' : `${selectedVehicle.owner}nd Owner`}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--site-muted)' }}>Board Type</p>
                  <p className="mt-1 text-sm font-semibold">{selectedVehicle.boardType || '—'}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--site-muted)' }}>FC</p>
                  <p className="mt-1 text-sm font-semibold">{selectedVehicle.fc || '—'}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--site-muted)' }}>Insurance</p>
                  <p className="mt-1 text-sm font-semibold">{selectedVehicle.insurance || '—'}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--site-muted)' }}>Permit</p>
                  <p className="mt-1 text-sm font-semibold">{selectedVehicle.permit || '—'}</p>
                </div>
              </div>

              {/* Price Breakdown */}
              <div
                className="rounded-xl border p-4 space-y-2 text-xs"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              >
                <p className="font-display text-sm font-semibold">Price Breakdown</p>
                <div className="flex justify-between">
                  <span style={{ color: '#f87171' }}>Asking price</span>
                  <span className="font-mono-tabular line-through" style={{ color: '#f87171' }}>
                    {formatInrFull(selectedVehicle.price)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#4ade80' }}>Final showroom price</span>
                  <span className="font-mono-tabular font-semibold" style={{ color: '#4ade80' }}>
                    {formatInrFull(selectedVehicle.finalPrice)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#ffffff' }}>You save</span>
                  <span className="font-mono-tabular font-semibold" style={{ color: '#ffffff' }}>
                    {selectedVehicle.price > selectedVehicle.finalPrice
                      ? formatInrFull(selectedVehicle.price - selectedVehicle.finalPrice)
                      : '₹0'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs" style={{ color: 'var(--site-muted)' }}>
                  Dealer: {selectedVehicle.dealer}
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  {canEditCar && (
                    <button
                      type="button"
                      onClick={() => handleStartEditCar(selectedVehicle)}
                      className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold"
                      style={{ borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                  {canDeleteCar && (
                    <button
                      type="button"
                      onClick={() => void handleDeleteFrontendCar(selectedVehicle)}
                      className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold"
                      style={{ borderColor: 'var(--site-border)', color: '#f87171' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                  <a
                    href={safeExternalHref(`tel:${getCardCallNumber()}`)}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold"
                    style={{ borderColor: 'var(--site-border)', color: 'var(--site-text)' }}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    <span>Call</span>
                  </a>
                  <a
                    href={safeExternalHref(
                      `https://wa.me/${getCardWhatsappNumber()}?text=${encodeURIComponent(
                        `Hello, I am interested in the ${selectedVehicle.year} ${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.reg}) listed at ${formatInrLakhs(selectedVehicle.finalPrice)}.`
                      )}`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold"
                    style={{ borderColor: 'var(--site-border)', color: '#4ade80' }}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleOpenEnquiryForVehicle(selectedVehicle)}
                    className="rounded-xl px-5 py-2.5 text-xs font-semibold"
                    style={{
                      backgroundColor: 'var(--site-accent)',
                      color: 'var(--site-accent-contrast)',
                    }}
                  >
                    Enquire Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Enquiry & Test Drive Dialog */}
      {enquiryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-2xl border p-6 shadow-2xl"
            style={{
              backgroundColor: 'var(--site-surface)',
              borderColor: 'var(--site-border)',
              color: 'var(--site-text)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--site-accent-bright)' }}>
                  Showroom Advisor Desk
                </p>
                <h3 className="mt-1 font-display text-xl font-bold">
                  {enquiryVehicle
                    ? `${enquiryVehicle.year} ${enquiryVehicle.brand} ${enquiryVehicle.model}`
                    : 'Book a Showroom Visit'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEnquiryModalOpen(false)}
                aria-label="Close enquiry dialog"
                className="rounded-lg p-2 hover:opacity-80"
                style={{ color: 'var(--site-muted)' }}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {enqSuccess ? (
              <div
                className="mt-6 rounded-xl border p-5 text-center"
                style={{ backgroundColor: 'var(--site-bg)', borderColor: 'var(--site-border)' }}
              >
                <p className="font-display text-base font-semibold" style={{ color: 'var(--site-accent-bright)' }}>
                  Request Confirmed
                </p>
                <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--site-muted)' }}>
                  Your enquiry has been logged and pushed in real time to our showroom advisors.
                </p>
                <button
                  type="button"
                  onClick={() => setEnquiryModalOpen(false)}
                  className="mt-4 rounded-xl px-5 py-2.5 text-xs font-semibold"
                  style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-accent-contrast)' }}
                >
                  Back to Inventory
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitModalEnquiry} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={enqName}
                      onChange={(e) => setEnqName(e.target.value)}
                      placeholder="Full name"
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--site-bg)',
                        borderColor: 'var(--site-border)',
                        color: 'var(--site-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={enqPhone}
                      onChange={(e) => setEnqPhone(e.target.value)}
                      placeholder="e.g. 93855 88888"
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--site-bg)',
                        borderColor: 'var(--site-border)',
                        color: 'var(--site-text)',
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={enqEmail}
                      onChange={(e) => setEnqEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--site-bg)',
                        borderColor: 'var(--site-border)',
                        color: 'var(--site-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                      Target Budget
                    </label>
                    <input
                      type="text"
                      value={enqBudget}
                      onChange={(e) => setEnqBudget(e.target.value)}
                      placeholder="e.g. ₹14.5 L"
                      className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none"
                      style={{
                        backgroundColor: 'var(--site-bg)',
                        borderColor: 'var(--site-border)',
                        color: 'var(--site-text)',
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                      Customer Location
                    </label>
                    <input
                      type="text"
                      value={enqLocation}
                      onChange={(e) => setEnqLocation(e.target.value)}
                      placeholder="e.g. Trichy"
                      className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                      style={{
                        backgroundColor: 'var(--site-bg)',
                        borderColor: 'var(--site-border)',
                        color: 'var(--site-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                      Date
                    </label>
                    <input
                      type="date"
                      value={enqDate}
                      onChange={(e) => setEnqDate(e.target.value)}
                      className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                      style={{
                        backgroundColor: 'var(--site-bg)',
                        borderColor: 'var(--site-border)',
                        color: 'var(--site-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                      OLX ID
                    </label>
                    <input
                      type="text"
                      value={enqOlxId}
                      onChange={(e) => setEnqOlxId(e.target.value)}
                      placeholder="e.g. OLX-123456"
                      className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                      style={{
                        backgroundColor: 'var(--site-bg)',
                        borderColor: 'var(--site-border)',
                        color: 'var(--site-text)',
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                      Status
                    </label>
                    <select
                      value={enqStatus}
                      onChange={(e) => setEnqStatus(e.target.value as EnquiryStatus)}
                      className="w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none"
                      style={{
                        backgroundColor: 'var(--site-bg)',
                        borderColor: 'var(--site-border)',
                        color: 'var(--site-text)',
                      }}
                    >
                      {NEW_ENQUIRY_STATUS_LIST.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--site-muted)' }}>
                    Message / Preferred Inspection Time
                  </label>
                  <textarea
                    rows={3}
                    value={enqMessage}
                    onChange={(e) => setEnqMessage(e.target.value)}
                    placeholder="Share preferred test drive slot, loan requirement, or exchange details…"
                    className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none resize-none"
                    style={{
                      backgroundColor: 'var(--site-bg)',
                      borderColor: 'var(--site-border)',
                      color: 'var(--site-text)',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={enqSubmitting}
                  className="w-full rounded-xl px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--site-accent)',
                    color: 'var(--site-accent-contrast)',
                  }}
                >
                  {enqSubmitting ? 'Sending Enquiry…' : 'Send Enquiry to Showroom'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
