import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarDays, CreditCard, FileSpreadsheet, GraduationCap, Search, Settings2, UserRound, Wallet } from 'lucide-react';
import { POSLayout } from '@/layouts/POSLayout';
import { POSButton } from '@/components/ui/POSButton';
import { ConfirmModal } from '@/components/ui/POSModal';
import { clearAuthUser, getAuthUser, isCashOpen } from '@/lib/auth';
import { buildViewOptions } from '@/lib/view-options';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

type ProgramsSection = 'inscribir' | 'cartera' | 'estudiantes' | 'configuracion';

const mockPrograms = [
  { name: 'Robótica Kids', mode: 'Grupo', groups: ['G1', 'G2'], price: 280000, guide: 'Laura Pineda', schedule: 'Mar y Jue · 4:00 PM' },
  { name: 'Arte Sensorial', mode: 'Clase', groups: ['Clase abierta'], price: 55000, guide: 'Camilo Rojas', schedule: 'Sábados · 10:00 AM' },
  { name: 'Mini Chefs', mode: 'Grupo', groups: ['G1', 'G3'], price: 240000, guide: 'Valentina Hoyos', schedule: 'Mié y Vie · 3:30 PM' },
];

const mockPortfolio = [
  { name: 'Sofía Mejía', document: 'TI 103244', program: 'Robótica Kids', group: 'G1', total: 280000, paid: 180000, guardian: 'Ana Mejía', phone: '300 123 9087', status: 'Activa' },
  { name: 'Samuel Ortiz', document: 'RC 99812', program: 'Mini Chefs', group: 'G3', total: 240000, paid: 240000, guardian: 'Lina Ortiz', phone: '301 333 4412', status: 'Activa' },
  { name: 'Valeria Torres', document: 'TI 884211', program: 'Arte Sensorial', group: 'Clase abierta', total: 55000, paid: 20000, guardian: 'Carlos Torres', phone: '315 800 1140', status: 'Stand By' },
];

const mockStudents = [
  { name: 'Sofía Mejía', age: 8, status: 'Activa', programs: 2, balance: 100000, lastPayment: '2026-03-10 4:12 PM' },
  { name: 'Samuel Ortiz', age: 6, status: 'Activa', programs: 1, balance: 0, lastPayment: '2026-03-09 5:40 PM' },
  { name: 'Valeria Torres', age: 9, status: 'Stand By', programs: 1, balance: 35000, lastPayment: '2026-03-04 2:18 PM' },
];

const mockConfig = [
  { program: 'Robótica Kids', group: 'G1', capacity: '14 / 18', schedule: 'Mar y Jue · 4:00 PM', value: 280000, guide: 'Laura Pineda', status: 'Activo' },
  { program: 'Robótica Kids', group: 'G2', capacity: '9 / 18', schedule: 'Sábados · 9:00 AM', value: 280000, guide: 'Laura Pineda', status: 'Activo' },
  { program: 'Mini Chefs', group: 'G3', capacity: '18 / 18', schedule: 'Mié y Vie · 3:30 PM', value: 240000, guide: 'Valentina Hoyos', status: 'Lleno' },
];

