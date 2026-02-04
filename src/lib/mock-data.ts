// === POLIVERSO Mock Data ===
import type { 
  User, 
  Product, 
  ProductCategory, 
  Card, 
  Prize, 
  RechargeBonus,
  Machine,
  Sale,
  Alert
} from '@/types/pos.types';

// Usuarios de prueba
export const mockUsers: User[] = [
  { id: '1', name: 'Cajero 1', email: 'cajero1@poliverso.local', role: 'cashier', createdAt: new Date() },
  { id: '2', name: 'Cajero 2', email: 'cajero2@poliverso.local', role: 'cashier', createdAt: new Date() },
  { id: '3', name: 'Supervisor Turno', email: 'supervisor@poliverso.local', role: 'supervisor', createdAt: new Date() },
  { id: '4', name: 'Admin POLIVERSE', email: 'admin@poliverso.local', role: 'admin', createdAt: new Date() },
];

// Códigos de acceso (demo)
export const mockAuthCodes: Record<string, string> = {
  '1': '333333',
  '2': '444444',
  '3': '222222',
  '4': '111111',
};

// Categorías de productos
export const mockCategories: ProductCategory[] = [
  { id: '1', name: 'Tarjetas', icon: 'credit_card', color: 'primary', order: 1 },
  { id: '2', name: 'Snacks', icon: 'fastfood', color: 'warning', order: 2 },
  { id: '3', name: 'Bebidas', icon: 'local_drink', color: 'info', order: 3 },
  { id: '4', name: 'Cumpleaños', icon: 'cake', color: 'accent', order: 4 },
  { id: '5', name: 'Programas', icon: 'school', color: 'success', order: 5 },
];

// Productos
export const mockProducts: Product[] = [
  { id: '1', name: 'Tarjeta Nueva', categoryId: '1', price: 10000, isActive: true },
  { id: '2', name: 'Tarjeta Regalo', categoryId: '1', price: 50000, isActive: true },
  { id: '3', name: 'Nachos', categoryId: '2', price: 8000, stock: 50, isActive: true },
  { id: '4', name: 'Palomitas', categoryId: '2', price: 6000, stock: 100, isActive: true },
  { id: '5', name: 'Hot Dog', categoryId: '2', price: 7500, stock: 30, isActive: true },
  { id: '6', name: 'Gaseosa', categoryId: '3', price: 4000, stock: 80, isActive: true },
  { id: '7', name: 'Agua', categoryId: '3', price: 3000, stock: 60, isActive: true },
  { id: '8', name: 'Jugo', categoryId: '3', price: 4500, stock: 40, isActive: true },
  { id: '9', name: 'Paquete Básico', categoryId: '4', price: 250000, isActive: true },
  { id: '10', name: 'Paquete Premium', categoryId: '4', price: 450000, isActive: true },
  { id: '11', name: 'Playmaker', categoryId: '5', price: 180000, isActive: true },
  { id: '12', name: 'Polirobotics', categoryId: '5', price: 200000, isActive: true },
  { id: '13', name: 'Tecnokids', categoryId: '5', price: 150000, isActive: true },
];

// Escalas de bonificación
export const mockBonuses: RechargeBonus[] = [
  { id: '1', minAmount: 20000, maxAmount: 49999, bonusAmount: 2000, isActive: true },
  { id: '2', minAmount: 50000, maxAmount: 99999, bonusAmount: 7000, isActive: true },
  { id: '3', minAmount: 100000, maxAmount: 199999, bonusAmount: 20000, isActive: true },
  { id: '4', minAmount: 200000, maxAmount: 999999, bonusAmount: 50000, isActive: true },
];

// Premios
export const mockPrizes: Prize[] = [
  { id: '1', name: 'Peluche Pequeño', pointsRequired: 500, stock: 20, isActive: true },
  { id: '2', name: 'Peluche Mediano', pointsRequired: 1500, stock: 15, isActive: true },
  { id: '3', name: 'Peluche Grande', pointsRequired: 3000, stock: 10, isActive: true },
  { id: '4', name: 'Audífonos', pointsRequired: 5000, stock: 5, isActive: true },
  { id: '5', name: 'Tablet', pointsRequired: 50000, stock: 2, isActive: true },
];

// Máquinas
export const mockMachines: Machine[] = [
  { id: '1', name: 'Air Hockey 1', code: 'AH-001', pricePerUse: 3000, locationId: '1', status: 'active', readers: 2 },
  { id: '2', name: 'Basketball Pro', code: 'BB-001', pricePerUse: 2500, locationId: '1', status: 'active', readers: 1 },
  { id: '3', name: 'Racing Simulator', code: 'RS-001', pricePerUse: 4000, locationId: '1', status: 'active', readers: 2 },
  { id: '4', name: 'Dance Revolution', code: 'DR-001', pricePerUse: 3500, locationId: '1', status: 'maintenance', readers: 2 },
  { id: '5', name: 'Claw Machine 1', code: 'CM-001', pricePerUse: 2000, locationId: '1', status: 'active', readers: 1 },
];

// Tarjeta de ejemplo
export const mockCards: Card[] = [
  { id: '1', code: 'POL-001234', balance: 45000, bonusBalance: 5000, points: 2500, isActive: true, createdAt: new Date() },
  { id: '2', code: 'POL-005678', balance: 12000, bonusBalance: 0, points: 800, isActive: true, createdAt: new Date() },
];

// Alertas de ejemplo
export const mockAlerts: Alert[] = [
  { id: '1', type: 'bonus', severity: 'info', message: 'Bono de $7,000 aplicado en recarga', isRead: false, createdAt: new Date() },
  { id: '2', type: 'inventory', severity: 'warning', message: 'Stock bajo: Nachos (5 unidades)', isRead: false, createdAt: new Date() },
  { id: '3', type: 'double_read', severity: 'error', message: 'Doble lectura detectada en Air Hockey 1', isRead: false, createdAt: new Date() },
];

// Ventas recientes (para supervisor)
export const mockRecentSales: Sale[] = [
  {
    id: '1',
    shiftId: '1',
    userId: '1',
    items: [{ id: '1', productId: '1', productName: 'Tarjeta Nueva', quantity: 1, unitPrice: 10000, total: 10000 }],
    subtotal: 10000,
    discount: 0,
    total: 10000,
    paymentMethod: 'cash',
    status: 'completed',
    requiresInvoice: false,
    createdAt: new Date(Date.now() - 5 * 60000),
  },
  {
    id: '2',
    shiftId: '1',
    userId: '1',
    items: [
      { id: '2', productId: '3', productName: 'Nachos', quantity: 2, unitPrice: 8000, total: 16000 },
      { id: '3', productId: '6', productName: 'Gaseosa', quantity: 2, unitPrice: 4000, total: 8000 },
    ],
    subtotal: 24000,
    discount: 0,
    total: 24000,
    paymentMethod: 'transfer',
    status: 'completed',
    requiresInvoice: true,
    createdAt: new Date(Date.now() - 15 * 60000),
  },
];

// Formato de moneda colombiana
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Formato de fecha/hora
export const formatDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Calcular bono por monto de recarga
export const calculateBonus = (amount: number): number => {
  const bonus = mockBonuses.find(b => amount >= b.minAmount && amount <= b.maxAmount);
  return bonus?.bonusAmount || 0;
};

// Calcular puntos por recarga (1 punto por cada $1,000)
export const calculatePoints = (amount: number): number => {
  return Math.floor(amount / 1000);
};
