import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PinPad } from '@/components/ui/NumPad';
import { mockUsers } from '@/lib/mock-data';
import { Clock, MapPin, Shield } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Actualizar reloj
  useState(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  });

  const handleUserSelect = (userId: string) => {
    setSelectedUser(userId);
    setPin('');
    setError('');
  };

  const handlePinSubmit = () => {
    // En producción, validar contra backend
    if (pin === '1234') {
      const user = mockUsers.find(u => u.id === selectedUser);
      if (user) {
        // Redirigir según rol
        switch (user.role) {
          case 'cashier':
            navigate('/cashier');
            break;
          case 'supervisor':
            navigate('/supervisor');
            break;
          case 'admin':
            navigate('/admin');
            break;
        }
      }
    } else {
      setError('PIN incorrecto');
      setPin('');
    }
  };

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="pos-header">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-xl shadow-glow">
            P
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">POLIVERSO</h1>
            <p className="text-xs text-muted-foreground">POS Terminal</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span className="text-sm">MallBP - Montelíbano</span>
        </div>

        <div className="flex items-center gap-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{formattedTime}</p>
            <p className="text-xs text-muted-foreground capitalize">{formattedDate}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          {!selectedUser ? (
            // Selección de usuario
            <div className="space-y-8 fade-in">
              <div className="text-center">
                <Shield className="h-16 w-16 mx-auto mb-4 text-primary" />
                <h2 className="text-3xl font-bold mb-2">Iniciar Sesión</h2>
                <p className="text-muted-foreground text-lg">Selecciona tu usuario para continuar</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mockUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user.id)}
                    className="card-pos-interactive p-6 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{user.name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {user.role === 'cashier' && 'Cajero'}
                          {user.role === 'supervisor' && 'Supervisor'}
                          {user.role === 'admin' && 'Administrador'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            // Ingreso de PIN
            <div className="max-w-md mx-auto space-y-8 fade-in">
              <button
                onClick={() => setSelectedUser(null)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Cambiar usuario
              </button>

              <div className="text-center">
                <div className="h-20 w-20 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold">
                  {mockUsers.find(u => u.id === selectedUser)?.name.charAt(0)}
                </div>
                <h2 className="text-2xl font-bold mb-1">
                  {mockUsers.find(u => u.id === selectedUser)?.name}
                </h2>
                <p className="text-muted-foreground">Ingresa tu PIN de 4 dígitos</p>
              </div>

              <div className="card-pos p-6">
                <PinPad
                  value={pin}
                  onChange={setPin}
                  onSubmit={handlePinSubmit}
                  error={error}
                />
              </div>

              <p className="text-center text-sm text-muted-foreground">
                PIN de prueba: <span className="font-mono font-bold">1234</span>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
