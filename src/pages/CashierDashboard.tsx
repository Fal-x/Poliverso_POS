import { useState } from 'react';
import { POSLayout } from '@/components/layout/POSLayout';
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
  Gift
} from 'lucide-react';
import { 
  mockProducts, 
  mockCategories, 
  formatCurrency,
  calculateBonus,
  calculatePoints,
  mockCards
} from '@/lib/mock-data';
import type { SaleItem, PaymentMethod, Card } from '@/types/pos.types';
import { cn } from '@/lib/utils';

// Item del carrito
interface CartItem extends SaleItem {
  productId: string;
}

export default function CashierDashboard() {
  // Estado de caja
  const [isOpen, setIsOpen] = useState(false);
  
  // Estado del carrito
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Modales
  const [showCardReader, setShowCardReader] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [showCardInfo, setShowCardInfo] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  
  // Estados de datos
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'success' | 'error'>('syncing');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Calcular totales
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal;

  // Productos filtrados
  const filteredProducts = selectedCategory === 'all' 
    ? mockProducts 
    : mockProducts.filter(p => p.categoryId === selectedCategory);

  // Agregar producto al carrito
  const addToCart = (productId: string) => {
    const product = mockProducts.find(p => p.id === productId);
    if (!product) return;

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

  // Simular lectura de tarjeta
  const handleReadCard = () => {
    setShowSync(true);
    setSyncStatus('syncing');
    
    setTimeout(() => {
      setSyncStatus('success');
      setTimeout(() => {
        setShowSync(false);
        setCurrentCard(mockCards[0]);
        setShowCardInfo(true);
      }, 500);
    }, 1500);
  };

  // Simular recarga
  const handleRecharge = () => {
    if (!rechargeAmount || parseInt(rechargeAmount) < 5000) {
      setErrorMessage('El monto mínimo de recarga es $5,000');
      setShowError(true);
      return;
    }
    
    setShowRecharge(false);
    setShowSync(true);
    setSyncStatus('syncing');
    
    setTimeout(() => {
      setSyncStatus('success');
      setTimeout(() => {
        setShowSync(false);
        setRechargeAmount('');
        // Mostrar recibo
        setShowReceipt(true);
      }, 500);
    }, 1500);
  };

  // Procesar venta
  const handleCheckout = () => {
    setShowCheckout(false);
    setShowSync(true);
    setSyncStatus('syncing');
    
    setTimeout(() => {
      setSyncStatus('success');
      setTimeout(() => {
        setShowSync(false);
        setCart([]);
        setShowReceipt(true);
      }, 500);
    }, 1500);
  };

  // Bonus calculado para recarga
  const rechargeValue = parseInt(rechargeAmount) || 0;
  const bonus = calculateBonus(rechargeValue);
  const points = calculatePoints(rechargeValue);

  return (
    <POSLayout userName="María García" userRole="Cajero">
      <div className="flex w-full pos-full-height">
        {/* === SECCIÓN IZQUIERDA: TARJETAS (30%) === */}
        <div className="w-[30%] min-w-[320px] border-r border-border bg-surface flex flex-col">
          {/* Botón Abrir/Cerrar Caja */}
          <div className="p-4 border-b border-border">
            <POSButton
              variant={isOpen ? 'danger' : 'success'}
              icon={isOpen ? PowerOff : Power}
              fullWidth
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? 'Cerrar Caja' : 'Abrir Caja'}
            </POSButton>
          </div>

          {/* Acciones de Tarjetas */}
          <div className="flex-1 p-4 space-y-3">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Gestión de Tarjetas
            </h3>

            <POSButton
              variant="primary"
              icon={Plus}
              fullWidth
              disabled={!isOpen}
              onClick={() => addToCart('1')} // Agregar tarjeta nueva al carrito
            >
              Crear Tarjeta
            </POSButton>

            <POSButton
              variant="success"
              icon={RefreshCw}
              fullWidth
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
              disabled={!isOpen}
              onClick={handleReadCard}
            >
              Leer Tarjeta
            </POSButton>

            <POSButton
              variant="danger"
              icon={Trash2}
              fullWidth
              disabled={!isOpen}
              onClick={() => setShowConfirmDelete(true)}
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
                    <p className="text-lg font-bold text-success">{formatCurrency(currentCard.balance)}</p>
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
          <div className="p-4 border-b border-border overflow-x-auto">
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all',
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                Todos
              </button>
              {mockCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all',
                    selectedCategory === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                  )}
                >
                  {cat.name}
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
                    'card-pos-interactive p-4 text-center',
                    !isOpen && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="h-16 w-16 mx-auto mb-3 rounded-xl bg-secondary flex items-center justify-center">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-sm mb-1 line-clamp-2">{product.name}</p>
                  <p className="text-money text-primary">{formatCurrency(product.price)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Carrito y Total */}
          <div className="border-t border-border bg-surface">
            {/* Items del carrito */}
            {cart.length > 0 && (
              <div className="max-h-48 overflow-auto p-4 space-y-2">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-card rounded-xl">
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">{formatCurrency(item.unitPrice)} c/u</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-2 rounded-lg bg-secondary hover:bg-secondary/80"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="font-bold w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-2 rounded-lg bg-secondary hover:bg-secondary/80"
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
            <div className="p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total a Pagar</p>
                <p className="text-money-xl text-success">{formatCurrency(total)}</p>
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
                <p className="text-2xl font-bold text-success">{formatCurrency(currentCard.balance)}</p>
              </div>
              <div className="card-pos p-4 text-center">
                <p className="text-sm text-muted-foreground">Puntos Acumulados</p>
                <p className="text-2xl font-bold text-accent">{currentCard.points.toLocaleString()}</p>
              </div>
            </div>

            {currentCard.bonusBalance > 0 && (
              <div className="p-4 bg-accent/10 border border-accent/30 rounded-xl text-center">
                <p className="text-sm text-accent">Bono Disponible</p>
                <p className="text-xl font-bold text-accent">{formatCurrency(currentCard.bonusBalance)}</p>
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
                  className="p-3 rounded-xl bg-secondary hover:bg-secondary/80 font-medium"
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
                  <div className="flex justify-between text-success">
                    <span className="flex items-center gap-2">
                      <Gift className="h-4 w-4" />
                      Bono aplicado
                    </span>
                    <span className="font-bold">+{formatCurrency(bonus)}</span>
                  </div>
                )}
                
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="font-semibold">Total en tarjeta</span>
                  <span className="text-xl font-bold text-success">
                    {formatCurrency(rechargeValue + bonus)}
                  </span>
                </div>
              </div>

              {points > 0 && (
                <div className="p-3 bg-accent/10 rounded-xl">
                  <p className="text-sm text-accent">
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
                      'p-3 rounded-xl flex items-center gap-2 transition-all',
                      selectedPayment === method.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
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
              disabled={rechargeValue < 5000}
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
                <span className="text-money-lg text-success">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Identificación y pago */}
          <div className="space-y-4">
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
                      'p-3 rounded-xl flex items-center gap-2 transition-all',
                      selectedPayment === method.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
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
              <input type="checkbox" className="h-5 w-5 rounded border-border" />
              <span>Requiere Factura Electrónica</span>
            </label>

            <POSButton
              variant="success"
              fullWidth
              size="xl"
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
              <span>María García</span>
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
    </POSLayout>
  );
}