export default function ProgramsDashboard() {
  const navigate = useNavigate();
  const authUser = getAuthUser();
  const [activeSection, setActiveSection] = useState<ProgramsSection>('inscribir');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const isCashierWithOpenCash = authUser?.role === 'cashier' && isCashOpen();
  const totalPortfolioBalance = mockPortfolio.reduce((acc, item) => acc + Math.max(item.total - item.paid, 0), 0);
  const activeEnrollments = mockPortfolio.filter((item) => item.status === 'Activa').length;

  const viewOptions = useMemo(() => buildViewOptions(authUser?.role, navigate), [authUser?.role, navigate]);

  return (
    <POSLayout
      userName={authUser?.name ?? 'Usuario'}
      userRole={authUser?.role === 'admin' ? 'Administrador' : authUser?.role === 'supervisor' ? 'Supervisor' : 'Cajero'}
      currentViewLabel="Programas"
      onLogout={() => setShowExitConfirm(true)}
      logoutDisabled={isCashierWithOpenCash}
      viewOptions={viewOptions}
    >
      <div className="flex w-full pos-full-height">
        <aside className="pos-sidebar w-72">
          <div className="border-b border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Programas</p>
            <h1 className="mt-2 text-xl font-bold">Gestión POLIKids</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Vista conceptual para inscripciones, cartera, estudiantes y configuración académica.
            </p>
          </div>

          <div className="space-y-2 p-4">
            {[
              { key: 'inscribir', label: 'Inscribir', icon: GraduationCap },
              { key: 'cartera', label: 'Cartera', icon: Wallet },
              { key: 'estudiantes', label: 'Estudiantes', icon: UserRound },
              { key: 'configuracion', label: 'Configuración', icon: Settings2 },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveSection(item.key as ProgramsSection)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors',
                    activeSection === item.key
                      ? 'border-sky-300 bg-sky-50 text-sky-800'
                      : 'border-border bg-background hover:bg-secondary/40'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-border p-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Resumen</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span>Inscripciones activas</span>
                  <span className="font-semibold">{activeEnrollments}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Saldo pendiente</span>
                  <span className="font-semibold">{formatCurrency(totalPortfolioBalance)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Programas activos</span>
                  <span className="font-semibold">{mockPrograms.length}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            <section className="card-pos overflow-hidden border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#eef7ff_55%,#ffffff_100%)] p-6">
              <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">Arquitectura del módulo</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">Programas no se trata como snacks ni máquinas</h2>
                  <p className="mt-3 max-w-3xl text-sm text-slate-600">
                    Cada inscripción maneja valor total, descuento, valor final, pagos acumulados y saldo pendiente calculado.
                    La idea es visualizar el flujo real de matrícula, cartera, abonos y configuración de grupos.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <p className="text-xs text-muted-foreground">Inscripción</p>
                    <p className="mt-1 text-lg font-semibold">Programa + Grupo + Horario</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <p className="text-xs text-muted-foreground">Cobro</p>
                    <p className="mt-1 text-lg font-semibold">Mensual o por clase</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className="mt-1 text-lg font-semibold">Calculado automáticamente</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <p className="mt-1 text-lg font-semibold">Activa / Stand By / Cancelada</p>
                  </div>
                </div>
              </div>
            </section>

            {activeSection === 'inscribir' && (
              <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <div className="card-pos border border-slate-200 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Programas &gt; Inscribir</h3>
                      <p className="text-sm text-muted-foreground">Búsqueda, ficha mínima, inscripción y pago inicial.</p>
                    </div>
                    <POSButton size="sm" variant="secondary" icon={Search}>
                      Buscar estudiante
                    </POSButton>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Documento</label>
                      <input className="input-pos input-pos-compact" placeholder="TI / RC / Otro" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Nombre completo POLIKid</label>
                      <input className="input-pos input-pos-compact" placeholder="Nombre del estudiante" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Fecha de nacimiento</label>
                      <input type="date" className="input-pos input-pos-compact" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Edad calculada</label>
                      <input className="input-pos input-pos-compact bg-muted/40" value="8 años" readOnly />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Programa</label>
                      <select className="input-pos input-pos-compact">
                        {mockPrograms.map((program) => <option key={program.name}>{program.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Modalidad</label>
                      <select className="input-pos input-pos-compact">
                        <option>Grupo</option>
                        <option>Clase</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Grupo</label>
                      <select className="input-pos input-pos-compact">
                        <option>G1</option>
                        <option>G2</option>
                        <option>G3</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Horario</label>
                      <input className="input-pos input-pos-compact" value="Mar y Jue · 4:00 PM" readOnly />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Fecha inicio programa</label>
                      <input type="date" className="input-pos input-pos-compact" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Estado POLIKid</label>
                      <select className="input-pos input-pos-compact">
                        <option>Activo</option>
                        <option>Inactivo</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Valor</label>
                      <input className="input-pos input-pos-compact" value={formatCurrency(280000)} readOnly />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Descuento</label>
                      <input className="input-pos input-pos-compact" placeholder="$0" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Valor programa</label>
                      <input className="input-pos input-pos-compact bg-muted/40" value={formatCurrency(260000)} readOnly />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Plan de cobro</label>
                      <select className="input-pos input-pos-compact">
                        <option>Mensual</option>
                        <option>Por clase</option>
                      </select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-medium text-muted-foreground">Estado inscripción</label>
                      <div className="grid gap-3 md:grid-cols-4">
                        <select className="input-pos input-pos-compact">
                          <option>Activa</option>
                          <option>Inactiva</option>
                          <option>Stand By</option>
                          <option>Cancelada</option>
                        </select>
                        <input className="input-pos input-pos-compact md:col-span-3" placeholder="Observación obligatoria para Stand By o Cancelada" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="card-pos border border-slate-200 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-sky-700" />
                      <h3 className="text-lg font-semibold">Pago inicial</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                          <p className="text-xs text-muted-foreground">Valor final</p>
                          <p className="mt-1 text-xl font-semibold">{formatCurrency(260000)}</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                          <p className="text-xs text-muted-foreground">Saldo resultante</p>
                          <p className="mt-1 text-xl font-semibold">{formatCurrency(60000)}</p>
                        </div>
                      </div>
                      <input className="input-pos input-pos-compact" placeholder="Valor pagado" />
                      <select className="input-pos input-pos-compact">
                        <option>Efectivo</option>
                        <option>Transferencia</option>
                        <option>Tarjeta</option>
                      </select>
                      <input className="input-pos input-pos-compact bg-muted/40" value="Cajero: María Pérez" readOnly />
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        El saldo pendiente nunca se digita manualmente. El sistema lo recalcula con cada abono.
                      </div>
                      <div className="flex gap-3">
                        <POSButton variant="success" fullWidth>
                          Guardar inscripción
                        </POSButton>
                        <POSButton variant="secondary" fullWidth>
                          Emitir comprobante
                        </POSButton>
                      </div>
                    </div>
                  </div>

                  <div className="card-pos border border-slate-200 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-700" />
                      <h3 className="text-lg font-semibold">Campos opcionales</h3>
                    </div>
                    <div className="space-y-3">
                      <input className="input-pos input-pos-compact" placeholder="Nombre del acudiente" />
                      <input className="input-pos input-pos-compact" placeholder="Celular del acudiente" />
                      <input className="input-pos input-pos-compact" placeholder="Correo acudiente" />
                      <input className="input-pos input-pos-compact" placeholder="Contacto de emergencia" />
                      <button className="text-sm font-medium text-sky-700">Completar después</button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'cartera' && (
              <section className="space-y-5">
                <div className="card-pos border border-slate-200 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Programas &gt; Cartera</h3>
                      <p className="text-sm text-muted-foreground">Filtros de cartera, saldo pendiente y acciones de exportación.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-5 xl:w-[920px]">
                      <select className="input-pos input-pos-compact"><option>Programa</option></select>
                      <select className="input-pos input-pos-compact"><option>Grupo</option></select>
                      <select className="input-pos input-pos-compact"><option>Estado inscripción</option></select>
                      <select className="input-pos input-pos-compact"><option>Con saldo pendiente</option></select>
                      <div className="flex gap-3">
                        <input type="date" className="input-pos input-pos-compact" />
                        <input type="date" className="input-pos input-pos-compact" />
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Saldo total de cartera</p>
                      <p className="mt-1 text-2xl font-bold">{formatCurrency(totalPortfolioBalance)}</p>
                    </div>
                    <POSButton variant="secondary" size="sm" icon={FileSpreadsheet}>
                      Exportar Excel
                    </POSButton>
                  </div>
                </div>

                <div className="card-pos overflow-hidden border border-slate-200">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Polikid</th>
                          <th className="px-4 py-3">Programa</th>
                          <th className="px-4 py-3">Grupo</th>
                          <th className="px-4 py-3">Valor total</th>
                          <th className="px-4 py-3">Abonos</th>
                          <th className="px-4 py-3">Saldo</th>
                          <th className="px-4 py-3">Acudiente</th>
                          <th className="px-4 py-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mockPortfolio.map((row) => {
                          const balance = Math.max(row.total - row.paid, 0);
                          return (
                            <tr key={row.document} className="border-t border-border/70">
                              <td className="px-4 py-3">
                                <p className="font-medium">{row.name}</p>
                                <p className="text-xs text-muted-foreground">{row.document}</p>
                              </td>
                              <td className="px-4 py-3">{row.program}</td>
                              <td className="px-4 py-3">{row.group}</td>
                              <td className="px-4 py-3">{formatCurrency(row.total)}</td>
                              <td className="px-4 py-3">{formatCurrency(row.paid)}</td>
                              <td className="px-4 py-3 font-semibold">{formatCurrency(balance)}</td>
                              <td className="px-4 py-3">
                                <p>{row.guardian}</p>
                                <p className="text-xs text-muted-foreground">{row.phone}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cn(
                                  'badge-pos',
                                  row.status === 'Activa' && 'badge-success',
                                  row.status === 'Stand By' && 'badge-warning'
                                )}>
                                  {row.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'estudiantes' && (
              <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                  <div className="card-pos border border-slate-200 p-5">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Programas &gt; Estudiantes</h3>
                        <p className="text-sm text-muted-foreground">Buscador rápido y acceso al historial por documento o nombre.</p>
                      </div>
                      <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input className="input-pos input-pos-compact pl-9" placeholder="Buscar por documento o nombre" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      {mockStudents.map((student) => (
                        <div key={student.name} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold">{student.name}</p>
                              <p className="text-sm text-muted-foreground">{student.age} años · {student.programs} programa(s)</p>
                            </div>
                            <span className={cn('badge-pos', student.status === 'Activa' ? 'badge-success' : 'badge-warning')}>
                              {student.status}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                              <p className="font-semibold">{formatCurrency(student.balance)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Último pago</p>
                              <p className="font-semibold">{student.lastPayment}</p>
                            </div>
                            <div className="flex items-end">
                              <button className="text-sm font-medium text-sky-700">Ver detalle estudiante</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="card-pos border border-slate-200 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-sky-700" />
                      <h3 className="text-lg font-semibold">Historial de inscripciones</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <p className="font-medium">Robótica Kids · G1</p>
                        <p className="text-muted-foreground">Inicio 2026-03-01 · Mensual · Estado Activa</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <p className="font-medium">Arte Sensorial · Clase abierta</p>
                        <p className="text-muted-foreground">Inicio 2026-02-12 · Por clase · Estado Stand By</p>
                      </div>
                    </div>
                  </div>

                  <div className="card-pos border border-slate-200 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-sky-700" />
                      <h3 className="text-lg font-semibold">Historial de pagos</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <p className="font-medium">Pago inicial {formatCurrency(180000)}</p>
                        <p className="text-muted-foreground">Transferencia · 2026-03-10 4:12 PM · Cajero Lina</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <p className="font-medium">Registrar abono</p>
                        <p className="text-muted-foreground">Flujo: buscar estudiante → abrir inscripción activa → registrar abono → recalcular saldo</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeSection === 'configuracion' && (
              <section className="space-y-6">
                <div className="card-pos border border-slate-200 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Programas &gt; Configuración</h3>
                      <p className="text-sm text-muted-foreground">Programas, grupos, cupos, horarios, valor, duración y guía de aprendizaje.</p>
                    </div>
                    <POSButton variant="success" size="sm">
                      Nuevo programa
                    </POSButton>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-3">
                    {mockConfig.map((row) => (
                      <div key={`${row.program}-${row.group}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-semibold text-slate-900">{row.program}</p>
                            <p className="text-sm text-muted-foreground">{row.group}</p>
                          </div>
                          <span className={cn('badge-pos', row.status === 'Activo' ? 'badge-success' : 'badge-warning')}>
                            {row.status}
                          </span>
                        </div>
                        <div className="mt-4 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Cupo</span>
                            <span className="font-medium">{row.capacity}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Horario</span>
                            <span className="font-medium">{row.schedule}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Valor</span>
                            <span className="font-medium">{formatCurrency(row.value)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Guía</span>
                            <span className="font-medium">{row.guide}</span>
                          </div>
                        </div>
                        <div className="mt-5 flex gap-3">
                          <POSButton variant="secondary" size="sm" fullWidth>
                            Editar
                          </POSButton>
                          <POSButton variant="secondary" size="sm" fullWidth>
                            Activar / Desactivar
                          </POSButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

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
