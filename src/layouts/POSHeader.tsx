import { Clock, MapPin, User, Monitor, LogOut, ShieldCheck, Crown, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type HeaderViewOption = {
  key: string;
  label: string;
  onClick: () => void;
};

interface POSHeaderProps {
  location?: string;
  cashRegister?: string;
  userName?: string;
  userRole?: string;
  showClock?: boolean;
  onLogout?: () => void;
  logoutDisabled?: boolean;
  viewOptions?: HeaderViewOption[];
  currentViewLabel?: string;
}

export function POSHeader({ 
  location = "MallBP - Montelíbano", 
  cashRegister = "Caja 1",
  userName = "Usuario",
  userRole = "Cajero",
  showClock = true,
  onLogout,
  logoutDisabled = false,
  viewOptions = [],
  currentViewLabel
}: POSHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showClock) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [showClock]);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !viewMenuRef.current?.contains(target)) {
        setViewMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => window.removeEventListener('mousedown', onPointerDown);
  }, [viewMenuOpen]);

  const formattedTime = currentTime.toLocaleTimeString('es-CO', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });

  const formattedDate = currentTime.toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  return (
    <header className="pos-header px-6">
      {/* Logo y Marca */}
      <div className="flex shrink-0 items-center w-[130px] sm:w-[170px] md:w-[210px] lg:w-[250px]">
        <div className="relative h-10 sm:h-11 md:h-12 w-full overflow-visible">
          <img
            src="/poliverso-logo.svg"
            alt="Poliverso"
            className="absolute left-1/2 top-1/2 h-10 sm:h-12 md:h-14 lg:h-16 w-auto -translate-x-1/2 -translate-y-1/2 object-contain"
            loading="eager"
            decoding="async"
          />
        </div>
      </div>

      {/* Info Central */}
      <div className="hidden md:flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{location}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Monitor className="h-4 w-4" />
          <span>{cashRegister}</span>
        </div>
      </div>

      {/* Usuario y Reloj */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-secondary rounded-full flex items-center justify-center">
            <User className="h-5 w-5 text-secondary-foreground" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium">{userName}</p>
            <div className={cn(
              'badge-pos mt-1 w-fit',
              userRole === 'Administrador' && 'badge-accent',
              userRole === 'Supervisor' && 'badge-warning',
              userRole === 'Cajero' && 'badge-info'
            )}>
              {userRole === 'Administrador' && <Crown className="h-3.5 w-3.5" />}
              {userRole === 'Supervisor' && <ShieldCheck className="h-3.5 w-3.5" />}
              {userRole === 'Cajero' && <User className="h-3.5 w-3.5" />}
              {userRole}
            </div>
          </div>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            disabled={logoutDisabled}
            className="h-9 px-3 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 text-sm font-semibold disabled:opacity-50"
            title={logoutDisabled ? "Cierra caja antes de salir" : "Salir"}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Salir</span>
          </button>
        )}

        {viewOptions.length > 0 && (
          <div ref={viewMenuRef} className="relative flex items-center gap-2">
            <button
              onClick={() => setViewMenuOpen((prev) => !prev)}
              className="h-9 px-3 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 text-sm font-semibold"
              title="Cambiar de vista"
              aria-haspopup="menu"
              aria-expanded={viewMenuOpen}
            >
              <span className="hidden md:inline">Vistas</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', viewMenuOpen && 'rotate-180')} />
            </button>
            {viewMenuOpen && (
              <div className="absolute right-0 top-11 z-50 min-w-[190px] overflow-hidden rounded-lg border border-border bg-white shadow-xl">
                {viewOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => {
                      setViewMenuOpen(false);
                      option.onClick();
                    }}
                    className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {showClock && (
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{formattedTime}</p>
            <p className="text-xs text-muted-foreground">{formattedDate}</p>
          </div>
        )}
      </div>
    </header>
  );
}
