import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { POSLayout } from '@/layouts/POSLayout';
import { POSButton } from '@/components/ui/POSButton';
import { ConfirmModal, POSModal } from '@/components/ui/POSModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { 
  Settings,
  Package, 
  Users,
  ChevronRight,
  Search,
  Plus,
  Play,
  Edit3,
  Trash2,
  Filter,
  Gift,
  CreditCard,
  Percent,
  Cpu,
  Store,
  Shield
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { api, apiFile } from '@/api/client';
import { cn } from '@/lib/utils';
import { clearAuthUser, getAuthUser, isCashOpen, getSiteIdStored } from '@/lib/auth';
import { buildViewOptions } from '@/lib/view-options';
import { toast } from '@/components/ui/sonner';

type AdminModule = 'catalog' | 'promotions' | 'parameters' | 'users' | 'stations' | 'cards';
type StationStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
type StationType = 'TIME' | 'SKILL';
type InventoryReason = 'NUEVA_COMPRA' | 'VENCIMIENTO' | 'DANO' | 'PERDIDA' | 'TRASLADO' | 'CORTESIA';
type PromotionScheduleMode = 'recurring' | 'specific_date';
type ExecutiveResponse = {
  executive: {
    today_revenue: number;
    average_ticket: number;
    comparison_vs_yesterday_pct: number;
    hourly_revenue: Array<{ hour: number; revenue: number; transactions: number }>;
  };
};

const INVENTORY_REASON_OPTIONS: Array<{ value: InventoryReason; label: string; movementType: string; sign: 1 | -1 }> = [
  { value: 'NUEVA_COMPRA', label: 'Nueva compra', movementType: 'PURCHASE', sign: 1 },
  { value: 'VENCIMIENTO', label: 'Vencimiento', movementType: 'ADJUSTMENT', sign: -1 },
  { value: 'DANO', label: 'Daño', movementType: 'ADJUSTMENT', sign: -1 },
  { value: 'PERDIDA', label: 'Pérdida', movementType: 'ADJUSTMENT', sign: -1 },
  { value: 'TRASLADO', label: 'Traslado', movementType: 'TRANSFER', sign: -1 },
  { value: 'CORTESIA', label: 'Cortesía', movementType: 'ADJUSTMENT', sign: -1 },
];

