import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DateRange } from 'react-day-picker';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  AlertTriangle,
  CalendarDays,
  Download,
  RefreshCw,
  ShieldAlert,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { api, apiFile } from '@/api/client';
import MagicBento from '@/components/application/dashboard/MagicBento';
import { ConfirmModal, POSModal } from '@/components/ui/POSModal';
import { POSButton } from '@/components/ui/POSButton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { POSLayout } from '@/layouts/POSLayout';
import { clearAuthUser, getAuthUser, getSiteIdStored } from '@/lib/auth';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { buildViewOptions } from '@/lib/view-options';
import { toast } from '@/components/ui/sonner';

type TabKey = 'indicators' | 'movements' | 'inventory' | 'machines';
type FilterMode = 'date' | 'range';

type SummaryResponse = {
  group_by: 'day' | 'month';
  summary: {
    total_sales: number;
    transactions: number;
    average_ticket: number;
    goal_amount: number;
    goal_pct: number;
    daily_goal: number;
  };
  trend: Array<{
    key: string;
    label: string;
    sales: number;
    transactions: number;
    goal: number;
    goal_pct: number;
  }>;
};

type PeriodKpis = {
  today: number;
  week: number;
  month: number;
};

type MovementRow = {
  id: string;
  occurred_at: string;
  kind: string;
  flow: 'income' | 'expense' | 'adjustment';
  category: string;
  label: string;
  amount: string;
  detail: string;
  description: string;
  authorized_by: string;
  receipt_number?: string | null;
  receipt_text?: string | null;
};

type PendingResponse = {
  approvals_required_count: number;
  approvals_required: Array<{
    id: string;
    created_at: string;
    label: string;
    customer_name: string;
    total: string;
    balance_due: string;
    created_by: string;
  }>;
  electronic_invoice_count: number;
  electronic_invoices: Array<{
    id: string;
    created_at: string;
    customer_name: string;
    total: string;
    created_by: string;
    electronic_invoice_code: string;
  }>;
};

type InventoryResponse = {
  summary: Array<{
    category: string;
    total_current: number;
    total_sold_or_redeemed: number;
    items: Array<{
      id: string;
      name: string;
      sku: string | null;
      stock_current: number;
      sold_or_redeemed: number;
      entries: number;
      last_movement_at: string | null;
      last_notes: string;
    }>;
  }>;
};

type TypeBreakdownResponse = {
  metric: 'value' | 'count';
  view: 'category' | 'subcategory';
  selected_type: string | null;
  total: number;
  data: Array<{
    name: string;
    value: number;
    count: number;
    metric_value: number;
    pct: number;
  }>;
};

type StationRow = {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  maintenance_mode: boolean;
  maintenance_message: string | null;
  type: 'TIME' | 'SKILL';
  location: string | null;
  price: string;
  duration: number;
  points_reward: number;
  last_use_at: string | null;
  total_uses_today: number;
  total_revenue_today: number;
  assigned_readers: Array<{ id: string; code: string; position: number }>;
};

type ExecutiveResponse = {
  generated_at: string;
  executive: {
    today_revenue: number;
    average_ticket: number;
    hourly_revenue: Array<{ hour: number; revenue: number; transactions: number }>;
    comparison_vs_yesterday_pct: number;
  };
  machine_efficiency: {
    occupancy_by_machine: Array<{ machine_name: string; machine_code: string; uses: number; occupancy_pct: number }>;
    top5_profitable: Array<{ machine_name: string; machine_code: string; machine_type: string; uses: number; revenue: number; avg_session_minutes: number }>;
    low_rotation: Array<{ machine_name: string; machine_code: string; machine_type: string; uses: number; revenue: number; avg_session_minutes: number }>;
    average_session_minutes: number;
  };
  customer_flow: {
    unique_customers_today: number;
    recurrent_customers_today: number;
    new_cards_activated_today: number;
    retention_rate_pct: number;
  };
  card_float: {
    pending_loaded_money: number;
    estimated_breakage: number;
  };
  operational_alerts: {
    offline_machines: number;
    network_failures: number;
    cash_imbalance_total: number;
    suspicious_transactions: number;
  };
  deep_finance: {
    profitability_by_machine: Array<{
      machine_name: string;
      machine_type: string;
      revenue: number;
      energy_cost: number;
      maintenance_cost: number;
      depreciation_cost: number;
      profit: number;
    }>;
    roi_by_game_type: Array<{
      game_type: string;
      revenue: number;
      cost: number;
      profit: number;
      roi_pct: number;
      uses: number;
    }>;
    customer_acquisition_cost: {
      promo_uses: number;
      estimated_promo_cost: number;
      attributed_new_customers: number;
      cac: number;
    };
  };
  behavioral: {
    peak_hours: Array<{ hour: number; revenue: number; transactions: number }>;
    weekly_heatmap: Array<{ day_key: string; hourly: Array<{ hour: number; transactions: number; revenue: number }> }>;
    customer_profile: Array<{ city: string; sales: number }>;
    preferred_game_by_segment: Array<{ segment: string; game: string; uses: number }>;
  };
  risk_control: {
    anomalous_repeat_cards: number;
    cloned_card_signals: number;
    out_of_pattern_operations: number;
  };
  projection: {
    monthly_revenue_forecast: number;
    cash_flow_forecast: number;
    dynamic_break_even: number;
    scenario_plus_500_revenue: number;
    scenario_plus_500_cash_flow: number;
  };
  strategic_metric: {
    area_m2: number;
    operation_hours: number;
    revenue_per_m2_per_hour: number;
  };
};

const formatLocalDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseLocalDateInput = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const todayInput = () => formatLocalDateInput(new Date());

