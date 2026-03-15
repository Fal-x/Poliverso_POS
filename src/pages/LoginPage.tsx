import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PinPad } from '@/components/ui/NumPad';
import { POSButton } from '@/components/ui/POSButton';
import { getAccessToken, getAuthUser, isCashOpen, setAuthUser, setTokens, setSiteId, clearAuthUser, setCashOpen, clearCashState } from '@/lib/auth';
import { Clock, MapPin, User, ShieldCheck, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/api/client';
import type { User as PosUser } from '@/types/pos.types';

export default function LoginPage() {
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [users, setUsers] = useState<PosUser[]>([]);
  const [siteId, setSiteIdState] = useState('');
  const [loadError, setLoadError] = useState('');
  const maxLength = 6;

  // Actualizar reloj
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleUserSelect = (userId: string) => {
    setSelectedUser(userId);
    setPin('');
    setError('');
  };

  const handlePinSubmit = (value?: string) => {
    const code = value ?? pin;
    const user = users.find(u => u.id === selectedUser);
    if (!user || !siteId) return;

    api<{
      token: string;
      refresh_token: string;
      user: { id: string; name: string; role: 'cashier' | 'supervisor' | 'admin' };
      expires_at: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ user_id: user.id, code }),
    })
      .then((res) => {
        setTokens(res.token, res.refresh_token);
        setAuthUser({
          id: res.user.id,
          name: res.user.name,
          email: user.email,
          role: res.user.role,
          createdAt: new Date(),
        });
        setSiteId(siteId);
        if (res.user.role === 'admin') navigate('/admin');
        if (res.user.role === 'supervisor') navigate('/supervisor');
        if (res.user.role === 'cashier') navigate('/cashier');
      })
      .catch(() => {
        setError('Código incorrecto');
        setPin('');
      });
  };

  useEffect(() => {
    const existing = getAuthUser();
    if (existing && !getAccessToken()) {
      clearAuthUser();
      setCashOpen(false);
      clearCashState();
    } else if (existing) {
      if (existing.role === 'admin') navigate('/admin', { replace: true });
      if (existing.role === 'supervisor') navigate('/supervisor', { replace: true });
      if (existing.role === 'cashier') navigate('/cashier', { replace: true });
    }

    if (!siteId) {
      api<Array<{ id: string; name: string; code: string }>>('/sites')
        .then((sites) => {
          if (sites.length > 0) {
            setSiteIdState(sites[0].id);
            setSiteId(sites[0].id);
            return api<PosUser[]>(`/auth/users?site_id=${sites[0].id}`);
          }
          return [];
        })
        .then((list) => {
          setUsers(list || []);
          setLoadError('');
        })
        .catch(() => {
          setUsers([]);
          setLoadError('No se pudieron cargar los usuarios. Verifica el backend.');
        });
    }

    if (!selectedUser) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key >= '0' && event.key <= '9') {
        if (pin.length < maxLength) {
          const nextValue = pin + event.key;
          setPin(nextValue);
          setError('');
          if (nextValue.length === maxLength) {
            handlePinSubmit(nextValue);
          }
        }
        return;
      }

      if (event.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
        return;
      }

      if (event.key === 'Enter') {
        if (pin.length === maxLength) {
          handlePinSubmit(pin);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedUser, pin, maxLength, navigate, siteId]);

  const formattedTime = currentTime.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const formattedDate = currentTime.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const selected = useMemo(() => users.find(u => u.id === selectedUser) ?? null, [selectedUser, users]);
  const roleMeta =
    selected?.role === 'admin'
      ? { label: 'Admin', icon: Crown, badge: 'badge-accent' }
      : selected?.role === 'supervisor'
        ? { label: 'Supervisor', icon: ShieldCheck, badge: 'badge-warning' }
        : { label: 'Cajero', icon: User, badge: 'badge-info' };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed right-4 top-4 z-20">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface shadow-soft">
          <img
            src="/poliverso-logo.svg"
            alt="Poliverso"
            className="h-8 w-8 object-contain"
          />
        </div>
      </div>

      {/* Header operativo compacto */}
      <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold text-base shadow-glow">
            P
          </div>
          <div className="text-xs text-muted-foreground">POLIVERSO POS</div>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>MallBP - Montelíbano</span>
          <Clock className="h-3.5 w-3.5 ml-2" />
          <span className="tabular-nums">{formattedTime}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {!selectedUser ? (
            // Selección de usuario
            <div className="space-y-4 fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Inicio de turno</h2>
                  <p className="text-muted-foreground">Seleccione usuario</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div className="uppercase tracking-wide">Fecha</div>
                  <div className="font-semibold capitalize">{formattedDate}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className={cn('status-dot', isCashOpen() ? 'status-active' : 'status-inactive')} />
                <span>{isCashOpen() ? 'Caja abierta (sesión en curso)' : 'Caja cerrada'}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {loadError && (
                  <div className="col-span-full alert-danger">
                    {loadError}
                  </div>
                )}
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user.id)}
                    className="card-pos-interactive p-4 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className={user.role === 'admin'
                        ? 'h-12 w-12 rounded-full bg-accent/15 text-accent flex items-center justify-center text-lg font-bold'
                        : user.role === 'supervisor'
                          ? 'h-12 w-12 rounded-full bg-warning/15 text-warning flex items-center justify-center text-lg font-bold'
                          : 'h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-lg font-bold'}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <span className={cn(
                          'badge-pos mt-1',
                          user.role === 'admin' && 'badge-accent',
                          user.role === 'supervisor' && 'badge-warning',
                          user.role === 'cashier' && 'badge-info'
                        )}>
                          {user.role === 'cashier' && 'Cajero'}
                          {user.role === 'supervisor' && 'Supervisor'}
                          {user.role === 'admin' && 'Administrador'}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
                {!loadError && users.length === 0 && (
                  <div className="col-span-full alert-info">
                    No hay usuarios disponibles.
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Ingreso de PIN
            <div className="max-w-md mx-auto space-y-4 fade-in">
              <POSButton
                variant="ghost"
                size="sm"
                onClick={() => setSelectedUser(null)}
              >
                ← Cambiar usuario
              </POSButton>

              {selected && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={selected.role === 'admin'
                      ? 'h-12 w-12 rounded-full bg-accent/15 text-accent flex items-center justify-center text-lg font-bold'
                      : selected.role === 'supervisor'
                        ? 'h-12 w-12 rounded-full bg-warning/15 text-warning flex items-center justify-center text-lg font-bold'
                        : 'h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center text-lg font-bold'}
                    >
                      {selected.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold">{selected.name}</p>
                      <span className={cn('badge-pos', roleMeta.badge)}>
                        <roleMeta.icon className="h-3.5 w-3.5" />
                        {roleMeta.label}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>Ingrese PIN</div>
                    <div className="font-semibold">{formattedTime}</div>
                  </div>
                </div>
              )}

              <div className="card-pos p-6">
                <PinPad
                  value={pin}
                  onChange={setPin}
                  onSubmit={handlePinSubmit}
                  maxLength={maxLength}
                  error={error}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Código: 6 dígitos
                </div>
                <POSButton
                  variant="primary"
                  size="sm"
                  onClick={() => handlePinSubmit()}
                  disabled={pin.length !== maxLength}
                >
                  Ingresar
                </POSButton>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
