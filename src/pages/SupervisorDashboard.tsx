import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { POSLayout } from '@/components/layout/POSLayout';
import { POSButton } from '@/components/ui/POSButton';
import { POSModal, ConfirmModal } from '@/components/ui/POSModal';
import { 
  Monitor, 
  Eye, 
  XCircle, 
  Edit3, 
  RotateCcw,
  AlertTriangle,
  Bell,
  TrendingUp,
  Settings,
  Wallet,
  Gift,
  Package,
  Zap,
  Clock,
  User,
  DollarSign,
  Plus,
  Search,
  FileText
} from 'lucide-react';
import { mockRecentSales, mockAlerts, mockMachines, formatCurrency, formatDateTime } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState<{ type: string; id: string; label: string } | null>(null);
  const [authPin, setAuthPin] = useState('');
  const [authReason, setAuthReason] = useState('');
  const [showCashierView, setShowCashierView] = useState(false);

  // Abrir modal de autorización
  const handleAuthAction = (type: string, id: string, label: string) => {
    setAuthAction({ type, id, label });
    setAuthPin('');
    setAuthReason('');
    setShowAuthModal(true);
  };

  // Confirmar autorización
  const handleConfirmAuth = () => {
    // En producción: validar PIN y registrar acción
    console.log('Autorizado:', authAction, authReason);
    setShowAuthModal(false);
    setAuthAction(null);
  };

  // Stats rápidos
  const stats = [
    { label: 'Ventas Hoy', value: '$2,450,000', icon: TrendingUp, color: 'text-success' },
    { label: 'Transacciones', value: '156', icon: FileText, color: 'text-primary' },
    { label: 'Alertas', value: '3', icon: Bell, color: 'text-warning' },
    { label: 'Bonos Entregados', value: '$180,000', icon: Gift, color: 'text-accent' },
  ];

  if (showCashierView) {
    return (
      <>
        <div className="fixed top-4 right-4 z-50">
          <POSButton
            variant="secondary"
            onClick={() => setShowCashierView(false)}
            icon={Eye}
          >
            Volver a Supervisor
          </POSButton>
        </div>
        {/* Importar CashierDashboard aquí o navegar */}
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <Monitor className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h2 className="text-2xl font-bold mb-2">Vista de Cajero</h2>
            <p className="text-muted-foreground mb-4">Vista completa del POS de cajero</p>
            <POSButton variant="primary" onClick={() => navigate('/cashier')}>
              Ir al Dashboard de Cajero
            </POSButton>
          </div>
        </div>
      </>
    );
  }

  return (
    <POSLayout userName="Carlos López" userRole="Supervisor">
      <div className="flex w-full pos-full-height">
        {/* Sidebar con botones principales */}
        <div className="w-72 border-r border-border bg-surface flex flex-col">
          <div className="p-4 space-y-3">
            <POSButton
              variant="primary"
              icon={Monitor}
              fullWidth
              onClick={() => setShowCashierView(true)}
            >
              Ver Dashboard Cajero
            </POSButton>
            
            <POSButton
              variant="secondary"
              icon={FileText}
              fullWidth
            >
              Reporte del Día
            </POSButton>
          </div>

          {/* Stats */}
          <div className="p-4 space-y-3 border-t border-border">
            {stats.map((stat, idx) => (
              <div key={idx} className="card-pos p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg bg-secondary', stat.color)}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="font-bold">{stat.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feed Principal - 5 Secciones */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* === SECCIÓN 1: Control y Supervisión === */}
          <section className="card-pos">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Control y Supervisión</h2>
              <span className="badge-info ml-auto">{mockRecentSales.length} transacciones</span>
            </div>
            <div className="p-4 space-y-3">
              {mockRecentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-background">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {sale.items.map(i => i.productName).join(', ')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(sale.createdAt)} • {sale.paymentMethod}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-money font-bold">{formatCurrency(sale.total)}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAuthAction('cancel', sale.id, 'Anulación')}
                        className="p-2 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"
                        title="Anular"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleAuthAction('modify', sale.id, 'Modificación')}
                        className="p-2 rounded-lg hover:bg-warning/20 text-warning transition-colors"
                        title="Modificar"
                      >
                        <Edit3 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleAuthAction('correct', sale.id, 'Corrección')}
                        className="p-2 rounded-lg hover:bg-primary/20 text-primary transition-colors"
                        title="Corregir"
                      >
                        <RotateCcw className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* === SECCIÓN 2: Autorizaciones Especiales === */}
          <section className="card-pos">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Wallet className="h-5 w-5 text-warning" />
              <h2 className="text-lg font-semibold">Autorizaciones Especiales</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card-pos-interactive p-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-warning/20 text-warning">
                      <DollarSign className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Retiro de Efectivo</h3>
                      <p className="text-sm text-muted-foreground">Autorizar salida de dinero de caja</p>
                    </div>
                  </div>
                  <POSButton
                    variant="warning"
                    fullWidth
                    className="mt-4"
                    onClick={() => handleAuthAction('withdrawal', 'new', 'Retiro de Efectivo')}
                  >
                    Autorizar Retiro
                  </POSButton>
                </div>

                <div className="card-pos p-6 opacity-60">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-secondary text-muted-foreground">
                      <Plus className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Más Acciones</h3>
                      <p className="text-sm text-muted-foreground">Próximamente</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* === SECCIÓN 3: Alertas === */}
          <section className="card-pos">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Bell className="h-5 w-5 text-destructive" />
              <h2 className="text-lg font-semibold">Alertas</h2>
              <span className="badge-danger ml-auto">{mockAlerts.filter(a => !a.isRead).length} nuevas</span>
            </div>
            <div className="p-4 space-y-3">
              {mockAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-xl border',
                    alert.severity === 'error' && 'bg-destructive/10 border-destructive/30',
                    alert.severity === 'warning' && 'bg-warning/10 border-warning/30',
                    alert.severity === 'info' && 'bg-primary/10 border-primary/30'
                  )}
                >
                  <AlertTriangle className={cn(
                    'h-5 w-5',
                    alert.severity === 'error' && 'text-destructive',
                    alert.severity === 'warning' && 'text-warning',
                    alert.severity === 'info' && 'text-primary'
                  )} />
                  <div className="flex-1">
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-sm text-muted-foreground">{formatDateTime(alert.createdAt)}</p>
                  </div>
                  <button className="p-2 rounded-lg hover:bg-secondary">
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* === SECCIÓN 4: Revisión === */}
          <section className="card-pos">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Search className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-semibold">Revisión</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card-pos-interactive p-4 text-center">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-success" />
                  <p className="font-medium">Movimientos Anormales</p>
                  <p className="text-2xl font-bold mt-2">0</p>
                </div>
                <div className="card-pos-interactive p-4 text-center">
                  <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <p className="font-medium">Acumulados por Producto</p>
                  <p className="text-sm text-muted-foreground mt-2">Ver detalle →</p>
                </div>
                <div className="card-pos-interactive p-4 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-accent" />
                  <p className="font-medium">Reportes</p>
                  <p className="text-sm text-muted-foreground mt-2">Exportar Excel →</p>
                </div>
              </div>
            </div>
          </section>

          {/* === SECCIÓN 5: Gestión === */}
          <section className="card-pos">
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Settings className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Gestión</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {mockMachines.slice(0, 4).map((machine) => (
                  <div 
                    key={machine.id} 
                    className={cn(
                      'card-pos p-4',
                      machine.status === 'maintenance' && 'border-warning'
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Zap className={cn(
                        'h-6 w-6',
                        machine.status === 'active' && 'text-success',
                        machine.status === 'maintenance' && 'text-warning',
                        machine.status === 'inactive' && 'text-muted-foreground'
                      )} />
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        machine.status === 'active' && 'bg-success/20 text-success',
                        machine.status === 'maintenance' && 'bg-warning/20 text-warning',
                        machine.status === 'inactive' && 'bg-muted text-muted-foreground'
                      )}>
                        {machine.status === 'active' && 'Activa'}
                        {machine.status === 'maintenance' && 'Mantenimiento'}
                        {machine.status === 'inactive' && 'Inactiva'}
                      </span>
                    </div>
                    <p className="font-semibold">{machine.name}</p>
                    <p className="text-sm text-muted-foreground">{machine.code}</p>
                    <p className="text-sm mt-2">{formatCurrency(machine.pricePerUse)}/uso</p>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <POSButton variant="secondary" icon={Plus}>
                  Agregar Máquina
                </POSButton>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Modal de Autorización */}
      <POSModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        title={authAction?.label || 'Autorización'}
        type="warning"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">Motivo</label>
            <textarea
              value={authReason}
              onChange={(e) => setAuthReason(e.target.value)}
              className="input-pos min-h-[100px]"
              placeholder="Describa el motivo de esta acción..."
            />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-2 block">PIN de Supervisor</label>
            <input
              type="password"
              value={authPin}
              onChange={(e) => setAuthPin(e.target.value)}
              className="input-pos"
              placeholder="••••"
              maxLength={4}
            />
          </div>

          <div className="flex gap-3">
            <POSButton
              variant="secondary"
              fullWidth
              onClick={() => setShowAuthModal(false)}
            >
              Cancelar
            </POSButton>
            <POSButton
              variant={authAction?.type === 'cancel' ? 'danger' : 'primary'}
              fullWidth
              disabled={!authReason || authPin.length !== 4}
              onClick={handleConfirmAuth}
            >
              Autorizar
            </POSButton>
          </div>
        </div>
      </POSModal>
    </POSLayout>
  );
}