const WEEK_DAYS = [
  { value: 0, short: 'Dom', label: 'Domingo' },
  { value: 1, short: 'Lun', label: 'Lunes' },
  { value: 2, short: 'Mar', label: 'Martes' },
  { value: 3, short: 'Mié', label: 'Miércoles' },
  { value: 4, short: 'Jue', label: 'Jueves' },
  { value: 5, short: 'Vie', label: 'Viernes' },
  { value: 6, short: 'Sáb', label: 'Sábado' },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const authUser = getAuthUser();
  const canManageInventoryAdjustments = authUser?.role === 'supervisor';
  const [activeModule, setActiveModule] = useState<AdminModule>('catalog');
  const [searchTerm, setSearchTerm] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [prizes, setPrizes] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [showSimulatorModal, setShowSimulatorModal] = useState(false);
  const [simulatorMachineId, setSimulatorMachineId] = useState('');
  const [simulatorReaderId, setSimulatorReaderId] = useState('');
  const [simulatorUid, setSimulatorUid] = useState('');
  const [simulatorResponse, setSimulatorResponse] = useState<any | null>(null);
  const [simulatorLoading, setSimulatorLoading] = useState(false);
  const [showStationModal, setShowStationModal] = useState(false);
  const [editingStation, setEditingStation] = useState<any | null>(null);
  const [stationForm, setStationForm] = useState({
    name: '',
    price: '',
    duration: '0',
    points_reward: '1000',
    type: 'SKILL' as StationType,
    status: 'ACTIVE' as StationStatus,
    reader_id: '',
    location: '',
  });
  const [espLogs, setEspLogs] = useState<any[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showDeleteUser, setShowDeleteUser] = useState(false);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'cashier', pin: '' });
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [showDeleteProduct, setShowDeleteProduct] = useState(false);
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<any | null>(null);
  const [showInventoryAdjustModal, setShowInventoryAdjustModal] = useState(false);
  const [inventoryAdjustProduct, setInventoryAdjustProduct] = useState<any | null>(null);
  const [inventoryAdjustForm, setInventoryAdjustForm] = useState<{
    reason: InventoryReason;
    quantity: string;
    transfer_direction: 'OUT' | 'IN';
    observations: string;
  }>({
    reason: 'NUEVA_COMPRA',
    quantity: '',
    transfer_direction: 'OUT',
    observations: '',
  });
  const [productForm, setProductForm] = useState({ name: '', price: '', stock_available: '', is_active: true, analytics_category: '', analytics_subcategory: '' });
  const [catalogCategories, setCatalogCategories] = useState<Array<{ id: string; nombre: string }>>([]);
  const [catalogSubcategories, setCatalogSubcategories] = useState<Array<{ id: string; categoria_id: string; nombre: string }>>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<any | null>(null);
  const [promotionForm, setPromotionForm] = useState({
    code: '',
    name: '',
    description: '',
    scope: 'RECHARGE',
    type: 'RECHARGE_ADDITIONAL',
    fixed_value: '',
    percent_value: '',
    exact_values: '',
    day_restrictions: '',
    product_restrictions: '',
    exceptions: '',
    starts_at: '',
    ends_at: '',
    is_active: true,
    priority: '100',
  });
  const [promotionScheduleMode, setPromotionScheduleMode] = useState<PromotionScheduleMode>('recurring');
  const [promotionSpecificDate, setPromotionSpecificDate] = useState<Date | undefined>(undefined);
  const [siteConfigForm, setSiteConfigForm] = useState({
    min_recharge_amount: '5000',
    points_per_currency: '1',
    currency_unit: '1000',
    daily_sales_goal: '0',
    credit_term_days: '15',
  });
  const [showDevLogs, setShowDevLogs] = useState(false);
  const [cardLookupUid, setCardLookupUid] = useState('');
  const [cardLookupLoading, setCardLookupLoading] = useState(false);
  const [cardLookupData, setCardLookupData] = useState<any | null>(null);
  const [cardLookupError, setCardLookupError] = useState('');
  const [cardScanLoading, setCardScanLoading] = useState(false);
  const [hourlySales, setHourlySales] = useState<Array<{ hourLabel: string; transactions: number; revenue: number }>>([]);
  const [hourlySalesLoading, setHourlySalesLoading] = useState(false);

  const parseWeekdayCsv = (value: string) =>
    value
      .split(',')
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 6);

  const toDateTimeLocal = (date: Date, hour: number, minute: number) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return `${year}-${month}-${day}T${hh}:${mm}`;
  };

  const modules = [
    { id: 'catalog' as AdminModule, icon: Package, label: 'Catálogo', description: 'Ítems, precios y stock' },
    { id: 'cards' as AdminModule, icon: CreditCard, label: 'Tarjetas', description: 'Estado y trazabilidad' },
    { id: 'promotions' as AdminModule, icon: Percent, label: 'Promociones', description: 'Reglas comerciales' },
    { id: 'parameters' as AdminModule, icon: Settings, label: 'Parámetros', description: 'Configuración de sede' },
    { id: 'users' as AdminModule, icon: Users, label: 'Usuarios', description: 'Gestión de usuarios' },
    { id: 'stations' as AdminModule, icon: Cpu, label: 'Estaciones', description: 'Máquinas y lectoras' },
  ];

  const cardStatusLabel: Record<string, string> = {
    ACTIVE: 'ACTIVA',
    BLOCKED: 'BLOQUEADA',
    LOST: 'EXTRAVIADA',
    REPLACED: 'REEMPLAZADA',
    INACTIVE: 'INACTIVA',
  };

  const cardStatusBadgeClass: Record<string, string> = {
    ACTIVE: 'badge-success',
    BLOCKED: 'badge-warning',
    LOST: 'badge-warning',
    REPLACED: 'badge-info',
    INACTIVE: 'badge-info',
  };

  const stationCategory = 'Parque';
  const stationSubcategory = stationForm.type === 'TIME' ? 'Atracciones' : 'Máquinas';
  const stationOperationLabel = stationForm.type === 'TIME' ? 'Tiempo' : 'Habilidad';
  const inventoryItemBySku = new Map(
    inventoryItems.map((item) => [String(item.sku ?? ''), item])
  );
  const selectedAdjustInventoryItem =
    inventoryAdjustProduct?.sku ? inventoryItemBySku.get(`INV-${inventoryAdjustProduct.sku}`) : null;
  const selectedCatalogCategory = catalogCategories.find(
    (category) => category.nombre.toLowerCase() === productForm.analytics_category.toLowerCase()
  );
  const availableCatalogSubcategories = selectedCatalogCategory
    ? catalogSubcategories.filter((subcategory) => subcategory.categoria_id === selectedCatalogCategory.id)
    : [];

  const refreshStations = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    const data = await api<any[]>(`/admin/stations?site_id=${siteId}`);
    setStations(data);
  };

  const refreshProductsAndInventory = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    const [productRows, inventoryRows] = await Promise.all([
      api<any[]>(`/admin/products?site_id=${siteId}`),
      api<any[]>(`/admin/inventory/items?site_id=${siteId}`),
    ]);
    setProducts(productRows);
    setInventoryItems(inventoryRows);
  };

  const refreshCatalogTaxonomy = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    const [categoryRows, subcategoryRows] = await Promise.all([
      api<Array<{ id: string; nombre: string }>>(`/admin/catalog/categories?site_id=${siteId}`),
      api<Array<{ id: string; categoria_id: string; nombre: string }>>(`/admin/catalog/subcategories?site_id=${siteId}`),
    ]);
    setCatalogCategories(categoryRows);
    setCatalogSubcategories(subcategoryRows);
  };

  useEffect(() => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    setHourlySalesLoading(true);
    refreshProductsAndInventory().catch(() => {
      setProducts([]);
      setInventoryItems([]);
    });
    api<any[]>(`/admin/promotions?site_id=${siteId}`).then(setPromotions).catch(() => setPromotions([]));
    api<any[]>(`/bonus-scales?site_id=${siteId}`).then(setBonuses).catch(() => setBonuses([]));
    api<any[]>(`/inventory/prizes?site_id=${siteId}`).then(setPrizes).catch(() => setPrizes([]));
    api<any[]>(`/admin/users?site_id=${siteId}`).then(setUsers).catch(() => setUsers([]));
    refreshStations().catch(() => setStations([]));
    refreshCatalogTaxonomy().catch(() => {
      setCatalogCategories([]);
      setCatalogSubcategories([]);
    });
    api<any>(`/admin/site-config?site_id=${siteId}`)
      .then((config) => setSiteConfigForm({
        min_recharge_amount: config.min_recharge_amount ?? '5000',
        points_per_currency: String(config.points_per_currency ?? 1),
        currency_unit: String(config.currency_unit ?? 1000),
        daily_sales_goal: config.daily_sales_goal ?? '0',
        credit_term_days: String(config.credit_term_days ?? 15),
      }))
      .catch(() => null);
    api<ExecutiveResponse>(`/reports/admin/executive?site_id=${siteId}`)
      .then((response) => {
        const hourly = response.executive.hourly_revenue.map((row) => ({
          hourLabel: `${String(row.hour).padStart(2, '0')}:00`,
          transactions: row.transactions,
          revenue: row.revenue,
        }));
        setHourlySales(hourly);
      })
      .catch(() => setHourlySales([]))
      .finally(() => setHourlySalesLoading(false));
  }, []);

  useEffect(() => {
    if (activeModule !== 'stations') return;
    refreshStations().catch(() => null);
    const interval = window.setInterval(() => {
      refreshStations().catch(() => null);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [activeModule]);

  useEffect(() => {
    const cats = Array.from(new Set(products.map(p => p.category))).map(c => ({ id: c, name: c }));
    setCategories(cats);
  }, [products]);

  useEffect(() => {
    if (!selectedCatalogCategory) return;
    const validNames = new Set(
      catalogSubcategories
        .filter((subcategory) => subcategory.categoria_id === selectedCatalogCategory.id)
        .map((subcategory) => subcategory.nombre)
    );
    if (productForm.analytics_subcategory && !validNames.has(productForm.analytics_subcategory)) {
      setProductForm((prev) => ({ ...prev, analytics_subcategory: '' }));
    }
  }, [productForm.analytics_category, productForm.analytics_subcategory, selectedCatalogCategory, catalogSubcategories]);

  const handleLogout = () => {
    if (isCashOpen()) return;
    setShowExitConfirm(true);
  };

  const loadEspLogs = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    const logs = await api<any[]>(`/admin/esp-logs?site_id=${siteId}&limit=120`);
    setEspLogs(logs);
  };

  const lookupCard = async (uidInput?: string) => {
    const siteId = getSiteIdStored();
    const uid = (uidInput ?? cardLookupUid).trim().toUpperCase();
    if (!siteId || !uid) return;
    setCardLookupError('');
    setCardLookupLoading(true);
    try {
      const data = await api<any>(`/admin/cards/lookup?site_id=${siteId}&uid=${encodeURIComponent(uid)}`);
      if (!data?.found || !data?.card) {
        setCardLookupData(null);
        setCardLookupError(data?.message || 'Tarjeta no encontrada');
        setCardLookupUid(uid);
        return;
      }
      setCardLookupData(data);
      setCardLookupUid(uid);
    } catch (err: any) {
      const notFoundRoute = typeof err?.message === 'string' && err.message.includes('404');
      if (notFoundRoute) {
        try {
          const legacy = await api<any>(`/cards/${encodeURIComponent(uid)}?site_id=${siteId}`);
          if (!legacy?.code) {
            setCardLookupData(null);
            setCardLookupError('Tarjeta no encontrada');
            setCardLookupUid(uid);
            return;
          }
          const fallbackData = {
            found: true,
            card: {
              uid: legacy.code,
              label: legacy.label ?? null,
              status: legacy.status,
              balance: Number(legacy.balance ?? 0),
              points: Number(legacy.points ?? 0),
              issued_at: legacy.createdAt ?? new Date().toISOString(),
              owner: legacy.owner ?? null,
            },
            issued_sale: null,
            recharges: [],
            status_history: [],
            usages: [],
            prize_redemptions: [],
            balance_events: [],
            device_logs: [],
          };
          setCardLookupData(fallbackData);
          setCardLookupUid(uid);
          setCardLookupError('API admin no disponible en este servidor. Mostrando datos básicos de tarjeta.');
          return;
        } catch (fallbackErr: any) {
          setCardLookupData(null);
          setCardLookupError(fallbackErr?.message || 'No se pudo consultar la tarjeta');
          return;
        }
      }
      setCardLookupData(null);
      setCardLookupError(err?.message || 'No se pudo consultar la tarjeta');
    } finally {
      setCardLookupLoading(false);
    }
  };

  const scanUidFromReader = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    const startedAt = Date.now();
    setCardLookupError('');
    setCardScanLoading(true);
    try {
      for (let i = 0; i < 30; i += 1) {
        const response = await api<{ uid: string | null; timestamp: number | null }>(
          `/cards/reader/wait-uid?site_id=${siteId}&after=${startedAt}`
        );
        if (response.uid) {
          await lookupCard(response.uid);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setCardLookupError('Tiempo de espera agotado para recibir UID');
    } catch (err: any) {
      setCardLookupError(err?.message || 'No se pudo leer UID desde lectora');
    } finally {
      setCardScanLoading(false);
    }
  };

  const openUserModal = (user?: any) => {
    setEditingUser(user ?? null);
    setUserForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'cashier',
      pin: '',
    });
    setShowUserModal(true);
  };

  const saveUser = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    if (editingUser) {
      await api(`/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          site_id: siteId,
          full_name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          pin: userForm.pin || undefined,
        }),
      });
    } else {
      await api('/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          full_name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          pin: userForm.pin,
        }),
      });
    }
    api<any[]>(`/admin/users?site_id=${siteId}`).then(setUsers);
    setShowUserModal(false);
  };

  const openProductModal = (product?: any) => {
    setEditingProduct(product ?? null);
    setProductForm({
      name: product?.name ?? '',
      price: product?.price ?? '',
      stock_available: product ? '' : product?.stock != null ? String(product.stock) : '',
      is_active: product?.is_active ?? true,
      analytics_category: product?.analytics_category ?? '',
      analytics_subcategory: product?.analytics_subcategory ?? '',
    });
    setNewCategoryName('');
    setNewSubcategoryName('');
    setShowProductModal(true);
  };

  const saveProduct = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    if (!productForm.analytics_category || !productForm.analytics_subcategory) return;
    if (editingProduct) {
      await api(`/admin/products/${editingProduct.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          site_id: siteId,
          name: productForm.name,
          price: productForm.price,
          is_active: productForm.is_active,
          analytics_category: productForm.analytics_category,
          analytics_subcategory: productForm.analytics_subcategory,
        }),
      });
    } else {
      await api('/admin/products', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          name: productForm.name,
          price: productForm.price,
          stock_available: productForm.stock_available === '' ? undefined : Number(productForm.stock_available),
          is_active: productForm.is_active,
          analytics_category: productForm.analytics_category,
          analytics_subcategory: productForm.analytics_subcategory,
        }),
      });
    }
    await refreshProductsAndInventory();
    setShowProductModal(false);
  };

  const createCategoryFromModal = async () => {
    const siteId = getSiteIdStored();
    const categoryName = newCategoryName.trim();
    if (!siteId || !categoryName) return;
    const created = await api<{ id: string; nombre: string }>('/admin/catalog/categories', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        nombre: categoryName,
      }),
    });
    await refreshCatalogTaxonomy();
    setProductForm((prev) => ({
      ...prev,
      analytics_category: created.nombre,
      analytics_subcategory: '',
    }));
    setNewCategoryName('');
  };

  const createSubcategoryFromModal = async () => {
    const siteId = getSiteIdStored();
    const subcategoryName = newSubcategoryName.trim();
    if (!siteId || !subcategoryName || !selectedCatalogCategory) return;
    const created = await api<{ id: string; nombre: string }>('/admin/catalog/subcategories', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        categoria_id: selectedCatalogCategory.id,
        nombre: subcategoryName,
      }),
    });
    await refreshCatalogTaxonomy();
    setProductForm((prev) => ({
      ...prev,
      analytics_subcategory: created.nombre,
    }));
    setNewSubcategoryName('');
  };

  const openInventoryAdjustModal = (product: any) => {
    if (!canManageInventoryAdjustments) {
      toast.error('El ajuste manual de stock solo puede hacerlo un supervisor desde movimientos de inventario');
      return;
    }
    setInventoryAdjustProduct(product);
    setInventoryAdjustForm({
      reason: 'NUEVA_COMPRA',
      quantity: '',
      transfer_direction: 'OUT',
      observations: '',
    });
    setShowInventoryAdjustModal(true);
  };

  const submitInventoryAdjustment = async () => {
    const siteId = getSiteIdStored();
    if (!canManageInventoryAdjustments) return;
    if (!siteId || !inventoryAdjustProduct?.sku || !selectedAdjustInventoryItem?.id) return;

    const qty = Number.parseInt(inventoryAdjustForm.quantity || '0', 10);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const reasonConfig = INVENTORY_REASON_OPTIONS.find((option) => option.value === inventoryAdjustForm.reason);
    if (!reasonConfig) return;

    const signedQty =
      inventoryAdjustForm.reason === 'TRASLADO'
        ? qty * (inventoryAdjustForm.transfer_direction === 'IN' ? 1 : -1)
        : qty * reasonConfig.sign;

    await api('/admin/inventory/movements', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        item_id: selectedAdjustInventoryItem.id,
        type: reasonConfig.movementType,
        quantity: signedQty,
        reason: inventoryAdjustForm.reason,
        observations: inventoryAdjustForm.observations.trim() || undefined,
      }),
    });
    await refreshProductsAndInventory();
    setShowInventoryAdjustModal(false);
    setInventoryAdjustProduct(null);
  };

  const exportInventoryExcel = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    const { blob, filename } = await apiFile(`/admin/inventory/report?site_id=${siteId}&export=excel`);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename || `reporte-inventario-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const openPromotionModal = (promotion?: any) => {
    const startAtRaw = promotion?.starts_at ? String(promotion.starts_at).slice(0, 16) : '';
    const endAtRaw = promotion?.ends_at ? String(promotion.ends_at).slice(0, 16) : '';
    const weekdayCsv = Array.isArray(promotion?.day_restrictions) ? promotion.day_restrictions.join(',') : '';
    const isSpecificDate = Boolean(startAtRaw) && !weekdayCsv;
    setPromotionScheduleMode(isSpecificDate ? 'specific_date' : 'recurring');
    setPromotionSpecificDate(startAtRaw ? new Date(startAtRaw) : undefined);
    setEditingPromotion(promotion ?? null);
    setPromotionForm({
      code: promotion?.code ?? '',
      name: promotion?.name ?? '',
      description: promotion?.description ?? '',
      scope: promotion?.scope ?? 'RECHARGE',
      type: promotion?.type ?? 'RECHARGE_ADDITIONAL',
      fixed_value: promotion?.fixed_value ?? '',
      percent_value: promotion?.percent_value ?? '',
      exact_values: Array.isArray(promotion?.exact_values) ? promotion.exact_values.join(',') : '',
      day_restrictions: weekdayCsv,
      product_restrictions: Array.isArray(promotion?.product_restrictions) ? promotion.product_restrictions.join(',') : '',
      exceptions: Array.isArray(promotion?.exceptions) ? promotion.exceptions.join(',') : '',
      starts_at: startAtRaw,
      ends_at: endAtRaw,
      is_active: promotion?.is_active ?? true,
      priority: String(promotion?.priority ?? 100),
    });
    setShowPromotionModal(true);
  };

  const selectedPromotionWeekDays = parseWeekdayCsv(promotionForm.day_restrictions);

  const togglePromotionWeekday = (day: number) => {
    const current = new Set(selectedPromotionWeekDays);
    if (current.has(day)) current.delete(day);
    else current.add(day);
    setPromotionForm((prev) => ({ ...prev, day_restrictions: Array.from(current).sort((a, b) => a - b).join(',') }));
  };

  const applyPromotionSpecificDate = (date: Date | undefined) => {
    setPromotionSpecificDate(date);
    if (!date) {
      setPromotionForm((prev) => ({ ...prev, starts_at: '', ends_at: '' }));
      return;
    }
    setPromotionForm((prev) => ({
      ...prev,
      starts_at: toDateTimeLocal(date, 0, 0),
      ends_at: toDateTimeLocal(date, 23, 59),
      day_restrictions: '',
    }));
  };

  const openStationModal = (station?: any) => {
    setEditingStation(station ?? null);
    setStationForm({
      name: station?.name ?? '',
      price: String(station?.price ?? station?.price_per_use ?? ''),
      duration: String(station?.duration ?? 0),
      points_reward: String(station?.points_reward ?? 1000),
      type: (station?.type ?? 'SKILL') as StationType,
      status: (station?.status ?? 'ACTIVE') as StationStatus,
      reader_id: station?.reader_assigned?.id ?? '',
      location: station?.location ?? '',
    });
    setShowStationModal(true);
  };

  const saveStation = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    const durationValue = stationForm.type === 'TIME' ? Number(stationForm.duration || '0') : 0;
    if (editingStation) {
      await api(`/admin/stations/${editingStation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          site_id: siteId,
          name: stationForm.name,
          price: stationForm.price,
          duration: durationValue,
          points_reward: Number(stationForm.points_reward || '0'),
          type: stationForm.type,
          status: stationForm.status,
          reader_id: stationForm.reader_id || null,
          location: stationForm.location,
        }),
      });
    } else {
      await api('/admin/stations', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          name: stationForm.name,
          price: stationForm.price,
          duration: durationValue,
          points_reward: Number(stationForm.points_reward || '0'),
          type: stationForm.type,
          status: stationForm.status,
          location: stationForm.location,
        }),
      });
    }
    await refreshStations();
    setShowStationModal(false);
    setEditingStation(null);
  };

  const selectedSimulatorStation = stations.find((station) => station.id === simulatorMachineId);
  const executeSimulator = async () => {
    const siteId = getSiteIdStored();
    if (!siteId || !simulatorMachineId || !simulatorUid) return;
    setSimulatorLoading(true);
    try {
      const response = await api<any>('/admin/stations/simulate-use', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          machine_id: simulatorMachineId,
          reader_id: simulatorReaderId || undefined,
          uid: simulatorUid.trim().toUpperCase(),
        }),
      });
      setSimulatorResponse(response);
      await refreshStations();
    } finally {
      setSimulatorLoading(false);
    }
  };

  const parseCsvNumbers = (value: string) =>
    value
      .split(',')
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isFinite(entry));

  const savePromotion = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    const payload = {
      site_id: siteId,
      code: promotionForm.code,
      name: promotionForm.name,
      description: promotionForm.description || undefined,
      scope: promotionForm.scope,
      type: promotionForm.type,
      percent_value: promotionForm.percent_value || undefined,
      fixed_value: promotionForm.fixed_value || undefined,
      exact_values: parseCsvNumbers(promotionForm.exact_values),
      day_restrictions: parseCsvNumbers(promotionForm.day_restrictions),
      product_restrictions: promotionForm.product_restrictions
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      exceptions: promotionForm.exceptions
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      starts_at: promotionForm.starts_at || undefined,
      ends_at: promotionForm.ends_at || undefined,
      is_active: promotionForm.is_active,
      priority: Number(promotionForm.priority || '100'),
    };
    if (editingPromotion) {
      await api(`/admin/promotions/${editingPromotion.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      await api('/admin/promotions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }
    api<any[]>(`/admin/promotions?site_id=${siteId}`).then(setPromotions);
    setShowPromotionModal(false);
  };

  const seedDefaultPromotions = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    const templates = [
      {
        code: 'PROM-001',
        name: 'Martes y Jueves 50% en Parque',
        description: '50% en todo el parque excepto Juegos de Salón',
        scope: 'SALE',
        type: 'PERCENT_DISCOUNT',
        percent_value: '50',
        day_restrictions: [2, 4],
        exceptions: ['JUEGOS_DE_SALON'],
      },
      {
        code: 'PROM-002',
        name: 'Semana Feliz',
        description: '20% descuento en todo el parque',
        scope: 'SALE',
        type: 'PERCENT_DISCOUNT',
        percent_value: '20',
      },
      {
        code: 'PROM-003',
        name: 'Día Feliz',
        description: '50% en todo el parque excepto Juegos de Salón',
        scope: 'SALE',
        type: 'PERCENT_DISCOUNT',
        percent_value: '50',
        exceptions: ['JUEGOS_DE_SALON'],
      },
      {
        code: 'PROM-004',
        name: 'Tarjeta VIP',
        description: '25% descuento en el parque',
        scope: 'SALE',
        type: 'PERCENT_DISCOUNT',
        percent_value: '25',
      },
      {
        code: 'RECA-001',
        name: 'Recarga 50K + 8K',
        description: '50.000 + 8.000 adicional',
        scope: 'RECHARGE',
        type: 'RECHARGE_ADDITIONAL',
        fixed_value: '8000',
        exact_values: [50000],
      },
      {
        code: 'RECA-002',
        name: 'Recarga 70K + 15K',
        description: '70.000 + 15.000 adicional',
        scope: 'RECHARGE',
        type: 'RECHARGE_ADDITIONAL',
        fixed_value: '15000',
        exact_values: [70000],
      },
      {
        code: 'RECA-003',
        name: 'Recarga 100K + 25K',
        description: '100.000 + 25.000 adicional',
        scope: 'RECHARGE',
        type: 'RECHARGE_ADDITIONAL',
        fixed_value: '25000',
        exact_values: [100000],
      },
    ];

    for (const promotion of templates) {
      // eslint-disable-next-line no-await-in-loop
      await api('/admin/promotions', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          is_active: true,
          priority: 100,
          ...promotion,
        }),
      }).catch(() => null);
    }
    api<any[]>(`/admin/promotions?site_id=${siteId}`).then(setPromotions);
  };

  return (
    <POSLayout
      userName={authUser?.name ?? 'Supervisor'}
      userRole={authUser?.role === 'admin' ? 'Administrador' : 'Supervisor'}
      currentViewLabel="Administración"
      onLogout={handleLogout}
      logoutDisabled={isCashOpen()}
      viewOptions={buildViewOptions(authUser?.role, navigate)}
    >
        <div className="flex w-full pos-full-height">
        {/* Sidebar de Módulos */}
        <div className="pos-sidebar w-64">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-lg">Capa 2: Configuración</h2>
            <p className="text-sm text-muted-foreground">Catálogo, reglas y parámetros</p>
          </div>

          <nav className="flex-1 p-2 space-y-1">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left',
                  activeModule === module.id
                    ? 'bg-primary text-primary-foreground shadow-soft'
                    : 'hover:bg-secondary'
                )}
              >
                <module.icon className="h-5 w-5" />
                <div className="flex-1">
                  <p className="font-medium">{module.label}</p>
                  <p className={cn(
                    'text-xs',
                    activeModule === module.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}>
                    {module.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 opacity-50" />
              </button>
            ))}
          </nav>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 overflow-auto p-6">
          {authUser?.role === 'admin' && (
            <div className="card-pos mb-6 p-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">Ventas por Hora del Día</h2>
                  <p className="text-sm text-muted-foreground">Cantidad de transacciones registradas hoy por franja horaria.</p>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <div>Total transacciones</div>
                  <div className="text-lg font-semibold text-foreground">
                    {hourlySales.reduce((acc, row) => acc + row.transactions, 0)}
                  </div>
                </div>
              </div>

              <div className="h-72">
                {hourlySalesLoading ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Cargando serie horaria...
                  </div>
                ) : hourlySales.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No hay datos horarios disponibles para hoy.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlySales} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="hourLabel"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        interval={1}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--secondary) / 0.25)' }}
                        formatter={(value: number, name: string, payload: any) => {
                          if (name === 'transactions') return [`${value} ventas`, 'Ventas'];
                          return [formatCurrency(Number(payload?.payload?.revenue ?? 0)), 'Ingresos'];
                        }}
                        labelFormatter={(label) => `Hora ${label}`}
                      />
                      <Bar dataKey="transactions" name="transactions" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* === PARÁMETROS === */}
          {activeModule === 'parameters' && (
            <div className="space-y-6 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Configuración General</h1>
                  <p className="text-muted-foreground">Parámetros del sistema</p>
                </div>
                <POSButton
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await loadEspLogs();
                    setShowDevLogs(true);
                  }}
                >
                  DEV
                </POSButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card-pos p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Store className="h-6 w-6 text-primary" />
                    <h3 className="font-semibold text-lg">Información de Sede</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-muted-foreground">Nombre</label>
                      <input className="input-pos input-pos-compact" defaultValue="POLIVERSO - MallBP" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Ubicación</label>
                      <input className="input-pos input-pos-compact" defaultValue="Montelíbano, Córdoba" />
                    </div>
                  </div>
                </div>

                <div className="card-pos p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-accent" />
                    <h3 className="font-semibold text-lg">Seguridad</h3>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 bg-secondary/70 rounded-xl cursor-pointer">
                      <input type="checkbox" className="h-5 w-5" defaultChecked />
                      <span>Requerer PIN para anulaciones</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-secondary/70 rounded-xl cursor-pointer">
                      <input type="checkbox" className="h-5 w-5" defaultChecked />
                      <span>Doble confirmación en cierres</span>
                    </label>
                  </div>
                </div>

                <div className="card-pos p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-6 w-6 text-success" />
                    <h3 className="font-semibold text-lg">Tarjetas</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-muted-foreground">Precio de tarjeta nueva</label>
                      <input className="input-pos input-pos-compact" defaultValue="10000" type="number" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Recarga mínima</label>
                      <input
                        className="input-pos input-pos-compact"
                        type="number"
                        value={siteConfigForm.min_recharge_amount}
                        onChange={(e) => setSiteConfigForm((prev) => ({ ...prev, min_recharge_amount: e.target.value.replace(/\D/g, '') }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="card-pos p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Gift className="h-6 w-6 text-warning" />
                    <h3 className="font-semibold text-lg">Puntos</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-muted-foreground">Puntos por cada $1,000</label>
                      <input
                        className="input-pos input-pos-compact"
                        type="number"
                        value={siteConfigForm.points_per_currency}
                        onChange={(e) => setSiteConfigForm((prev) => ({ ...prev, points_per_currency: e.target.value.replace(/\D/g, '') }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Meta diaria de ventas</label>
                      <input
                        className="input-pos input-pos-compact"
                        type="number"
                        value={siteConfigForm.daily_sales_goal}
                        onChange={(e) => setSiteConfigForm((prev) => ({ ...prev, daily_sales_goal: e.target.value.replace(/\D/g, '') }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Días de crédito</label>
                      <input
                        className="input-pos input-pos-compact"
                        type="number"
                        value={siteConfigForm.credit_term_days}
                        onChange={(e) => setSiteConfigForm((prev) => ({ ...prev, credit_term_days: e.target.value.replace(/\D/g, '') }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <POSButton
                variant="success"
                size="md"
                onClick={async () => {
                  const siteId = getSiteIdStored();
                  if (!siteId) return;
                  await api('/admin/site-config', {
                    method: 'PATCH',
                    body: JSON.stringify({
                      site_id: siteId,
                      min_recharge_amount: siteConfigForm.min_recharge_amount,
                      points_per_currency: Number(siteConfigForm.points_per_currency || '1'),
                      currency_unit: Number(siteConfigForm.currency_unit || '1000'),
                      daily_sales_goal: siteConfigForm.daily_sales_goal,
                      credit_term_days: Number(siteConfigForm.credit_term_days || '15'),
                    }),
                  });
                }}
              >
                Guardar Cambios
              </POSButton>
            </div>
          )}

          {/* === CATÁLOGO === */}
          {activeModule === 'catalog' && (
            <div className="space-y-6 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Gestión de Inventario</h1>
                  <p className="text-muted-foreground">Productos, precios, bonos y promociones</p>
                </div>
                <div className="flex gap-2">
                  <POSButton variant="secondary" onClick={exportInventoryExcel}>
                    Exportar Excel
                  </POSButton>
                  <POSButton variant="primary" icon={Plus} onClick={() => openProductModal()}>
                    Nuevo Producto
                  </POSButton>
                </div>
              </div>

              {/* Búsqueda */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    className="input-pos input-pos-compact pl-10"
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <POSButton variant="secondary" size="sm" icon={Filter}>
                  Filtrar
                </POSButton>
              </div>

              {/* Tabs de inventario */}
              <div className="flex gap-2 border-b border-border pb-4">
                {['Productos', 'Bonos', 'Premios', 'Categorías'].map((tab) => (
                  <button
                    key={tab}
                    className="chip-pos"
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tabla de productos */}
              <div className="card-pos">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-secondary/70">
                      <tr>
                        <th className="text-left p-4 font-medium">Producto</th>
                        <th className="text-left p-4 font-medium">Categoría</th>
                        <th className="text-left p-4 font-medium">Tipo reporte</th>
                        <th className="text-left p-4 font-medium">Subcategoría</th>
                        <th className="text-right p-4 font-medium">Precio</th>
                        <th className="text-right p-4 font-medium">Stock</th>
                        <th className="text-center p-4 font-medium">Estado</th>
                        <th className="text-center p-4 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.filter(p =>
                        p.name.toLowerCase().includes(searchTerm.toLowerCase())
                      ).map((product) => (
                        <tr key={product.id} className="border-t border-border hover:bg-secondary/30">
                          <td className="p-4 font-medium">{product.name}</td>
                          <td className="p-4 text-muted-foreground">
                            {categories.find(c => c.id === product.category)?.name ?? product.category}
                          </td>
                          <td className="p-4 text-muted-foreground">{product.analytics_category ?? '-'}</td>
                          <td className="p-4 text-muted-foreground">{product.analytics_subcategory ?? '-'}</td>
                          <td className="p-4 text-right font-mono">{formatCurrency(Number(product.price))}</td>
                          <td className="p-4 text-right">{product.stock ?? '-'}</td>
                          <td className="p-4 text-center">
                            <span className={cn(
                              'badge-pos',
                              product.is_active ?? true ? 'badge-success' : 'badge-info'
                            )}>
                              {product.is_active ?? true ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center gap-2">
                              <button
                                className="btn-pos-secondary btn-pos-sm disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => openInventoryAdjustModal(product)}
                                disabled={!canManageInventoryAdjustments}
                                title={!canManageInventoryAdjustments ? 'Solo supervisor puede registrar ajustes manuales' : undefined}
                              >
                                Ajuste
                              </button>
                              <button className="btn-pos-secondary btn-pos-sm" onClick={() => openProductModal(product)}>
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button
                                className="btn-pos-danger btn-pos-sm"
                                onClick={() => {
                                  setPendingDeleteProduct(product);
                                  setShowDeleteProduct(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Escalas de bonificación */}
              <div className="card-pos p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Percent className="h-6 w-6 text-accent" />
                    <h3 className="font-semibold text-lg">Escalas de Bonificación</h3>
                  </div>
                  <POSButton variant="accent" size="sm" icon={Plus}>
                    Nueva Escala
                  </POSButton>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {bonuses.map((bonus) => (
                    <div key={bonus.id} className="card-pos p-4">
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(Number(bonus.min_amount))} - {formatCurrency(Number(bonus.max_amount ?? bonus.min_amount))}
                      </p>
                      <p className="text-xl font-bold text-accent mt-1">
                        +{formatCurrency(Number(bonus.bonus_amount))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* === TARJETAS === */}
          {activeModule === 'cards' && (
            <div className="space-y-6 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Consulta de Tarjetas</h1>
                  <p className="text-muted-foreground">Escanea o ingresa UID para ver dueño, estado e historial completo</p>
                </div>
              </div>

              <div className="card-pos p-4">
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    className="input-pos flex-1"
                    placeholder="UID de tarjeta"
                    value={cardLookupUid}
                    onChange={(e) => setCardLookupUid(e.target.value.toUpperCase())}
                  />
                  <POSButton variant="secondary" onClick={scanUidFromReader} disabled={cardScanLoading || cardLookupLoading}>
                    {cardScanLoading ? 'Esperando UID...' : 'Escanear lectora'}
                  </POSButton>
                  <POSButton variant="primary" onClick={() => lookupCard()} disabled={cardLookupLoading || !cardLookupUid.trim()}>
                    {cardLookupLoading ? 'Consultando...' : 'Consultar'}
                  </POSButton>
                </div>
                {cardLookupError && <p className="mt-3 text-sm text-red-600">{cardLookupError}</p>}
              </div>

              {cardLookupData?.card && (
                <div className="space-y-4">
                  <div className="card-pos p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">UID</p>
                      <p className="font-semibold">{cardLookupData.card.uid}</p>
                      <p className="text-sm text-muted-foreground">Etiqueta: {cardLookupData.card.label || 'Sin etiqueta'}</p>
                      <p className="text-sm text-muted-foreground">Emitida: {new Date(cardLookupData.card.issued_at).toLocaleString('es-CO')}</p>
                    </div>
                    <div className="space-y-2">
                      <span className={cn('badge-pos', cardStatusBadgeClass[cardLookupData.card.status] ?? 'badge-info')}>
                        {cardStatusLabel[cardLookupData.card.status] ?? cardLookupData.card.status}
                      </span>
                      <p className="text-sm">Saldo: <span className="font-semibold">{formatCurrency(Number(cardLookupData.card.balance ?? 0))}</span></p>
                      <p className="text-sm">Puntos: <span className="font-semibold">{Number(cardLookupData.card.points ?? 0)}</span></p>
                    </div>
                  </div>

                  <div className="card-pos p-5">
                    <h3 className="font-semibold">Propietario</h3>
                    {cardLookupData.card.owner ? (
                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <p>Nombre: <span className="font-medium">{cardLookupData.card.owner.full_name}</span></p>
                        <p>Documento: <span className="font-medium">{cardLookupData.card.owner.document_type} {cardLookupData.card.owner.document_number}</span></p>
                        <p>Teléfono: <span className="font-medium">{cardLookupData.card.owner.phone}</span></p>
                        <p>Email: <span className="font-medium">{cardLookupData.card.owner.email || 'N/D'}</span></p>
                        <p>Ciudad: <span className="font-medium">{cardLookupData.card.owner.city}</span></p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Sin propietario asignado.</p>
                    )}
                  </div>

                  <div className="card-pos p-5">
                    <h3 className="font-semibold">Emisión</h3>
                    {cardLookupData.issued_sale ? (
                      <div className="mt-2 text-sm space-y-1">
                        <p>Fecha: {new Date(cardLookupData.issued_sale.occurred_at).toLocaleString('es-CO')}</p>
                        <p>Producto: {cardLookupData.issued_sale.product?.name || 'Tarjeta física'} ({cardLookupData.issued_sale.product?.sku || 'N/D'})</p>
                        <p>Recibo: {cardLookupData.issued_sale.receipt_number || cardLookupData.issued_sale.sale_id}</p>
                        <p>Cliente: {cardLookupData.issued_sale.customer?.full_name || 'N/D'}</p>
                        <p>Registró: {cardLookupData.issued_sale.created_by || 'N/D'}</p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">No se encontró venta de emisión asociada.</p>
                    )}
                  </div>

                  <div className="card-pos p-5">
                    <h3 className="font-semibold">Recargas</h3>
                    {Array.isArray(cardLookupData.recharges) && cardLookupData.recharges.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {cardLookupData.recharges.map((row: any) => (
                          <div key={`${row.sale_id}-${row.occurred_at}`} className="rounded-xl border border-border/60 p-3 text-sm">
                            <p>{new Date(row.occurred_at).toLocaleString('es-CO')} · {formatCurrency(Number(row.amount || 0))}</p>
                            <p className="text-muted-foreground">Recibo: {row.receipt_number || row.sale_id} · Registró: {row.created_by || 'N/D'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Sin recargas registradas.</p>
                    )}
                  </div>

                  <div className="card-pos p-5">
                    <h3 className="font-semibold">Historial de Estado</h3>
                    {Array.isArray(cardLookupData.status_history) && cardLookupData.status_history.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {cardLookupData.status_history.map((entry: any) => (
                          <div key={entry.id} className="rounded-xl border border-border/60 p-3 text-sm">
                            <p>
                              {new Date(entry.occurred_at).toLocaleString('es-CO')} · {entry.from_status || 'N/A'} {'->'} {entry.to_status}
                            </p>
                            <p className="text-muted-foreground">Motivo: {entry.reason}</p>
                            <p className="text-muted-foreground">Usuario: {entry.changed_by || 'N/D'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Sin cambios de estado registrados.</p>
                    )}
                  </div>

                  <div className="card-pos p-5">
                    <h3 className="font-semibold">Usos de Atracciones/Máquinas</h3>
                    {Array.isArray(cardLookupData.usages) && cardLookupData.usages.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {cardLookupData.usages.map((usage: any) => (
                          <div key={usage.id} className="rounded-xl border border-border/60 p-3 text-sm">
                            <p>{new Date(usage.occurred_at).toLocaleString('es-CO')} · {usage.attraction?.code} · {usage.attraction?.name}</p>
                            <p className="text-muted-foreground">Costo: {formatCurrency(Number(usage.cost || 0))} · Lectora: {usage.reader?.code || 'N/D'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Sin usos registrados.</p>
                    )}
                  </div>

                  <div className="card-pos p-5">
                    <h3 className="font-semibold">Redención de Premios</h3>
                    {Array.isArray(cardLookupData.prize_redemptions) && cardLookupData.prize_redemptions.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {cardLookupData.prize_redemptions.map((redemption: any) => (
                          <div key={redemption.id} className="rounded-xl border border-border/60 p-3 text-sm">
                            <p>{new Date(redemption.occurred_at).toLocaleString('es-CO')} · {redemption.item?.name || 'Premio'} x{redemption.quantity}</p>
                            <p className="text-muted-foreground">Puntos: {redemption.points_total} · Registró: {redemption.performed_by || 'N/D'}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Sin redenciones registradas.</p>
                    )}
                  </div>

                  <div className="card-pos p-5">
                    <h3 className="font-semibold">Movimientos de Saldo y Puntos</h3>
                    {Array.isArray(cardLookupData.balance_events) && cardLookupData.balance_events.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {cardLookupData.balance_events.map((event: any) => (
                          <div key={event.id} className="rounded-xl border border-border/60 p-3 text-sm">
                            <p>{new Date(event.occurred_at).toLocaleString('es-CO')} · {event.reason}</p>
                            <p className="text-muted-foreground">
                              Saldo: {formatCurrency(Number(event.money_delta || 0))} · Puntos: {Number(event.points_delta || 0)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Sin movimientos de saldo/puntos.</p>
                    )}
                  </div>

                  <div className="card-pos p-5">
                    <h3 className="font-semibold">Logs de Lectora</h3>
                    {Array.isArray(cardLookupData.device_logs) && cardLookupData.device_logs.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {cardLookupData.device_logs.map((log: any) => (
                          <div key={log.id} className="rounded-xl border border-border/60 p-3 text-sm">
                            <p>{new Date(log.created_at).toLocaleString('es-CO')} · {log.event_type}</p>
                            <p className="text-muted-foreground">
                              Lectora: {log.reader?.code || 'N/D'} · Estado: {log.allowed === null ? 'N/A' : log.allowed ? 'OK' : 'DENEGADO'}
                            </p>
                            {log.reason && <p className="text-muted-foreground">Motivo: {log.reason}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Sin logs de lectora para esta tarjeta.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* === PROMOCIONES === */}
          {activeModule === 'promotions' && (
            <div className="space-y-6 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Motor de Promociones</h1>
                  <p className="text-muted-foreground">Reglas activas por alcance y tipo</p>
                </div>
                <div className="flex gap-2">
                  <POSButton variant="secondary" size="sm" onClick={seedDefaultPromotions}>
                    Cargar PROM/RECA base
                  </POSButton>
                  <POSButton variant="primary" size="sm" icon={Plus} onClick={() => openPromotionModal()}>
                    Nueva Promoción
                  </POSButton>
                </div>
              </div>

              <div className="card-pos p-6 space-y-4">
                <div className="space-y-2">
                  {promotions.length === 0 && (
                    <p className="text-sm text-muted-foreground">No hay promociones configuradas.</p>
                  )}
                  {promotions.map((promotion) => (
                    <div key={promotion.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
                      <div>
                        <p className="font-medium">{promotion.code} · {promotion.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {promotion.scope} · {promotion.type} · {promotion.is_active ? 'Activa' : 'Inactiva'}
                        </p>
                        {promotion.fixed_value && (
                          <p className="text-xs text-muted-foreground">
                            Adicional: {formatCurrency(Number(promotion.fixed_value))}
                          </p>
                        )}
                        {Array.isArray(promotion.exact_values) && promotion.exact_values.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Valores exactos: {promotion.exact_values.join(', ')}
                          </p>
                        )}
                      </div>
                      <button className="btn-pos-secondary btn-pos-sm" onClick={() => openPromotionModal(promotion)}>
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* === USUARIOS === */}
          {activeModule === 'users' && (
            <div className="space-y-6 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
                  <p className="text-muted-foreground">Administra usuarios y roles</p>
                </div>
                <POSButton variant="primary" icon={Plus} onClick={() => openUserModal()}>
                  Nuevo Usuario
                </POSButton>
              </div>

              <div className="card-pos">
                <table className="w-full">
                  <thead className="bg-secondary/70">
                    <tr>
                      <th className="text-left p-4 font-medium">Usuario</th>
                      <th className="text-left p-4 font-medium">Email</th>
                      <th className="text-left p-4 font-medium">Rol</th>
                      <th className="text-center p-4 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-t border-border hover:bg-secondary/30">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                              {user.name.charAt(0)}
                            </div>
                            <span className="font-medium">{user.name}</span>
                          </div>
                        </td>
                        <td className="p-4 text-muted-foreground">{user.email}</td>
                        <td className="p-4">
                          <span className={cn(
                            'badge-pos',
                            user.role === 'admin' && 'badge-accent',
                            user.role === 'supervisor' && 'badge-warning',
                            user.role === 'cashier' && 'badge-info'
                          )}>
                            {user.role === 'admin' && 'Administrador'}
                            {user.role === 'supervisor' && 'Supervisor'}
                            {user.role === 'cashier' && 'Cajero'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            <button className="btn-pos-secondary btn-pos-sm" onClick={() => openUserModal(user)}>
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button className="btn-pos-danger btn-pos-sm" onClick={() => { setPendingDeleteUser(user); setShowDeleteUser(true); }}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* === ESTACIONES === */}
          {activeModule === 'stations' && (
            <div className="space-y-6 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Estaciones y Lectoras</h1>
                  <p className="text-muted-foreground">Configuración de máquinas por ubicación</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Auto refresh: 5s</span>
                  <POSButton variant="primary" size="sm" icon={Plus} onClick={() => openStationModal()}>
                    Nueva máquina
                  </POSButton>
                  <POSButton
                    variant="secondary"
                    size="sm"
                    icon={Play}
                    onClick={() => {
                      setSimulatorResponse(null);
                      setSimulatorUid('');
                      setSimulatorMachineId(stations[0]?.id ?? '');
                      setSimulatorReaderId('');
                      setShowSimulatorModal(true);
                    }}
                  >
                    Simular uso
                  </POSButton>
                </div>
              </div>

              <div className="card-pos">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-secondary/70">
                      <tr>
                        <th className="text-left p-4 font-medium">Máquina</th>
                        <th className="text-left p-4 font-medium">Estado</th>
                        <th className="text-right p-4 font-medium">Precio</th>
                        <th className="text-left p-4 font-medium">Tipo</th>
                        <th className="text-left p-4 font-medium">Ubicación</th>
                        <th className="text-left p-4 font-medium">Lector asociado</th>
                        <th className="text-left p-4 font-medium">Último uso</th>
                        <th className="text-right p-4 font-medium">Usos hoy</th>
                        <th className="text-right p-4 font-medium">Ingresos hoy</th>
                        <th className="text-center p-4 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stations.map((station) => (
                        <tr key={station.id} className="border-t border-border hover:bg-secondary/30">
                          <td className="p-4">
                            <p className="font-medium">{station.name}</p>
                            <p className="text-xs text-muted-foreground">{station.code}</p>
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              'badge-pos',
                              station.status === 'ACTIVE' && 'badge-success',
                              station.status === 'INACTIVE' && 'badge-info',
                              station.status === 'MAINTENANCE' && 'badge-warning',
                            )}>
                              {station.status === 'ACTIVE' && 'Activa'}
                              {station.status === 'INACTIVE' && 'Inactiva'}
                              {station.status === 'MAINTENANCE' && 'Mantenimiento'}
                            </span>
                          </td>
                          <td className="p-4 text-right">{formatCurrency(Number(station.price ?? 0))}</td>
                          <td className="p-4">{station.type ?? '-'}</td>
                          <td className="p-4">{station.location ?? '-'}</td>
                          <td className="p-4">{station.reader_assigned?.code ?? 'Sin asignar'}</td>
                          <td className="p-4">
                            {station.last_use_at ? new Date(station.last_use_at).toLocaleString('es-CO') : 'Sin uso hoy'}
                          </td>
                          <td className="p-4 text-right">{station.total_uses_today ?? 0}</td>
                          <td className="p-4 text-right">{formatCurrency(Number(station.total_revenue_today ?? 0))}</td>
                          <td className="p-4">
                            <div className="flex justify-center gap-2">
                              <button className="btn-pos-secondary btn-pos-sm" onClick={() => openStationModal(station)}>
                                <Edit3 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card-pos p-4 space-y-3">
                {stations.length === 0 && (
                  <p className="text-sm text-muted-foreground">No hay estaciones registradas.</p>
                )}
                {stations.map((station) => (
                  <div key={station.id} className="rounded-xl border border-border/50 bg-secondary/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{station.code} · {station.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {station.machine_type ?? 'Sin tipo'} · {station.location ?? 'Sin ubicación'}
                        </p>
                      </div>
                      <span className={cn(
                        'badge-pos',
                        station.status === 'ACTIVE' && 'badge-success',
                        station.status === 'MAINTENANCE' && 'badge-warning',
                        station.status === 'INACTIVE' && 'badge-info',
                      )}>
                        {station.status === 'ACTIVE' && 'Activa'}
                        {station.status === 'MAINTENANCE' && 'Mantenimiento'}
                        {station.status === 'INACTIVE' && 'Inactiva'}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">
                      <p>Precio por uso: {formatCurrency(Number(station.price ?? 0))}</p>
                      <p>Puntos por uso: {Number(station.points_reward ?? 0)}</p>
                      <p>Duración: {station.duration ?? 0} min</p>
                      <p>Último uso: {station.last_use_at ? new Date(station.last_use_at).toLocaleString('es-CO') : 'Sin uso hoy'}</p>
                      <p>Usos hoy: {station.total_uses_today ?? 0}</p>
                      <p>Ingresos hoy: {formatCurrency(Number(station.total_revenue_today ?? 0))}</p>
                      <p>Lectoras asignadas: {Array.isArray(station.assigned_readers) ? station.assigned_readers.length : 0}</p>
                      <p>
                        {Array.isArray(station.assigned_readers) && station.assigned_readers.length > 0
                          ? `Códigos: ${station.assigned_readers.map((reader: any) => reader.code).join(', ')}`
                          : 'Sin lectoras asignadas'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={() => {
          clearAuthUser();
          setShowExitConfirm(false);
          navigate('/login');
        }}
        title="Salir de sesión"
        message="¿Deseas cerrar la sesión actual?"
        confirmText="Salir"
        variant="danger"
      />

      <POSModal
        isOpen={showUserModal}
        onClose={() => setShowUserModal(false)}
        title={editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
        size="md"
      >
        <div className="space-y-3">
          <input
            className="input-pos"
            placeholder="Nombre completo"
            value={userForm.name}
            onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="input-pos"
            placeholder="Email"
            value={userForm.email}
            onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <select
            className="input-pos"
            value={userForm.role}
            onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
          >
            <option value="cashier">Cajero</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Administrador</option>
          </select>
          <input
            className="input-pos"
            placeholder="PIN 6 dígitos"
            value={userForm.pin}
            onChange={(e) => setUserForm((prev) => ({ ...prev, pin: e.target.value }))}
          />
          <POSButton variant="success" fullWidth onClick={saveUser}>
            Guardar Usuario
          </POSButton>
        </div>
      </POSModal>

      <ConfirmModal
        isOpen={showDeleteUser}
        onClose={() => setShowDeleteUser(false)}
        onConfirm={async () => {
          const siteId = getSiteIdStored();
          if (!siteId || !pendingDeleteUser) return;
          await api(`/admin/users/${pendingDeleteUser.id}`, {
            method: 'DELETE',
            body: JSON.stringify({ site_id: siteId }),
          });
          const list = await api<any[]>(`/admin/users?site_id=${siteId}`);
          setUsers(list);
          setShowDeleteUser(false);
          setPendingDeleteUser(null);
        }}
        title="Eliminar Usuario"
        message="¿Deseas desactivar este usuario?"
        confirmText="Eliminar"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showDeleteProduct}
        onClose={() => setShowDeleteProduct(false)}
        onConfirm={async () => {
          const siteId = getSiteIdStored();
          if (!siteId || !pendingDeleteProduct) return;
          await api(`/admin/products/${pendingDeleteProduct.id}`, {
            method: 'DELETE',
            body: JSON.stringify({ site_id: siteId }),
          });
          await refreshProductsAndInventory();
          setShowDeleteProduct(false);
          setPendingDeleteProduct(null);
        }}
        title="Eliminar Producto"
        message="Se desactivará el producto sin borrar historial. ¿Deseas continuar?"
        confirmText="Eliminar"
        variant="danger"
      />

      <POSModal
        isOpen={showInventoryAdjustModal}
        onClose={() => setShowInventoryAdjustModal(false)}
        title={`Ajuste de inventario · ${inventoryAdjustProduct?.name ?? ''}`}
        size="md"
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-3 text-sm">
            <p>SKU: {inventoryAdjustProduct?.sku ?? 'N/D'}</p>
            <p>Stock actual: {inventoryAdjustProduct?.stock ?? 0}</p>
            {!selectedAdjustInventoryItem && (
              <p className="text-red-600">Este producto no tiene ítem de inventario asociado.</p>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Motivo (obligatorio)</p>
            <Select
              value={inventoryAdjustForm.reason}
              onValueChange={(value) =>
                setInventoryAdjustForm((prev) => ({ ...prev, reason: value as InventoryReason }))
              }
            >
              <SelectTrigger className="input-pos">
                <SelectValue placeholder="Selecciona motivo" />
              </SelectTrigger>
              <SelectContent>
                {INVENTORY_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {inventoryAdjustForm.reason === 'TRASLADO' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Dirección del traslado</p>
              <Select
                value={inventoryAdjustForm.transfer_direction}
                onValueChange={(value) =>
                  setInventoryAdjustForm((prev) => ({ ...prev, transfer_direction: value as 'OUT' | 'IN' }))
                }
              >
                <SelectTrigger className="input-pos">
                  <SelectValue placeholder="Selecciona dirección" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OUT">Salida</SelectItem>
                  <SelectItem value="IN">Entrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <input
            className="input-pos"
            placeholder="Cantidad"
            value={inventoryAdjustForm.quantity}
            onChange={(e) =>
              setInventoryAdjustForm((prev) => ({ ...prev, quantity: e.target.value.replace(/\D/g, '') }))
            }
          />
          <textarea
            className="input-pos min-h-[92px]"
            placeholder="Observaciones (obligatorio para inconsistencias)"
            value={inventoryAdjustForm.observations}
            onChange={(e) =>
              setInventoryAdjustForm((prev) => ({ ...prev, observations: e.target.value }))
            }
          />
          <POSButton
            variant="success"
            fullWidth
            onClick={submitInventoryAdjustment}
            disabled={
              !selectedAdjustInventoryItem ||
              !inventoryAdjustForm.reason ||
              !inventoryAdjustForm.quantity ||
              (inventoryAdjustForm.reason !== 'NUEVA_COMPRA' && !inventoryAdjustForm.observations.trim()) ||
              Number(inventoryAdjustForm.quantity) <= 0
            }
          >
            Registrar ajuste
          </POSButton>
        </div>
      </POSModal>

      <POSModal
        isOpen={showSimulatorModal}
        onClose={() => setShowSimulatorModal(false)}
        title="Simulador de uso"
        size="md"
      >
        <div className="space-y-3">
          <select
            className="input-pos"
            value={simulatorMachineId}
            onChange={(e) => {
              setSimulatorMachineId(e.target.value);
              setSimulatorReaderId('');
            }}
          >
            <option value="">Selecciona máquina</option>
            {stations.map((station) => (
              <option key={station.id} value={station.id}>
                {station.name} ({station.code})
              </option>
            ))}
          </select>
          <select
            className="input-pos"
            value={simulatorReaderId}
            onChange={(e) => setSimulatorReaderId(e.target.value)}
            disabled={!selectedSimulatorStation}
          >
            <option value="">Lector por defecto de máquina</option>
            {(selectedSimulatorStation?.assigned_readers ?? []).map((reader: any) => (
              <option key={reader.id} value={reader.id}>
                {reader.code} (Pos {reader.position})
              </option>
            ))}
          </select>
          <input
            className="input-pos"
            placeholder="UID manual"
            value={simulatorUid}
            onChange={(e) => setSimulatorUid(e.target.value.toUpperCase())}
          />
          <POSButton
            variant="success"
            fullWidth
            onClick={executeSimulator}
            disabled={!simulatorMachineId || !simulatorUid || simulatorLoading}
          >
            {simulatorLoading ? 'Ejecutando...' : 'Ejecutar validación'}
          </POSButton>
          {simulatorResponse && (
            <pre className="rounded-xl border border-border/60 bg-secondary/30 p-3 text-xs overflow-x-auto">
              {JSON.stringify(simulatorResponse, null, 2)}
            </pre>
          )}
        </div>
      </POSModal>

      <POSModal
        isOpen={showStationModal}
        onClose={() => setShowStationModal(false)}
        title={editingStation ? `Editar máquina · ${editingStation.name}` : 'Nueva máquina'}
        size="md"
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
            <p className="text-xs text-muted-foreground">Clasificación operacional</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <span className="badge-pos badge-info">Categoría: {stationCategory}</span>
              <span className="badge-pos badge-accent">Subcategoría: {stationSubcategory}</span>
              <span className="badge-pos badge-warning">Tipo operación: {stationOperationLabel}</span>
            </div>
          </div>
          <input
            className="input-pos"
            placeholder="Nombre de máquina"
            value={stationForm.name}
            onChange={(e) => setStationForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="input-pos"
            placeholder="Precio"
            value={stationForm.price}
            onChange={(e) => setStationForm((prev) => ({ ...prev, price: e.target.value.replace(/[^\d.]/g, '') }))}
          />
          <input
            className="input-pos"
            placeholder={stationForm.type === 'TIME' ? 'Duración (min)' : 'Duración no aplica para habilidad'}
            value={stationForm.duration}
            onChange={(e) => setStationForm((prev) => ({ ...prev, duration: e.target.value.replace(/\D/g, '') }))}
            disabled={stationForm.type !== 'TIME'}
          />
          <input
            className="input-pos"
            placeholder="Puntos por uso"
            value={stationForm.points_reward}
            onChange={(e) => setStationForm((prev) => ({ ...prev, points_reward: e.target.value.replace(/\D/g, '') }))}
          />
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Tipo de operación</p>
            <Select
              value={stationForm.type}
              onValueChange={(value) =>
                setStationForm((prev) => ({
                  ...prev,
                  type: value as StationType,
                  duration: value === 'TIME' ? prev.duration : '0',
                }))
              }
            >
              <SelectTrigger className="input-pos">
                <SelectValue placeholder="Selecciona tipo de operación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SKILL">Habilidad (Máquina)</SelectItem>
                <SelectItem value="TIME">Tiempo (Atracción)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Estado operativo</p>
            <Select
              value={stationForm.status}
              onValueChange={(value) => setStationForm((prev) => ({ ...prev, status: value as StationStatus }))}
            >
              <SelectTrigger className="input-pos">
                <SelectValue placeholder="Selecciona estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Activa</SelectItem>
                <SelectItem value="INACTIVE">Inactiva</SelectItem>
                <SelectItem value="MAINTENANCE">En mantenimiento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <input
            className="input-pos"
            placeholder="Ubicación"
            value={stationForm.location}
            onChange={(e) => setStationForm((prev) => ({ ...prev, location: e.target.value }))}
          />
          {editingStation && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Lectora principal</p>
              <Select
                value={stationForm.reader_id || '__none__'}
                onValueChange={(value) =>
                  setStationForm((prev) => ({ ...prev, reader_id: value === '__none__' ? '' : value }))
                }
              >
                <SelectTrigger className="input-pos">
                  <SelectValue placeholder="Selecciona lectora principal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin lector asignado</SelectItem>
                  {(editingStation.assigned_readers ?? []).map((reader: any) => (
                    <SelectItem key={reader.id} value={reader.id}>
                      {reader.code} (Slot {reader.position})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {editingStation && Array.isArray(editingStation.assigned_readers) && editingStation.assigned_readers.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
              <p className="text-sm font-medium">Slots de lectora</p>
              <div className="mt-2 space-y-2 text-sm">
                {editingStation.assigned_readers.map((reader: any) => (
                  <div key={reader.id} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
                    <span>{reader.code} · Slot {reader.position}</span>
                    <span className="text-muted-foreground">{stationCategory} / {stationSubcategory}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stationForm.type !== 'TIME' && (
            <p className="text-xs text-muted-foreground">
              En tipo Habilidad la duración no se configura porque varía según desempeño del jugador.
            </p>
          )}
          <POSButton variant="success" fullWidth onClick={saveStation}>
            {editingStation ? 'Guardar máquina' : 'Crear máquina'}
          </POSButton>
        </div>
      </POSModal>

      <POSModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
        size="md"
      >
        <div className="space-y-3">
          <input
            className="input-pos"
            placeholder="Nombre"
            value={productForm.name}
            onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
          />
          <input
            className="input-pos"
            placeholder="Precio"
            value={productForm.price}
            onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))}
          />
          {editingProduct ? (
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-3 text-sm text-muted-foreground">
              Stock actual: {editingProduct.stock ?? 0}. Los ajustes manuales se registran desde movimientos de inventario con rol supervisor.
            </div>
          ) : (
            <input
              className="input-pos"
              placeholder="Stock disponible"
              value={productForm.stock_available}
              onChange={(e) => setProductForm((prev) => ({ ...prev, stock_available: e.target.value.replace(/\D/g, '') }))}
            />
          )}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Categoría</p>
            <Select
              value={productForm.analytics_category || '__none__'}
              onValueChange={(value) =>
                setProductForm((prev) => ({
                  ...prev,
                  analytics_category: value === '__none__' ? '' : value,
                  analytics_subcategory: value === '__none__' ? '' : prev.analytics_subcategory,
                }))
              }
            >
              <SelectTrigger className="input-pos">
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin categoría</SelectItem>
                {catalogCategories.map((category) => (
                  <SelectItem key={category.id} value={category.nombre}>
                    {category.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <input
                className="input-pos"
                placeholder="Nueva categoría"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <POSButton
                variant="secondary"
                size="sm"
                onClick={createCategoryFromModal}
                disabled={!newCategoryName.trim()}
              >
                Crear
              </POSButton>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Subcategoría</p>
            <Select
              value={productForm.analytics_subcategory || '__none__'}
              onValueChange={(value) =>
                setProductForm((prev) => ({
                  ...prev,
                  analytics_subcategory: value === '__none__' ? '' : value,
                }))
              }
              disabled={!productForm.analytics_category}
            >
              <SelectTrigger className="input-pos">
                <SelectValue placeholder="Selecciona subcategoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin subcategoría</SelectItem>
                {availableCatalogSubcategories.map((subcategory) => (
                  <SelectItem key={subcategory.id} value={subcategory.nombre}>
                    {subcategory.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <input
                className="input-pos"
                placeholder="Nueva subcategoría"
                value={newSubcategoryName}
                onChange={(e) => setNewSubcategoryName(e.target.value)}
                disabled={!selectedCatalogCategory}
              />
              <POSButton
                variant="secondary"
                size="sm"
                onClick={createSubcategoryFromModal}
                disabled={!selectedCatalogCategory || !newSubcategoryName.trim()}
              >
                Crear
              </POSButton>
            </div>
          </div>
          {!editingProduct && (
            <p className="text-xs text-muted-foreground">
              El código se genera automáticamente según grupo y subgrupo.
            </p>
          )}
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-border"
              checked={productForm.is_active}
              onChange={(e) => setProductForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            <span>Activo en inventario</span>
          </label>
          <POSButton
            variant="success"
            fullWidth
            onClick={saveProduct}
            disabled={!productForm.analytics_category || !productForm.analytics_subcategory}
          >
            {editingProduct ? 'Guardar Cambios' : 'Crear Producto'}
          </POSButton>
        </div>
      </POSModal>

      <POSModal
        isOpen={showPromotionModal}
        onClose={() => setShowPromotionModal(false)}
        title={editingPromotion ? 'Editar Promoción' : 'Nueva Promoción'}
        size="full"
        overlayClassName="items-start px-3 py-3"
        contentClassName="max-w-[98vw] w-[98vw]"
        bodyClassName="max-h-[84vh] overflow-hidden"
      >
        <div className="grid h-full grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="space-y-3 overflow-y-auto xl:col-span-4 pr-1">
            <div className="card-pos p-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Identificación</p>
              <input
                className="input-pos"
                placeholder="Código (ej. PROM-001 / RECA-001)"
                value={promotionForm.code}
                onChange={(e) => setPromotionForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                disabled={Boolean(editingPromotion)}
              />
              <input
                className="input-pos"
                placeholder="Nombre comercial"
                value={promotionForm.name}
                onChange={(e) => setPromotionForm((prev) => ({ ...prev, name: e.target.value }))}
              />
              <input
                className="input-pos"
                placeholder="Descripción"
                value={promotionForm.description}
                onChange={(e) => setPromotionForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="card-pos p-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tipo de regla</p>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={promotionForm.scope}
                  onValueChange={(value) => setPromotionForm((prev) => ({ ...prev, scope: value }))}
                >
                  <SelectTrigger className="input-pos">
                    <SelectValue placeholder="Alcance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECHARGE">Recarga</SelectItem>
                    <SelectItem value="SALE">Venta</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={promotionForm.type}
                  onValueChange={(value) => setPromotionForm((prev) => ({ ...prev, type: value }))}
                >
                  <SelectTrigger className="input-pos">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECHARGE_ADDITIONAL">Recarga adicional</SelectItem>
                    <SelectItem value="PERCENT_DISCOUNT">% descuento</SelectItem>
                    <SelectItem value="COMBO">Combo</SelectItem>
                    <SelectItem value="BONUS">Bonificación</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input-pos"
                  placeholder="% descuento"
                  value={promotionForm.percent_value}
                  onChange={(e) => setPromotionForm((prev) => ({ ...prev, percent_value: e.target.value.replace(/[^\d.]/g, '') }))}
                />
                <input
                  className="input-pos"
                  placeholder="Valor fijo"
                  value={promotionForm.fixed_value}
                  onChange={(e) => setPromotionForm((prev) => ({ ...prev, fixed_value: e.target.value.replace(/[^\d.]/g, '') }))}
                />
              </div>
              <input
                className="input-pos"
                placeholder="Valores exactos (coma): 50000,70000"
                value={promotionForm.exact_values}
                onChange={(e) => setPromotionForm((prev) => ({ ...prev, exact_values: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto xl:col-span-5 pr-1">
            <div className="card-pos p-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Programación</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={cn('chip-pos h-10 justify-center', promotionScheduleMode === 'recurring' && 'chip-pos-active')}
                  onClick={() => {
                    setPromotionScheduleMode('recurring');
                    setPromotionSpecificDate(undefined);
                    setPromotionForm((prev) => ({ ...prev, starts_at: '', ends_at: '' }));
                  }}
                >
                  Recurrente
                </button>
                <button
                  type="button"
                  className={cn('chip-pos h-10 justify-center', promotionScheduleMode === 'specific_date' && 'chip-pos-active')}
                  onClick={() => {
                    setPromotionScheduleMode('specific_date');
                    setPromotionForm((prev) => ({ ...prev, day_restrictions: '' }));
                  }}
                >
                  Fecha especial
                </button>
              </div>

              {promotionScheduleMode === 'recurring' && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Días aplicables</p>
                  <div className="grid grid-cols-7 gap-2">
                    {WEEK_DAYS.map((day) => {
                      const selected = selectedPromotionWeekDays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          className={cn('chip-pos h-11 justify-center', selected && 'chip-pos-active')}
                          onClick={() => togglePromotionWeekday(day.value)}
                          title={day.label}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    className="input-pos"
                    placeholder="Días permitidos 0-6 (opcional manual)"
                    value={promotionForm.day_restrictions}
                    onChange={(e) => setPromotionForm((prev) => ({ ...prev, day_restrictions: e.target.value }))}
                  />
                </div>
              )}

              {promotionScheduleMode === 'specific_date' && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Selecciona fecha especial</p>
                  <div className="rounded-xl border border-border/60 bg-secondary/20 p-2">
                    <Calendar
                      mode="single"
                      selected={promotionSpecificDate}
                      onSelect={applyPromotionSpecificDate}
                      className="rounded-md"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="input-pos"
                      type="datetime-local"
                      value={promotionForm.starts_at}
                      onChange={(e) => setPromotionForm((prev) => ({ ...prev, starts_at: e.target.value }))}
                    />
                    <input
                      className="input-pos"
                      type="datetime-local"
                      value={promotionForm.ends_at}
                      onChange={(e) => setPromotionForm((prev) => ({ ...prev, ends_at: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto xl:col-span-3 pr-1">
            <div className="card-pos p-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Reglas y exclusiones</p>
              <input
                className="input-pos"
                placeholder="Aplica a códigos (coma) ej: ARCADE-01,VR-01"
                value={promotionForm.product_restrictions}
                onChange={(e) => setPromotionForm((prev) => ({ ...prev, product_restrictions: e.target.value.toUpperCase() }))}
              />
              <input
                className="input-pos"
                placeholder="Exclusiones (coma) ej: JUEGOS_DE_SALON, TYPE:SKILL"
                value={promotionForm.exceptions}
                onChange={(e) => setPromotionForm((prev) => ({ ...prev, exceptions: e.target.value.toUpperCase() }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input-pos"
                  placeholder="Prioridad"
                  value={promotionForm.priority}
                  onChange={(e) => setPromotionForm((prev) => ({ ...prev, priority: e.target.value.replace(/\D/g, '') }))}
                />
                <label className="flex items-center gap-3 rounded-xl border border-border/60 px-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-border"
                    checked={promotionForm.is_active}
                    onChange={(e) => setPromotionForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <span>Activa</span>
                </label>
              </div>
              <POSButton variant="success" fullWidth onClick={savePromotion}>
                {editingPromotion ? 'Guardar Promoción' : 'Crear Promoción'}
              </POSButton>
            </div>
          </div>
        </div>
      </POSModal>

      <POSModal
        isOpen={showDevLogs}
        onClose={() => setShowDevLogs(false)}
        title="DEV • Logs ESP"
        size="xl"
      >
        <div className="space-y-3">
          {espLogs.length === 0 && (
            <div className="text-sm text-muted-foreground">No hay logs disponibles.</div>
          )}
          {espLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/40 px-4 py-3">
              <div>
                <p className="font-medium">{log.event_type} • {log.reader_code}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString('es-CO')} • Req {log.request_id}
                </p>
                {log.reason && (
                  <p className="text-xs text-muted-foreground">Motivo: {log.reason}</p>
                )}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>Pts: {log.points_before ?? 0} → {log.points_after ?? 0}</p>
                <p>Crédito: {log.credit_before ?? '0.00'} → {log.credit_after ?? '0.00'}</p>
                <p>{log.allowed === null ? '' : log.allowed ? 'OK' : 'DENEGADO'}</p>
              </div>
            </div>
          ))}
        </div>
      </POSModal>
    </POSLayout>
  );
}
