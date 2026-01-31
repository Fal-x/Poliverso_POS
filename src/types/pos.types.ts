// === POLIVERSO POS Types ===

// Roles del sistema
export type UserRole = 'cashier' | 'supervisor' | 'admin';

// Estados de caja
export type CashRegisterStatus = 'closed' | 'open';

// Medios de pago
export type PaymentMethod = 'cash' | 'transfer' | 'qr' | 'debit' | 'credit';

// Estados de transacción
export type TransactionStatus = 'completed' | 'pending' | 'cancelled' | 'refunded';

// Usuario del sistema
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  createdAt: Date;
}

// Sede
export interface Location {
  id: string;
  name: string;
  address: string;
  isActive: boolean;
}

// Caja registradora
export interface CashRegister {
  id: string;
  locationId: string;
  name: string;
  status: CashRegisterStatus;
  openedBy?: string;
  openedAt?: Date;
  initialAmount?: number;
}

// Turno de trabajo
export interface Shift {
  id: string;
  userId: string;
  cashRegisterId: string;
  startTime: Date;
  endTime?: Date;
  initialAmount: number;
  finalAmount?: number;
  isActive: boolean;
}

// Tarjeta física
export interface Card {
  id: string;
  code: string;
  balance: number;
  bonusBalance: number;
  points: number;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  customerId?: string;
}

// Cliente
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  document?: string;
  birthDate?: Date;
  createdAt: Date;
}

// Categoría de producto
export interface ProductCategory {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  order: number;
}

// Producto
export interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  cost?: number;
  stock?: number;
  isActive: boolean;
  image?: string;
  description?: string;
}

// Máquina/Atracción
export interface Machine {
  id: string;
  name: string;
  code: string;
  pricePerUse: number;
  locationId: string;
  status: 'active' | 'maintenance' | 'inactive';
  readers: number;
}

// Premio
export interface Prize {
  id: string;
  name: string;
  pointsRequired: number;
  stock: number;
  image?: string;
  isActive: boolean;
}

// Bonificación por recarga
export interface RechargeBonus {
  id: string;
  minAmount: number;
  maxAmount: number;
  bonusAmount: number;
  isActive: boolean;
}

// Item de venta
export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Venta/Transacción
export interface Sale {
  id: string;
  shiftId: string;
  userId: string;
  customerId?: string;
  cardId?: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  requiresInvoice: boolean;
  invoiceCode?: string;
  createdAt: Date;
}

// Recarga
export interface Recharge {
  id: string;
  cardId: string;
  userId: string;
  shiftId: string;
  amount: number;
  bonusAmount: number;
  pointsEarned: number;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  createdAt: Date;
}

// Uso de máquina
export interface MachineUsage {
  id: string;
  machineId: string;
  cardId: string;
  amountCharged: number;
  timestamp: Date;
  isDoubleRead: boolean;
  correctedBy?: string;
  correctionReason?: string;
}

// Redención de premio
export interface PrizeRedemption {
  id: string;
  prizeId: string;
  cardId: string;
  userId: string;
  pointsUsed: number;
  createdAt: Date;
}

// Programa (cumpleaños, vacacionales, extracurriculares)
export interface Program {
  id: string;
  type: 'birthday' | 'vacation' | 'extracurricular';
  name: string;
  customerId: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: 'pending' | 'partial' | 'paid';
  scheduledDate?: Date;
  notes?: string;
  createdAt: Date;
}

// Pago de programa
export interface ProgramPayment {
  id: string;
  programId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  userId: string;
  createdAt: Date;
}

// Salida de dinero de caja
export interface CashWithdrawal {
  id: string;
  shiftId: string;
  amount: number;
  reason: string;
  authorizedBy: string;
  createdBy: string;
  createdAt: Date;
}

// Alerta del sistema
export interface Alert {
  id: string;
  type: 'bonus' | 'cancellation' | 'inventory' | 'double_read' | 'cash_difference';
  severity: 'info' | 'warning' | 'error';
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

// Inventario de tarjetas
export interface CardInventory {
  id: string;
  shiftId: string;
  initialCount: number;
  soldCount: number;
  finalCount: number;
  difference: number;
  createdAt: Date;
}

// Arqueo de caja
export interface CashCount {
  id: string;
  shiftId: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  byPaymentMethod: Record<PaymentMethod, { expected: number; actual: number }>;
  notes?: string;
  createdAt: Date;
}
