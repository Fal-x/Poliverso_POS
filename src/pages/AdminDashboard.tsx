import { useState } from 'react';
import { POSLayout } from '@/components/layout/POSLayout';
import { POSButton } from '@/components/ui/POSButton';
import { 
  Settings, 
  Package, 
  FileText, 
  TrendingUp, 
  Users,
  ChevronRight,
  Search,
  Plus,
  Edit3,
  Trash2,
  Download,
  Filter,
  DollarSign,
  Gift,
  CreditCard,
  Percent,
  BarChart3,
  Calendar,
  Store,
  Shield
} from 'lucide-react';
import { mockProducts, mockCategories, mockPrizes, mockBonuses, mockUsers, formatCurrency } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

type AdminModule = 'config' | 'inventory' | 'reports' | 'sales' | 'users';

export default function AdminDashboard() {
  const [activeModule, setActiveModule] = useState<AdminModule>('config');
  const [searchTerm, setSearchTerm] = useState('');

  const modules = [
    { id: 'config' as AdminModule, icon: Settings, label: 'Configuración', description: 'Sistema y parámetros' },
    { id: 'inventory' as AdminModule, icon: Package, label: 'Inventario', description: 'Productos, precios, bonos' },
    { id: 'reports' as AdminModule, icon: FileText, label: 'Reportes', description: 'Auditoría y reportes' },
    { id: 'sales' as AdminModule, icon: TrendingUp, label: 'Ventas', description: 'Vista total de ventas' },
    { id: 'users' as AdminModule, icon: Users, label: 'Usuarios', description: 'Gestión de usuarios' },
  ];

  return (
    <POSLayout userName="Ana Martínez" userRole="Administrador">
      <div className="flex w-full pos-full-height">
        {/* Sidebar de Módulos */}
        <div className="w-72 border-r border-border bg-surface flex flex-col">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-lg">Panel Administrativo</h2>
            <p className="text-sm text-muted-foreground">Gestión del sistema</p>
          </div>

          <nav className="flex-1 p-2 space-y-1">
            {modules.map((module) => (
              <button
                key={module.id}
                onClick={() => setActiveModule(module.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-4 rounded-xl transition-all text-left',
                  activeModule === module.id
                    ? 'bg-primary text-primary-foreground'
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
          {/* === CONFIGURACIÓN === */}
          {activeModule === 'config' && (
            <div className="space-y-6 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Configuración General</h1>
                  <p className="text-muted-foreground">Parámetros del sistema</p>
                </div>
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
                      <input className="input-pos" defaultValue="POLIVERSO - MallBP" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Ubicación</label>
                      <input className="input-pos" defaultValue="Montelíbano, Córdoba" />
                    </div>
                  </div>
                </div>

                <div className="card-pos p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Shield className="h-6 w-6 text-accent" />
                    <h3 className="font-semibold text-lg">Seguridad</h3>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 bg-secondary rounded-xl cursor-pointer">
                      <input type="checkbox" className="h-5 w-5" defaultChecked />
                      <span>Requerer PIN para anulaciones</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-secondary rounded-xl cursor-pointer">
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
                      <input className="input-pos" defaultValue="10000" type="number" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Recarga mínima</label>
                      <input className="input-pos" defaultValue="5000" type="number" />
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
                      <input className="input-pos" defaultValue="1" type="number" />
                    </div>
                  </div>
                </div>
              </div>

              <POSButton variant="success">
                Guardar Cambios
              </POSButton>
            </div>
          )}

          {/* === INVENTARIO === */}
          {activeModule === 'inventory' && (
            <div className="space-y-6 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Gestión de Inventario</h1>
                  <p className="text-muted-foreground">Productos, precios, bonos y promociones</p>
                </div>
                <POSButton variant="primary" icon={Plus}>
                  Nuevo Producto
                </POSButton>
              </div>

              {/* Búsqueda */}
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <input
                    className="input-pos pl-12"
                    placeholder="Buscar productos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <POSButton variant="secondary" icon={Filter}>
                  Filtrar
                </POSButton>
              </div>

              {/* Tabs de inventario */}
              <div className="flex gap-2 border-b border-border pb-4">
                {['Productos', 'Bonos', 'Premios', 'Categorías'].map((tab) => (
                  <button
                    key={tab}
                    className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 font-medium"
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Tabla de productos */}
              <div className="card-pos overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-secondary">
                      <tr>
                        <th className="text-left p-4 font-medium">Producto</th>
                        <th className="text-left p-4 font-medium">Categoría</th>
                        <th className="text-right p-4 font-medium">Precio</th>
                        <th className="text-right p-4 font-medium">Stock</th>
                        <th className="text-center p-4 font-medium">Estado</th>
                        <th className="text-center p-4 font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockProducts.filter(p => 
                        p.name.toLowerCase().includes(searchTerm.toLowerCase())
                      ).map((product) => (
                        <tr key={product.id} className="border-t border-border hover:bg-secondary/30">
                          <td className="p-4 font-medium">{product.name}</td>
                          <td className="p-4 text-muted-foreground">
                            {mockCategories.find(c => c.id === product.categoryId)?.name}
                          </td>
                          <td className="p-4 text-right font-mono">{formatCurrency(product.price)}</td>
                          <td className="p-4 text-right">{product.stock ?? '∞'}</td>
                          <td className="p-4 text-center">
                            <span className={cn(
                              'px-2 py-1 rounded-full text-xs font-medium',
                              product.isActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                            )}>
                              {product.isActive ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex justify-center gap-2">
                              <button className="p-2 rounded-lg hover:bg-secondary">
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button className="p-2 rounded-lg hover:bg-destructive/20 text-destructive">
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
                  {mockBonuses.map((bonus) => (
                    <div key={bonus.id} className="p-4 bg-secondary rounded-xl">
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(bonus.minAmount)} - {formatCurrency(bonus.maxAmount)}
                      </p>
                      <p className="text-xl font-bold text-accent mt-1">
                        +{formatCurrency(bonus.bonusAmount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* === REPORTES === */}
          {activeModule === 'reports' && (
            <div className="space-y-6 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Reportes y Auditoría</h1>
                  <p className="text-muted-foreground">Descarga y análisis de datos</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { icon: DollarSign, label: 'Ventas por Período', color: 'text-success' },
                  { icon: BarChart3, label: 'Ventas por Línea', color: 'text-primary' },
                  { icon: Users, label: 'Ventas por Vendedor', color: 'text-accent' },
                  { icon: Gift, label: 'Bonificaciones Entregadas', color: 'text-warning' },
                  { icon: CreditCard, label: 'Uso de Máquinas', color: 'text-primary' },
                  { icon: Package, label: 'Inventario de Tarjetas', color: 'text-success' },
                ].map((report, idx) => (
                  <div key={idx} className="card-pos-interactive p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className={cn('p-3 rounded-xl bg-secondary', report.color)}>
                        <report.icon className="h-6 w-6" />
                      </div>
                      <h3 className="font-semibold">{report.label}</h3>
                    </div>
                    <div className="flex gap-2">
                      <POSButton variant="secondary" size="sm" icon={Calendar}>
                        Filtrar
                      </POSButton>
                      <POSButton variant="primary" size="sm" icon={Download}>
                        Excel
                      </POSButton>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* === VENTAS === */}
          {activeModule === 'sales' && (
            <div className="space-y-6 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">Vista Total de Ventas</h1>
                  <p className="text-muted-foreground">Resumen de todas las transacciones</p>
                </div>
                <div className="flex gap-3">
                  <POSButton variant="secondary" icon={Calendar}>
                    Hoy
                  </POSButton>
                  <POSButton variant="secondary" icon={Filter}>
                    Filtros
                  </POSButton>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Ventas', value: '$2,450,000', change: '+12%', positive: true },
                  { label: 'Transacciones', value: '156', change: '+8%', positive: true },
                  { label: 'Ticket Promedio', value: '$15,705', change: '-2%', positive: false },
                  { label: 'Bonos Entregados', value: '$180,000', change: '+15%', positive: true },
                ].map((kpi, idx) => (
                  <div key={idx} className="card-pos p-6">
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                    <p className={cn(
                      'text-sm mt-2',
                      kpi.positive ? 'text-success' : 'text-destructive'
                    )}>
                      {kpi.change} vs ayer
                    </p>
                  </div>
                ))}
              </div>

              {/* Placeholder para gráfico */}
              <div className="card-pos p-6 h-64 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3" />
                  <p>Gráfico de ventas por hora</p>
                  <p className="text-sm">(Requiere integración con backend)</p>
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
                <POSButton variant="primary" icon={Plus}>
                  Nuevo Usuario
                </POSButton>
              </div>

              <div className="card-pos overflow-hidden">
                <table className="w-full">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="text-left p-4 font-medium">Usuario</th>
                      <th className="text-left p-4 font-medium">Email</th>
                      <th className="text-left p-4 font-medium">Rol</th>
                      <th className="text-center p-4 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockUsers.map((user) => (
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
                            'px-3 py-1 rounded-full text-xs font-medium',
                            user.role === 'admin' && 'bg-accent/20 text-accent',
                            user.role === 'supervisor' && 'bg-warning/20 text-warning',
                            user.role === 'cashier' && 'bg-primary/20 text-primary'
                          )}>
                            {user.role === 'admin' && 'Administrador'}
                            {user.role === 'supervisor' && 'Supervisor'}
                            {user.role === 'cashier' && 'Cajero'}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            <button className="p-2 rounded-lg hover:bg-secondary">
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button className="p-2 rounded-lg hover:bg-destructive/20 text-destructive">
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
        </div>
      </div>
    </POSLayout>
  );
}
