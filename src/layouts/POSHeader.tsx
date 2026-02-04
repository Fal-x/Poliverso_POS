import { Clock, MapPin, User, Monitor, LogOut, ShieldCheck, Crown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface POSHeaderProps {
  location?: string;
  cashRegister?: string;
  userName?: string;
  userRole?: string;
  showClock?: boolean;
  onLogout?: () => void;
  logoutDisabled?: boolean;
}

export function POSHeader({ 
  location = "MallBP - Montelíbano", 
  cashRegister = "Caja 1",
  userName = "Usuario",
  userRole = "Cajero",
  showClock = true,
  onLogout,
  logoutDisabled = false
}: POSHeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!showClock) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [showClock]);

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
    <header className="pos-header">
      {/* Logo y Marca */}
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-xl shadow-glow">
          P
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">POLIVERSO</h1>
          <p className="text-xs text-muted-foreground">POS Terminal</p>
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