const dateShift = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatLocalDateInput(date);
};

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

const formatDayKey = (dayKey: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
    return new Date(`${dayKey}T00:00:00`).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
  }
  return dayKey;
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Sin uso reciente';
  return new Date(value).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
};

export default function SupervisorDashboard() {
  const navigate = useNavigate();
  const authUser = getAuthUser();
  const [activeTab, setActiveTab] = useState<TabKey>('indicators');
  const [filterMode, setFilterMode] = useState<FilterMode>('date');
  const [singleDate, setSingleDate] = useState(todayInput());
  const [range, setRange] = useState<DateRange | undefined>({
    from: parseLocalDateInput(todayInput()),
    to: parseLocalDateInput(todayInput()),
  });
  const [movementQuery, setMovementQuery] = useState('');
  const [movementFlow, setMovementFlow] = useState<'all' | 'income' | 'expense' | 'adjustment'>('all');
  const [movementCategory, setMovementCategory] = useState('');
  const [areaM2Input, setAreaM2Input] = useState('120');
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [periodKpis, setPeriodKpis] = useState<PeriodKpis>({ today: 0, week: 0, month: 0 });
  const [executive, setExecutive] = useState<ExecutiveResponse | null>(null);
  const [movements, setMovements] = useState<MovementRow[]>([]);
  const [pending, setPending] = useState<PendingResponse | null>(null);
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [typeBreakdown, setTypeBreakdown] = useState<TypeBreakdownResponse | null>(null);
  const [stationsLoading, setStationsLoading] = useState(false);
  const [maintenanceModalStation, setMaintenanceModalStation] = useState<StationRow | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<{ number: string; text: string } | null>(null);
  const [invoiceModalSaleId, setInvoiceModalSaleId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceCode, setInvoiceCode] = useState('');
  const [invoiceError, setInvoiceError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);

  const dateParams = useMemo(() => {
    if (filterMode === 'date') {
      return { from: singleDate, to: singleDate, groupBy: 'day' as const };
    }
    const from = range?.from ? formatLocalDateInput(range.from) : singleDate;
    const to = range?.to ? formatLocalDateInput(range.to) : from;
    const days = Math.max(1, Math.ceil((parseLocalDateInput(to).getTime() - parseLocalDateInput(from).getTime()) / 86400000) + 1);
    return { from, to, groupBy: days > 31 ? 'month' as const : 'day' as const };
  }, [filterMode, range, singleDate]);

  const periodLabel = useMemo(() => {
    if (filterMode === 'date') {
      return parseLocalDateInput(singleDate).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    if (range?.from && range?.to) {
      return `${formatLocalDateInput(range.from)} a ${formatLocalDateInput(range.to)}`;
    }
    if (range?.from) {
      return formatLocalDateInput(range.from);
    }
    return 'Seleccionar fechas';
  }, [filterMode, range, singleDate]);

  const loadDashboard = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    setLoading(true);
    setError('');
    try {
      const areaValue = Number(areaM2Input);
      const areaM2 = Number.isFinite(areaValue) && areaValue > 0 ? areaValue : 120;
      const baseParams = new URLSearchParams({
        site_id: siteId,
        from: dateParams.from,
        to: dateParams.to,
      });
      const movementParams = new URLSearchParams(baseParams);
      movementParams.set('q', movementQuery);
      movementParams.set('flow', movementFlow);
      if (movementCategory.trim()) movementParams.set('category', movementCategory.trim());

      const [summaryResp, executiveResp, movementResp, pendingResp, inventoryResp, typeBreakdownResp, todayResp, weekResp, monthResp] = await Promise.all([
        api<SummaryResponse>(`/reports/dashboard/summary?${baseParams.toString()}&group_by=${dateParams.groupBy}`),
        api<ExecutiveResponse>(`/reports/admin/executive?site_id=${siteId}&area_m2=${areaM2}`),
        api<{ data: MovementRow[] }>(`/reports/dashboard/movements?${movementParams.toString()}`),
        api<PendingResponse>(`/reports/dashboard/pending?site_id=${siteId}`),
        api<InventoryResponse>(`/reports/dashboard/inventory?${baseParams.toString()}`),
        api<TypeBreakdownResponse>(`/reports/day/type-breakdown?${baseParams.toString()}&metric=value`),
        api<SummaryResponse>(`/reports/dashboard/summary?site_id=${siteId}&from=${todayInput()}&to=${todayInput()}&group_by=day`),
        api<SummaryResponse>(`/reports/dashboard/summary?site_id=${siteId}&from=${dateShift(-6)}&to=${todayInput()}&group_by=day`),
        api<SummaryResponse>(`/reports/dashboard/summary?site_id=${siteId}&from=${dateShift(-29)}&to=${todayInput()}&group_by=day`),
      ]);

      setSummary(summaryResp);
      setExecutive(executiveResp);
      setMovements(movementResp.data ?? []);
      setPending(pendingResp);
      setInventory(inventoryResp);
      setTypeBreakdown(typeBreakdownResp);
      setPeriodKpis({
        today: todayResp.summary.total_sales,
        week: weekResp.summary.total_sales,
        month: monthResp.summary.total_sales,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el panel');
    } finally {
      setLoading(false);
    }
  };

  const loadStations = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    setStationsLoading(true);
    try {
      const rows = await api<StationRow[]>(`/admin/stations?site_id=${siteId}`);
      setStations(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar las máquinas');
    } finally {
      setStationsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard().catch(() => null);
  }, [dateParams, movementQuery, movementFlow, movementCategory, areaM2Input]);

  useEffect(() => {
    if (activeTab !== 'machines') return;
    loadStations().catch(() => null);
    const interval = window.setInterval(() => {
      loadStations().catch(() => null);
    }, 10000);
    return () => window.clearInterval(interval);
  }, [activeTab]);

  const selectedInvoice = pending?.electronic_invoices.find((row) => row.id === invoiceModalSaleId) ?? null;

  const exportMovements = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    const params = new URLSearchParams({
      site_id: siteId,
      from: dateParams.from,
      to: dateParams.to,
      flow: movementFlow,
      q: movementQuery,
    });
    if (movementCategory.trim()) params.set('category', movementCategory.trim());
    const { blob, filename } = await apiFile(`/reports/dashboard/movements/export?${params.toString()}`);
    downloadBlob(blob, filename || `movimientos-${todayInput()}.csv`);
  };

  const exportDashboardPdf = async () => {
    const siteId = getSiteIdStored();
    if (!siteId || authUser?.role !== 'admin') return;
    setExportingPdf(true);
    try {
      const params = new URLSearchParams({
        site_id: siteId,
        from: dateParams.from,
        to: dateParams.to,
        group_by: dateParams.groupBy,
        area_m2: areaM2Input || '120',
        flow: movementFlow,
        q: movementQuery,
      });
      if (movementCategory.trim()) params.set('category', movementCategory.trim());
      const { blob, filename } = await apiFile(`/reports/dashboard/executive.pdf?${params.toString()}`);
      downloadBlob(blob, filename || `dashboard-arcade-${todayInput()}.pdf`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF del dashboard');
    } finally {
      setExportingPdf(false);
    }
  };

  const exportDailyXls = async () => {
    const siteId = getSiteIdStored();
    if (!siteId) return;
    try {
      const { blob, filename } = await apiFile(`/reports/daily?site_id=${siteId}&format=xls`);
      downloadBlob(blob, filename || `reporte-dia-${todayInput()}.xls`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el XLS diario');
    }
  };

  const saveInvoiceManagement = async () => {
    const siteId = getSiteIdStored();
    if (!siteId || !authUser?.id || !invoiceModalSaleId || !invoiceNumber.trim()) {
      setInvoiceError('El número de la factura emitida es obligatorio.');
      return;
    }
    try {
      await api(`/sales/${invoiceModalSaleId}/electronic-invoice`, {
        method: 'PATCH',
        body: JSON.stringify({
          site_id: siteId,
          managed_by_user_id: authUser.id,
          electronic_invoice_number: invoiceNumber.trim(),
          electronic_invoice_code: invoiceCode.trim() || undefined,
        }),
      });
      setInvoiceModalSaleId('');
      setInvoiceNumber('');
      setInvoiceCode('');
      setInvoiceError('');
      await loadDashboard();
    } catch (err: unknown) {
      setInvoiceError(err instanceof Error ? err.message : 'No se pudo guardar la factura.');
    }
  };

  const openMaintenanceModal = (station: StationRow) => {
    setMaintenanceModalStation(station);
    setMaintenanceMessage(station.maintenance_message ?? '');
  };

  const submitMaintenanceMode = async (enabled: boolean) => {
    const siteId = getSiteIdStored();
    if (!siteId || !maintenanceModalStation) return;
    setMaintenanceSubmitting(true);
    try {
      await api(`/admin/stations/${maintenanceModalStation.id}/maintenance`, {
        method: 'POST',
        body: JSON.stringify({
          site_id: siteId,
          enabled,
          message: enabled ? maintenanceMessage.trim() || undefined : undefined,
        }),
      });
      await loadStations();
      setMaintenanceModalStation(null);
      setMaintenanceMessage('');
      toast.success(enabled ? 'Máquina puesta en mantenimiento' : 'Máquina reactivada');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'No se pudo actualizar el mantenimiento');
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  const salesComplianceData = (summary?.trend ?? []).map((row, index) => ({
    label: row.label || (filterMode === 'date' ? 'Dia' : `P${index + 1}`),
    sales: row.sales,
    goalPct: row.goal_pct,
  }));
  const topMachineLabels = executive?.machine_efficiency.top5_profitable.map((row) => row.machine_name) ?? [];
  const topMachineRevenue = executive?.machine_efficiency.top5_profitable.map((row) => row.revenue) ?? [];
  const occupancyRows = executive?.machine_efficiency.occupancy_by_machine.slice(0, 12) ?? [];
  const weeklyFlowLabels = executive?.behavioral.weekly_heatmap.map((row) => formatDayKey(row.day_key)) ?? [];
  const weeklyCustomerFlow = executive?.behavioral.weekly_heatmap.map((row) => row.hourly.reduce((acc, cell) => acc + cell.transactions, 0)) ?? [];
  const customerProfileLabels = executive?.behavioral.customer_profile.slice(0, 6).map((row) => row.city || 'Sin ciudad') ?? [];
  const customerProfileValues = executive?.behavioral.customer_profile.slice(0, 6).map((row) => row.sales) ?? [];
  const totalMachines = executive?.machine_efficiency.occupancy_by_machine.length ?? 0;
  const activeMachines = executive ? Math.max(totalMachines - executive.operational_alerts.offline_machines, 0) : 0;
  const ingressPerMachine = totalMachines > 0 && executive ? executive.executive.today_revenue / totalMachines : 0;
  const clientsToday = executive?.customer_flow.unique_customers_today ?? 0;
  const ingresoPorCliente = clientsToday > 0 && executive ? executive.executive.today_revenue / clientsToday : 0;
  const alerts = executive ? [
    executive.operational_alerts.offline_machines > 0 ? `Maquinas offline: ${executive.operational_alerts.offline_machines}` : null,
    executive.operational_alerts.network_failures > 0 ? `Lectores NFC con error/red: ${executive.operational_alerts.network_failures}` : null,
    executive.operational_alerts.suspicious_transactions > 0 ? `Intentos de fraude o transacciones sospechosas: ${executive.operational_alerts.suspicious_transactions}` : null,
    executive.operational_alerts.cash_imbalance_total > 0 ? `Descuadre de caja: ${formatCurrency(executive.operational_alerts.cash_imbalance_total)}` : null,
    executive.machine_efficiency.low_rotation[0] ? `Baja rotacion detectada en ${executive.machine_efficiency.low_rotation[0].machine_name}` : null,
  ].filter(Boolean) as string[] : [];
  const systemHealthPct = totalMachines > 0 ? (activeMachines / totalMachines) * 100 : 0;
  const topProfitability = executive?.deep_finance.profitability_by_machine.slice(0, 5) ?? [];
  const preferredGames = executive?.behavioral.preferred_game_by_segment.slice(0, 4) ?? [];
  const movementTotals = movements.reduce((acc, row) => {
    const amount = Number(row.amount) || 0;
    if (row.flow === 'income') acc.income += amount;
    if (row.flow === 'expense') acc.expense += amount;
    if (row.flow === 'adjustment') acc.adjustment += amount;
    return acc;
  }, { income: 0, expense: 0, adjustment: 0 });
  const movementCategories = Array.from(new Set(movements.map((row) => row.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
  const salesTypeRows = typeBreakdown?.data.slice(0, 8) ?? [];
  const bentoItems = executive ? [
    {
      id: 'income-series',
      label: 'Ingresos',
      title: 'Ventas y % de cumplimiento',
      description: 'Muestra ventas en barras y el porcentaje de cumplimiento sobre la meta para el filtro activo.',
      className: 'magic-bento-card--wide',
      content: (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={salesComplianceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis yAxisId="sales" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => formatCurrency(Number(value))} />
              <YAxis yAxisId="pct" orientation="right" domain={[0, 'dataMax + 10']} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
              <Tooltip
                formatter={(value: number, name: string) => (
                  name === 'Cumplimiento'
                    ? [`${Number(value).toFixed(1)}%`, name]
                    : [formatCurrency(Number(value)), name]
                )}
                contentStyle={{ borderRadius: 12, borderColor: '#cbd5e1' }}
              />
              <Legend />
              <Bar yAxisId="sales" dataKey="sales" name="Ventas" fill="#0f766e" radius={[8, 8, 0, 0]} maxBarSize={48} />
              <Line yAxisId="pct" type="monotone" dataKey="goalPct" name="Cumplimiento" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ),
    },
    {
      id: 'top-attractions',
      label: 'Maquinas',
      title: 'Top atracciones por ingreso',
      description: 'Ranking de atracciones para decidir precio, reubicación o retiro.',
      className: 'magic-bento-card--wide',
      content: (
        <BarChart
          height={260}
          xAxis={[{ scaleType: 'band', data: topMachineLabels }]}
          series={[{ id: 'machine-revenue', label: 'Ingreso por atraccion', data: topMachineRevenue, color: '#14b8a6' }]}
        />
      ),
    },
    {
      id: 'client-flow',
      label: 'Clientes',
      title: 'Flujo de clientes por dia',
      description: 'Se usa para ajustar personal, promociones y ventanas de operación.',
      content: (
        <BarChart
          height={220}
          xAxis={[{ scaleType: 'band', data: weeklyFlowLabels }]}
          series={[{ id: 'customer-flow', label: 'Clientes por dia', data: weeklyCustomerFlow, color: '#2563eb' }]}
        />
      ),
    },
    {
      id: 'system-health',
      label: 'Salud',
      title: 'Salud del sistema',
      description: 'Resume operatividad de máquinas, NFC y riesgo operativo.',
      content: (
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span>Maquinas operativas</span>
              <span className="font-semibold">{systemHealthPct.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${systemHealthPct}%` }} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Offline</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{executive.operational_alerts.offline_machines}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Fallas NFC</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{executive.operational_alerts.network_failures}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Anomalias</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{executive.risk_control.anomalous_repeat_cards + executive.risk_control.cloned_card_signals}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Caja</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(executive.operational_alerts.cash_imbalance_total)}</p>
            </div>
          </div>
        </div>
      ),
    },
  ] : [];

  return (
    <POSLayout
      userName={authUser?.name ?? 'Supervisor'}
      userRole={authUser?.role === 'admin' ? 'Administrador' : 'Supervisor'}
      currentViewLabel="Supervisor"
      onLogout={() => setShowExitConfirm(true)}
      viewOptions={buildViewOptions(authUser?.role, navigate)}
    >
      <div className="flex w-full pos-full-height">
        <div className="pos-sidebar w-72">
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">Dashboard Arcade</h2>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Decision operacional</p>
              </div>
              <ShieldAlert className="h-5 w-5 text-warning" />
            </div>
            <POSButton variant={activeTab === 'indicators' ? 'primary' : 'secondary'} fullWidth size="sm" onClick={() => setActiveTab('indicators')}>Indicadores</POSButton>
            <POSButton variant={activeTab === 'movements' ? 'primary' : 'secondary'} fullWidth size="sm" onClick={() => setActiveTab('movements')}>Movimientos</POSButton>
            <POSButton variant={activeTab === 'inventory' ? 'primary' : 'secondary'} fullWidth size="sm" onClick={() => setActiveTab('inventory')}>Inventario</POSButton>
            <POSButton variant={activeTab === 'machines' ? 'primary' : 'secondary'} fullWidth size="sm" onClick={() => setActiveTab('machines')}>Máquinas</POSButton>
          </div>

          <div className="p-4 space-y-3">
            <div className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Periodo analizado</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="input-pos input-pos-compact flex w-full items-center justify-between gap-3 text-left">
                    <span className="truncate">{periodLabel}</span>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-3">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFilterMode('date')}
                        className={cn(
                          'rounded-lg px-3 py-2 text-sm font-medium',
                          filterMode === 'date' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                        )}
                      >
                        Un dia
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterMode('range')}
                        className={cn(
                          'rounded-lg px-3 py-2 text-sm font-medium',
                          filterMode === 'range' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                        )}
                      >
                        Rango
                      </button>
                    </div>

                    {filterMode === 'date' ? (
                      <Calendar
                        mode="single"
                        selected={parseLocalDateInput(singleDate)}
                        onSelect={(date) => {
                          if (!date) return;
                          setSingleDate(formatLocalDateInput(date));
                        }}
                        initialFocus
                      />
                    ) : (
                      <Calendar
                        mode="range"
                        selected={range}
                        onSelect={(nextRange) => {
                          if (!nextRange?.from) return;
                          setRange(nextRange);
                        }}
                        numberOfMonths={2}
                        initialFocus
                      />
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <input className="input-pos input-pos-compact" placeholder="Area m2" value={areaM2Input} onChange={(e) => setAreaM2Input(e.target.value.replace(/[^\d.]/g, '').slice(0, 8))} />
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="card-pos p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ingresos hoy</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(periodKpis.today)}</p>
              </div>
              <div className="card-pos p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ingresos semana</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(periodKpis.week)}</p>
              </div>
              <div className="card-pos p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ingresos mes</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(periodKpis.month)}</p>
              </div>
              <div className="card-pos p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ingreso por maquina</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(ingressPerMachine)}</p>
              </div>
              <div className="card-pos p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ticket promedio</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(executive?.executive.average_ticket ?? 0)}</p>
              </div>
              <div className="card-pos p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ingreso por cliente</p>
                <p className="mt-1 text-xl font-bold">{formatCurrency(ingresoPorCliente)}</p>
              </div>
            </div>

            <POSButton variant="secondary" fullWidth size="sm" icon={RefreshCw} onClick={() => loadDashboard().catch(() => null)}>
              {loading ? 'Actualizando...' : 'Actualizar'}
            </POSButton>
            <POSButton variant="secondary" fullWidth size="sm" icon={Download} onClick={exportDailyXls}>
              Descargar XLS diario
            </POSButton>
            {authUser?.role === 'admin' && (
              <POSButton variant="secondary" fullWidth size="sm" icon={Download} onClick={exportDashboardPdf}>
                {exportingPdf ? 'Generando PDF...' : 'Descargar PDF'}
              </POSButton>
            )}
            {error && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {activeTab === 'indicators' && executive && summary && (
            <>
              <section className="card-pos p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Dashboard Arcade</p>
                    <h1 className="mt-1 text-2xl font-semibold">Panel operativo para tomar decisiones comerciales, técnicas y de operación</h1>
                    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                      La vista responde tres preguntas: cuanto se gana y donde, que maquinas estan funcionando o fallando y como se comporta el cliente para optimizar precios y flujo.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-secondary/20 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Meta del periodo</p>
                    <p className="mt-1 text-2xl font-bold">{formatCurrency(summary.summary.goal_amount)}</p>
                    <p className="text-sm text-muted-foreground">{summary.summary.goal_pct.toFixed(1)}% cumplimiento</p>
                  </div>
                </div>
              </section>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="card-pos p-5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Ingresos hoy</p>
                  <p className="mt-2 text-3xl font-bold">{formatCurrency(executive.executive.today_revenue)}</p>
                  <p className={cn('mt-2 text-sm font-medium', executive.executive.comparison_vs_yesterday_pct >= 0 ? 'text-success' : 'text-destructive')}>
                    {executive.executive.comparison_vs_yesterday_pct >= 0 ? '+' : ''}{executive.executive.comparison_vs_yesterday_pct.toFixed(2)}% vs ayer
                  </p>
                </div>
                <div className="card-pos p-5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Clientes hoy</p>
                  <p className="mt-2 text-3xl font-bold">{executive.customer_flow.unique_customers_today}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Nuevos vs recurrentes: {executive.customer_flow.new_cards_activated_today} / {executive.customer_flow.recurrent_customers_today}</p>
                </div>
                <div className="card-pos p-5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Maquinas activas</p>
                  <p className="mt-2 text-3xl font-bold">{activeMachines} / {totalMachines}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Offline: {executive.operational_alerts.offline_machines}</p>
                </div>
                <div className="card-pos p-5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Ingreso por cliente</p>
                  <p className="mt-2 text-3xl font-bold">{formatCurrency(ingresoPorCliente)}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Retencion: {executive.customer_flow.retention_rate_pct.toFixed(1)}%</p>
                </div>
              </div>

              <section className="card-pos p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Acumulado por tipo de producto</h2>
                    <p className="text-sm text-muted-foreground">Ventas acumuladas por categoría para el periodo seleccionado.</p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(typeBreakdown?.total ?? 0)}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {salesTypeRows.map((row) => (
                    <div key={row.name} className="rounded-xl border border-border/60 bg-secondary/20 p-4">
                      <p className="text-sm font-medium">{row.name}</p>
                      <p className="mt-2 text-2xl font-bold">{formatCurrency(row.value)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{row.count} unidades • {row.pct.toFixed(1)}%</p>
                    </div>
                  ))}
                  {salesTypeRows.length === 0 && (
                    <div className="rounded-xl border border-border/60 bg-secondary/10 p-4 text-sm text-muted-foreground">
                      Sin datos para el periodo seleccionado.
                    </div>
                  )}
                </div>
              </section>

              <MagicBento
                items={bentoItems}
                enableTilt={false}
                enableMagnetism={false}
                enableStars={false}
                enableBorderGlow={true}
                enableSpotlight={true}
                textAutoHide={false}
              />

              <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <section className="card-pos p-5">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold">Uso en tiempo real por maquina</h2>
                    <p className="text-sm text-muted-foreground">Heatmap operativo para ver demanda alta, media o baja y reorganizar el arcade.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {occupancyRows.map((machine) => {
                      const toneClass =
                        machine.occupancy_pct >= 70
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : machine.occupancy_pct >= 35
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700';
                      return (
                        <div key={machine.machine_code} className={cn('rounded-2xl border p-4', toneClass)}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 break-words text-sm font-semibold">{machine.machine_name}</p>
                            <span className="shrink-0 text-[11px] font-semibold">{machine.occupancy_pct.toFixed(0)}%</span>
                          </div>
                          <p className="mt-2 text-xs opacity-80">{machine.uses} lecturas hoy</p>
                          <div className="mt-3 h-2 rounded-full bg-white/70">
                            <div className="h-2 rounded-full bg-current" style={{ width: `${Math.max(8, Math.min(machine.occupancy_pct, 100))}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="card-pos p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Alertas operativas</h2>
                      <p className="text-sm text-muted-foreground">Incidencias criticas que afectan ingreso, servicio o control.</p>
                    </div>
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="space-y-3">
                    {alerts.map((alert, idx) => (
                      <div key={`${alert}-${idx}`} className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="text-sm font-medium">{alert}</p>
                      </div>
                    ))}
                    {alerts.length === 0 && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
                        Sin alertas criticas en este momento.
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/60 p-4">
                        <div className="flex items-center gap-2 text-muted-foreground"><Wrench className="h-4 w-4" />ROI por tipo</div>
                        <div className="mt-2 space-y-2">
                          {executive.deep_finance.roi_by_game_type.slice(0, 3).map((row) => (
                            <div key={row.game_type} className="text-sm">
                              <p className="font-medium">{row.game_type}</p>
                              <p className="text-xs text-muted-foreground">{row.roi_pct.toFixed(1)}% ROI · {row.uses} usos</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/60 p-4">
                        <div className="flex items-center gap-2 text-muted-foreground"><Zap className="h-4 w-4" />Juego por segmento</div>
                        <div className="mt-2 space-y-2">
                          {preferredGames.map((row) => (
                            <div key={`${row.segment}-${row.game}`} className="text-sm">
                              <p className="font-medium">{row.segment}</p>
                              <p className="text-xs text-muted-foreground">{row.game} · {row.uses} usos</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                <section className="card-pos p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Comportamiento del cliente</h2>
                      <p className="text-sm text-muted-foreground">Sirve para decidir promociones, permanencia y ajuste de personal.</p>
                    </div>
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Duracion promedio</p>
                      <p className="mt-1 text-2xl font-bold">{executive.machine_efficiency.average_session_minutes.toFixed(1)} min</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Nuevos vs recurrentes</p>
                      <p className="mt-1 text-2xl font-bold">{executive.customer_flow.new_cards_activated_today} / {executive.customer_flow.recurrent_customers_today}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">CAC</p>
                      <p className="mt-1 text-2xl font-bold">{formatCurrency(executive.deep_finance.customer_acquisition_cost.cac)}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Ingreso m2/h</p>
                      <p className="mt-1 text-2xl font-bold">{formatCurrency(executive.strategic_metric.revenue_per_m2_per_hour)}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-border/60 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Perfil geografico principal</p>
                    <div className="mt-3 space-y-2">
                      {customerProfileLabels.map((label, idx) => (
                        <div key={`${label}-${idx}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="min-w-0 break-words">{label}</span>
                          <span className="shrink-0 font-medium">{customerProfileValues[idx]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="card-pos p-5">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold">Rentabilidad por maquina</h2>
                    <p className="text-sm text-muted-foreground">Vista directa de utilidad por atracción para decidir precio, permanencia y mantenimiento.</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    {topProfitability.map((row) => (
                      <div key={`${row.machine_name}-${row.machine_type}`} className="rounded-xl border border-border/60 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium break-words">{row.machine_name}</p>
                            <p className="text-xs text-muted-foreground">{row.machine_type}</p>
                          </div>
                          <p className={cn('shrink-0 font-semibold', row.profit >= 0 ? 'text-emerald-600' : 'text-destructive')}>
                            {formatCurrency(row.profit)}
                          </p>
                        </div>
                        <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                          <span>Ingreso: {formatCurrency(row.revenue)}</span>
                          <span>Costo energia: {formatCurrency(row.energy_cost)}</span>
                          <span>Mantenimiento: {formatCurrency(row.maintenance_cost + row.depreciation_cost)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </>
          )}

          {activeTab === 'movements' && (
            <section className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="card-pos p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Ingresos filtrados</p>
                  <p className="mt-2 text-2xl font-bold">{formatCurrency(movementTotals.income)}</p>
                </div>
                <div className="card-pos p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Egresos filtrados</p>
                  <p className="mt-2 text-2xl font-bold text-destructive">{formatCurrency(movementTotals.expense)}</p>
                </div>
                <div className="card-pos p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Ajustes filtrados</p>
                  <p className="mt-2 text-2xl font-bold">{formatCurrency(movementTotals.adjustment)}</p>
                </div>
                <div className="card-pos p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Pendientes operativos</p>
                  <p className="mt-2 text-2xl font-bold">{(pending?.approvals_required_count ?? 0) + (pending?.electronic_invoice_count ?? 0)}</p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="card-pos p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">Detalle de movimientos</h2>
                      <p className="text-sm text-muted-foreground">Filtra ingresos, egresos o ajustes y revisa su trazabilidad.</p>
                    </div>
                    {authUser?.role === 'admin' && (
                      <POSButton size="sm" variant="secondary" icon={Download} onClick={exportMovements}>
                        Exportar CSV
                      </POSButton>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <input className="input-pos input-pos-compact" placeholder="Buscar movimientos" value={movementQuery} onChange={(e) => setMovementQuery(e.target.value)} />
                    <select className="input-pos input-pos-compact" value={movementFlow} onChange={(e) => setMovementFlow(e.target.value as typeof movementFlow)}>
                      <option value="all">Todos</option>
                      <option value="income">Ingresos</option>
                      <option value="expense">Egresos</option>
                      <option value="adjustment">Ajustes</option>
                    </select>
                    <input className="input-pos input-pos-compact" list="movement-categories" placeholder="Categoría" value={movementCategory} onChange={(e) => setMovementCategory(e.target.value)} />
                    <datalist id="movement-categories">
                      {movementCategories.map((category) => (
                        <option key={category} value={category} />
                      ))}
                    </datalist>
                    <POSButton size="sm" variant="secondary" onClick={() => { setMovementQuery(''); setMovementFlow('all'); setMovementCategory(''); }}>
                      Limpiar filtros
                    </POSButton>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-border/60">
                    <div className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.8fr_0.6fr] gap-3 border-b border-border/60 bg-secondary/30 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <span>Movimiento</span>
                      <span>Fecha</span>
                      <span>Categoría</span>
                      <span>Valor</span>
                      <span>Acciones</span>
                    </div>
                    <div className="divide-y divide-border/60">
                      {movements.map((row) => (
                        <div key={row.id} className="grid grid-cols-[1.2fr_0.8fr_0.9fr_0.8fr_0.6fr] gap-3 px-4 py-4 text-sm">
                          <div className="min-w-0">
                            <p className="break-words font-medium">{row.label}</p>
                            <p className="mt-1 break-words text-xs text-muted-foreground">{row.description || row.detail}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">Autorizado por: {row.authorized_by}</p>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(row.occurred_at).toLocaleString('es-CO')}
                          </div>
                          <div className="min-w-0">
                            <p className="break-words">{row.category}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{row.kind}</p>
                          </div>
                          <div>
                            <p className={cn('font-semibold', row.flow === 'expense' ? 'text-destructive' : row.flow === 'income' ? 'text-emerald-600' : 'text-foreground')}>
                              {row.flow === 'expense' ? '-' : row.flow === 'income' ? '+' : ''}{formatCurrency(Number(row.amount))}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
                          </div>
                          <div className="flex flex-col items-start gap-2">
                            {row.receipt_text ? (
                              <POSButton size="sm" variant="secondary" onClick={() => setSelectedReceipt({ number: row.receipt_number || row.id, text: row.receipt_text || '' })}>
                                Ver factura
                              </POSButton>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin factura</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {movements.length === 0 && (
                        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                          No hay movimientos para los filtros seleccionados.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="card-pos p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Transacciones por aprobar</h2>
                        <p className="text-sm text-muted-foreground">Pendientes de aprobación o revisión operativa.</p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        {pending?.approvals_required_count ?? 0}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {(pending?.approvals_required ?? []).slice(0, 6).map((row) => (
                        <div key={row.id} className="rounded-xl border border-border/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-medium">{row.label}</p>
                              <p className="mt-1 break-words text-xs text-muted-foreground">{row.customer_name}</p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold">{formatCurrency(Number(row.total))}</p>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <span>Saldo pendiente: {formatCurrency(Number(row.balance_due))}</span>
                            <span>{new Date(row.created_at).toLocaleDateString('es-CO')}</span>
                          </div>
                        </div>
                      ))}
                      {(pending?.approvals_required_count ?? 0) === 0 && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                          No hay aprobaciones pendientes.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card-pos p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">Facturación electrónica pendiente</h2>
                        <p className="text-sm text-muted-foreground">Registra el número emitido para cerrar el pendiente contable.</p>
                      </div>
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                        {pending?.electronic_invoice_count ?? 0}
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {(pending?.electronic_invoices ?? []).slice(0, 6).map((row) => (
                        <div key={row.id} className="rounded-xl border border-border/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-medium">{row.customer_name}</p>
                              <p className="mt-1 break-words text-xs text-muted-foreground">Creada por {row.created_by}</p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold">{formatCurrency(Number(row.total))}</p>
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString('es-CO')}</span>
                            <POSButton
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setInvoiceModalSaleId(row.id);
                                setInvoiceNumber('');
                                setInvoiceCode(row.electronic_invoice_code ?? '');
                                setInvoiceError('');
                              }}
                            >
                              Gestionar
                            </POSButton>
                          </div>
                        </div>
                      ))}
                      {(pending?.electronic_invoice_count ?? 0) === 0 && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
                          No hay facturas electrónicas pendientes.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'inventory' && (
            <section className="grid gap-4 md:grid-cols-3">
              {(inventory?.summary ?? []).map((group) => (
                <div key={group.category} className="card-pos p-5">
                  <h2 className="font-semibold">{group.category}</h2>
                  <p className="mt-2 text-2xl font-bold">{group.total_current}</p>
                  <p className="text-sm text-muted-foreground">Vendidas/redimidas: {group.total_sold_or_redeemed}</p>
                </div>
              ))}
            </section>
          )}

          {activeTab === 'machines' && (
            <section className="space-y-4">
              <div className="card-pos p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Operación de máquinas</p>
                    <h1 className="mt-1 text-2xl font-semibold">Control de mantenimiento para lectoras y máquinas</h1>
                    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                      Si una máquina entra en mantenimiento, la lectora deja de autorizar usos y responde el mensaje configurado desde este panel.
                    </p>
                  </div>
                  <POSButton variant="secondary" size="sm" icon={RefreshCw} onClick={() => loadStations().catch(() => null)}>
                    {stationsLoading ? 'Actualizando...' : 'Actualizar máquinas'}
                  </POSButton>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {stations.map((station) => (
                  <article key={station.id} className={cn(
                    'card-pos p-5',
                    station.maintenance_mode && 'border-amber-300 bg-amber-50/60',
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">{station.code}</p>
                        <h2 className="mt-1 break-words text-lg font-semibold">{station.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {station.location || 'Sin ubicación'} · {station.type === 'TIME' ? 'Tiempo' : 'Habilidad'}
                        </p>
                      </div>
                      <span className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold',
                        station.status === 'ACTIVE' && 'bg-emerald-100 text-emerald-700',
                        station.status === 'INACTIVE' && 'bg-slate-200 text-slate-700',
                        station.status === 'MAINTENANCE' && 'bg-amber-100 text-amber-800',
                      )}>
                        {station.status === 'ACTIVE' ? 'Activa' : station.status === 'INACTIVE' ? 'Inactiva' : 'Mantenimiento'}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                      <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Usos hoy</p>
                        <p className="mt-1 text-xl font-bold">{station.total_uses_today}</p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-secondary/20 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Ingreso hoy</p>
                        <p className="mt-1 text-xl font-bold">{formatCurrency(station.total_revenue_today)}</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                      <p>Último uso: {formatDateTime(station.last_use_at)}</p>
                      <p>Lectoras: {station.assigned_readers.length > 0 ? station.assigned_readers.map((reader) => reader.code).join(', ') : 'Sin lectoras asignadas'}</p>
                      <p>Tarifa: {formatCurrency(Number(station.price))}</p>
                    </div>

                    {station.maintenance_mode && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-100/70 p-4 text-sm text-amber-900">
                        <p className="font-semibold">Mensaje enviado a la máquina</p>
                        <p className="mt-1">{station.maintenance_message || 'Máquina en mantenimiento'}</p>
                      </div>
                    )}

                    <div className="mt-4 flex gap-3">
                      <POSButton
                        variant={station.maintenance_mode ? 'success' : 'warning'}
                        fullWidth
                        onClick={() => openMaintenanceModal(station)}
                      >
                        {station.maintenance_mode ? 'Quitar mantenimiento' : 'Poner mantenimiento'}
                      </POSButton>
                    </div>
                  </article>
                ))}
              </div>

              {!stationsLoading && stations.length === 0 && (
                <div className="rounded-xl border border-border/60 bg-card/60 p-6 text-center text-sm text-muted-foreground">
                  No hay máquinas configuradas para esta sede.
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      <POSModal isOpen={Boolean(selectedReceipt)} onClose={() => setSelectedReceipt(null)} title="Factura / Recibo" size="md">
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border/60 bg-secondary/20 p-3 text-[11px] leading-5">
          {selectedReceipt?.text ?? 'Sin contenido.'}
        </pre>
      </POSModal>

      <POSModal isOpen={Boolean(selectedInvoice)} onClose={() => setInvoiceModalSaleId('')} title="Gestionar factura electrónica" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{selectedInvoice?.customer_name} · {selectedInvoice ? formatCurrency(Number(selectedInvoice.total)) : ''}</p>
          <input className="input-pos" placeholder="Número de factura emitida" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          <input className="input-pos" placeholder="Código / referencia contable" value={invoiceCode} onChange={(e) => setInvoiceCode(e.target.value)} />
          {invoiceError && <p className="text-sm text-destructive">{invoiceError}</p>}
          <POSButton variant="success" fullWidth onClick={saveInvoiceManagement}>Cerrar pendiente</POSButton>
        </div>
      </POSModal>

      <POSModal
        isOpen={Boolean(maintenanceModalStation)}
        onClose={() => {
          if (maintenanceSubmitting) return;
          setMaintenanceModalStation(null);
          setMaintenanceMessage('');
        }}
        title={maintenanceModalStation?.maintenance_mode ? 'Quitar mantenimiento' : 'Poner máquina en mantenimiento'}
        size="md"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 text-sm">
            <p className="font-semibold">{maintenanceModalStation?.name}</p>
            <p className="mt-1 text-muted-foreground">{maintenanceModalStation?.code} · {maintenanceModalStation?.location || 'Sin ubicación'}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mensaje de mantenimiento</label>
            <textarea
              className="input-pos min-h-28"
              placeholder="Ej: Máquina fuera de servicio por revisión técnica. Intenta de nuevo en 15 minutos."
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value.slice(0, 240))}
              disabled={maintenanceSubmitting || Boolean(maintenanceModalStation?.maintenance_mode)}
            />
            <p className="text-xs text-muted-foreground">
              Este texto viaja en la respuesta del servidor cuando la lectora intenta validar uso sobre una máquina en mantenimiento.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <POSButton
              variant="warning"
              onClick={() => submitMaintenanceMode(true)}
              loading={maintenanceSubmitting}
              disabled={maintenanceSubmitting || Boolean(maintenanceModalStation?.maintenance_mode)}
            >
              Activar mantenimiento
            </POSButton>
            <POSButton
              variant="success"
              onClick={() => submitMaintenanceMode(false)}
              loading={maintenanceSubmitting}
              disabled={maintenanceSubmitting || !Boolean(maintenanceModalStation?.maintenance_mode)}
            >
              Reactivar máquina
            </POSButton>
          </div>
        </div>
      </POSModal>

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
