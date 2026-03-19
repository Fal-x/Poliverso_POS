import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { POSLayout } from '@/layouts/POSLayout';
import { POSButton } from '@/components/ui/POSButton';
import { POSModal, ConfirmModal, ErrorModal, SyncModal } from '@/components/ui/POSModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NumPad } from '@/components/ui/NumPad';
import { AnimatePresence, motion } from 'framer-motion';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { 
  CreditCard, 
  RefreshCw, 
  Eye, 
  Trash2, 
  ShoppingCart,
  Plus,
  Minus,
  DollarSign,
  Wallet,
  Smartphone,
  CreditCard as CardIcon,
  QrCode,
  Power,
  PowerOff,
  Printer,
  Gift,
  ShieldCheck,
  Clock,
  Search,
  ArrowRightLeft
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { SaleItem, PaymentMethod, Card } from '@/types/pos.types';
import { api, apiFile } from '@/api/client';
import { cn } from '@/lib/utils';
import { clearAuthUser, getAuthUser, getCashState, isCashOpen, setCashOpen, setCashState, clearCashState, getSiteIdStored } from '@/lib/auth';
import { buildViewOptions } from '@/lib/view-options';

// Item del carrito
interface CartItem extends SaleItem {
  productId: string;
}

type RechargeFlowMode = 'recharge_only' | 'issue_and_recharge';
type ProductSortBy = 'default' | 'best_sellers' | 'worst_sellers' | 'price_desc' | 'price_asc';
type ProductCategoryTheme = { card: string; categoryText: string; priceText: string };
type CheckoutStep = 'payment' | 'cash_tender' | 'invoice';
type CheckoutEvent = 'GO_PAYMENT' | 'GO_CASH_TENDER' | 'GO_INVOICE' | 'PAYMENT_CHANGED';
type CardReadOptions = { openRecharge?: boolean; createIfMissing?: boolean; flowMode?: RechargeFlowMode };
type PrizeCatalogItem = { id: string; name: string; sku: string | null; points_cost: number; stock: number };
type PendingIssuedCard = { key: string; productId: string; productName: string; sequence: number; uid: string };
type CardActivitySummary = {
  card: Card;
  summary: {
    recharges_count: number;
    uses_count: number;
    redemptions_count: number;
    last_activity_at: string | null;
  };
  recharges: Array<{
    sale_id: string;
    occurred_at: string;
    receipt_number: string | null;
    sale_status: string;
    amount: string;
    payments: Array<{ method: string; amount: string }>;
    created_by: string;
  }>;
  usages: Array<{
    id: string;
    type: string;
    cost: string;
    occurred_at: string;
    attraction: { id: string; code: string; name: string; type: string; location: string | null };
    reader: { id: string; code: string; position: number };
    performed_by: string | null;
  }>;
  prize_redemptions: Array<{
    id: string;
    occurred_at: string;
    quantity: number;
    points_total: number;
    item: { id: string; name: string; sku: string | null };
    performed_by: string;
  }>;
  balance_events: Array<{
    id: string;
    occurred_at: string;
    money_delta: string;
    points_delta: number;
    reason: string;
  }>;
};
type CashierDaySummary = {
  sales_today: string;
  daily_goal: string;
  goal_pct: number;
  cash_outflows: string;
  cash_balance_expected: string;
  transactions_count: number;
};
type RecentSale = {
  id: string;
  created_at: string;
  subtotal?: string;
  total: string;
  status?: string;
  payment_method: string | null;
  receipt_number?: string | null;
  requires_invoice?: boolean;
  created_by?: {
    id: string;
    full_name: string;
  } | null;
  customer?: {
    id: string;
    document_type: string;
    document_number: string;
    full_name: string;
    phone: string;
    email?: string | null;
    city: string;
    address?: string;
    person_type?: string;
  } | null;
  items: Array<{ id?: string; product_id: string | null; product_name: string; quantity: number; unit_price: string; total?: string; category?: string }>;
};

type SalesHistoryResponse = {
  items: RecentSale[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type KnownCustomerProfile = {
  id: string;
  document_type: string;
  document_number: string;
  full_name: string;
  phone: string;
  email?: string | null;
  city: string;
  address?: string;
  person_type?: string;
};

type CheckoutAuditSnapshot = {
  item_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
};

const PRODUCT_CATEGORY_THEMES: ProductCategoryTheme[] = [
  { card: 'border-sky-500/35 bg-sky-500/10 hover:bg-sky-500/15', categoryText: 'text-sky-700 dark:text-sky-300', priceText: 'text-sky-700 dark:text-sky-200' },
  { card: 'border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/15', categoryText: 'text-emerald-700 dark:text-emerald-300', priceText: 'text-emerald-700 dark:text-emerald-200' },
  { card: 'border-violet-500/35 bg-violet-500/10 hover:bg-violet-500/15', categoryText: 'text-violet-700 dark:text-violet-300', priceText: 'text-violet-700 dark:text-violet-200' },
  { card: 'border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/15', categoryText: 'text-amber-700 dark:text-amber-300', priceText: 'text-amber-700 dark:text-amber-200' },
  { card: 'border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/15', categoryText: 'text-rose-700 dark:text-rose-300', priceText: 'text-rose-700 dark:text-rose-200' },
  { card: 'border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/15', categoryText: 'text-cyan-700 dark:text-cyan-300', priceText: 'text-cyan-700 dark:text-cyan-200' },
  { card: 'border-fuchsia-500/35 bg-fuchsia-500/10 hover:bg-fuchsia-500/15', categoryText: 'text-fuchsia-700 dark:text-fuchsia-300', priceText: 'text-fuchsia-700 dark:text-fuchsia-200' },
  { card: 'border-orange-500/35 bg-orange-500/10 hover:bg-orange-500/15', categoryText: 'text-orange-700 dark:text-orange-300', priceText: 'text-orange-700 dark:text-orange-200' },
];

const getProductCategoryTheme = (categoryKey: string) => {
  let hash = 0;
  for (let i = 0; i < categoryKey.length; i += 1) {
    hash = (hash * 31 + categoryKey.charCodeAt(i)) >>> 0;
  }
  return PRODUCT_CATEGORY_THEMES[hash % PRODUCT_CATEGORY_THEMES.length];
};

const toDateInputValue = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function transitionCheckoutStep(
  current: CheckoutStep,
  event: CheckoutEvent,
  context: { selectedPayment: PaymentMethod; requiresInvoice: boolean; canProvideChange: boolean }
): CheckoutStep {
  const isCash = context.selectedPayment === 'cash';

  switch (event) {
    case 'GO_PAYMENT':
      return 'payment';
    case 'GO_CASH_TENDER':
      return isCash ? 'cash_tender' : 'payment';
    case 'GO_INVOICE':
      if (!context.requiresInvoice) return 'payment';
      if (isCash && !context.canProvideChange) return 'cash_tender';
      return 'invoice';
    case 'PAYMENT_CHANGED':
      if (!isCash && current === 'cash_tender') return 'payment';
      if (!context.requiresInvoice && current === 'invoice') return 'payment';
      return current;
    default:
      return current;
  }
}

export default function CashierDashboard() {
  const navigate = useNavigate();
  const authUser = getAuthUser();
  const todayDate = toDateInputValue(new Date());
  const isCashierRole = authUser?.role === 'cashier';
  const isSupervisorView = authUser?.role === 'supervisor' || authUser?.role === 'admin';
  const sanitizeTextInput = (value: string, maxLength = 120) => value.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').slice(0, maxLength);
  const sanitizeNumericInput = (value: string, maxLength = 10) => value.replace(/\D/g, '').slice(0, maxLength);
  const sanitizeCountInput = (value: string) => value.replace(/\D/g, '').slice(0, 4);
  const sanitizeEmailInput = (value: string, maxLength = 160) => sanitizeTextInput(value, maxLength).replace(/\s/g, '').toLowerCase();
  // Estado de caja
  const [isOpen, setIsOpen] = useState(isCashOpen());
  
  // Estado del carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [rechargeFlowMode, setRechargeFlowMode] = useState<RechargeFlowMode>('recharge_only');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [productSortBy, setProductSortBy] = useState<ProductSortBy>('default');
  const [favoriteProductIds, setFavoriteProductIds] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [isSimulatingScan, setIsSimulatingScan] = useState(false);
  const [products, setProducts] = useState<Array<{
    id: string;
    name: string;
    price: number;
    category: string;
    saleCategory: string;
    sku: string;
    subcategory: string;
  }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [bonusScales, setBonusScales] = useState<Array<{ min: number; max: number | null; bonus: number }>>([]);
  const [siteConfig, setSiteConfig] = useState<{ minRecharge: number; pointsPerCurrency: number; currencyUnit: number } | null>(null);
  
  // Modales
  const [showCardReader, setShowCardReader] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [showCardInfo, setShowCardInfo] = useState(false);
  const [cardInfoTab, setCardInfoTab] = useState('overview');
  const [showCardReadModal, setShowCardReadModal] = useState(false);
  const [pendingCardRead, setPendingCardRead] = useState<CardReadOptions | null>(null);
  const [showSaleCardScanModal, setShowSaleCardScanModal] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutAuditSessionId, setCheckoutAuditSessionId] = useState('');
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('payment');
  const [showReceipt, setShowReceipt] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | undefined>(undefined);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSupervisorAuth, setShowSupervisorAuth] = useState(false);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [pendingAction, setPendingAction] = useState<'delete_card' | 'cash_withdrawal' | null>(null);
  const [lastAddedProductId, setLastAddedProductId] = useState<string | null>(null);
  const [lastAddTick, setLastAddTick] = useState(0);
  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [showCashWithdrawalModal, setShowCashWithdrawalModal] = useState(false);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [showEditSaleModal, setShowEditSaleModal] = useState(false);
  const [showCardTransferModal, setShowCardTransferModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showRewardsRedeemConfirm, setShowRewardsRedeemConfirm] = useState(false);
  const productSearchInputRef = useRef<HTMLInputElement | null>(null);
  
  // Estados de datos
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [currentCardActivity, setCurrentCardActivity] = useState<CardActivitySummary | null>(null);
  const [isCurrentCardActivityLoading, setIsCurrentCardActivityLoading] = useState(false);
  const [cardUidInput, setCardUidInput] = useState('');
  const [pendingIssuedCards, setPendingIssuedCards] = useState<PendingIssuedCard[]>([]);
  const [currentIssuedCardIndex, setCurrentIssuedCardIndex] = useState(0);
  const [cardCustomName, setCardCustomName] = useState('');
  const [registerCardOwner, setRegisterCardOwner] = useState(false);
  const [cardOwnerDocType, setCardOwnerDocType] = useState<'CC' | 'CE' | 'NIT' | 'PAS'>('CC');
  const [cardOwnerDocNumber, setCardOwnerDocNumber] = useState('');
  const [cardOwnerFullName, setCardOwnerFullName] = useState('');
  const [cardOwnerPhone, setCardOwnerPhone] = useState('');
  const [cardOwnerEmail, setCardOwnerEmail] = useState('');
  const [cardOwnerCity, setCardOwnerCity] = useState('');
  const [transferSourceUid, setTransferSourceUid] = useState('');
  const [transferTargetUid, setTransferTargetUid] = useState('');
  const [transferDocType, setTransferDocType] = useState<'CC' | 'CE' | 'NIT' | 'PAS'>('CC');
  const [transferDocNumber, setTransferDocNumber] = useState('');
  const [transferOwnerCards, setTransferOwnerCards] = useState<Array<{
    uid: string;
    label: string | null;
    status: string;
    balance: number;
    points: number;
  }>>([]);
  const [isLoadingTransferOwnerCards, setIsLoadingTransferOwnerCards] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [prizeCatalog, setPrizeCatalog] = useState<PrizeCatalogItem[]>([]);
  const [rewardCardUid, setRewardCardUid] = useState('');
  const [rewardCardSummary, setRewardCardSummary] = useState<{
    card: {
      uid: string;
      status: string;
      points_balance: number;
      balance: number;
      owner: { full_name: string } | null;
    };
    points_history: Array<{
      id: string;
      occurred_at: string;
      points_delta: number;
      reason: string;
    }>;
  } | null>(null);
  const [selectedPrizeId, setSelectedPrizeId] = useState('');
  const [selectedPrizeQty, setSelectedPrizeQty] = useState('1');
  const [prizeSkuQuery, setPrizeSkuQuery] = useState('');
  const [rewardRedeemNotes, setRewardRedeemNotes] = useState('');
  const [rewardReceiptNumber, setRewardReceiptNumber] = useState('');
  const [rewardReceiptText, setRewardReceiptText] = useState('');
  const [isRewardLoading, setIsRewardLoading] = useState(false);
  const [isRewardRedeeming, setIsRewardRedeeming] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
  const [editingSale, setEditingSale] = useState<RecentSale | null>(null);
  const [editingSaleSaving, setEditingSaleSaving] = useState(false);
  const [editingSaleTotalInput, setEditingSaleTotalInput] = useState('');
  const [editingSaleReason, setEditingSaleReason] = useState('');
  const [pendingPostSaleInvoice, setPendingPostSaleInvoice] = useState(false);
  const [cashReceivedInput, setCashReceivedInput] = useState('');
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [salesHistoryPage, setSalesHistoryPage] = useState(1);
  const [salesHistoryTotalPages, setSalesHistoryTotalPages] = useState(1);
  const [salesHistoryTotal, setSalesHistoryTotal] = useState(0);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);
  const [requiresInvoice, setRequiresInvoice] = useState(false);
  const [customerPersonType, setCustomerPersonType] = useState<'natural' | 'juridica'>('natural');
  const [customerDocType, setCustomerDocType] = useState<'CC' | 'CE' | 'NIT' | 'PAS'>('CC');
  const [customerDocNumber, setCustomerDocNumber] = useState('');
  const [customerFullName, setCustomerFullName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [isCustomerLookupLoading, setIsCustomerLookupLoading] = useState(false);
  const [customerLookupStatus, setCustomerLookupStatus] = useState<'found' | null>(null);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'success' | 'error'>('syncing');
  const [errorMessage, setErrorMessage] = useState('');
  const [receiptTotal, setReceiptTotal] = useState(0);
  const [receiptSaleId, setReceiptSaleId] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receiptText, setReceiptText] = useState('');
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [closingCashInput, setClosingCashInput] = useState('');
  const [withdrawalAmountInput, setWithdrawalAmountInput] = useState('');
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [withdrawalSubmitting, setWithdrawalSubmitting] = useState(false);
  const [pendingWithdrawalApproval, setPendingWithdrawalApproval] = useState<{ id: string; approved_by_id: string } | null>(null);
  const [expectedCashAmount, setExpectedCashAmount] = useState(0);
  const [cashOpeningReference, setCashOpeningReference] = useState<{
    suggestedOpeningCash: number;
    lastClosedCash: number;
    lastClosedAt: string | null;
  } | null>(null);
  const initialCashState = getCashState();

  const writeCheckoutAudit = async (payload: {
    event: 'OPEN' | 'UPDATE_ITEM' | 'REMOVE_ITEM' | 'CASH_TENDER' | 'SUBMIT';
    itemId?: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    sessionId?: string;
  }) => {
    const siteId = getSiteIdStored();
    const activeSessionId = payload.sessionId ?? checkoutAuditSessionId;
    if (!siteId || !authUser?.id || !activeSessionId) return;
    try {
      await api('/sales/checkout-audit', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          actor_id: authUser.id,
          checkout_session_id: activeSessionId,
          event: payload.event,
          item_id: payload.itemId,
          before: payload.before,
          after: payload.after,
          reason: payload.reason,
        }),
      });
    } catch {
      // Audit logging must not block checkout UI.
    }
  };

  const buildCheckoutAuditItemSnapshot = (item: CartItem | null | undefined): CheckoutAuditSnapshot | null => {
    if (!item) return null;
    return {
      item_id: item.id,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
    };
  };

  const buildCheckoutAuditCartSnapshot = (items: CartItem[]) => ({
    items: items.map((item) => buildCheckoutAuditItemSnapshot(item)).filter(Boolean),
    total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    total_amount: items.reduce((sum, item) => sum + item.total, 0),
  });

  const openCheckoutModal = () => {
    if (!isOpen || cart.length === 0) return;
    const sessionId = crypto.randomUUID();
    setCheckoutAuditSessionId(sessionId);
    setShowCheckout(true);
    const cartSnapshot = buildCheckoutAuditCartSnapshot(cart);
    void writeCheckoutAudit({
      event: 'OPEN',
      sessionId,
      before: null,
      after: cartSnapshot,
      reason: 'CHECKOUT_OPEN',
    });
  };

  const closeCheckoutModal = () => {
    setShowCheckout(false);
    setCheckoutAuditSessionId('');
  };

  const applyCashReceivedPreset = (amount: number) => {
    const nextValue = String(amount);
    if (showCheckout && checkoutAuditSessionId) {
      void writeCheckoutAudit({
        event: 'CASH_TENDER',
        before: {
          received_amount: cashReceivedValue,
          change_due: changeDue,
        },
        after: {
          received_amount: amount,
          change_due: Math.max(0, amount - total),
          source: 'preset',
        },
        reason: 'CHECKOUT_CASH_PRESET',
      });
    }
    setCashReceivedInput(nextValue);
  };

  const loadCurrentCardActivity = async (uid: string) => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    setIsCurrentCardActivityLoading(true);
    try {
      const summary = await api<CardActivitySummary>(`/cards/${encodeURIComponent(uid)}/activity-summary?site_id=${siteId}`);
      setCurrentCardActivity(summary);
    } catch (err: any) {
      setCurrentCardActivity(null);
      setErrorMessage(err?.message || 'No se pudo cargar la actividad de la tarjeta.');
      setShowError(true);
    } finally {
      setIsCurrentCardActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!showCardInfo || showRecharge || !currentCard?.code) return;
    setCardInfoTab('overview');
    loadCurrentCardActivity(currentCard.code).catch(() => null);
  }, [showCardInfo, showRecharge, currentCard?.code]);
  const [openingCashAmount, setOpeningCashAmount] = useState(initialCashState?.openingCashAmount ?? 0);
  const [cashSales, setCashSales] = useState(initialCashState?.cashSales ?? 0);
  const [cashWithdrawalsAmount, setCashWithdrawalsAmount] = useState(0);
  const [daySummary, setDaySummary] = useState<CashierDaySummary | null>(null);
  const [posContext, setPosContext] = useState<{
    shiftId: string | null;
    terminalId: string | null;
    cashRegisterId: string | null;
    cashSessionId: string | null;
  }>({
    shiftId: null,
    terminalId: null,
    cashRegisterId: null,
    cashSessionId: initialCashState?.cashSessionId ?? null,
  });
  
  // Calcular totales
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal;
  const expectedCash = expectedCashAmount;
  const cashReceived = Number.parseInt(cashReceivedInput, 10);
  const cashReceivedValue = Number.isNaN(cashReceived) ? 0 : cashReceived;
  const changeDue = selectedPayment === 'cash' ? Math.max(0, cashReceivedValue - total) : 0;
  const canProvideChange = selectedPayment !== 'cash' || cashReceivedValue >= total;
  const isCashCheckout = selectedPayment === 'cash';
  const canCashCheckout = !isCashCheckout || cashReceivedValue >= total;
  const isCustomerComplete = Boolean(
    customerDocNumber.trim()
    && customerFullName.trim()
    && customerPhone.trim()
    && customerEmail.trim()
    && customerAddress.trim()
    && customerCity.trim()
  );
  const isCardOwnerComplete = Boolean(cardOwnerDocNumber.trim() && cardOwnerFullName.trim());
  const canSubmitCheckout = canCashCheckout;
  const needsInvoiceStep = requiresInvoice;
  const needsCashTenderStep = isCashCheckout;
  const canAdvanceFromPayment = selectedPayment ? true : false;

  const normalizedProductSearchTerm = productSearchTerm.trim().toLowerCase();
  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const favoritesStorageKey = useMemo(() => {
    const siteId = getSiteIdStored() ?? 'site';
    return `pos:favorites:${siteId}:${authUser?.id ?? 'user'}`;
  }, [authUser?.id]);
  const favoriteProductIdSet = useMemo(() => new Set(favoriteProductIds), [favoriteProductIds]);
  const centralDockLeft = 'calc(50vw + ((max(22vw, 232px) - 380px) / 2))';
  const activeCardDockWidth = 'min(calc(100vw - max(22vw, 232px) - 420px), 760px)';
  const statusDockWidth = 'min(calc(100vw - max(22vw, 232px) - 420px), 900px)';
  const bonusQuickOptions = useMemo(
    () =>
      bonusScales
        .filter((scale) => scale.bonus > 0)
        .sort((a, b) => a.min - b.min)
        .map((scale) => ({
          amount: scale.min,
          bonus: scale.bonus,
          max: scale.max,
        })),
    [bonusScales],
  );
  const filteredPrizeCatalog = useMemo(() => {
    const query = prizeSkuQuery.trim().toUpperCase();
    if (!query) return prizeCatalog;
    return prizeCatalog.filter((prize) => (prize.sku ?? '').toUpperCase().includes(query));
  }, [prizeCatalog, prizeSkuQuery]);
  const requiredIssuedCards = useMemo(
    () =>
      cart.flatMap((item) => {
        const product = productById.get(item.productId);
        if (!product || product.saleCategory !== 'CARD_PLASTIC') return [];
        return Array.from({ length: item.quantity }, (_, index) => ({
          key: `${item.id}-${index + 1}`,
          productId: item.productId,
          productName: item.productName,
          sequence: index + 1,
          uid: '',
        }));
      }),
    [cart, productById],
  );
  const currentIssuedCard = pendingIssuedCards[currentIssuedCardIndex] ?? null;

  const productSalesCount = useMemo(() => {
    const counts = new Map<string, number>();
    recentSales.forEach((sale) => {
      sale.items.forEach((item) => {
        counts.set(item.product_id, (counts.get(item.product_id) ?? 0) + item.quantity);
      });
    });
    return counts;
  }, [recentSales]);

  // Productos filtrados y ordenados
  const filteredProducts = useMemo(() => {
    const base = products.filter((product) => {
      const hasPrice = Number.isFinite(product.price) && product.price > 0;
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSubcategory = selectedSubcategory === 'all' || product.subcategory === selectedSubcategory;
      const matchesSearch = normalizedProductSearchTerm.length === 0
        || product.name.toLowerCase().includes(normalizedProductSearchTerm)
        || product.sku.toLowerCase().includes(normalizedProductSearchTerm)
        || product.subcategory.toLowerCase().includes(normalizedProductSearchTerm);
      const matchesFavorites = !onlyFavorites || favoriteProductIdSet.has(product.id);
      return hasPrice && matchesCategory && matchesSubcategory && matchesSearch && matchesFavorites;
    });

    if (productSortBy === 'default') {
      return [...base].sort((a, b) => {
        const aFav = favoriteProductIdSet.has(a.id) ? 1 : 0;
        const bFav = favoriteProductIdSet.has(b.id) ? 1 : 0;
        if (aFav !== bFav) return bFav - aFav;
        return a.name.localeCompare(b.name, 'es-CO');
      });
    }

    return [...base].sort((a, b) => {
      const aSales = productSalesCount.get(a.id) ?? 0;
      const bSales = productSalesCount.get(b.id) ?? 0;
      switch (productSortBy) {
        case 'best_sellers':
          return bSales - aSales;
        case 'worst_sellers':
          return aSales - bSales;
        case 'price_desc':
          return b.price - a.price;
        case 'price_asc':
          return a.price - b.price;
        default:
          return 0;
      }
    });
  }, [products, selectedCategory, selectedSubcategory, normalizedProductSearchTerm, onlyFavorites, productSortBy, productSalesCount, favoriteProductIdSet]);

  const availableSubcategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((product) => {
      if (selectedCategory === 'all' || product.category === selectedCategory) {
        if (product.subcategory) set.add(product.subcategory);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es-CO'));
  }, [products, selectedCategory]);

  const categoryLabels: Record<string, string> = {
    Parque: 'Parque',
    Snacks: 'Snacks',
    Programas: 'Programas',
    'Eventos y celebraciones': 'Eventos y celebraciones',
    Otros: 'Otros',
    CARD_PLASTIC: 'Tarjetas',
    GIFT_CARD: 'Gift Card',
    RECHARGE: 'Recargas',
    PRIZE: 'Premios',
    SNACKS: 'Snacks',
    SERVICE: 'Servicios',
    OTHER: 'Otros',
  };

  const categoryLabelById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(cat => map.set(cat.id, categoryLabels[cat.name] ?? cat.name));
    return map;
  }, [categories]);

  const resolvePaymentMethod = (method: PaymentMethod) => {
    if (method === 'cash') return 'CASH';
    if (method === 'transfer_account_1') return 'TRANSFER_ACCOUNT_1';
    if (method === 'transfer_account_2') return 'TRANSFER_ACCOUNT_2';
    if (method === 'nequi') return 'NEQUI';
    if (method === 'qr') return 'QR';
    if (method === 'credit') return 'CREDIT';
    if (method === 'credit_card') return 'CREDIT_CARD';
    if (method === 'debit') return 'CARD';
    return 'CREDIT_CARD';
  };

  const resolveUiPayment = (method?: string | null): PaymentMethod => {
    if (!method) return 'cash';
    if (method === 'CASH') return 'cash';
    if (method === 'TRANSFER_ACCOUNT_1' || method === 'TRANSFER') return 'transfer_account_1';
    if (method === 'TRANSFER_ACCOUNT_2') return 'transfer_account_2';
    if (method === 'NEQUI') return 'nequi';
    if (method === 'QR') return 'qr';
    if (method === 'CREDIT') return 'credit';
    if (method === 'CREDIT_CARD') return 'credit_card';
    return 'debit';
  };

  const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'transfer_account_1', label: 'Transferencia cta 1' },
    { value: 'transfer_account_2', label: 'Transferencia cta 2' },
    { value: 'nequi', label: 'Nequi' },
    { value: 'qr', label: 'QR' },
    { value: 'credit_card', label: 'Tarjeta credito' },
    { value: 'credit', label: 'Credito' },
    { value: 'debit', label: 'Tarjeta / datáfono' },
  ];

  useEffect(() => {
    if (customerPersonType === 'juridica') {
      if (customerDocType !== 'NIT') {
        setCustomerDocType('NIT');
      }
      return;
    }
    if (customerDocType === 'NIT') {
      setCustomerDocType('CC');
    }
  }, [customerPersonType, customerDocType]);

  useEffect(() => {
    setSelectedSubcategory('all');
  }, [selectedCategory]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(favoritesStorageKey);
      if (!raw) {
        setFavoriteProductIds([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavoriteProductIds(parsed.filter((value): value is string => typeof value === 'string'));
      }
    } catch {
      setFavoriteProductIds([]);
    }
  }, [favoritesStorageKey]);

  useEffect(() => {
    localStorage.setItem(favoritesStorageKey, JSON.stringify(favoriteProductIds));
  }, [favoritesStorageKey, favoriteProductIds]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = Boolean(target?.closest('input, textarea, [contenteditable="true"]'));
      if (isTyping) return;
      if (event.key === '/' || (event.ctrlKey && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        productSearchInputRef.current?.focus();
      }
      if (event.key.toLowerCase() === 'f' && event.altKey) {
        event.preventDefault();
        setOnlyFavorites((prev) => !prev);
      }
      if (event.key.toLowerCase() === 's' && event.altKey) {
        event.preventDefault();
        productSearchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!showCheckout) {
      setCheckoutStep('payment');
      return;
    }
    if (!requiresInvoice && checkoutStep === 'invoice') {
      setCheckoutStep('payment');
    }
  }, [showCheckout, requiresInvoice, checkoutStep]);

  useEffect(() => {
    if (showCheckout && cart.length === 0) {
      closeCheckoutModal();
    }
  }, [showCheckout, cart.length]);

  useEffect(() => {
    setCheckoutStep((prev) =>
      transitionCheckoutStep(prev, 'PAYMENT_CHANGED', {
        selectedPayment,
        requiresInvoice,
        canProvideChange,
      })
    );
  }, [selectedPayment, requiresInvoice, canProvideChange]);

  useEffect(() => {
    const siteId = getSiteIdStored();
    const documentNumber = customerDocNumber.trim();
    if (!showCheckout || !requiresInvoice || !siteId || !documentNumber || documentNumber.length < 5) {
      setIsCustomerLookupLoading(false);
      setCustomerLookupStatus(null);
      return;
    }

    const lookupKey = `${siteId}:${customerDocType}:${documentNumber}`;
    let cancelled = false;
    setIsCustomerLookupLoading(true);
    setCustomerLookupStatus(null);

    const timer = window.setTimeout(() => {
      api<KnownCustomerProfile>(
        `/sales/customer-lookup?site_id=${siteId}&document_type=${customerDocType}&document_number=${encodeURIComponent(documentNumber)}`
      )
        .then((customer) => {
          if (cancelled) return;
          const currentKey = `${siteId}:${customerDocType}:${customerDocNumber.trim()}`;
          if (currentKey !== lookupKey) return;
          setCustomerPersonType((customer.person_type ?? 'natural') === 'juridica' ? 'juridica' : 'natural');
          setCustomerFullName(customer.full_name ?? '');
          setCustomerPhone(customer.phone ?? '');
          setCustomerEmail(customer.email ?? '');
          setCustomerCity(customer.city ?? '');
          setCustomerAddress(customer.address ?? '');
          setCustomerLookupStatus('found');
        })
        .catch((err: any) => {
          if (cancelled) return;
          setCustomerLookupStatus(null);
          const message = String(err?.message || '').toLowerCase();
          if (!message.includes('cliente no encontrado') && !message.includes('[404]')) {
            setErrorMessage(err?.message || 'No se pudo consultar el cliente.');
            setShowError(true);
          }
        })
        .finally(() => {
          if (!cancelled) setIsCustomerLookupLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [showCheckout, requiresInvoice, customerDocType, customerDocNumber]);

  const loadSalesHistory = async (siteId: string, page = salesHistoryPage) => {
    if (!authUser?.id) return;
    setSalesHistoryLoading(true);
    try {
      const params = new URLSearchParams({
        site_id: siteId,
        limit: '10',
        page: String(page),
      });
      let response: SalesHistoryResponse;
      if (isCashierRole) {
        params.set('created_by_user_id', authUser.id);
        params.set('sale_date', todayDate);
        response = await api<SalesHistoryResponse>(`/sales/recent?${params.toString()}`);
      } else {
        response = await api<SalesHistoryResponse>(`/sales?${params.toString()}`);
      }
      setRecentSales(response.items ?? []);
      setSalesHistoryPage(response.page ?? page);
      setSalesHistoryTotalPages(response.total_pages ?? 1);
      setSalesHistoryTotal(response.total ?? 0);
    } catch {
      setRecentSales([]);
      setSalesHistoryTotalPages(1);
      setSalesHistoryTotal(0);
    } finally {
      setSalesHistoryLoading(false);
    }
  };

  useEffect(() => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser?.id) return;
    const interval = window.setInterval(() => {
      if (showSalesHistory) {
        loadSalesHistory(siteId, salesHistoryPage).catch(() => null);
      }
    }, 5000);
    return () => window.clearInterval(interval);
  }, [authUser?.id, isCashierRole, todayDate, showSalesHistory, salesHistoryPage]);

  useEffect(() => {
    const siteId = getSiteIdStored();
    if (!siteId || !currentCard?.code) return;
    const interval = window.setInterval(() => {
      api<Card>('/cards/read', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          uid: currentCard.code,
          create_if_missing: false,
        }),
      })
        .then((card) => setCurrentCard(card))
        .catch(() => null);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [currentCard?.code]);

  useEffect(() => {
    const siteId = getSiteIdStored();
    if (!siteId) return;

    refreshDaySummary(siteId).catch(() => null);
    if (posContext.cashSessionId) {
      refreshCashSessionSummary(posContext.cashSessionId).catch(() => null);
    }

    const interval = window.setInterval(() => {
      refreshDaySummary(siteId).catch(() => null);
      if (posContext.cashSessionId) {
        refreshCashSessionSummary(posContext.cashSessionId).catch(() => null);
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, [posContext.cashSessionId]);

  const createSupervisorApproval = async (params: {
    entityId: string;
    reason: string;
    entityType?: string;
    action?: string;
    supervisorCode?: string;
  }) => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser) {
      throw new Error('No se encontró el sitio o usuario');
    }
    return api<{ id: string; approved_by_id: string }>('/supervisor-approvals', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        requested_by_user_id: authUser.id,
        action: params.action ?? 'OTHER',
        entity_type: params.entityType ?? 'CASH_SESSION',
        entity_id: params.entityId,
        reason: params.reason,
        supervisor_code: params.supervisorCode ?? supervisorPin,
      }),
    });
  };

  const refreshDaySummary = async (siteId: string) => {
    try {
      const summary = await api<CashierDaySummary>(`/reports/day/summary?site_id=${siteId}`);
      setDaySummary(summary);
    } catch {
      setDaySummary(null);
    }
  };

  const refreshCashSessionSummary = async (cashSessionId?: string | null) => {
    const sessionId = cashSessionId ?? posContext.cashSessionId;
    if (!sessionId) return;
    try {
      const summary = await api<{
        opening_cash_amount: string;
        cash_sales: string;
        expected_cash_amount: string;
        withdrawals_amount: string;
      }>(`/cash-sessions/${sessionId}`);
      setOpeningCashAmount(parseFloat(summary.opening_cash_amount));
      setCashSales(parseFloat(summary.cash_sales));
      setExpectedCashAmount(parseFloat(summary.expected_cash_amount));
      setCashWithdrawalsAmount(parseFloat(summary.withdrawals_amount));
    } catch {
      // Ignore background refresh errors
    }
  };

  // Agregar producto al carrito
  const addToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    if (!Number.isFinite(product.price) || product.price <= 0) {
      setErrorMessage(`El producto "${product.name}" no tiene precio configurado.`);
      setShowError(true);
      return;
    }

    setLastAddedProductId(productId);
    setLastAddTick(Date.now());
    setTimeout(() => setLastAddedProductId(null), 500);
    setTimeout(() => setLastAddTick(0), 600);

    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        return prev.map(item =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
            : item
        );
      }
      return [...prev, {
        id: Date.now().toString(),
        productId,
        productName: product.name,
        quantity: 1,
        unitPrice: product.price,
        total: product.price,
      }];
    });
  };

  const toggleFavorite = (productId: string) => {
    setFavoriteProductIds((prev) => (
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    ));
  };

  const addProductByScanTerm = (rawTerm: string) => {
    const term = rawTerm.trim().toLowerCase();
    if (!term) return false;
    const cleaned = term.replace(/\s+/g, '');
    const exactSku = products.find((product) => Number.isFinite(product.price) && product.price > 0 && product.sku.toLowerCase() === cleaned);
    const fallback = products.find((product) => Number.isFinite(product.price) && product.price > 0 && product.name.toLowerCase() === term);
    const partial = products.find((product) => Number.isFinite(product.price) && product.price > 0 && product.sku.toLowerCase().includes(cleaned));
    const match = exactSku ?? fallback ?? partial;
    if (!match) {
      return false;
    }
    addToCart(match.id);
    return true;
  };

  const handleScanAdd = () => {
    if (!normalizedProductSearchTerm) return;
    const found = addProductByScanTerm(productSearchTerm);
    if (!found) {
      setErrorMessage(`No se encontró producto: ${productSearchTerm}`);
      setShowError(true);
      return;
    }
    setProductSearchTerm('');
  };

  const handleSimulatedSkuScan = () => {
    if (isSimulatingScan) return;
    const current = productSearchTerm.trim();
    const fallbackSku = products.find((product) => Number.isFinite(product.price) && product.price > 0 && Boolean(product.sku))?.sku ?? '';
    const scanTerm = (current || fallbackSku).trim();
    if (!scanTerm) {
      setErrorMessage('No hay SKU disponible para simular el escaneo.');
      setShowError(true);
      return;
    }
    setProductSearchTerm(scanTerm.toUpperCase());
    setIsSimulatingScan(true);
    setTimeout(() => {
      const found = addProductByScanTerm(scanTerm);
      if (!found) {
        setErrorMessage(`No se encontró producto para el escaneo: ${scanTerm}`);
        setShowError(true);
      } else {
        setProductSearchTerm('');
      }
      setIsSimulatingScan(false);
    }, 240);
  };

  // Actualizar cantidad
  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      const target = prev.find((item) => item.id === itemId);
      if (!target) return prev;

      const newQty = Math.max(0, target.quantity + delta);
      const nextCart = prev
        .map((item) => {
          if (item.id !== itemId) return item;
          if (newQty === 0) return null as unknown as CartItem;
          return { ...item, quantity: newQty, total: newQty * item.unitPrice };
        })
        .filter(Boolean);

      if (showCheckout && checkoutAuditSessionId) {
        const updated = newQty === 0 ? null : nextCart.find((item) => item.id === itemId);
        void writeCheckoutAudit({
          event: newQty === 0 ? 'REMOVE_ITEM' : 'UPDATE_ITEM',
          itemId,
          before: {
            item: buildCheckoutAuditItemSnapshot(target),
            cart: buildCheckoutAuditCartSnapshot(prev),
          },
          after: {
            item: buildCheckoutAuditItemSnapshot(updated),
            cart: buildCheckoutAuditCartSnapshot(nextCart),
          },
          reason: newQty === 0 ? 'CHECKOUT_REMOVE_ITEM' : 'CHECKOUT_UPDATE_ITEM',
        });
      }

      return nextCart;
    });
  };

  const openCardReadModal = (options?: CardReadOptions) => {
    const flowMode = options?.flowMode ?? 'recharge_only';
    setPendingCardRead({
      openRecharge: options?.openRecharge ?? false,
      createIfMissing: options?.createIfMissing ?? false,
      flowMode,
    });
    setCardUidInput('');
    setCardCustomName('');
    setRegisterCardOwner(flowMode === 'issue_and_recharge');
    setCardOwnerDocType('CC');
    setCardOwnerDocNumber('');
    setCardOwnerFullName('');
    setCardOwnerPhone('');
    setCardOwnerEmail('');
    setCardOwnerCity('');
    setShowCardReadModal(true);
  };

  // Lectura de tarjeta por API
  const closeSyncWithError = (message: string) => {
    setSyncStatus('error');
    setSyncMessage(undefined);
    setTimeout(() => {
      setShowSync(false);
      setErrorMessage(message);
      setShowError(true);
    }, 250);
  };

  const handleReadCard = async (uidOverride?: string) => {
    const siteId = getSiteIdStored();
    if (!siteId) {
      setShowSync(false);
      setErrorMessage('No se encontró la sede');
      setShowError(true);
      return;
    }
    if (!pendingCardRead) {
      setShowSync(false);
      setErrorMessage('No se encontró el contexto de lectura');
      setShowError(true);
      return;
    }
    const uid = sanitizeTextInput((uidOverride ?? cardUidInput).toUpperCase(), 60).replace(/\s+/g, '');
    if (!uid) {
      setShowSync(false);
      setErrorMessage('Debes ingresar el UID de la tarjeta');
      setShowError(true);
      return;
    }

    if (pendingCardRead.createIfMissing) {
      try {
        const existingCard = await checkIssuedCardUidAvailability(siteId, uid);
        if (existingCard) {
          setCurrentCard(existingCard);
          setRechargeFlowMode('recharge_only');
          setShowCardReadModal(false);
          setSyncStatus('success');
          setSyncMessage(undefined);
          setTimeout(() => {
            setShowSync(false);
            setErrorMessage(
              `La tarjeta ${uid} ya existe. Se cargó como tarjeta existente y no se emitirá una nueva con ese UID.`
            );
            setShowError(true);
            if (pendingCardRead.openRecharge) {
              setShowCardInfo(false);
              setShowRecharge(true);
            } else {
              setShowCardInfo(true);
            }
          }, 250);
          setPendingCardRead(null);
          return;
        }
      } catch (err: any) {
        closeSyncWithError(err?.message || 'No se pudo validar si la tarjeta ya existe.');
        setPendingCardRead(null);
        return;
      }

    }

    setShowSync(true);
    setSyncStatus('syncing');
    setSyncMessage(uidOverride ? 'Tarjeta escaneada. Procesando...' : 'Leyendo tarjeta...');
    setShowCardReadModal(false);

    api<Card>('/cards/read', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        uid,
        card_name: pendingCardRead.createIfMissing ? cardCustomName.trim() : undefined,
        create_if_missing: pendingCardRead.createIfMissing,
        owner_customer: pendingCardRead.createIfMissing && registerCardOwner
          ? {
              document_type: cardOwnerDocType,
              document_number: cardOwnerDocNumber.trim(),
              full_name: cardOwnerFullName.trim(),
              phone: cardOwnerPhone.trim(),
              email: cardOwnerEmail.trim(),
              city: cardOwnerCity.trim(),
            }
          : undefined,
      }),
    })
      .then((card) => {
        setCurrentCard(card);
        setRechargeFlowMode(pendingCardRead.flowMode ?? 'recharge_only');
        setSyncStatus('success');
        setSyncMessage(undefined);
        setTimeout(() => {
          setShowSync(false);
          if (pendingCardRead.openRecharge) {
            setShowCardInfo(false);
            setShowRecharge(true);
            return;
          }
          setShowCardInfo(true);
        }, 400);
      })
      .catch((err) => {
        closeSyncWithError(err?.message || 'No se pudo leer la tarjeta');
      })
      .finally(() => {
        setPendingCardRead(null);
      });
  };

  const waitUidFromApi = async (target: 'card_read' | 'transfer_target' | 'sale_card_issue') => {
    const siteId = getSiteIdStored();
    if (!siteId) {
      setErrorMessage('No se encontró la sede');
      setShowError(true);
      return;
    }
    const startedAt = Date.now();
    setShowSync(true);
    setSyncStatus('syncing');
    setSyncMessage('Esperando UID por API...');
    try {
      for (let i = 0; i < 30; i += 1) {
        const response = await api<{ uid: string | null; timestamp: number | null }>(
          `/cards/reader/wait-uid?site_id=${siteId}&after=${startedAt}`
        );
        if (response.uid) {
          if (target === 'card_read') {
            setCardUidInput(response.uid);
            await handleReadCard(response.uid);
            return;
          }
          if (target === 'sale_card_issue') {
            setCardUidInput(response.uid);
            setSyncStatus('success');
            setSyncMessage(undefined);
            setShowSync(false);
            registerIssuedCardUid(response.uid);
            return;
          }
          if (target === 'transfer_target') setTransferTargetUid(response.uid);
          setSyncStatus('success');
          setSyncMessage(undefined);
          setTimeout(() => setShowSync(false), 350);
          return;
        }
        // poll each second
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setSyncStatus('error');
      setSyncMessage(undefined);
      setTimeout(() => {
        setShowSync(false);
        setErrorMessage('Tiempo de espera agotado para recibir UID');
        setShowError(true);
      }, 300);
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(undefined);
      setTimeout(() => {
        setShowSync(false);
        setErrorMessage(err?.message || 'No se pudo consultar UID por API');
        setShowError(true);
      }, 300);
    }
  };

  // Recarga
  const handleRecharge = () => {
    const minRecharge = siteConfig?.minRecharge ?? 5000;
    const rechargeInputValue = parseInt(rechargeAmount, 10);
    if (!rechargeAmount || rechargeInputValue < minRecharge) {
      setErrorMessage(`El monto mínimo de recarga es ${formatCurrency(minRecharge)}`);
      setShowError(true);
      return;
    }
    if (!currentCard) {
      setErrorMessage('No hay tarjeta seleccionada');
      setShowError(true);
      return;
    }
    if (rechargeFlowMode === 'issue_and_recharge' && registerCardOwner && !isCardOwnerComplete) {
      setErrorMessage('Activas­te registrar propietario, pero falta documento o nombre. Complétalos antes de cargar la tarjeta.');
      setShowError(true);
      return;
    }
    if (!authUser || !posContext.shiftId || !posContext.terminalId || !posContext.cashSessionId) {
      setErrorMessage('No hay contexto de caja activo');
      setShowError(true);
      return;
    }
    const siteId = getSiteIdStored();
    if (!siteId) {
      setErrorMessage('No se encontró la sede');
      setShowError(true);
      return;
    }

    const includeCardIssueFee = rechargeFlowMode === 'issue_and_recharge';

    setShowRecharge(false);
    setShowSync(true);
    setSyncStatus('syncing');

    api<{
      sale_id: string;
      amount: string;
      card_issue_fee: string;
      bonus_amount: string;
      points: number;
      receipt_number?: string | null;
      receipt_text?: string | null;
    }>(`/cards/${currentCard.code}/recharge`, {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        amount: rechargeInputValue.toFixed(2),
        payment_method: resolvePaymentMethod(selectedPayment),
        terminal_id: posContext.terminalId,
        shift_id: posContext.shiftId,
        cash_session_id: posContext.cashSessionId,
        created_by_user_id: authUser.id,
        include_card_issue_fee: includeCardIssueFee,
      }),
    })
      .then((rechargeResult) => {
        const cardIssueFee = parseFloat(rechargeResult.card_issue_fee || '0');
        const chargedTotal = rechargeInputValue + cardIssueFee;
        return api<Card>(`/cards/${currentCard.code}?site_id=${siteId}`).then((card) => ({ card, chargedTotal, rechargeResult }));
      })
      .then(({ card, chargedTotal, rechargeResult }) => {
        setCurrentCard(card);
        setSyncStatus('success');
        setTimeout(() => {
          setShowSync(false);
          setRechargeAmount('');
          setRechargeFlowMode('recharge_only');
          setReceiptTotal(chargedTotal);
          setReceiptSaleId(rechargeResult.sale_id);
          setReceiptNumber(rechargeResult.receipt_number ?? '');
          setReceiptText(rechargeResult.receipt_text ?? '');
          if (selectedPayment === 'cash') {
            setCashSales(prev => prev + chargedTotal);
            setExpectedCashAmount(prev => prev + chargedTotal);
          }
          refreshDaySummary(siteId).catch(() => null);
          refreshCashSessionSummary(posContext.cashSessionId).catch(() => null);
          setShowReceipt(true);
        }, 500);
      })
      .catch((err) => {
        setSyncStatus('error');
        setTimeout(() => {
          setShowSync(false);
          setErrorMessage(err?.message || 'No se pudo completar la recarga');
          setShowError(true);
        }, 400);
      });
  };

  const startSaleCardScanFlow = () => {
    setPendingIssuedCards(requiredIssuedCards);
    setCurrentIssuedCardIndex(0);
    setCardUidInput('');
    setShowCheckout(false);
    setShowSaleCardScanModal(true);
  };

  const submitIssuedCardsSale = (issuedCards: PendingIssuedCard[]) => {
    setPendingIssuedCards([]);
    setCurrentIssuedCardIndex(0);
    setShowSaleCardScanModal(false);
    finalizeCheckout(issuedCards.map((entry) => ({ product_id: entry.productId, uid: entry.uid })));
  };

  const checkIssuedCardUidAvailability = async (siteId: string, uid: string) => {
    try {
      const existingCard = await api<Card>(`/cards/${encodeURIComponent(uid)}?site_id=${siteId}`);
      return existingCard;
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.toLowerCase().includes('tarjeta no encontrada')) {
        return null;
      }
      throw err;
    }
  };

  const registerIssuedCardUid = async (uidOverride?: string) => {
    const siteId = getSiteIdStored();
    const uid = sanitizeTextInput((uidOverride ?? cardUidInput).toUpperCase(), 60).replace(/\s+/g, '');
    if (!siteId) {
      setErrorMessage('No se encontró la sede');
      setShowError(true);
      return;
    }
    if (!uid) {
      setErrorMessage('Debes escanear o ingresar el UID de la tarjeta');
      setShowError(true);
      return;
    }
    if (pendingIssuedCards.some((entry, index) => index !== currentIssuedCardIndex && entry.uid === uid)) {
      setErrorMessage('Ese UID ya fue leído para otra tarjeta de esta venta.');
      setShowError(true);
      return;
    }

    try {
      const existingCard = await checkIssuedCardUidAvailability(siteId, uid);
      if (existingCard) {
        setErrorMessage(
          `La tarjeta ${uid} ya existe y no puede emitirse de nuevo. Usa otra tarjeta o cambia al flujo de lectura/recarga.`
        );
        setShowError(true);
        return;
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'No se pudo validar si la tarjeta ya existe.');
      setShowError(true);
      return;
    }

    const nextIssuedCards = pendingIssuedCards.map((entry, index) =>
      index === currentIssuedCardIndex ? { ...entry, uid } : entry,
    );
    setPendingIssuedCards(nextIssuedCards);
    setCardUidInput('');

    if (currentIssuedCardIndex + 1 >= nextIssuedCards.length) {
      submitIssuedCardsSale(nextIssuedCards);
      return;
    }

    setCurrentIssuedCardIndex((prev) => prev + 1);
  };

  const cancelSaleCardScanFlow = () => {
    setShowSaleCardScanModal(false);
    setPendingIssuedCards([]);
    setCurrentIssuedCardIndex(0);
    setCardUidInput('');
    setShowCheckout(true);
  };

  const finalizeCheckout = (issuedCards: Array<{ product_id: string; uid: string }> = []) => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser) {
      setErrorMessage('Usuario o sede no disponible');
      setShowError(true);
      return;
    }
    if (!posContext.terminalId || !posContext.cashSessionId) {
      setErrorMessage('No hay contexto de caja activo');
      setShowError(true);
      return;
    }
    if (cart.length === 0) return;

    if (checkoutAuditSessionId) {
      if (selectedPayment === 'cash') {
        void writeCheckoutAudit({
          event: 'CASH_TENDER',
          before: {
            received_amount: cashReceivedValue,
            change_due: changeDue,
          },
          after: {
            received_amount: cashReceivedValue,
            change_due: changeDue,
            sufficient: canCashCheckout,
          },
          reason: 'CHECKOUT_CASH_CONFIRMED',
        });
      }

      void writeCheckoutAudit({
        event: 'SUBMIT',
        before: {
          cart: buildCheckoutAuditCartSnapshot(cart),
        },
        after: {
          payment_method: selectedPayment,
          total,
          requires_invoice: requiresInvoice,
          cash_received: selectedPayment === 'cash' ? cashReceivedValue : null,
          change_due: selectedPayment === 'cash' ? changeDue : null,
          issued_cards_count: issuedCards.length,
        },
        reason: 'CHECKOUT_SUBMIT',
      });
    }

    closeCheckoutModal();
    setShowSync(true);
    setSyncStatus('syncing');

    const invoiceReadyAtSaleTime = requiresInvoice && isCustomerComplete;

    const createSale = () => api<{ id: string; total: string; receipt_number?: string | null; receipt_text?: string | null }>('/sales', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        shift_id: posContext.shiftId ?? undefined,
        terminal_id: posContext.terminalId,
        cash_session_id: posContext.cashSessionId,
        created_by_user_id: authUser.id,
        requires_invoice: invoiceReadyAtSaleTime,
        customer: invoiceReadyAtSaleTime && customerDocNumber.trim()
          ? {
              document_type: customerDocType,
              document_number: customerDocNumber.trim(),
              full_name: customerFullName.trim(),
              phone: customerPhone.trim(),
              email: customerEmail.trim(),
              address: customerAddress.trim(),
              city: customerCity.trim(),
              person_type: customerPersonType,
            }
          : undefined,
        items: cart.map(item => ({ product_id: item.productId, quantity: item.quantity })),
        issued_cards: issuedCards,
        payments: [{ method: resolvePaymentMethod(selectedPayment), amount: total.toFixed(2) }],
      }),
    });

    const finalize = (saleResult?: { id?: string; receipt_number?: string | null; receipt_text?: string | null }) => {
      setSyncStatus('success');
      setTimeout(() => {
        setShowSync(false);
        setReceiptTotal(total);
        setReceiptSaleId(saleResult?.id ?? '');
        setReceiptNumber(saleResult?.receipt_number ?? '');
        setReceiptText(saleResult?.receipt_text ?? '');
        if (selectedPayment === 'cash') {
          setCashSales(prev => prev + total);
          setExpectedCashAmount(prev => prev + total);
        }
        setCart([]);
        setCashReceivedInput('');
        if (siteId) {
          loadSalesHistory(siteId, 1).catch(() => null);
          refreshDaySummary(siteId).catch(() => null);
        }
        refreshCashSessionSummary(posContext.cashSessionId).catch(() => null);
        if (requiresInvoice && !invoiceReadyAtSaleTime && saleResult?.id) {
          setPendingPostSaleInvoice(true);
          setEditingSale({
            id: saleResult.id,
            created_at: new Date().toISOString(),
            total: total.toFixed(2),
            payment_method: resolvePaymentMethod(selectedPayment),
            requires_invoice: true,
            customer: null,
            items: cart.map((item) => ({
              product_id: item.productId,
              product_name: item.productName,
              quantity: item.quantity,
              unit_price: item.unitPrice.toFixed(2),
            })),
          });
          setShowEditSaleModal(true);
          return;
        }
        setShowReceipt(true);
      }, 500);
    };

    createSale()
      .then((saleResult) => finalize(saleResult))
      .catch((err) => {
        setSyncStatus('error');
        setTimeout(() => {
          setShowSync(false);
          const message = String(err?.message || '');
          if (message.toLowerCase().includes('uid ya registrado')) {
            setShowSaleCardScanModal(true);
            setErrorMessage(`${message}. Escanea una tarjeta nueva para continuar la emisión.`);
          } else {
            setErrorMessage(message || 'No se pudo registrar la venta');
          }
          setShowError(true);
        }, 400);
      });
  };

  // Procesar venta
  const handleCheckout = () => {
    if (!selectedPayment) return;

    if (isCashCheckout) {
      if (cashReceivedValue <= 0) {
        setErrorMessage('Ingresa el valor recibido en efectivo.');
        setShowError(true);
        return;
      }
      if (cashReceivedValue < total) {
        setErrorMessage('El efectivo recibido es menor al total de la venta.');
        setShowError(true);
        return;
      }
    }
    if (requiredIssuedCards.length > 0) {
      startSaleCardScanFlow();
      return;
    }
    finalizeCheckout();
  };

  const continueCheckoutFlow = () => {
    if (checkoutStep === 'payment') {
      if (!canAdvanceFromPayment) return;
      if (needsInvoiceStep) {
        setCheckoutStep('invoice');
        return;
      }
      if (needsCashTenderStep) {
        setCheckoutStep('cash_tender');
        return;
      }
      handleCheckout();
      return;
    }

    if (checkoutStep === 'invoice') {
      if (needsCashTenderStep) {
        setCheckoutStep('cash_tender');
        return;
      }
      handleCheckout();
      return;
    }

    handleCheckout();
  };

  const goBackCheckoutFlow = () => {
    if (checkoutStep === 'cash_tender') {
      setCheckoutStep(needsInvoiceStep ? 'invoice' : 'payment');
      return;
    }
    if (checkoutStep === 'invoice') {
      setCheckoutStep('payment');
    }
  };

  const handlePrintReceiptPdf = async () => {
    const siteId = getSiteIdStored();
    if (!siteId || !receiptSaleId) {
      setErrorMessage('No se encontró la venta para generar el PDF');
      setShowError(true);
      return;
    }
    try {
      const { blob, filename } = await apiFile(`/sales/${receiptSaleId}/receipt.pdf?site_id=${siteId}`);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename || `factura-${receiptNumber || receiptSaleId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || 'No se pudo generar el PDF');
      setShowError(true);
    }
  };

  const handleTransferCardByLoss = async () => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser) {
      setErrorMessage('No se encontró contexto de usuario/sede');
      setShowError(true);
      return;
    }
    const sourceUid = sanitizeTextInput(transferSourceUid.toUpperCase(), 60).replace(/\s+/g, '');
    const targetUid = sanitizeTextInput(transferTargetUid.toUpperCase(), 60).replace(/\s+/g, '');
    if (!sourceUid || !targetUid) {
      setErrorMessage('Debes ingresar tarjeta origen y destino');
      setShowError(true);
      return;
    }
    if (sourceUid === targetUid) {
      setErrorMessage('La tarjeta destino debe ser diferente a la origen');
      setShowError(true);
      return;
    }

    setShowSync(true);
    setSyncStatus('syncing');
    setSyncMessage('Procesando transferencia...');
    setShowCardTransferModal(false);

    api<{ source_uid: string; target_uid: string }>(`/cards/${sourceUid}/migrate-balance`, {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        target_uid: targetUid,
        reason: 'Reposición por pérdida',
        changed_by_user_id: authUser.id,
        document_type: transferDocType,
        document_number: transferDocNumber.trim(),
      }),
    })
      .then(() => api<Card>(`/cards/${targetUid}?site_id=${siteId}`))
      .then((card) => {
        setCurrentCard(card);
        setSyncStatus('success');
        setSyncMessage(undefined);
        setTimeout(() => {
          setShowSync(false);
          setShowCardInfo(true);
        }, 450);
      })
      .catch((err: any) => {
        setSyncStatus('error');
        setSyncMessage(undefined);
        setTimeout(() => {
          setShowSync(false);
          setErrorMessage(err?.message || 'No se pudo transferir la tarjeta');
          setShowError(true);
        }, 400);
      });
  };

  const loadPrizeCatalog = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    const data = await api<PrizeCatalogItem[]>(`/prizes?site_id=${siteId}`);
    setPrizeCatalog(data);
  };

  const loadRewardCardSummary = async (uidInput?: string) => {
    const siteId = getSiteIdStored();
    const uid = sanitizeTextInput((uidInput ?? rewardCardUid).toUpperCase(), 60).replace(/\s+/g, '');
    if (!siteId || !uid) {
      setErrorMessage('Debes escanear o ingresar UID para consultar puntos.');
      setShowError(true);
      return;
    }
    setIsRewardLoading(true);
    try {
      const summary = await api<{
        card: {
          uid: string;
          status: string;
          points_balance: number;
          balance: number;
          owner: { full_name: string } | null;
        };
        points_history: Array<{
          id: string;
          occurred_at: string;
          points_delta: number;
          reason: string;
        }>;
      }>(`/prizes/card-summary?site_id=${siteId}&card_uid=${encodeURIComponent(uid)}&include_history=true&history_limit=15`);
      setRewardCardUid(uid);
      setRewardCardSummary(summary);
      setRewardReceiptNumber('');
      setRewardReceiptText('');
    } catch (err: any) {
      setRewardCardSummary(null);
      setErrorMessage(err?.message || 'No se pudo consultar la tarjeta para premios.');
      setShowError(true);
    } finally {
      setIsRewardLoading(false);
    }
  };

  const waitUidForRewards = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) {
      setErrorMessage('No se encontró la sede');
      setShowError(true);
      return;
    }
    const startedAt = Date.now();
    setShowSync(true);
    setSyncStatus('syncing');
    setSyncMessage('Esperando UID para premios...');
    try {
      for (let i = 0; i < 30; i += 1) {
        const response = await api<{ uid: string | null; timestamp: number | null }>(
          `/cards/reader/wait-uid?site_id=${siteId}&after=${startedAt}`
        );
        if (response.uid) {
          setRewardCardUid(response.uid);
          setSyncStatus('success');
          setSyncMessage(undefined);
          setTimeout(() => setShowSync(false), 300);
          await loadRewardCardSummary(response.uid);
          return;
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setSyncStatus('error');
      setSyncMessage(undefined);
      setTimeout(() => {
        setShowSync(false);
        setErrorMessage('Tiempo de espera agotado para UID de premios.');
        setShowError(true);
      }, 300);
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(undefined);
      setTimeout(() => {
        setShowSync(false);
        setErrorMessage(err?.message || 'No se pudo consultar UID para premios.');
        setShowError(true);
      }, 300);
    }
  };

  const handleRedeemPrize = async () => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser) {
      setErrorMessage('No hay contexto de usuario/sede para redimir.');
      setShowError(true);
      return;
    }
    if (!rewardCardSummary?.card?.uid) {
      setErrorMessage('Debes consultar una tarjeta para redimir.');
      setShowError(true);
      return;
    }
    if (rewardCardSummary.card.status !== 'ACTIVE') {
      setErrorMessage('La tarjeta debe estar ACTIVA para redimir premios.');
      setShowError(true);
      return;
    }
    const itemId = selectedPrizeId;
    const qty = Number.parseInt(selectedPrizeQty || '1', 10);
    if (!itemId || !Number.isInteger(qty) || qty <= 0) {
      setErrorMessage('Selecciona un premio y cantidad válida.');
      setShowError(true);
      return;
    }
    const prize = prizeCatalog.find((row) => row.id === itemId);
    if (!prize) {
      setErrorMessage('Premio no encontrado en catálogo.');
      setShowError(true);
      return;
    }
    const totalPoints = prize.points_cost * qty;
    if (prize.stock < qty) {
      setErrorMessage('No hay inventario suficiente para ese premio.');
      setShowError(true);
      return;
    }
    if ((rewardCardSummary.card.points_balance ?? 0) < totalPoints) {
      setErrorMessage('La tarjeta no tiene puntos suficientes.');
      setShowError(true);
      return;
    }

    setIsRewardRedeeming(true);
    try {
      const result = await api<{
        receipt_number: string;
        receipt_text: string;
      }>('/prizes/redeem', {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          card_uid: rewardCardSummary.card.uid,
          item_id: itemId,
          quantity: qty,
          performed_by_user_id: authUser.id,
          notes: rewardRedeemNotes.trim() || undefined,
        }),
      });
      setRewardReceiptNumber(result.receipt_number);
      setRewardReceiptText(result.receipt_text);
      await Promise.all([
        loadRewardCardSummary(rewardCardSummary.card.uid),
        loadPrizeCatalog(),
      ]);
      setShowRewardsRedeemConfirm(false);
      setRewardRedeemNotes('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'No se pudo redimir el premio.');
      setShowError(true);
    } finally {
      setIsRewardRedeeming(false);
    }
  };

  // Bonus calculado para recarga
  const rechargeValue = parseInt(rechargeAmount) || 0;
  const bonus = bonusScales.reduce((acc, b) => {
    if (rechargeValue >= b.min && (b.max === null || rechargeValue <= b.max)) return b.bonus;
    return acc;
  }, 0);
  const points = siteConfig
    ? Math.floor(rechargeValue / siteConfig.currencyUnit) * siteConfig.pointsPerCurrency
    : 0;
  const openingAmountInput = Number.parseInt(openingCashInput, 10);
  const openingAmountValue = Number.isNaN(openingAmountInput) ? 0 : openingAmountInput;
  const closingAmountInput = Number.parseInt(closingCashInput, 10);
  const closingAmountValue = Number.isNaN(closingAmountInput) ? 0 : closingAmountInput;
  const withdrawalAmountParsed = Number.parseInt(withdrawalAmountInput, 10);
  const withdrawalAmountValue = Number.isNaN(withdrawalAmountParsed) ? 0 : withdrawalAmountParsed;
  const withdrawalExceedsCash = withdrawalAmountValue > expectedCashAmount;
  const daySalesValue = Number.parseFloat(daySummary?.sales_today ?? '0') || 0;
  const dayGoalValue = Number.parseFloat(daySummary?.daily_goal ?? '0') || 0;
  const dayOutflowsValue = Number.parseFloat(daySummary?.cash_outflows ?? '0') || 0;
  const dayCashBalanceValue = Number.parseFloat(daySummary?.cash_balance_expected ?? '0') || 0;
  const dayGoalPct = Math.max(0, daySummary?.goal_pct ?? 0);
  const goalProgressData = [{
    label: 'Meta diaria',
    achieved: Math.min(dayGoalPct, 100),
    remaining: Math.max(0, 100 - Math.min(dayGoalPct, 100)),
    overflow: Math.max(0, dayGoalPct - 100),
  }];

  const attemptOpenCash = (amount: number, approvalId?: string | null) => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser || !posContext.terminalId || !posContext.cashRegisterId) {
      setErrorMessage('No se encontró el contexto de caja');
      setShowError(true);
      return;
    }

    api<{ id: string; status: string; opening_cash_amount: string; expected_cash_amount: string }>('/cash-sessions/open', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        terminal_id: posContext.terminalId,
        cash_register_id: posContext.cashRegisterId,
        shift_id: posContext.shiftId ?? undefined,
        opened_by_user_id: authUser.id,
        opening_cash_amount: amount.toFixed(2),
        approval_id: approvalId ?? null,
      }),
    })
      .then((res) => {
        setOpeningCashAmount(parseFloat(res.opening_cash_amount));
        setExpectedCashAmount(parseFloat(res.expected_cash_amount));
        setCashSales(0);
        setCashWithdrawalsAmount(0);
        setIsOpen(true);
        setPosContext(prev => ({ ...prev, cashSessionId: res.id }));
        setOpeningCashInput('');
        setShowOpenCashModal(false);
        refreshDaySummary(siteId).catch(() => null);
      })
      .catch((err) => {
        setErrorMessage(err?.message || 'No se pudo abrir la caja');
        setShowError(true);
      });
  };

  const dispatchCheckoutStep = (event: CheckoutEvent) => {
    setCheckoutStep((prev) =>
      transitionCheckoutStep(prev, event, {
        selectedPayment,
        requiresInvoice,
        canProvideChange,
      })
    );
  };

  const attemptCloseCash = (amount: number, approvalId?: string | null) => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser || !posContext.cashSessionId) {
      setErrorMessage('No hay una caja abierta para cerrar');
      setShowError(true);
      return;
    }

    api<{ totals: { difference: string } }>(`/cash-sessions/${posContext.cashSessionId}/close`, {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        closed_by_user_id: authUser.id,
        closing_cash_amount: amount.toFixed(2),
        close_reason: 'Cierre de caja',
        approval_id: approvalId ?? null,
      }),
    })
      .then(() => {
        setIsOpen(false);
        setOpeningCashAmount(0);
        setCashSales(0);
        setCashWithdrawalsAmount(0);
        setExpectedCashAmount(0);
        setClosingCashInput('');
        clearCashState();
        setPosContext(prev => ({ ...prev, cashSessionId: null }));
        setShowCloseCashModal(false);
        refreshDaySummary(siteId).catch(() => null);
      })
      .catch((err) => {
        setErrorMessage(err?.message || 'No se pudo cerrar la caja');
        setShowError(true);
      });
  };

  const handleToggleCash = () => {
    if (!isOpen) {
      const siteId = getSiteIdStored();
      if (!siteId || !posContext.terminalId || !posContext.cashRegisterId) {
        setOpeningCashInput('0');
        setCashOpeningReference(null);
        setShowOpenCashModal(true);
        return;
      }
      api<{
        suggested_opening_cash: string;
        last_closed_cash: string;
        last_closed_at: string | null;
      }>(`/cash-sessions/open/reference?site_id=${siteId}&terminal_id=${posContext.terminalId}&cash_register_id=${posContext.cashRegisterId}`)
        .then((reference) => {
          const suggested = Math.round(parseFloat(reference.suggested_opening_cash) || 0);
          setOpeningCashInput(String(suggested));
          setCashOpeningReference({
            suggestedOpeningCash: suggested,
            lastClosedCash: parseFloat(reference.last_closed_cash),
            lastClosedAt: reference.last_closed_at,
          });
        })
        .catch(() => {
          setOpeningCashInput('0');
          setCashOpeningReference(null);
        })
        .finally(() => {
          setShowOpenCashModal(true);
        });
      return;
    }
    if (posContext.cashSessionId) {
      api<{ opening_cash_amount: string; cash_sales: string; expected_cash_amount: string; withdrawals_amount: string }>(`/cash-sessions/${posContext.cashSessionId}`)
        .then((summary) => {
          setOpeningCashAmount(parseFloat(summary.opening_cash_amount));
          setCashSales(parseFloat(summary.cash_sales));
          setExpectedCashAmount(parseFloat(summary.expected_cash_amount));
          setCashWithdrawalsAmount(parseFloat(summary.withdrawals_amount));
          setClosingCashInput(String(Math.round(parseFloat(summary.expected_cash_amount) || 0)));
        })
        .catch(() => null)
        .finally(() => setShowCloseCashModal(true));
      return;
    }
    setShowCloseCashModal(true);
  };

  const handleSupervisorAuth = () => {
    if (!pendingAction) return;
    if (pendingAction === 'delete_card') {
      setShowSupervisorAuth(false);
      setSupervisorPin('');
      setPendingAction(null);
      setShowConfirmDelete(true);
      return;
    }
    if (pendingAction === 'cash_withdrawal') {
      if (!posContext.cashSessionId) {
        setErrorMessage('No hay una caja activa para autorizar el retiro.');
        setShowError(true);
        return;
      }
      createSupervisorApproval({
        entityId: posContext.cashSessionId,
        entityType: 'CASH_SESSION',
        action: 'OTHER',
        reason: 'Autorización previa para retiro parcial de efectivo',
        supervisorCode: supervisorPin,
      })
        .then((approval) => {
          setPendingWithdrawalApproval({ id: approval.id, approved_by_id: approval.approved_by_id });
          setShowSupervisorAuth(false);
          setSupervisorPin('');
          setPendingAction(null);
          setShowCashWithdrawalModal(true);
        })
        .catch((err) => {
          setErrorMessage(err?.message || 'No se pudo autorizar el retiro.');
          setShowError(true);
        });
    }
  };

  const handleCashWithdrawal = async () => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser || !posContext.cashSessionId) {
      setErrorMessage('No hay una caja activa para registrar el retiro.');
      setShowError(true);
      return;
    }
    if (withdrawalAmountValue <= 0) {
      setErrorMessage('Ingresa un valor valido para el retiro.');
      setShowError(true);
      return;
    }
    if (withdrawalExceedsCash) {
      setErrorMessage('No puedes retirar más efectivo del disponible en caja.');
      setShowError(true);
      return;
    }
    if (!withdrawalReason.trim()) {
      setErrorMessage('Debes registrar el motivo del retiro.');
      setShowError(true);
      return;
    }
    if (!pendingWithdrawalApproval) {
      setErrorMessage('Debes autorizar primero el retiro con PIN de supervisor.');
      setShowError(true);
      return;
    }

    try {
      setWithdrawalSubmitting(true);
      await api<{ id: string }>(`/cash-sessions/${posContext.cashSessionId}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          type: 'WITHDRAWAL',
          amount: withdrawalAmountValue.toFixed(2),
          reason: withdrawalReason.trim(),
          created_by_user_id: authUser.id,
          authorized_by_user_id: pendingWithdrawalApproval.approved_by_id,
          approval_id: pendingWithdrawalApproval.id,
        }),
      });

      setShowCashWithdrawalModal(false);
      setWithdrawalAmountInput('');
      setWithdrawalReason('');
      setPendingWithdrawalApproval(null);
      await Promise.all([
        refreshDaySummary(siteId),
        refreshCashSessionSummary(posContext.cashSessionId),
      ]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'No se pudo registrar el retiro de efectivo.');
      setShowError(true);
    } finally {
      setWithdrawalSubmitting(false);
    }
  };

  const openSaleEditor = (sale: RecentSale) => {
    setEditingSale(sale);
    setSelectedPayment(resolveUiPayment(sale.payment_method));
    setEditingSaleTotalInput(sale.total);
    setEditingSaleReason('');
    setRequiresInvoice(Boolean(sale.requires_invoice));
    setCustomerPersonType((sale.customer?.person_type ?? 'natural') === 'juridica' ? 'juridica' : 'natural');
    setCustomerDocType((sale.customer?.document_type as typeof customerDocType) ?? 'CC');
    setCustomerDocNumber(sale.customer?.document_number ?? '');
    setCustomerFullName(sale.customer?.full_name ?? '');
    setCustomerPhone(sale.customer?.phone ?? '');
    setCustomerEmail(sale.customer?.email ?? '');
    setCustomerAddress(sale.customer?.address ?? '');
    setCustomerCity(sale.customer?.city ?? '');
    setShowEditSaleModal(true);
  };

  const handleSaveSaleEdits = async () => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser || !editingSale) {
      setErrorMessage('No se pudo resolver la venta a editar.');
      setShowError(true);
      return;
    }
    if (requiresInvoice && !isCustomerComplete) {
      setErrorMessage('Completa los datos de facturación.');
      setShowError(true);
      return;
    }
    const normalizedTotal = editingSaleTotalInput.replace(/[^\d.]/g, '');
    const wantsAmountEdit = isSupervisorView && normalizedTotal && Number(normalizedTotal) !== Number(editingSale.total);
    if (wantsAmountEdit && !editingSaleReason.trim()) {
      setErrorMessage('Debes indicar la razón de la corrección.');
      setShowError(true);
      return;
    }

    try {
      setEditingSaleSaving(true);
      await api(`/sales/${editingSale.id}/metadata`, {
        method: 'PATCH',
        body: JSON.stringify({
          site_id: siteId,
          managed_by_user_id: authUser.id,
          payment_method: resolvePaymentMethod(selectedPayment),
          requires_invoice: requiresInvoice,
          total_amount: wantsAmountEdit ? normalizedTotal : undefined,
          correction_reason: wantsAmountEdit ? editingSaleReason.trim() : undefined,
          customer: requiresInvoice ? {
            document_type: customerDocType,
            document_number: customerDocNumber.trim(),
            full_name: customerFullName.trim(),
            phone: customerPhone.trim(),
            email: customerEmail.trim(),
            address: customerAddress.trim(),
            city: customerCity.trim(),
            person_type: customerPersonType,
          } : undefined,
        }),
      });
      await loadSalesHistory(siteId, salesHistoryPage);
      setShowEditSaleModal(false);
      setEditingSale(null);
      setEditingSaleTotalInput('');
      setEditingSaleReason('');
      if (pendingPostSaleInvoice) {
        setPendingPostSaleInvoice(false);
        setShowReceipt(true);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'No se pudo actualizar la venta.');
      setShowError(true);
    } finally {
      setEditingSaleSaving(false);
    }
  };

  const handleReprintSale = async (sale?: RecentSale | null) => {
    const targetSale = sale ?? editingSale;
    const siteId = getSiteIdStored();
    if (!siteId || !targetSale?.id) {
      setErrorMessage('No se encontró la venta para reimprimir.');
      setShowError(true);
      return;
    }
    try {
      const { blob, filename } = await apiFile(`/sales/${targetSale.id}/receipt.pdf?site_id=${siteId}`);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename || `factura-${targetSale.receipt_number || targetSale.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setErrorMessage(err?.message || 'No se pudo reimprimir la venta.');
      setShowError(true);
    }
  };

  const handleVoidSale = async (sale: RecentSale) => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser?.id) {
      setErrorMessage('No se encontró contexto para anular la venta.');
      setShowError(true);
      return;
    }
    const reason = editingSaleReason.trim();
    if (!reason) {
      setErrorMessage('Debes indicar la razón de anulación o corrección.');
      setShowError(true);
      return;
    }
    try {
      setEditingSaleSaving(true);
      await api(`/sales/${sale.id}/void`, {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          voided_by_user_id: authUser.id,
          reason,
        }),
      });
      await loadSalesHistory(siteId, salesHistoryPage);
      setShowEditSaleModal(false);
      setEditingSale(null);
      setEditingSaleTotalInput('');
      setEditingSaleReason('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'No se pudo anular la venta.');
      setShowError(true);
    } finally {
      setEditingSaleSaving(false);
    }
  };

  const handleLogout = () => {
    if (isOpen) {
      setErrorMessage('No puedes salir con la caja abierta. Cierra la caja primero.');
      setShowError(true);
      return;
    }
    setShowExitConfirm(true);
  };

  useEffect(() => {
    setCashOpen(isOpen);
  }, [isOpen]);

  useEffect(() => {
    setCashState({ openingCashAmount, cashSales, cashSessionId: posContext.cashSessionId ?? null });
  }, [openingCashAmount, cashSales, posContext.cashSessionId]);

  useEffect(() => {
    if (!showCardTransferModal) return;
    const siteId = getSiteIdStored();
    const doc = transferDocNumber.trim();
    if (!siteId || doc.length < 4) {
      setTransferOwnerCards([]);
      return;
    }

    const timer = setTimeout(() => {
      setIsLoadingTransferOwnerCards(true);
      api<Array<{ uid: string; label: string | null; status: string; balance: number; points: number }>>(
        `/cards/by-owner?site_id=${siteId}&document_type=${transferDocType}&document_number=${encodeURIComponent(doc)}`
      )
        .then((cards) => {
          setTransferOwnerCards(cards);
          if (cards.length > 0 && !cards.some((card) => card.uid === transferSourceUid)) {
            setTransferSourceUid(cards[0].uid);
          }
          if (cards.length === 0) {
            setTransferSourceUid('');
          }
        })
        .catch(() => {
          setTransferOwnerCards([]);
        })
        .finally(() => setIsLoadingTransferOwnerCards(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [showCardTransferModal, transferDocType, transferDocNumber]);

  useEffect(() => {
    const siteId = getSiteIdStored();
    if (!siteId) return;

    api<{ shift_id: string | null; terminal_id: string | null; cash_register_id: string | null; cash_session_id: string | null }>(
      `/pos/context?site_id=${siteId}`
    )
      .then((ctx) => {
        setPosContext({
          shiftId: ctx.shift_id,
          terminalId: ctx.terminal_id,
          cashRegisterId: ctx.cash_register_id,
          cashSessionId: ctx.cash_session_id,
        });
        if (ctx.cash_session_id) {
          setIsOpen(true);
          setCashOpen(true);
          api<{ opening_cash_amount: string; cash_sales: string; expected_cash_amount: string }>(`/cash-sessions/${ctx.cash_session_id}`)
            .then((summary) => {
              setOpeningCashAmount(parseFloat(summary.opening_cash_amount));
              setCashSales(parseFloat(summary.cash_sales));
              setExpectedCashAmount(parseFloat(summary.expected_cash_amount));
              refreshCashSessionSummary(ctx.cash_session_id).catch(() => null);
            })
            .catch(() => null);
        } else {
          setIsOpen(false);
          setCashOpen(false);
          clearCashState();
          setOpeningCashAmount(0);
          setCashSales(0);
          setCashWithdrawalsAmount(0);
          setExpectedCashAmount(0);
        }
      })
      .catch(() => null);

    api<Array<{
      id: string;
      name: string;
      price: string;
      category: string;
      sku?: string | null;
      analytics_category?: string | null;
      analytics_subcategory?: string | null;
    }>>(`/products?site_id=${siteId}`)
      .then((list) => {
        const normalized = list.map((p) => {
          const parsedPrice = Number.parseFloat(String(p.price ?? '0'));
          return {
            id: p.id,
            name: p.name,
            price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
            category: (p.analytics_category || p.category || 'Otros').trim(),
            saleCategory: (p.category || '').trim().toUpperCase(),
            sku: (p.sku || '').trim(),
            subcategory: (p.analytics_subcategory || 'Sin subcategoría').trim(),
          };
        });
        setProducts(normalized);
        const cats = Array.from(new Set(normalized.map((p) => p.category))).map(c => ({ id: c, name: c }));
        setCategories(cats);
      })
      .catch(() => setProducts([]));

    api<Array<{ id: string; min_amount: string; max_amount: string | null; bonus_amount: string }>>(`/bonus-scales?site_id=${siteId}`)
      .then((list) => {
        setBonusScales(list.map(b => ({
          min: parseFloat(b.min_amount),
          max: b.max_amount ? parseFloat(b.max_amount) : null,
          bonus: parseFloat(b.bonus_amount),
        })));
      })
      .catch(() => setBonusScales([]));

    api<{ min_recharge_amount: string; points_per_currency: number; currency_unit: number }>(`/site-config?site_id=${siteId}`)
      .then((cfg) => setSiteConfig({
        minRecharge: parseFloat(cfg.min_recharge_amount),
        pointsPerCurrency: cfg.points_per_currency,
        currencyUnit: cfg.currency_unit,
      }))
      .catch(() => setSiteConfig(null));

    loadSalesHistory(siteId, 1).catch(() => null);
    refreshDaySummary(siteId).catch(() => null);
    loadPrizeCatalog().catch(() => setPrizeCatalog([]));
  }, []);

  const renderPaymentStep = () => (
    <section className="space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4">
      <p className="font-semibold">Medio de Pago</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { id: 'cash', icon: Wallet, label: 'Efectivo', hint: 'Caja' },
          { id: 'transfer_account_1', icon: Smartphone, label: 'Transferencia Cta 1', hint: 'Cuenta 1' },
          { id: 'transfer_account_2', icon: Smartphone, label: 'Transferencia Cta 2', hint: 'Cuenta 2' },
          { id: 'nequi', icon: Smartphone, label: 'Nequi', hint: 'Billetera' },
          { id: 'credit_card', icon: CardIcon, label: 'Tarjeta crédito', hint: 'Datáfono' },
          { id: 'credit', icon: CardIcon, label: 'Crédito', hint: 'Saldo pendiente' },
        ].map(method => (
          <motion.button
            key={method.id}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              const nextMethod = method.id as PaymentMethod;
              setSelectedPayment(nextMethod);
              if (nextMethod !== 'cash') setCashReceivedInput('');
            }}
            className={cn(
              'tile-option flex items-center gap-2.5 rounded-2xl p-2.5 transition-all hover:scale-[1.01]',
              selectedPayment === method.id
                ? 'tile-option-active shadow-lg ring-2 ring-primary/40'
                : 'tile-option-muted'
            )}
          >
            <method.icon className="h-4 w-4" />
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium leading-none">{method.label}</span>
              <span className="text-[11px] text-muted-foreground">{method.hint}</span>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );

  const renderCashTenderStep = () => (
    <section className="space-y-3 rounded-2xl border border-border/50 bg-card/40 p-3">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Paso 1.5: Entrega en Efectivo</p>
        <span className="text-xs text-muted-foreground">Ingresa el valor recibido</span>
      </div>
      <input
        className="input-pos-compact py-2"
        placeholder="Paga con"
        value={cashReceivedInput}
        onChange={(e) => setCashReceivedInput(sanitizeNumericInput(e.target.value, 7))}
      />
      <div className="grid grid-cols-3 gap-2">
        {[20000, 50000, 100000].map((amount) => (
          <button
            key={amount}
            type="button"
            className="rounded-lg border border-border/60 bg-background/70 px-3 py-2 text-sm font-medium transition hover:bg-secondary"
            onClick={() => applyCashReceivedPreset(amount)}
          >
            {formatCurrency(amount)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-secondary/60 p-2">
          <p className="text-muted-foreground">Recibido</p>
          <p className="font-semibold">{formatCurrency(cashReceivedValue)}</p>
        </div>
        <div className="rounded-lg bg-secondary/60 p-2">
          <p className="text-muted-foreground">Vueltas</p>
          <p className="font-semibold">{formatCurrency(changeDue)}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setCashReceivedInput('')}
        >
          Limpiar valor recibido
        </button>
      </div>
      {cashReceivedValue > 0 && cashReceivedValue < total && (
        <p className="text-xs text-destructive">El valor recibido no cubre el total.</p>
      )}
    </section>
  );

  const renderInvoiceStep = () => (
    <section className="space-y-3 rounded-2xl border border-border/50 bg-card/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Datos de Factura</h3>
        <span className="text-[11px] text-muted-foreground">Completa la información del cliente</span>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 p-2.5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Identificación fiscal</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={cn('tile-option justify-center rounded-xl py-1.5 text-sm', customerPersonType === 'natural' && 'tile-option-active')}
            onClick={() => setCustomerPersonType('natural')}
          >
            Persona Natural
          </button>
          <button
            type="button"
            className={cn('tile-option justify-center rounded-xl py-1.5 text-sm', customerPersonType === 'juridica' && 'tile-option-active')}
            onClick={() => setCustomerPersonType('juridica')}
          >
            Persona Jurídica
          </button>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <Select
            value={customerDocType}
            onValueChange={(value) => setCustomerDocType(value as typeof customerDocType)}
            disabled={customerPersonType === 'juridica'}
          >
            <SelectTrigger className="input-pos-compact py-1.5 col-span-2">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {customerPersonType === 'natural' && (
                <>
                  <SelectItem value="CC">CC</SelectItem>
                  <SelectItem value="CE">CE</SelectItem>
                  <SelectItem value="PAS">PAS</SelectItem>
                </>
              )}
              <SelectItem value="NIT">NIT</SelectItem>
            </SelectContent>
          </Select>
          <input
            className="input-pos-compact py-1.5 col-span-3"
            placeholder="Número de documento"
            value={customerDocNumber}
            onChange={(e) => setCustomerDocNumber(sanitizeTextInput(e.target.value, 40))}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 p-2.5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Datos principales</p>
        <input
          className="input-pos-compact py-1.5"
          placeholder={customerPersonType === 'juridica' ? 'Razón social' : 'Nombre completo'}
          value={customerFullName}
          onChange={(e) => setCustomerFullName(sanitizeTextInput(e.target.value, 120))}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input-pos-compact py-1.5"
            placeholder="Ciudad"
            value={customerCity}
            onChange={(e) => setCustomerCity(sanitizeTextInput(e.target.value, 80))}
          />
          <input
            className="input-pos-compact py-1.5"
            placeholder="Dirección"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(sanitizeTextInput(e.target.value, 160))}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 p-2.5 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Contacto</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input-pos-compact py-1.5"
            placeholder="Teléfono"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(sanitizeNumericInput(e.target.value, 20))}
          />
          <input
            className="input-pos-compact py-1.5"
            placeholder="Correo electrónico"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(sanitizeEmailInput(e.target.value, 160))}
          />
        </div>
      </div>

      {!isCustomerComplete && (
        <p className="text-xs text-destructive">
          Completa los datos del cliente para facturar.
        </p>
      )}
    </section>
  );

  return (
    <POSLayout
      userName={authUser?.name ?? 'Cajero'}
      userRole={authUser?.role === 'admin' ? 'Administrador' : authUser?.role === 'supervisor' ? 'Supervisor' : 'Cajero'}
      currentViewLabel="Cajero"
      onLogout={handleLogout}
      logoutDisabled={isOpen}
      viewOptions={buildViewOptions(authUser?.role, navigate)}
    >
      <div className="flex w-full pos-full-height">
        {/* === SECCIÓN IZQUIERDA: TARJETAS === */}
        <div className="pos-sidebar w-[22%] min-w-[232px]">
          {/* Botón Abrir/Cerrar Caja */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wide">
              <span>Estado de Caja</span>
              <span className={cn('badge-pos', isOpen ? 'badge-success' : 'badge-danger')}>
                {isOpen ? 'Abierta' : 'Cerrada'}
              </span>
            </div>
            <POSButton
              variant={isOpen ? 'danger' : 'success'}
              icon={isOpen ? PowerOff : Power}
              fullWidth
              size="md"
              onClick={handleToggleCash}
            >
              {isOpen ? 'Cerrar Caja' : 'Abrir Caja'}
            </POSButton>
            <POSButton
              variant="secondary"
              fullWidth
              size="sm"
              disabled={!isOpen}
              onClick={() => {
                setWithdrawalAmountInput('');
                setWithdrawalReason('');
                setPendingWithdrawalApproval(null);
                setSupervisorPin('');
                setPendingAction('cash_withdrawal');
                setShowSupervisorAuth(true);
              }}
            >
              Retiro de efectivo
            </POSButton>
            <POSButton
              variant="secondary"
              fullWidth
              size="sm"
              onClick={() => {
                const siteId = getSiteIdStored();
                setSalesHistoryPage(1);
                if (siteId) loadSalesHistory(siteId, 1).catch(() => null);
                setShowSalesHistory(true);
              }}
            >
              Historial de Ventas
            </POSButton>
          </div>

          {/* Acciones de Tarjetas */}
          <div className="flex-1 p-4 space-y-3">
            <div className="pos-section-title flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Tarjetas
            </div>

            <div className="grid grid-cols-2 gap-2">
              <POSButton
                variant="secondary"
                icon={Plus}
                fullWidth
                size="sm"
                className="px-2 text-xs"
                disabled={!isOpen}
                onClick={() => {
                  openCardReadModal({
                    openRecharge: true,
                    createIfMissing: true,
                    flowMode: 'issue_and_recharge',
                  });
                }}
              >
                Crear tarjeta
              </POSButton>

              <POSButton
                variant="success"
                icon={RefreshCw}
                fullWidth
                size="sm"
                className="px-2 text-xs"
                disabled={!isOpen}
                onClick={() => {
                  openCardReadModal({
                    openRecharge: true,
                    createIfMissing: false,
                    flowMode: 'recharge_only',
                  });
                }}
              >
                Recargar
              </POSButton>

              <POSButton
                variant="secondary"
                icon={Eye}
                fullWidth
                size="sm"
                className="px-2 text-xs"
                disabled={!isOpen}
                onClick={() => openCardReadModal({ openRecharge: false, createIfMissing: false, flowMode: 'recharge_only' })}
              >
                Ver saldo
              </POSButton>

              <POSButton
                variant="secondary"
                icon={ArrowRightLeft}
                fullWidth
                size="sm"
                className="px-2 text-xs"
                disabled={!isOpen}
                onClick={() => {
                  setTransferSourceUid(currentCard?.code ?? '');
                  setTransferTargetUid('');
                  setTransferDocType('CC');
                  setTransferDocNumber('');
                  setTransferOwnerCards([]);
                  setShowCardTransferModal(true);
                }}
              >
                Transferir
              </POSButton>
            </div>

            <div className="pos-section-divider" />

            <div className="pos-section-title flex items-center gap-2">
              <Gift className="h-4 w-4 text-muted-foreground" />
              Premios
            </div>

            <POSButton
              variant="secondary"
              icon={Gift}
              fullWidth
              size="md"
              disabled={!isOpen}
              onClick={() => {
                setShowRewardsModal(true);
                setRewardReceiptNumber('');
                setRewardReceiptText('');
                loadPrizeCatalog().catch(() => null);
              }}
            >
              Redimir premios
            </POSButton>

            <div className="pos-section-divider" />

            <div className="pos-section-title flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Riesgo
            </div>

            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-destructive/90">
                Accion irreversible
              </p>
              <p className="text-xs text-muted-foreground">
                Elimina la tarjeta actual solo con autorizacion de supervisor.
              </p>
              <POSButton
                variant="danger"
                icon={Trash2}
                fullWidth
                size="md"
                className="shadow-none"
                disabled={!isOpen}
                onClick={() => {
                  setPendingAction('delete_card');
                  setSupervisorPin('');
                  setShowSupervisorAuth(true);
                }}
              >
                Eliminar tarjeta
              </POSButton>
            </div>
          </div>

        </div>

        {/* === SECCIÓN DERECHA: PRODUCTOS + CARRITO === */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_380px] bg-background">
          <div className="min-w-0 min-h-0 flex flex-col border-r border-border">
          {/* Nivel 1: Categorías */}
          <div className="border-b border-border bg-surface px-4 py-3 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn('chip-pos h-11', selectedCategory === 'all' && 'chip-pos-active')}
                >
                  Todas
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn('chip-pos h-11', selectedCategory === cat.id && 'chip-pos-active')}
                  >
                    {categoryLabels[cat.name] ?? cat.name}
                  </button>
                ))}
              </div>

            </div>
          </div>

          {/* Nivel 2: Búsqueda + Acciones */}
          <div className="border-b border-border bg-background px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(140px,0.65fr)]">
                <div className="relative min-w-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={productSearchInputRef}
                  className="input-pos-compact h-11 w-full rounded-xl pl-10 pr-12"
                  placeholder="Buscar producto o SKU... (/ o Ctrl+K)"
                  value={productSearchTerm}
                  onChange={(event) => setProductSearchTerm(sanitizeTextInput(event.target.value.toUpperCase(), 80))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleScanAdd();
                    }
                  }}
                />
                <button
                  type="button"
                  className={cn(
                    'absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-border/60 bg-background/80 hover:bg-secondary',
                    isSimulatingScan && 'animate-pulse'
                  )}
                  onClick={handleSimulatedSkuScan}
                  title="Agregar por escaneo/búsqueda (Alt+S)"
                >
                  <QrCode className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
                <Select value={productSortBy} onValueChange={(value) => setProductSortBy(value as ProductSortBy)}>
                  <SelectTrigger className="input-pos-compact h-11 w-full md:max-w-[180px]">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Ordenar</SelectItem>
                    <SelectItem value="best_sellers">Mas vendidos</SelectItem>
                    <SelectItem value="worst_sellers">Menos vendidos</SelectItem>
                    <SelectItem value="price_desc">Mayor precio</SelectItem>
                    <SelectItem value="price_asc">Menor precio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                onClick={() => setOnlyFavorites((prev) => !prev)}
                className={cn('chip-pos h-11', onlyFavorites && 'chip-pos-active')}
                title="Mostrar solo favoritos (Alt+F)"
              >
                Favoritos
                {favoriteProductIds.length > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">({favoriteProductIds.length})</span>
                )}
              </button>
            </div>
          </div>

          {/* Nivel 3: Subcategorías */}
          {selectedCategory !== 'all' && (
            <div className="border-b border-border bg-muted/30 px-4 py-2">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedSubcategory('all')}
                  className={cn('chip-pos h-9 text-xs', selectedSubcategory === 'all' && 'chip-pos-active')}
                >
                  Todas subcategorías
                </button>
                {availableSubcategories.map((subcategory) => (
                  <button
                    key={subcategory}
                    type="button"
                    onClick={() => setSelectedSubcategory(subcategory)}
                    className={cn('chip-pos h-9 text-xs', selectedSubcategory === subcategory && 'chip-pos-active')}
                  >
                    {subcategory}
                  </button>
                ))}
              </div>
            </div>
          )}

            {/* Grid de Productos */}
            <div className="flex-1 min-h-0 overflow-auto p-4">
              <div className="products-grid">
                {filteredProducts.map(product => {
                  const categoryLabel = categoryLabelById.get(product.category) ?? 'Producto';
                  const categoryTheme = getProductCategoryTheme(product.category);
                  const hasPrice = Number.isFinite(product.price) && product.price > 0;
                  const isFavorite = favoriteProductIdSet.has(product.id);
                  return (
                    <button
                      key={product.id}
                      onClick={() => isOpen && addToCart(product.id)}
                      disabled={!isOpen || !hasPrice}
                      className={cn(
                        'product-card relative',
                        categoryTheme.card,
                        (!isOpen || !hasPrice) && 'opacity-50 cursor-not-allowed',
                        lastAddedProductId === product.id && 'pulse-success border-success/50'
                      )}
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleFavorite(product.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleFavorite(product.id);
                          }
                        }}
                        className={cn(
                          'absolute right-2 top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1 text-[11px] font-semibold',
                          isFavorite ? 'border-amber-500/60 bg-amber-100 text-amber-700' : 'border-border/60 bg-background/70 text-muted-foreground'
                        )}
                        title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      >
                        {isFavorite ? '★' : '☆'}
                      </span>
                      <p className={cn('text-xs', categoryTheme.categoryText)}>{categoryLabel}</p>
                      <p className="text-[11px] text-muted-foreground">{product.sku || 'Sin código'} • {product.subcategory}</p>
                      <p className={cn('product-price', hasPrice ? categoryTheme.priceText : 'text-muted-foreground')}>
                        {hasPrice ? formatCurrency(product.price) : 'Sin precio'}
                      </p>
                      <p className="product-name line-clamp-2">{product.name}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar Carrito */}
          <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-card/80 backdrop-blur">
            <div className="border-b border-border/70 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <ShoppingCart className="h-5 w-5" />
                  Carrito
                </h2>
                <span className="badge-pos">{cart.length} ítems</span>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
              {cart.length === 0 && (
                <div className="mt-2 rounded-2xl border border-dashed border-border/80 bg-secondary/20 p-6 text-center text-sm text-muted-foreground">
                  Aún no hay productos en el carrito.
                </div>
              )}
              <div className="space-y-2.5">
                {cart.map(item => (
                  <div key={item.id} className="rounded-xl border border-border/60 bg-background/70 p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium">{item.productName}</p>
                      <p className="shrink-0 text-sm font-semibold">{formatCurrency(item.total)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)} c/u</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.id, -1)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/60 hover:bg-muted"
                          title="Disminuir"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-6 text-center text-sm font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/60 hover:bg-muted"
                          title="Aumentar"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={cn('sticky bottom-0 z-10 border-t border-border bg-card/95 px-4 py-4 space-y-3 backdrop-blur', lastAddTick ? 'slide-up' : '')}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Productos</span>
                <span className="font-semibold">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-bold">{formatCurrency(total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <POSButton
                  variant="secondary"
                  size="md"
                  fullWidth
                  disabled={cart.length === 0}
                  onClick={() => setCart([])}
                >
                  Vaciar
                </POSButton>
                <POSButton
                  variant="success"
                  icon={DollarSign}
                  size="md"
                  fullWidth
                  disabled={!isOpen || cart.length === 0}
                  onClick={openCheckoutModal}
                >
                  Cobrar
                </POSButton>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {currentCard && (
        <div
          className="pointer-events-none fixed bottom-3 z-40 -translate-x-1/2"
          style={{ left: centralDockLeft, width: activeCardDockWidth }}
        >
          <div className="mx-auto rounded-full border border-border/70 bg-background/88 px-5 py-2 shadow-lg backdrop-blur">
            <div className="flex items-center justify-center gap-4 text-xs md:text-sm">
              <span className="font-semibold">Tarjeta Activa</span>
              <span className="font-mono text-primary">{currentCard.code}</span>
              {currentCard.label && <span className="text-muted-foreground">{currentCard.label}</span>}
              <span className="text-muted-foreground">Saldo: <span className="font-semibold text-foreground">{formatCurrency(currentCard.balance)}</span></span>
              <span className="text-muted-foreground">Puntos: <span className="font-semibold text-foreground">{currentCard.points.toLocaleString()}</span></span>
            </div>
          </div>
        </div>
      )}

      <div
        className="pointer-events-none fixed bottom-20 z-40 hidden -translate-x-1/2 xl:block"
        style={{ left: centralDockLeft, width: statusDockWidth }}
      >
        <div className="flex flex-col items-center gap-2">
          {expectedCashAmount >= 500000 && (
            <div className="w-[min(92vw,560px)] rounded-[26px] border border-amber-400/60 bg-amber-50/90 px-4 py-3 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">Advertencia de efectivo</p>
                  <p className="mt-1 text-sm font-bold leading-tight text-amber-950">
                    La caja superó los $500.000 y requiere retiro parcial.
                  </p>
                </div>
                <div className="shrink-0 rounded-2xl bg-amber-500/15 px-3 py-2 text-right">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-amber-700">Efectivo esperado</p>
                  <p className="text-base font-bold text-amber-950">{formatCurrency(expectedCashAmount)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-stretch gap-2 rounded-full border border-border/70 bg-background/84 px-3 py-1.5 shadow-lg backdrop-blur">
            <div className="min-w-[170px] rounded-full bg-card/80 px-4 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Saldo en caja</p>
              <p className="mt-0.5 text-sm font-bold">{formatCurrency(dayCashBalanceValue)}</p>
            </div>
            <div className="min-w-[170px] rounded-full bg-card/80 px-4 py-1.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Total día</p>
              <p className="mt-0.5 text-sm font-bold">{formatCurrency(daySalesValue)}</p>
            </div>
            <div className="min-w-[300px] rounded-full bg-card/80 px-4 py-1.5">
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>Meta diaria</span>
                <span>{dayGoalPct.toFixed(1)}%</span>
              </div>
              <div className="h-6 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={goalProgressData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide domain={[0, Math.max(100, Math.ceil(dayGoalPct / 10) * 10)]} />
                    <YAxis type="category" dataKey="label" hide />
                    <Tooltip
                      cursor={false}
                      formatter={(value: number) => `${Number(value).toFixed(1)}%`}
                      labelFormatter={() => 'Cumplimiento'}
                    />
                    <Bar dataKey="achieved" stackId="goal" fill="#16a34a" radius={[8, 0, 0, 8]} />
                    <Bar dataKey="remaining" stackId="goal" fill="#e5e7eb" radius={[0, 8, 8, 0]} />
                    <Bar dataKey="overflow" stackId="overflow" fill="#2563eb" radius={[8, 8, 8, 8]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === MODALES === */}

      {/* Modal Lectura Tarjeta */}
      <POSModal
        isOpen={showCardReadModal}
        onClose={() => { setShowCardReadModal(false); setPendingCardRead(null); }}
        title={(pendingCardRead?.createIfMissing ? 'Leer / Emitir Tarjeta' : 'Leer Tarjeta')}
        size="md"
        footer={(
          <>
            <POSButton variant="secondary" onClick={() => { setShowCardReadModal(false); setPendingCardRead(null); }}>
              Cancelar
            </POSButton>
          </>
        )}
      >
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">UID de tarjeta</p>
            <POSButton
              variant={cardUidInput ? "success" : "primary"}
              fullWidth
              onClick={() => waitUidFromApi('card_read')}
            >
              {cardUidInput ? 'Escaneado y procesado' : 'Escanear'}
            </POSButton>
          </div>
          {pendingCardRead?.createIfMissing && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Nombre personalizado de tarjeta (opcional)</p>
              <input
                className="input-pos-compact h-11 w-full"
                placeholder="Ej: Tarjeta de Juan"
                value={cardCustomName}
                onChange={(event) => setCardCustomName(sanitizeTextInput(event.target.value, 120))}
              />
            </div>
          )}
          {pendingCardRead?.createIfMissing && (
            <div className="space-y-3 rounded-xl border border-border/50 p-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Registrar propietario</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={registerCardOwner}
                  onChange={(e) => setRegisterCardOwner(e.target.checked)}
                />
              </label>
              {registerCardOwner && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={cardOwnerDocType} onValueChange={(value) => setCardOwnerDocType(value as typeof cardOwnerDocType)}>
                      <SelectTrigger className="input-pos-compact h-10 w-full">
                        <SelectValue placeholder="Tipo doc" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CC">CC</SelectItem>
                        <SelectItem value="CE">CE</SelectItem>
                        <SelectItem value="NIT">NIT</SelectItem>
                        <SelectItem value="PAS">PAS</SelectItem>
                      </SelectContent>
                    </Select>
                    <input
                      className="input-pos-compact h-10 w-full"
                      placeholder="Documento"
                      value={cardOwnerDocNumber}
                      onChange={(e) => setCardOwnerDocNumber(sanitizeTextInput(e.target.value, 60))}
                    />
                  </div>
                  <input
                    className="input-pos-compact h-10 w-full"
                    placeholder="Nombre completo / Razón social"
                    value={cardOwnerFullName}
                    onChange={(e) => setCardOwnerFullName(sanitizeTextInput(e.target.value, 120))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="input-pos-compact h-10 w-full"
                      placeholder="Teléfono (opcional)"
                      value={cardOwnerPhone}
                      onChange={(e) => setCardOwnerPhone(sanitizeTextInput(e.target.value, 40))}
                    />
                    <input
                      className="input-pos-compact h-10 w-full"
                      placeholder="Ciudad (opcional)"
                      value={cardOwnerCity}
                      onChange={(e) => setCardOwnerCity(sanitizeTextInput(e.target.value, 80))}
                    />
                  </div>
                  <input
                    className="input-pos-compact h-10 w-full"
                    placeholder="Email (opcional)"
                    value={cardOwnerEmail}
                    onChange={(e) => setCardOwnerEmail(sanitizeEmailInput(e.target.value, 160))}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </POSModal>

      {/* Modal Lectura de Tarjeta / Info */}
      <POSModal
        isOpen={showCardInfo && !showRecharge}
        onClose={() => { setShowCardInfo(false); setCurrentCard(null); setCurrentCardActivity(null); }}
        title="Información de Tarjeta"
        size="xl"
        contentClassName="max-w-[96vw] lg:max-w-[1100px]"
      >
        {currentCard && (
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
              <div className="rounded-2xl border border-border/60 bg-secondary/35 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tarjeta activa</p>
                <p className="mt-2 text-2xl font-mono font-bold text-primary">{currentCard.code}</p>
                {currentCard.label && <p className="mt-2 text-sm font-medium text-foreground">{currentCard.label}</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge-pos badge-info">{currentCard.status ?? 'ACTIVE'}</span>
                  {currentCardActivity?.summary.last_activity_at && (
                    <span className="badge-pos">
                      Ult. mov. {new Date(currentCardActivity.summary.last_activity_at).toLocaleString('es-CO')}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="card-pos p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{formatCurrency(currentCard.balance)}</p>
                </div>
                <div className="card-pos p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Puntos</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{currentCard.points.toLocaleString()}</p>
                </div>
                <div className="card-pos p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Recargas</p>
                  <p className="mt-2 text-xl font-bold text-foreground">{currentCardActivity?.summary.recharges_count ?? 0}</p>
                </div>
                <div className="card-pos p-4 text-center">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Juegos</p>
                  <p className="mt-2 text-xl font-bold text-foreground">{currentCardActivity?.summary.uses_count ?? 0}</p>
                </div>
              </div>
            </div>

            {currentCard.owner && (
              <div className="rounded-xl border border-border/60 bg-background/70 p-4 text-sm">
                <p className="mb-1 font-semibold">Propietario</p>
                <p>{currentCard.owner.full_name}</p>
                <p className="text-muted-foreground">{currentCard.owner.document_type} {currentCard.owner.document_number}</p>
              </div>
            )}

            <Tabs value={cardInfoTab} onValueChange={setCardInfoTab}>
              <TabsList className="grid h-auto w-full grid-cols-4 gap-2 rounded-2xl bg-secondary/50 p-1">
                <TabsTrigger value="overview">Resumen</TabsTrigger>
                <TabsTrigger value="recharges">Recargas</TabsTrigger>
                <TabsTrigger value="games">Maquinas</TabsTrigger>
                <TabsTrigger value="prizes">Premios</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                {isCurrentCardActivityLoading ? (
                  <div className="rounded-xl border border-border/60 bg-secondary/20 p-6 text-sm text-muted-foreground">
                    Cargando movimientos de la tarjeta...
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="card-pos p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="font-semibold">Ultimos movimientos</p>
                        <span className="text-xs text-muted-foreground">Saldo y puntos</span>
                      </div>
                      <div className="space-y-2">
                        {(currentCardActivity?.balance_events ?? []).slice(0, 6).map((event) => (
                          <div key={event.id} className="rounded-xl border border-border/50 bg-background/70 p-3 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">{event.reason}</p>
                                <p className="text-xs text-muted-foreground">{new Date(event.occurred_at).toLocaleString('es-CO')}</p>
                              </div>
                              <div className="text-right">
                                <p className={cn('font-semibold', Number(event.money_delta) >= 0 ? 'text-emerald-700' : 'text-rose-700')}>
                                  {Number(event.money_delta) >= 0 ? '+' : ''}{formatCurrency(Number(event.money_delta))}
                                </p>
                                <p className={cn('text-xs font-medium', event.points_delta >= 0 ? 'text-sky-700' : 'text-amber-700')}>
                                  {event.points_delta >= 0 ? '+' : ''}{event.points_delta} pts
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(currentCardActivity?.balance_events ?? []).length === 0 && (
                          <p className="text-sm text-muted-foreground">Sin movimientos recientes.</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="card-pos p-4">
                        <p className="mb-3 font-semibold">Ultima recarga</p>
                        {currentCardActivity?.recharges[0] ? (
                          <div className="text-sm">
                            <p className="font-semibold">{formatCurrency(Number(currentCardActivity.recharges[0].amount))}</p>
                            <p className="text-muted-foreground">{new Date(currentCardActivity.recharges[0].occurred_at).toLocaleString('es-CO')}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Por {currentCardActivity.recharges[0].created_by}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No tiene recargas registradas.</p>
                        )}
                      </div>
                      <div className="card-pos p-4">
                        <p className="mb-3 font-semibold">Ultimo juego</p>
                        {currentCardActivity?.usages[0] ? (
                          <div className="text-sm">
                            <p className="font-semibold">{currentCardActivity.usages[0].attraction.name}</p>
                            <p className="text-muted-foreground">{new Date(currentCardActivity.usages[0].occurred_at).toLocaleString('es-CO')}</p>
                            <p className="mt-1 text-xs text-muted-foreground">Costo {formatCurrency(Number(currentCardActivity.usages[0].cost))}</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No tiene usos de maquinas.</p>
                        )}
                      </div>
                      <div className="card-pos p-4">
                        <p className="mb-3 font-semibold">Ultimo premio</p>
                        {currentCardActivity?.prize_redemptions[0] ? (
                          <div className="text-sm">
                            <p className="font-semibold">{currentCardActivity.prize_redemptions[0].item.name}</p>
                            <p className="text-muted-foreground">{new Date(currentCardActivity.prize_redemptions[0].occurred_at).toLocaleString('es-CO')}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{currentCardActivity.prize_redemptions[0].points_total} pts</p>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No ha redimido premios.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="recharges" className="mt-4">
                <div className="space-y-2">
                  {(currentCardActivity?.recharges ?? []).map((entry) => (
                    <div key={entry.sale_id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{formatCurrency(Number(entry.amount))}</p>
                          <p className="text-sm text-muted-foreground">{new Date(entry.occurred_at).toLocaleString('es-CO')}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Recibo {entry.receipt_number ?? 'N/D'} · {entry.created_by}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {entry.payments.map((payment, index) => (
                            <p key={`${payment.method}-${index}`}>{payment.method} {formatCurrency(Number(payment.amount))}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(currentCardActivity?.recharges ?? []).length === 0 && (
                    <p className="rounded-xl border border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
                      Esta tarjeta no tiene recargas registradas.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="games" className="mt-4">
                <div className="space-y-2">
                  {(currentCardActivity?.usages ?? []).map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{entry.attraction.name}</p>
                          <p className="text-sm text-muted-foreground">{new Date(entry.occurred_at).toLocaleString('es-CO')}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Lectora {entry.reader.code} · {entry.attraction.location ?? 'Ubicacion no definida'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(Number(entry.cost))}</p>
                          <p className="text-xs text-muted-foreground">{entry.type}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(currentCardActivity?.usages ?? []).length === 0 && (
                    <p className="rounded-xl border border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
                      Esta tarjeta no registra juegos o usos de maquinas.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="prizes" className="mt-4">
                <div className="space-y-2">
                  {(currentCardActivity?.prize_redemptions ?? []).map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-border/60 bg-background/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{entry.item.name}</p>
                          <p className="text-sm text-muted-foreground">{new Date(entry.occurred_at).toLocaleString('es-CO')}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Cantidad {entry.quantity} · {entry.item.sku ?? 'Sin SKU'} · {entry.performed_by}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{entry.points_total.toLocaleString('es-CO')} pts</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(currentCardActivity?.prize_redemptions ?? []).length === 0 && (
                    <p className="rounded-xl border border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
                      Esta tarjeta no tiene premios redimidos.
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </POSModal>

      {/* Modal Recarga */}
      <POSModal
        isOpen={showRecharge}
        onClose={() => { setShowRecharge(false); setRechargeAmount(''); setRechargeFlowMode('recharge_only'); }}
        title={rechargeFlowMode === 'issue_and_recharge' ? 'Emitir y Recibir Tarjeta' : 'Recibir Tarjeta'}
        size="xl"
        contentClassName="max-w-[96vw] lg:max-w-[1100px]"
      >
        <div className="grid grid-cols-2 gap-6">
          {/* Teclado numérico */}
          <div className="space-y-4">
              <div className="card-pos p-4">
                <p className="text-sm text-muted-foreground mb-2">Monto de Recarga</p>
                <p className="text-money-xl">
                  {rechargeValue > 0 ? formatCurrency(rechargeValue) : '$0'}
                </p>
              </div>
            <NumPad
              value={rechargeAmount}
              onChange={(value) => setRechargeAmount(sanitizeNumericInput(value, 7))}
              maxLength={7}
            />

            {bonusQuickOptions.length > 0 && (
              <div className="card-pos p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Bonos</h4>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {bonusQuickOptions.map((option) => (
                    <button
                      key={`${option.amount}-${option.bonus}`}
                      onClick={() => setRechargeAmount(option.amount.toString())}
                      className="tile-option flex-col items-start gap-1 px-4 py-3 text-left"
                    >
                      <span className="text-sm font-semibold text-foreground">
                        {formatCurrency(option.amount)}
                      </span>
                      <span className="text-xs text-primary">
                        +{formatCurrency(option.bonus)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Resumen */}
          <div className="space-y-4">
            <div className="card-pos p-6 space-y-4">
              <h4 className="font-semibold">Resumen de Recarga</h4>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor base</span>
                  <span className="font-medium">{formatCurrency(rechargeValue)}</span>
                </div>
                
                {bonus > 0 && (
                  <div className="flex justify-between text-primary">
                    <span className="flex items-center gap-2">
                      <Gift className="h-4 w-4" />
                      Bono aplicado
                    </span>
                    <span className="font-bold">+{formatCurrency(bonus)}</span>
                  </div>
                )}
                
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="font-semibold">Total en tarjeta</span>
                  <span className="text-xl font-bold text-foreground">
                    {formatCurrency(rechargeValue + bonus)}
                  </span>
                </div>
              </div>

              {points > 0 && (
                <div className="p-3 bg-secondary/60 rounded-xl">
                  <p className="text-sm text-muted-foreground">
                    + {points.toLocaleString()} puntos por esta recarga
                  </p>
                </div>
              )}
            </div>

            {/* Medio de pago */}
            <div className="card-pos p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Medio de Pago</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cash', icon: Wallet, label: 'Efectivo', hint: 'Caja' },
                  { id: 'transfer_account_1', icon: Smartphone, label: 'Transferencia Cta 1', hint: 'Cuenta 1' },
                  { id: 'transfer_account_2', icon: Smartphone, label: 'Transferencia Cta 2', hint: 'Cuenta 2' },
                  { id: 'nequi', icon: Smartphone, label: 'Nequi', hint: 'Billetera' },
                  { id: 'credit_card', icon: CardIcon, label: 'Tarjeta crédito', hint: 'Datáfono' },
                  { id: 'credit', icon: CardIcon, label: 'Crédito', hint: 'Saldo pendiente' },
                ].map(method => (
                  <motion.button
                    key={method.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      const nextMethod = method.id as PaymentMethod;
                      setSelectedPayment(nextMethod);
                      if (nextMethod !== 'cash') setCashReceivedInput('');
                    }}
                    className={cn(
                      'tile-option flex items-center gap-2.5 rounded-2xl p-2.5 transition-all hover:scale-[1.01]',
                      selectedPayment === method.id
                        ? 'tile-option-active shadow-lg ring-2 ring-primary/40'
                        : 'tile-option-muted'
                    )}
                  >
                    <method.icon className="h-4 w-4" />
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-medium leading-none">{method.label}</span>
                      <span className="text-[11px] text-muted-foreground">{method.hint}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>

            <POSButton
              variant="success"
              fullWidth
              size="xl"
              disabled={rechargeValue < (siteConfig?.minRecharge ?? 5000)}
              onClick={handleRecharge}
            >
              {rechargeFlowMode === 'issue_and_recharge' ? 'Emitir y Recibir' : 'Confirmar Recibido'}
            </POSButton>
            {rechargeFlowMode === 'issue_and_recharge' && (
              <p className="text-xs text-muted-foreground">
                Se incluirá el valor de la tarjeta plástica en este mismo cobro.
              </p>
            )}
          </div>
        </div>
      </POSModal>

      {/* Modal Transferencia por Pérdida */}
      <POSModal
        isOpen={showCardTransferModal}
        onClose={() => setShowCardTransferModal(false)}
        title="Transferir tarjeta por pérdida"
        size="md"
        footer={(
          <>
            <POSButton variant="secondary" onClick={() => setShowCardTransferModal(false)}>
              Cancelar
            </POSButton>
            <POSButton variant="success" onClick={handleTransferCardByLoss}>
              Transferir y anular origen
            </POSButton>
          </>
        )}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={transferDocType} onValueChange={(value) => setTransferDocType(value as typeof transferDocType)}>
              <SelectTrigger className="input-pos-compact h-10 w-full">
                <SelectValue placeholder="Tipo doc" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CC">CC</SelectItem>
                <SelectItem value="CE">CE</SelectItem>
                <SelectItem value="NIT">NIT</SelectItem>
                <SelectItem value="PAS">PAS</SelectItem>
              </SelectContent>
            </Select>
            <input
              className="input-pos-compact h-10 w-full"
              placeholder="Documento propietario"
              value={transferDocNumber}
              onChange={(e) => setTransferDocNumber(sanitizeTextInput(e.target.value, 60))}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Tarjetas del propietario</p>
            <Select value={transferSourceUid} onValueChange={setTransferSourceUid}>
              <SelectTrigger className="input-pos-compact h-10 w-full">
                <SelectValue placeholder={isLoadingTransferOwnerCards ? 'Buscando tarjetas...' : 'Selecciona tarjeta origen'} />
              </SelectTrigger>
              <SelectContent>
                {transferOwnerCards.map((card) => (
                  <SelectItem key={card.uid} value={card.uid}>
                    {card.label ? `${card.label} · ${card.uid}` : card.uid} · {formatCurrency(card.balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoadingTransferOwnerCards && transferDocNumber.trim().length >= 4 && transferOwnerCards.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">No hay tarjetas asociadas a este documento.</p>
            )}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">UID destino (tarjeta nueva)</p>
            <POSButton
              variant={transferTargetUid ? "success" : "primary"}
              fullWidth
              onClick={() => waitUidFromApi('transfer_target')}
            >
              {transferTargetUid ? 'Escaneado' : 'Escanear'}
            </POSButton>
          </div>
        </div>
      </POSModal>

      <POSModal
        isOpen={showRewardsModal}
        onClose={() => setShowRewardsModal(false)}
        title="Premios > Redimir"
        size="xl"
        contentClassName="max-w-[96vw] lg:max-w-[1100px]"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="card-pos p-4 space-y-3">
              <p className="font-semibold">Leer tarjeta</p>
              <div className="flex gap-2">
                <input
                  className="input-pos-compact h-11 flex-1"
                  placeholder="UID de tarjeta"
                  value={rewardCardUid}
                  onChange={(e) => setRewardCardUid(sanitizeTextInput(e.target.value.toUpperCase(), 60))}
                />
                <POSButton variant="secondary" onClick={waitUidForRewards} disabled={isRewardLoading}>
                  {isRewardLoading ? 'Escaneando...' : 'Escanear'}
                </POSButton>
              </div>
            </div>

            <div className="card-pos p-4 space-y-3">
              <p className="font-semibold">Tarjeta</p>
              {rewardCardSummary ? (
                <div className="space-y-2 text-sm">
                  <p>UID: <span className="font-mono">{rewardCardSummary.card.uid}</span></p>
                  <p>Estado: <span className="font-semibold">{rewardCardSummary.card.status}</span></p>
                  <p>Propietario: <span className="font-semibold">{rewardCardSummary.card.owner?.full_name ?? 'N/D'}</span></p>
                  <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
                    <p className="text-xs text-muted-foreground">Puntos disponibles</p>
                    <p className="text-3xl font-bold">{Number(rewardCardSummary.card.points_balance || 0).toLocaleString('es-CO')}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Escanea una tarjeta para consultar puntos.</p>
              )}
            </div>

            <div className="card-pos p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Historial de puntos</p>
                <span className="text-xs text-muted-foreground">Opcional</span>
              </div>
              <div className="max-h-[220px] space-y-2 overflow-y-auto">
                {(rewardCardSummary?.points_history ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">Sin movimientos recientes.</p>
                )}
                {(rewardCardSummary?.points_history ?? []).map((event) => (
                  <div key={event.id} className="rounded-lg border border-border/60 bg-secondary/20 p-2 text-xs">
                    <p>{new Date(event.occurred_at).toLocaleString('es-CO')}</p>
                    <p className="text-muted-foreground">{event.reason}</p>
                    <p className={cn('font-semibold', event.points_delta >= 0 ? 'text-green-700' : 'text-red-700')}>
                      {event.points_delta >= 0 ? '+' : ''}{event.points_delta} pts
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="card-pos p-4 space-y-3">
              <p className="font-semibold">Catálogo de premios</p>
              <input
                className="input-pos-compact h-11 w-full"
                placeholder="Buscar por SKU"
                value={prizeSkuQuery}
                onChange={(e) => setPrizeSkuQuery(sanitizeTextInput(e.target.value.toUpperCase(), 60))}
              />
              <Select value={selectedPrizeId} onValueChange={setSelectedPrizeId}>
                <SelectTrigger className="input-pos-compact h-11 w-full">
                  <SelectValue placeholder="Selecciona premio" />
                </SelectTrigger>
                <SelectContent>
                  {filteredPrizeCatalog.map((prize) => (
                    <SelectItem key={prize.id} value={prize.id}>
                      {prize.name} {prize.sku ? `· ${prize.sku}` : ''} · {prize.points_cost} pts · Stock {prize.stock}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filteredPrizeCatalog.length === 0 && (
                <p className="text-xs text-muted-foreground">No hay premios que coincidan con ese SKU.</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input-pos-compact h-11"
                  placeholder="Cantidad"
                  value={selectedPrizeQty}
                  onChange={(e) => setSelectedPrizeQty(sanitizeNumericInput(e.target.value, 3) || '1')}
                />
                <input
                  className="input-pos-compact h-11"
                  placeholder="Observación (opcional)"
                  value={rewardRedeemNotes}
                  onChange={(e) => setRewardRedeemNotes(sanitizeTextInput(e.target.value, 120))}
                />
              </div>
              {(() => {
                const selected = prizeCatalog.find((prize) => prize.id === selectedPrizeId);
                const qty = Number.parseInt(selectedPrizeQty || '1', 10) || 1;
                const pointsCost = selected ? selected.points_cost * qty : 0;
                return (
                  <div className="rounded-xl border border-border/60 bg-secondary/30 p-3 text-sm">
                    <p>Premio: <span className="font-semibold">{selected?.name ?? 'N/D'}</span></p>
                    <p>Costo total: <span className="font-semibold">{pointsCost.toLocaleString('es-CO')} pts</span></p>
                    <p>Stock: <span className="font-semibold">{selected?.stock ?? 0}</span></p>
                  </div>
                );
              })()}
              <POSButton
                variant="success"
                fullWidth
                disabled={!rewardCardSummary || !selectedPrizeId || isRewardRedeeming}
                onClick={() => setShowRewardsRedeemConfirm(true)}
              >
                Redimir premio
              </POSButton>
            </div>

            <div className="card-pos p-4 space-y-2">
              <p className="font-semibold">Comprobante</p>
              {!rewardReceiptText && (
                <p className="text-sm text-muted-foreground">Aún no se ha generado redención.</p>
              )}
              {rewardReceiptText && (
                <>
                  <p className="text-sm">No. {rewardReceiptNumber}</p>
                  <pre className="max-h-[260px] overflow-auto rounded-xl border border-border/60 bg-secondary/20 p-3 text-xs whitespace-pre-wrap">
                    {rewardReceiptText}
                  </pre>
                </>
              )}
            </div>
          </div>
        </div>
      </POSModal>

      <ConfirmModal
        isOpen={showRewardsRedeemConfirm}
        onClose={() => setShowRewardsRedeemConfirm(false)}
        onConfirm={handleRedeemPrize}
        title="Confirmar Redención"
        message="Esta operación descontará puntos y bajará inventario. ¿Deseas continuar?"
        confirmText="Confirmar redención"
        variant="warning"
        loading={isRewardRedeeming}
      />

      <POSModal
        isOpen={showSaleCardScanModal}
        onClose={cancelSaleCardScanFlow}
        title="Leer tarjetas vendidas"
        size="md"
        footer={(
          <>
            <POSButton variant="secondary" onClick={cancelSaleCardScanFlow}>
              Cancelar
            </POSButton>
            <POSButton variant="primary" onClick={() => registerIssuedCardUid()}>
              Registrar UID
            </POSButton>
          </>
        )}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Tarjeta {Math.min(currentIssuedCardIndex + 1, pendingIssuedCards.length)} de {pendingIssuedCards.length}
            </p>
            <p className="mt-1 font-semibold">{currentIssuedCard?.productName ?? 'Tarjeta física'}</p>
            {currentIssuedCard && pendingIssuedCards.length > 1 && (
              <p className="text-xs text-muted-foreground">Unidad #{currentIssuedCard.sequence}</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm text-muted-foreground">UID de tarjeta</p>
            <POSButton
              variant={cardUidInput ? 'success' : 'primary'}
              fullWidth
              onClick={() => waitUidFromApi('sale_card_issue')}
            >
              {cardUidInput ? 'Escaneado y registrado' : 'Escanear'}
            </POSButton>
          </div>

          <input
            className="input-pos-compact h-11 w-full"
            placeholder="UID manual (si aplica)"
            value={cardUidInput}
            onChange={(event) => setCardUidInput(sanitizeTextInput(event.target.value.toUpperCase(), 60))}
          />

          {pendingIssuedCards.some((entry) => entry.uid) && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarjetas leídas</p>
              <div className="space-y-1.5">
                {pendingIssuedCards.filter((entry) => entry.uid).map((entry) => (
                  <div key={entry.key} className="flex items-center justify-between text-xs">
                    <span className="truncate text-muted-foreground">{entry.productName} #{entry.sequence}</span>
                    <span className="font-mono font-semibold text-foreground">{entry.uid}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </POSModal>

      {/* Modal Checkout */}
      <POSModal
        isOpen={showCheckout}
        onClose={closeCheckoutModal}
        title="Finalizar Venta"
        size="full"
        overlayClassName="items-center px-2 py-2 md:px-4 md:py-4"
        contentClassName="max-w-[98vw] md:max-w-[96vw] xl:max-w-[1400px] max-h-[95vh] shadow-xl shadow-black/5"
        bodyClassName="p-0 md:p-0"
      >
        <div className="flex h-[80vh] flex-col">
          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-4 md:px-8">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-6">
              <div className="flex min-w-0 flex-col gap-4 xl:col-span-5">
                <section className="rounded-2xl border border-border/50 bg-card/40 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold">Resumen</h3>
                    <span className="text-xs text-muted-foreground">{cart.length} productos</span>
                  </div>
                  <div className="space-y-1 pr-1">
                    {cart.map(item => (
                      <div key={item.id} className="flex items-start justify-between gap-3 py-2 border-b border-border/40 last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{item.productName}</p>
                          <p className="text-sm text-muted-foreground">x{item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/70 px-1 py-1">
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary"
                              onClick={() => updateQuantity(item.id, -1)}
                              title="Disminuir"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-5 text-center text-sm font-semibold">{item.quantity}</span>
                            <button
                              type="button"
                              className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-secondary"
                              onClick={() => updateQuantity(item.id, 1)}
                              title="Aumentar"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
                            onClick={() => updateQuantity(item.id, -item.quantity)}
                            title="Quitar producto"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <p className="font-medium shrink-0 min-w-[84px] text-right">{formatCurrency(item.total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="flex min-w-0 flex-col gap-4 xl:col-span-7">
                <section className="rounded-2xl border border-border/50 bg-card/40 p-4">
                  <label className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Cliente (Factura)</p>
                      <p className="text-xs text-muted-foreground">
                        {requiresInvoice ? 'Facturación activa' : 'Venta sin datos de cliente'}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-border"
                      checked={requiresInvoice}
                      onChange={(e) => setRequiresInvoice(e.target.checked)}
                    />
                  </label>
                </section>

                {checkoutStep === 'payment' && renderPaymentStep()}
                {checkoutStep === 'invoice' && renderInvoiceStep()}
                {checkoutStep === 'cash_tender' && renderCashTenderStep()}
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 bg-background/95 p-3 backdrop-blur md:p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">TOTAL</span>
              <span className="text-money-xl text-success">{formatCurrency(total)}</span>
            </div>
            <div className="mt-3 flex gap-2">
              {checkoutStep !== 'payment' && (
                <POSButton
                  variant="secondary"
                  fullWidth
                  size="lg"
                  onClick={goBackCheckoutFlow}
                >
                  Atrás
                </POSButton>
              )}
              <POSButton
                variant="success"
                fullWidth
                size="lg"
                disabled={
                  checkoutStep === 'cash_tender'
                    ? !canSubmitCheckout
                    : !canAdvanceFromPayment
                }
                onClick={checkoutStep === 'cash_tender' ? handleCheckout : continueCheckoutFlow}
              >
                {checkoutStep === 'cash_tender'
                  ? `Cobrar ${formatCurrency(total)}`
                  : 'Continuar'}
              </POSButton>
            </div>
          </div>
        </div>
      </POSModal>

      {/* Modal Historial de Ventas */}
      <POSModal
        isOpen={showSalesHistory}
        onClose={() => setShowSalesHistory(false)}
        title="Historial de Ventas"
        size="lg"
        contentClassName="max-h-[88vh]"
        bodyClassName="px-5 pt-3 pb-5 md:px-6 md:pt-3 md:pb-6"
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-border/60 bg-card/50 p-3">
            <div className="flex flex-wrap items-end gap-3">
              {isCashierRole && (
                <p className="text-xs text-muted-foreground">
                  El rol cajero solo puede consultar ventas del dia actual.
                </p>
              )}
              {isSupervisorView && (
                <p className="text-xs text-muted-foreground">
                  Supervisor puede consultar ventas de todo el historial.
                </p>
              )}
              <div className="ml-auto text-xs text-muted-foreground">
                {salesHistoryTotal} transacciones
              </div>
            </div>
          </div>
          {salesHistoryLoading && (
            <div className="text-sm text-muted-foreground">Cargando historial...</div>
          )}
          <div className="max-h-[52vh] overflow-y-auto rounded-xl border border-border/60 bg-card/30 pr-1">
            <div className="space-y-2 p-2">
              {recentSales.length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">No hay ventas recientes.</div>
              )}
              {recentSales.slice(0, 10).map((sale) => (
                <div key={sale.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/30 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="rounded-md bg-background p-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {sale.items.map((item) => item.product_name).join(', ')}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {new Date(sale.created_at).toLocaleString('es-CO')} • {sale.payment_method ?? 'N/A'}
                        {sale.created_by?.full_name ? ` • ${sale.created_by.full_name}` : ''}
                      </p>
                      {sale.customer?.full_name && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {sale.customer.full_name} • {sale.requires_invoice ? 'Con factura' : 'Sin factura'}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-bold">{formatCurrency(Number(sale.total))}</span>
                    <POSButton
                      variant="secondary"
                      size="sm"
                      onClick={() => openSaleEditor(sale)}
                    >
                      Ver
                    </POSButton>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Página {salesHistoryPage} de {salesHistoryTotalPages}
            </p>
            <div className="flex gap-2">
              <POSButton
                variant="secondary"
                size="sm"
                disabled={salesHistoryPage <= 1 || salesHistoryLoading}
                onClick={() => {
                  const siteId = getSiteIdStored();
                  const nextPage = Math.max(1, salesHistoryPage - 1);
                  setSalesHistoryPage(nextPage);
                  if (siteId) loadSalesHistory(siteId, nextPage).catch(() => null);
                }}
              >
                Anterior
              </POSButton>
              <POSButton
                variant="secondary"
                size="sm"
                disabled={salesHistoryPage >= salesHistoryTotalPages || salesHistoryLoading}
                onClick={() => {
                  const siteId = getSiteIdStored();
                  const nextPage = Math.min(salesHistoryTotalPages, salesHistoryPage + 1);
                  setSalesHistoryPage(nextPage);
                  if (siteId) loadSalesHistory(siteId, nextPage).catch(() => null);
                }}
              >
                Siguiente
              </POSButton>
            </div>
          </div>
        </div>
      </POSModal>

      <POSModal
        isOpen={showEditSaleModal}
        onClose={() => {
          setShowEditSaleModal(false);
          setEditingSale(null);
          setEditingSaleTotalInput('');
          setEditingSaleReason('');
          if (pendingPostSaleInvoice) setPendingPostSaleInvoice(false);
        }}
        title={pendingPostSaleInvoice ? 'Completar facturación' : 'Editar venta'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card/40 p-3 text-sm text-muted-foreground">
            {isCashierRole
              ? 'Como cajero solo puedes corregir medio de pago, datos de facturación y reimprimir.'
              : 'Como supervisor puedes corregir medio de pago, facturación, valor de ventas simples y anular transacciones.'}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/60 bg-card/50 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Medio de pago</p>
              <Select value={selectedPayment} onValueChange={(value) => setSelectedPayment(value as PaymentMethod)}>
                <SelectTrigger className="mt-2 input-pos-compact h-11 w-full">
                  <SelectValue placeholder="Selecciona medio de pago" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethodOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="rounded-xl border border-border/60 bg-card/50 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Facturación</p>
                <p className="text-sm font-medium">{requiresInvoice ? 'Datos requeridos' : 'Sin facturación'}</p>
              </div>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-border"
                checked={requiresInvoice}
                onChange={(e) => setRequiresInvoice(e.target.checked)}
              />
            </label>
          </div>

          {isSupervisorView && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-card/50 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor total</p>
                <input
                  className="input-pos-compact mt-2 h-11 w-full"
                  placeholder="Total corregido"
                  value={editingSaleTotalInput}
                  onChange={(e) => setEditingSaleTotalInput(e.target.value.replace(/[^\d.]/g, '').slice(0, 12))}
                  disabled={Boolean(editingSale?.items.some((item) => item.category === 'RECHARGE'))}
                />
              </div>
              <div className="rounded-xl border border-border/60 bg-card/50 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Razón</p>
                <input
                  className="input-pos-compact mt-2 h-11 w-full"
                  placeholder="Razón de corrección o anulación"
                  value={editingSaleReason}
                  onChange={(e) => setEditingSaleReason(sanitizeTextInput(e.target.value, 240))}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select value={customerDocType} onValueChange={(value) => setCustomerDocType(value as typeof customerDocType)} disabled={!requiresInvoice}>
              <SelectTrigger className="input-pos-compact h-11 w-full">
                <SelectValue placeholder="Tipo doc" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CC">CC</SelectItem>
                <SelectItem value="CE">CE</SelectItem>
                <SelectItem value="NIT">NIT</SelectItem>
                <SelectItem value="PAS">PAS</SelectItem>
              </SelectContent>
            </Select>
            <input
              className="input-pos-compact h-11 w-full"
              placeholder="Documento"
              disabled={!requiresInvoice}
              value={customerDocNumber}
              onChange={(e) => setCustomerDocNumber(sanitizeTextInput(e.target.value, 40))}
            />
            {requiresInvoice && isCustomerLookupLoading && (
              <p className="col-span-2 -mt-1 text-[11px] text-muted-foreground">
                Buscando cliente registrado. Espera un momento...
              </p>
            )}
            {requiresInvoice && !isCustomerLookupLoading && customerLookupStatus === 'found' && (
              <p className="col-span-2 -mt-1 text-[11px] font-medium text-emerald-700">
                Cliente encontrado. Se completaron los datos registrados.
              </p>
            )}
            <input
              className="input-pos-compact h-11 w-full"
              placeholder="Nombre completo"
              disabled={!requiresInvoice}
              value={customerFullName}
              onChange={(e) => setCustomerFullName(sanitizeTextInput(e.target.value, 120))}
            />
            <input
              className="input-pos-compact h-11 w-full"
              placeholder="Teléfono"
              disabled={!requiresInvoice}
              value={customerPhone}
              onChange={(e) => setCustomerPhone(sanitizeNumericInput(e.target.value, 20))}
            />
            <input
              className="input-pos-compact h-11 w-full"
              placeholder="Correo"
              disabled={!requiresInvoice}
              value={customerEmail}
              onChange={(e) => setCustomerEmail(sanitizeEmailInput(e.target.value, 160))}
            />
            <input
              className="input-pos-compact h-11 w-full"
              placeholder="Ciudad"
              disabled={!requiresInvoice}
              value={customerCity}
              onChange={(e) => setCustomerCity(sanitizeTextInput(e.target.value, 80))}
            />
            <input
              className="input-pos-compact h-11 w-full col-span-2"
              placeholder="Dirección"
              disabled={!requiresInvoice}
              value={customerAddress}
              onChange={(e) => setCustomerAddress(sanitizeTextInput(e.target.value, 160))}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <POSButton variant="secondary" onClick={() => setShowEditSaleModal(false)}>
              Cancelar
            </POSButton>
            <POSButton variant="secondary" icon={Printer} onClick={() => handleReprintSale()}>
              Reimprimir
            </POSButton>
            <POSButton variant="success" loading={editingSaleSaving} onClick={handleSaveSaleEdits}>
              Guardar cambios
            </POSButton>
          </div>
          {isSupervisorView && editingSale && (
            <div className="grid grid-cols-1 gap-2">
              <POSButton
                variant="danger"
                loading={editingSaleSaving}
                onClick={() => handleVoidSale(editingSale)}
              >
                {editingSale.items.some((item) => item.category === 'RECHARGE') ? 'Anular recarga' : 'Anular venta'}
              </POSButton>
            </div>
          )}
        </div>
      </POSModal>

      {/* Modal Recibo */}
      <POSModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        title="Venta Exitosa"
        type="success"
        size="md"
        contentClassName="max-h-[92vh]"
        bodyClassName="overflow-y-auto"
        footer={
          <>
            <POSButton variant="secondary" icon={Printer} onClick={handlePrintReceiptPdf}>
              Imprimir
            </POSButton>
            <POSButton variant="success" onClick={() => setShowReceipt(false)}>
              Nueva Venta
            </POSButton>
          </>
        }
      >
        <div className="receipt-paper max-h-[60vh] overflow-y-auto">
          {receiptNumber && (
            <div className="mb-3 text-center">
              <p className="text-xs text-muted-foreground">Comprobante</p>
              <p className="font-semibold">{receiptNumber}</p>
            </div>
          )}
          {receiptText ? (
            <pre className="whitespace-pre-wrap break-words text-[11px] leading-5 font-mono">{receiptText}</pre>
          ) : (
            <div className="space-y-2 text-sm">
              <p>No se encontró el texto de recibo.</p>
              <p>Total: {formatCurrency(receiptTotal)}</p>
            </div>
          )}
        </div>
      </POSModal>

      {/* Modal Error */}
      <ErrorModal
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Error"
        message={errorMessage}
      />

      {/* Modal Sincronización */}
      <SyncModal
        isOpen={showSync}
        status={syncStatus}
        message={syncStatus === 'syncing' ? (syncMessage || 'Leyendo tarjeta...') : undefined}
      />

      {/* Modal Confirmar Eliminación */}
      <ConfirmModal
        isOpen={showConfirmDelete}
        onClose={() => setShowConfirmDelete(false)}
        onConfirm={() => {
          setShowConfirmDelete(false);
          // Lógica de eliminación
        }}
        title="Eliminar Tarjeta"
        message="¿Estás seguro de que deseas eliminar esta tarjeta? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        variant="danger"
      />

      {/* Modal Apertura de Caja */}
      <POSModal
        isOpen={showOpenCashModal}
        onClose={() => setShowOpenCashModal(false)}
        title="Apertura de Caja"
        size="lg"
        overlayClassName="items-center px-1 sm:px-1 md:px-1 py-1 sm:py-1 md:py-1"
        contentClassName="max-w-[98vw] md:max-w-[95vw] lg:max-w-[720px] max-h-[calc(85vh+20px)]"
        bodyClassName="pt-2 md:pt-3"
      >
        <div className="mx-auto w-full max-w-3xl px-6 md:px-8">
          <div className="rounded-3xl border border-border/60 bg-card/60 p-5 pb-4">
            <div className="space-y-4">
              <div className="card-pos p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Último cierre</span>
                  <span className="font-semibold">
                    {formatCurrency(cashOpeningReference?.lastClosedCash ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sugerido para apertura</span>
                  <span className="font-semibold text-success">
                    {formatCurrency(cashOpeningReference?.suggestedOpeningCash ?? 0)}
                  </span>
                </div>
                {cashOpeningReference?.lastClosedAt && (
                  <p className="text-xs text-muted-foreground">
                    Cierre previo: {new Date(cashOpeningReference.lastClosedAt).toLocaleString('es-CO')}
                  </p>
                )}
              </div>

              <div className="card-pos p-3">
                <p className="text-sm text-muted-foreground mb-2">Efectivo inicial contado</p>
                <p className="text-money-xl">{formatCurrency(openingAmountValue)}</p>
              </div>

              <NumPad
                value={openingCashInput}
                onChange={(value) => setOpeningCashInput(sanitizeNumericInput(value, 7))}
                maxLength={7}
                buttonClassName="h-12 md:h-14 text-xl"
              />
            </div>

            <div className="mt-6 pt-4 border-t border-border/40">
              <POSButton
                variant="success"
                fullWidth
                disabled={Number.isNaN(openingAmountInput) || openingAmountValue < 0}
                onClick={() => {
                  attemptOpenCash(openingAmountValue);
                }}
              >
                Abrir caja ahora
              </POSButton>
            </div>
          </div>
        </div>
      </POSModal>

      {/* Modal Cierre de Caja */}
      <POSModal
        isOpen={showCloseCashModal}
        onClose={() => setShowCloseCashModal(false)}
        title="Cierre de Caja"
        size="lg"
        overlayClassName="items-center overflow-hidden px-1 sm:px-1 md:px-1 py-1 sm:py-1 md:py-1"
        contentClassName="max-w-[98vw] md:max-w-[95vw] lg:max-w-[720px] max-h-[calc(85vh+20px)] overflow-hidden"
        bodyClassName="pt-2 md:pt-3"
      >
        <div className="mx-auto w-full max-w-3xl px-6 md:px-8">
          <div className="rounded-3xl border border-border/60 bg-card/60 p-5 pb-4">
            <div className="space-y-4">
              <div className="card-pos p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Efectivo inicial</span>
                  <span className="font-semibold">{formatCurrency(openingCashAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ventas en efectivo</span>
                  <span className="font-semibold">{formatCurrency(cashSales)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Retiros parciales</span>
                  <span className="font-semibold">{formatCurrency(cashWithdrawalsAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Esperado</span>
                  <span className="font-bold">{formatCurrency(expectedCash)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Diferencia</span>
                  <span className={cn('font-semibold', closingAmountValue - expectedCash === 0 ? 'text-success' : 'text-destructive')}>
                    {formatCurrency(closingAmountValue - expectedCash)}
                  </span>
                </div>
              </div>

              <div className="card-pos p-3">
                <p className="text-sm text-muted-foreground mb-2">Efectivo contado al cierre</p>
                <p className="text-money-xl">{formatCurrency(closingAmountValue)}</p>
              </div>

              <NumPad
                value={closingCashInput}
                onChange={(value) => setClosingCashInput(sanitizeNumericInput(value, 7))}
                maxLength={7}
                buttonClassName="h-12 md:h-14 text-xl"
              />
            </div>

            <div className="mt-6 pt-4 border-t border-border/40">
              <POSButton
                variant="danger"
                fullWidth
                disabled={Number.isNaN(closingAmountInput) || closingAmountValue < 0}
                onClick={() => {
                  attemptCloseCash(closingAmountValue);
                }}
              >
                Cerrar caja definitivamente
              </POSButton>
            </div>
          </div>
        </div>
      </POSModal>

      <POSModal
        isOpen={showCashWithdrawalModal}
        onClose={() => setShowCashWithdrawalModal(false)}
        title="Retiro parcial de efectivo"
        size="lg"
        contentClassName="max-w-[94vw] lg:max-w-[920px] max-h-[88vh] overflow-hidden"
        bodyClassName="overflow-hidden"
      >
        <div className="grid max-h-[72vh] grid-cols-1 gap-4 overflow-hidden md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Salidas del día</p>
                <p className="mt-1 text-lg font-bold">{formatCurrency(dayOutflowsValue)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Efectivo esperado</p>
                <p className="mt-1 text-lg font-bold">{formatCurrency(expectedCashAmount)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Retiros acumulados</p>
                <p className="mt-1 text-lg font-bold">{formatCurrency(cashWithdrawalsAmount)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Umbral de alerta</p>
                <p className="mt-1 text-lg font-bold">{formatCurrency(500000)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
              <p className="text-sm text-muted-foreground mb-1">Valor a retirar</p>
              <p className="text-money-xl">{formatCurrency(withdrawalAmountValue)}</p>
              {withdrawalExceedsCash && (
                <p className="mt-2 text-xs font-medium text-destructive">
                  El retiro supera el efectivo disponible en caja.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
              <p className="mb-2 text-sm font-semibold">Motivo del retiro</p>
              <textarea
                className="input-pos-compact min-h-[156px] w-full resize-none py-3"
                placeholder="Describe el motivo del retiro parcial"
                value={withdrawalReason}
                onChange={(event) => setWithdrawalReason(sanitizeTextInput(event.target.value, 180))}
              />
            </div>
          </div>

          <div className="space-y-3 overflow-y-auto">
            <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
              <p className="text-sm font-semibold">Autorización</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pendingWithdrawalApproval ? 'Supervisor autorizado. Ya puedes confirmar el retiro.' : 'Se requiere autorización previa de supervisor.'}
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 p-3">
              <p className="mb-2 text-sm font-semibold">Monto del retiro</p>
              <NumPad
                value={withdrawalAmountInput}
                onChange={(value) => setWithdrawalAmountInput(sanitizeNumericInput(value, 7))}
                maxLength={7}
                buttonClassName="h-11 text-lg"
              />
            </div>

            <POSButton
              variant="warning"
              fullWidth
              disabled={withdrawalSubmitting || withdrawalAmountValue <= 0 || withdrawalExceedsCash || !withdrawalReason.trim() || !pendingWithdrawalApproval}
              onClick={handleCashWithdrawal}
            >
              {withdrawalSubmitting ? 'Registrando retiro...' : 'Confirmar retiro parcial'}
            </POSButton>
          </div>
        </div>
      </POSModal>

      {/* Modal Supervisor Auth */}
      <POSModal
        isOpen={showSupervisorAuth}
        onClose={() => setShowSupervisorAuth(false)}
        title={pendingAction === 'cash_withdrawal' ? 'Autorizar retiro de efectivo' : 'Autorización de Supervisor'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {pendingAction === 'cash_withdrawal'
              ? 'Ingresa el código del supervisor para habilitar el retiro.'
              : 'Ingresa el código de 6 dígitos del supervisor para continuar.'}
          </p>
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: 6 }).map((_, idx) => {
              const filled = idx < supervisorPin.length;
              return (
                <span
                  key={idx}
                  className={cn(
                    'h-3.5 w-3.5 rounded-full border transition-colors',
                    filled ? 'bg-primary border-primary' : 'bg-transparent border-border'
                  )}
                />
              );
            })}
          </div>
          <div className="card-pos p-4">
            <NumPad value={supervisorPin} onChange={(value) => setSupervisorPin(sanitizeNumericInput(value, 6))} maxLength={6} />
          </div>
          <POSButton
            variant="success"
            fullWidth
            disabled={supervisorPin.length !== 6}
            onClick={handleSupervisorAuth}
          >
            Autorizar
          </POSButton>
        </div>
      </POSModal>

      {/* Modal Confirmar Salida */}
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
    </POSLayout>
  );
}
