import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { POSLayout } from '@/layouts/POSLayout';
import { POSButton } from '@/components/ui/POSButton';
import { POSModal, ConfirmModal, ErrorModal, SyncModal } from '@/components/ui/POSModal';
import { NumPad } from '@/components/ui/NumPad';
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
  ShieldCheck
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { SaleItem, PaymentMethod, Card } from '@/types/pos.types';
import { api } from '@/api/client';
import { cn } from '@/lib/utils';
import { clearAuthUser, getAuthUser, getCashState, isCashOpen, setCashOpen, setCashState, clearCashState, getSiteIdStored } from '@/lib/auth';

// Item del carrito
interface CartItem extends SaleItem {
  productId: string;
}

export default function CashierDashboard() {
  const navigate = useNavigate();
  const authUser = getAuthUser();
  // Estado de caja
  const [isOpen, setIsOpen] = useState(isCashOpen());
  
  // Estado del carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number; category: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [bonusScales, setBonusScales] = useState<Array<{ min: number; max: number | null; bonus: number }>>([]);
  const [siteConfig, setSiteConfig] = useState<{ minRecharge: number; pointsPerCurrency: number; currencyUnit: number } | null>(null);
  
  // Modales
  const [showCardReader, setShowCardReader] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [showCardInfo, setShowCardInfo] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSupervisorAuth, setShowSupervisorAuth] = useState(false);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [pendingAction, setPendingAction] = useState<'open_cash' | 'close_cash' | 'delete_card' | null>(null);
  const [pendingOpenAmount, setPendingOpenAmount] = useState(0);
  const [pendingCloseAmount, setPendingCloseAmount] = useState(0);
  const [lastAddedProductId, setLastAddedProductId] = useState<string | null>(null);
  const [lastAddTick, setLastAddTick] = useState(0);
  const [showOpenCashModal, setShowOpenCashModal] = useState(false);
  const [showCloseCashModal, setShowCloseCashModal] = useState(false);
  const [showCashOpenNotice, setShowCashOpenNotice] = useState(false);
  
  // Estados de datos
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
  const [requiresInvoice, setRequiresInvoice] = useState(false);
  const [customerDocType, setCustomerDocType] = useState<'CC' | 'CE' | 'NIT' | 'TI' | 'PAS'>('CC');
  const [customerDocNumber, setCustomerDocNumber] = useState('');
  const [customerFullName, setCustomerFullName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'success' | 'error'>('syncing');
  const [errorMessage, setErrorMessage] = useState('');
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [closingCashInput, setClosingCashInput] = useState('');
  const initialCashState = getCashState();
  const [openingCashAmount, setOpeningCashAmount] = useState(initialCashState?.openingCashAmount ?? 0);
  const [cashSales, setCashSales] = useState(initialCashState?.cashSales ?? 0);
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
  const expectedCash = openingCashAmount + cashSales;
  const isCustomerComplete = Boolean(
    customerDocNumber.trim()
    && customerFullName.trim()
    && customerPhone.trim()
    && customerCity.trim()
  );

  // Productos filtrados
  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  const categoryLabels: Record<string, string> = {
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
    if (method === 'transfer') return 'TRANSFER';
    if (method === 'qr') return 'QR';
    return 'CARD';
  };

  const createSupervisorApproval = async (params: { entityId: string; reason: string }) => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser) {
      throw new Error('No se encontró el sitio o usuario');
    }
    return api<{ id: string }>('/supervisor-approvals', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        requested_by_user_id: authUser.id,
        action: 'OTHER',
        entity_type: 'CASH_SESSION',
        entity_id: params.entityId,
        reason: params.reason,
        supervisor_code: supervisorPin,
      }),
    });
  };

  // Agregar producto al carrito
  const addToCart = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

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

  // Actualizar cantidad
  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, item.quantity + delta);
        if (newQty === 0) return null as unknown as CartItem;
        return { ...item, quantity: newQty, total: newQty * item.unitPrice };
      }
      return item;
    }).filter(Boolean));
  };

  // Lectura de tarjeta (placeholder hasta integrar lector real)
  const handleReadCard = () => {
    setShowSync(true);
    setSyncStatus('syncing');
    api<Card>(`/cards/04A1B2C3D4`)
      .then((card) => {
        setCurrentCard(card);
        setSyncStatus('success');
        setTimeout(() => {
          setShowSync(false);
          setShowCardInfo(true);
        }, 400);
      })
      .catch(() => {
        setSyncStatus('error');
        setTimeout(() => {
          setShowSync(false);
          setErrorMessage('No se pudo leer la tarjeta');
          setShowError(true);
        }, 400);
      });
  };

  // Recarga
  const handleRecharge = () => {
    const minRecharge = siteConfig?.minRecharge ?? 5000;
    if (!rechargeAmount || parseInt(rechargeAmount) < minRecharge) {
      setErrorMessage(`El monto mínimo de recarga es ${formatCurrency(minRecharge)}`);
      setShowError(true);
      return;
    }
    if (!currentCard) {
      setErrorMessage('No hay tarjeta seleccionada');
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

    setShowRecharge(false);
    setShowSync(true);
    setSyncStatus('syncing');

    api<{ amount: string; bonus_amount: string; points: number }>(`/cards/${currentCard.code}/recharge`, {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        amount: (parseInt(rechargeAmount, 10)).toFixed(2),
        payment_method: resolvePaymentMethod(selectedPayment),
        terminal_id: posContext.terminalId,
        shift_id: posContext.shiftId,
        cash_session_id: posContext.cashSessionId,
        created_by_user_id: authUser.id,
      }),
    })
      .then(() => api<Card>(`/cards/${currentCard.code}`))
      .then((card) => {
        setCurrentCard(card);
        setSyncStatus('success');
        setTimeout(() => {
          setShowSync(false);
          setRechargeAmount('');
          if (selectedPayment === 'cash') {
            setCashSales(prev => prev + parseInt(rechargeAmount, 10));
          }
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

  // Procesar venta
  const handleCheckout = () => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser) {
      setErrorMessage('Usuario o sede no disponible');
      setShowError(true);
      return;
    }
    if (!posContext.shiftId || !posContext.terminalId || !posContext.cashSessionId) {
      setErrorMessage('No hay contexto de caja activo');
      setShowError(true);
      return;
    }
    if (cart.length === 0) return;

    setShowCheckout(false);
    setShowSync(true);
    setSyncStatus('syncing');

    api<{ id: string; total: string }>('/sales', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        shift_id: posContext.shiftId,
        terminal_id: posContext.terminalId,
        cash_session_id: posContext.cashSessionId,
        created_by_user_id: authUser.id,
        requires_invoice: requiresInvoice,
        customer: customerDocNumber.trim()
          ? {
              document_type: customerDocType,
              document_number: customerDocNumber.trim(),
              full_name: customerFullName.trim(),
              phone: customerPhone.trim(),
              city: customerCity.trim(),
            }
          : undefined,
        items: cart.map(item => ({ product_id: item.productId, quantity: item.quantity })),
        payments: [{ method: resolvePaymentMethod(selectedPayment), amount: total.toFixed(2) }],
      }),
    })
      .then(() => {
        setSyncStatus('success');
        setTimeout(() => {
          setShowSync(false);
          if (selectedPayment === 'cash') {
            setCashSales(prev => prev + total);
          }
          setCart([]);
          setShowReceipt(true);
        }, 500);
      })
      .catch((err) => {
        setSyncStatus('error');
        setTimeout(() => {
          setShowSync(false);
          setErrorMessage(err?.message || 'No se pudo registrar la venta');
          setShowError(true);
        }, 400);
      });
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

  const attemptOpenCash = (amount: number, approvalId?: string | null) => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser || !posContext.terminalId || !posContext.cashRegisterId) {
      setErrorMessage('No se encontró el contexto de caja');
      setShowError(true);
      return;
    }

    api<{ id: string; status: string }>('/cash-sessions/open', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        terminal_id: posContext.terminalId,
        cash_register_id: posContext.cashRegisterId,
        shift_id: posContext.shiftId ?? undefined,
        opened_by_user_id: authUser.id,
        opening_cash_amount: amount.toFixed(2),
        denominations: {},
        approval_id: approvalId ?? null,
      }),
    })
      .then((res) => {
        setOpeningCashAmount(amount);
        setCashSales(0);
        setIsOpen(true);
        setPosContext(prev => ({ ...prev, cashSessionId: res.id }));
        setShowOpenCashModal(false);
        setShowCashOpenNotice(true);
      })
      .catch((err) => {
        const message = err?.message || 'No se pudo abrir la caja';
        if (message.toLowerCase().includes('autoriz')) {
          setPendingAction('open_cash');
          setPendingOpenAmount(amount);
          setSupervisorPin('');
          setShowOpenCashModal(false);
          setShowSupervisorAuth(true);
          return;
        }
        setErrorMessage(message);
        setShowError(true);
      });
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
        denominations: {},
        close_reason: 'Cierre de caja',
        approval_id: approvalId ?? null,
      }),
    })
      .then(() => {
        setIsOpen(false);
        setOpeningCashAmount(0);
        setCashSales(0);
        setClosingCashInput('');
        clearCashState();
        setPosContext(prev => ({ ...prev, cashSessionId: null }));
      })
      .catch((err) => {
        const message = err?.message || 'No se pudo cerrar la caja';
        if (message.toLowerCase().includes('autoriz')) {
          setPendingAction('close_cash');
          setPendingCloseAmount(amount);
          setSupervisorPin('');
          setShowSupervisorAuth(true);
          return;
        }
        setErrorMessage(message);
        setShowError(true);
      });
  };

  const handleToggleCash = () => {
    if (!isOpen) {
      setOpeningCashInput('');
      setShowOpenCashModal(true);
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
    const entityId = pendingAction === 'open_cash'
      ? (posContext.cashRegisterId ?? posContext.terminalId ?? '')
      : (posContext.cashSessionId ?? '');

    if (!entityId) {
      setErrorMessage('No se pudo resolver la entidad para autorización');
      setShowError(true);
      return;
    }

    createSupervisorApproval({
      entityId,
      reason: pendingAction === 'open_cash' ? 'Ajuste de apertura de caja' : 'Cierre de caja',
    })
      .then((approval) => {
        if (pendingAction === 'open_cash') {
          attemptOpenCash(pendingOpenAmount, approval.id);
        }
        if (pendingAction === 'close_cash') {
          attemptCloseCash(pendingCloseAmount, approval.id);
        }
        setShowSupervisorAuth(false);
        setSupervisorPin('');
        setPendingAction(null);
      })
      .catch((err) => {
        setErrorMessage(err?.message || 'No se pudo autorizar la acción');
        setShowError(true);
      });
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
          api<{ opening_cash_amount: string; cash_sales: string }>(`/cash-sessions/${ctx.cash_session_id}`)
            .then((summary) => {
              setOpeningCashAmount(parseFloat(summary.opening_cash_amount));
              setCashSales(parseFloat(summary.cash_sales));
            })
            .catch(() => null);
        } else {
          setIsOpen(false);
          setCashOpen(false);
          clearCashState();
          setOpeningCashAmount(0);
          setCashSales(0);
        }
      })
      .catch(() => null);

    api<Array<{ id: string; name: string; price: string; category: string }>>(`/products?site_id=${siteId}`)
      .then((list) => {
        setProducts(list.map(p => ({ ...p, price: parseFloat(p.price) })));
        const cats = Array.from(new Set(list.map(p => p.category))).map(c => ({ id: c, name: c }));
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
  }, []);

  useEffect(() => {
    if (!showCashOpenNotice) return;
    const timer = setTimeout(() => setShowCashOpenNotice(false), 3000);
    return () => clearTimeout(timer);
  }, [showCashOpenNotice]);

  return (
    <POSLayout
      userName={authUser?.name ?? 'Cajero'}
      userRole={authUser?.role === 'admin' ? 'Administrador' : authUser?.role === 'supervisor' ? 'Supervisor' : 'Cajero'}
      onLogout={handleLogout}
      logoutDisabled={isOpen}
    >
      <div className="flex w-full pos-full-height">
        {/* === SECCIÓN IZQUIERDA: TARJETAS (30%) === */}
        <div className="pos-sidebar w-[24%] min-w-[260px]">
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
            {(authUser?.role === 'supervisor' || authUser?.role === 'admin') && (
              <POSButton
                variant="secondary"
                fullWidth
                size="sm"
                onClick={() => navigate('/supervisor')}
              >
                Ir a Supervisor
              </POSButton>
            )}
          </div>

          {/* Acciones de Tarjetas */}
          <div className="flex-1 p-4 space-y-3">
            <div className="pos-section-title flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Tarjetas
            </div>

            <POSButton
              variant="secondary"
              icon={Plus}
              fullWidth
              size="md"
              disabled={!isOpen}
              onClick={() => {
                const cardProduct = products.find(p => p.category === 'CARD_PLASTIC');
                if (!cardProduct) {
                  setErrorMessage('No hay producto de tarjeta configurado');
                  setShowError(true);
                  return;
                }
                addToCart(cardProduct.id);
              }}
            >
              Crear Tarjeta
            </POSButton>

            <POSButton
              variant="success"
              icon={RefreshCw}
              fullWidth
              size="md"
              disabled={!isOpen}
              onClick={() => {
                handleReadCard();
                setShowRecharge(true);
              }}
            >
              Recargar Tarjeta
            </POSButton>

            <POSButton
              variant="secondary"
              icon={Eye}
              fullWidth
              size="md"
              disabled={!isOpen}
              onClick={handleReadCard}
            >
              Leer Tarjeta
            </POSButton>

            <div className="pos-section-divider" />

            <div className="pos-section-title flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              Riesgo
            </div>

            <POSButton
              variant="danger"
              icon={Trash2}
              fullWidth
              size="md"
              disabled={!isOpen}
              onClick={() => {
                setPendingAction('delete_card');
                setSupervisorPin('');
                setShowSupervisorAuth(true);
              }}
            >
              Eliminar Tarjeta
            </POSButton>
          </div>

          {/* Info de Tarjeta Actual */}
          {currentCard && (
            <div className="p-4 border-t border-border bg-card">
              <div className="card-pos p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tarjeta Activa</span>
                  <span className="font-mono font-bold text-primary">{currentCard.code}</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className="text-lg font-bold text-foreground">{formatCurrency(currentCard.balance)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Puntos</p>
                    <p className="text-lg font-bold text-accent">{currentCard.points.toLocaleString()}</p>
                  </div>
                </div>
                {currentCard.bonusBalance > 0 && (
                  <div className="badge-accent">
                    <Gift className="h-4 w-4" />
                    Bono: {formatCurrency(currentCard.bonusBalance)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* === SECCIÓN DERECHA: VENTAS (70%) === */}
        <div className="flex-1 flex flex-col bg-background">
          {/* Categorías */}
            <div className="p-3 border-b border-border overflow-x-auto bg-surface">
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'chip-pos',
                    selectedCategory === 'all' && 'chip-pos-active'
                  )}
                >
                Todos
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'chip-pos',
                    selectedCategory === cat.id && 'chip-pos-active'
                  )}
                >
                  {categoryLabels[cat.name] ?? cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Productos */}
          <div className="flex-1 overflow-auto p-4">
            <div className="products-grid">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => isOpen && addToCart(product.id)}
                  disabled={!isOpen}
                  className={cn(
                    'product-card',
                    !isOpen && 'opacity-50 cursor-not-allowed',
                    lastAddedProductId === product.id && 'pulse-success border-success/50'
                  )}
                >
                  <p className="text-xs text-muted-foreground">{categoryLabelById.get(product.category) ?? 'Producto'}</p>
                  <p className="product-price">{formatCurrency(product.price)}</p>
                  <p className="product-name line-clamp-2">{product.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Carrito y Total */}
          <div className="border-t border-border bg-surface">
            {/* Items del carrito */}
            {cart.length > 0 && (
              <div className="max-h-48 overflow-auto p-3 space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="pos-cart-item">
                    <div className="flex-1">
                      <p className="font-semibold">{item.productName}</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(item.unitPrice)} c/u</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="btn-pos-secondary btn-pos-sm"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-bold w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="btn-pos-secondary btn-pos-sm"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <span className="font-bold w-24 text-right">{formatCurrency(item.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total y Botón Cobrar */}
            <div className={cn('p-4', lastAddTick ? 'slide-up' : '')}>
              <div className="pos-total">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total a Pagar</p>
                  <p className="pos-total-amount text-foreground">{formatCurrency(total)}</p>
                </div>
              <POSButton
                variant="success"
                icon={DollarSign}
                size="xl"
                disabled={!isOpen || cart.length === 0}
                onClick={() => setShowCheckout(true)}
              >
                Cobrar
              </POSButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === MODALES === */}

      {/* Modal Lectura de Tarjeta / Info */}
      <POSModal
        isOpen={showCardInfo && !showRecharge}
        onClose={() => { setShowCardInfo(false); setCurrentCard(null); }}
        title="Información de Tarjeta"
        size="md"
      >
        {currentCard && (
          <div className="space-y-6">
            <div className="text-center p-6 bg-secondary rounded-xl">
              <p className="text-sm text-muted-foreground mb-2">Código de Tarjeta</p>
              <p className="text-2xl font-mono font-bold text-primary">{currentCard.code}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="card-pos p-4 text-center">
                <p className="text-sm text-muted-foreground">Saldo Disponible</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(currentCard.balance)}</p>
              </div>
              <div className="card-pos p-4 text-center">
                <p className="text-sm text-muted-foreground">Puntos Acumulados</p>
                <p className="text-2xl font-bold text-foreground">{currentCard.points.toLocaleString()}</p>
              </div>
            </div>

            {currentCard.bonusBalance > 0 && (
              <div className="p-4 bg-secondary/60 border border-border rounded-xl text-center">
                <p className="text-sm text-muted-foreground">Bono Disponible</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(currentCard.bonusBalance)}</p>
              </div>
            )}
          </div>
        )}
      </POSModal>

      {/* Modal Recarga */}
      <POSModal
        isOpen={showRecharge}
        onClose={() => { setShowRecharge(false); setRechargeAmount(''); }}
        title="Recargar Tarjeta"
        size="lg"
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
              onChange={setRechargeAmount}
              maxLength={7}
            />
            
            {/* Montos rápidos */}
            <div className="grid grid-cols-3 gap-2">
              {[20000, 50000, 100000].map(amount => (
                <button
                  key={amount}
                  onClick={() => setRechargeAmount(amount.toString())}
                  className="tile-option justify-center font-medium"
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>
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
                  { id: 'cash', icon: Wallet, label: 'Efectivo' },
                  { id: 'transfer', icon: Smartphone, label: 'Transferencia' },
                  { id: 'debit', icon: CardIcon, label: 'Débito' },
                  { id: 'qr', icon: QrCode, label: 'QR' },
                ].map(method => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPayment(method.id as PaymentMethod)}
                    className={cn(
                      'tile-option',
                      selectedPayment === method.id && 'tile-option-active'
                    )}
                  >
                    <method.icon className="h-5 w-5" />
                    <span className="font-medium">{method.label}</span>
                  </button>
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
              Confirmar Recarga
            </POSButton>
          </div>
        </div>
      </POSModal>

      {/* Modal Checkout */}
      <POSModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        title="Finalizar Venta"
        size="lg"
      >
        <div className="grid grid-cols-2 gap-6">
          {/* Resumen de venta */}
          <div className="space-y-4">
            <div className="card-pos p-4 max-h-64 overflow-auto">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-muted-foreground">x{item.quantity}</p>
                  </div>
                  <p className="font-medium">{formatCurrency(item.total)}</p>
                </div>
              ))}
            </div>

            <div className="card-pos p-4">
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total</span>
                <span className="text-money-lg text-foreground">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Identificación y pago */}
          <div className="space-y-4">
            {/* Cliente para factura */}
            <div className="card-pos p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Cliente (Factura)</p>
                {!requiresInvoice && (
                  <span className="text-xs text-muted-foreground">Opcional</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="input-pos"
                  value={customerDocType}
                  onChange={(e) => setCustomerDocType(e.target.value as typeof customerDocType)}
                >
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="NIT">NIT</option>
                  <option value="TI">TI</option>
                  <option value="PAS">PAS</option>
                </select>
                <input
                  className="input-pos"
                  placeholder="Documento"
                  value={customerDocNumber}
                  onChange={(e) => setCustomerDocNumber(e.target.value)}
                />
              </div>
              <input
                className="input-pos"
                placeholder="Nombre completo"
                value={customerFullName}
                onChange={(e) => setCustomerFullName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input-pos"
                  placeholder="Teléfono"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <input
                  className="input-pos"
                  placeholder="Ciudad"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                />
              </div>
              {requiresInvoice && !isCustomerComplete && (
                <p className="text-xs text-destructive">
                  Completa los datos del cliente para facturar.
                </p>
              )}
            </div>

            {/* Medio de pago */}
            <div className="card-pos p-4 space-y-3">
              <p className="font-semibold">Medio de Pago</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'cash', icon: Wallet, label: 'Efectivo' },
                  { id: 'transfer', icon: Smartphone, label: 'Transferencia' },
                  { id: 'debit', icon: CardIcon, label: 'Débito' },
                  { id: 'credit', icon: CardIcon, label: 'Crédito' },
                ].map(method => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPayment(method.id as PaymentMethod)}
                    className={cn(
                      'tile-option',
                      selectedPayment === method.id && 'tile-option-active'
                    )}
                  >
                    <method.icon className="h-5 w-5" />
                    <span className="font-medium">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Checkbox factura */}
            <label className="flex items-center gap-3 p-4 card-pos cursor-pointer">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-border"
                checked={requiresInvoice}
                onChange={(e) => setRequiresInvoice(e.target.checked)}
              />
              <span>Requiere Factura Electrónica</span>
            </label>

            <POSButton
              variant="success"
              fullWidth
              size="xl"
              disabled={requiresInvoice && !isCustomerComplete}
              onClick={handleCheckout}
            >
              Confirmar Venta
            </POSButton>
          </div>
        </div>
      </POSModal>

      {/* Modal Recibo */}
      <POSModal
        isOpen={showReceipt}
        onClose={() => setShowReceipt(false)}
        title="Venta Exitosa"
        type="success"
        size="md"
        footer={
          <>
            <POSButton variant="secondary" icon={Printer}>
              Imprimir
            </POSButton>
            <POSButton variant="success" onClick={() => setShowReceipt(false)}>
              Nueva Venta
            </POSButton>
          </>
        }
      >
        <div className="receipt-paper max-h-96 overflow-auto">
          <div className="text-center mb-4">
            <h3 className="text-xl font-bold">POLIVERSO</h3>
            <p className="text-sm">MallBP - Montelíbano</p>
            <p className="text-xs mt-2">{new Date().toLocaleString('es-CO')}</p>
          </div>
          
          <div className="border-t border-dashed border-gray-400 my-4" />
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Cajero:</span>
              <span>{authUser?.name ?? 'Cajero'}</span>
            </div>
            <div className="flex justify-between">
              <span>Caja:</span>
              <span>Caja 1</span>
            </div>
            <div className="flex justify-between">
              <span>Ticket:</span>
              <span>#00001234</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-4" />
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between font-bold">
              <span>TOTAL</span>
              <span>{formatCurrency(total || 50000)}</span>
            </div>
            <div className="flex justify-between">
              <span>Medio de pago:</span>
              <span className="capitalize">{selectedPayment}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-4" />
          
          <p className="text-center text-xs">¡Gracias por su visita!</p>
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
        message={syncStatus === 'syncing' ? 'Leyendo tarjeta...' : undefined}
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
        size="md"
      >
        <div className="space-y-4">
          <div className="card-pos p-4">
            <p className="text-sm text-muted-foreground mb-2">Efectivo inicial contado</p>
            <p className="text-money-xl">{formatCurrency(parseInt(openingCashInput || '0'))}</p>
          </div>
          <NumPad value={openingCashInput} onChange={setOpeningCashInput} maxLength={7} />
          <POSButton
            variant="success"
            fullWidth
            disabled={parseInt(openingCashInput || '0') < 0}
            onClick={() => {
              const amount = parseInt(openingCashInput || '0');
              attemptOpenCash(amount);
            }}
          >
            Confirmar Apertura
          </POSButton>
        </div>
      </POSModal>

      {/* Modal Cierre de Caja */}
      <POSModal
        isOpen={showCloseCashModal}
        onClose={() => setShowCloseCashModal(false)}
        title="Cierre de Caja"
        size="lg"
      >
        <div className="space-y-4">
          <div className="card-pos p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Efectivo inicial</span>
              <span className="font-semibold">{formatCurrency(openingCashAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ventas en efectivo</span>
              <span className="font-semibold">{formatCurrency(cashSales)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="font-semibold">Esperado</span>
              <span className="font-bold">{formatCurrency(expectedCash)}</span>
            </div>
          </div>
          <div className="card-pos p-4">
            <p className="text-sm text-muted-foreground mb-2">Efectivo contado al cierre</p>
            <p className="text-money-xl">{formatCurrency(parseInt(closingCashInput || '0'))}</p>
          </div>
          <NumPad value={closingCashInput} onChange={setClosingCashInput} maxLength={7} />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Diferencia</span>
            <span className="font-semibold">
              {formatCurrency(parseInt(closingCashInput || '0') - expectedCash)}
            </span>
          </div>
          <POSButton
            variant="danger"
            fullWidth
            disabled={parseInt(closingCashInput || '0') <= 0}
            onClick={() => {
              const amount = parseInt(closingCashInput || '0');
              setShowCloseCashModal(false);
              attemptCloseCash(amount);
            }}
          >
            Confirmar Cierre
          </POSButton>
        </div>
      </POSModal>

      {/* Aviso Apertura Caja Registradora */}
      <POSModal
        isOpen={showCashOpenNotice}
        onClose={() => setShowCashOpenNotice(false)}
        title="Apertura Caja Registradora"
        size="sm"
      >
        <div className="text-center py-6">
          <p className="text-lg font-semibold">Caja abierta correctamente</p>
          <p className="text-sm text-muted-foreground">Lista para operar</p>
        </div>
      </POSModal>

      {/* Modal Supervisor Auth */}
      <POSModal
        isOpen={showSupervisorAuth}
        onClose={() => setShowSupervisorAuth(false)}
        title="Autorización de Supervisor"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ingresa el código de 6 dígitos del supervisor para continuar.
          </p>
          <div className="card-pos p-4">
            <NumPad value={supervisorPin} onChange={setSupervisorPin} maxLength={6} />
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
