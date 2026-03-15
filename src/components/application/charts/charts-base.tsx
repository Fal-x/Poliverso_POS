import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const ChartLegendContent = (props: any) => {
  const payload = props?.payload ?? [];
  return (
    <div className={cn('flex flex-wrap items-center gap-3 text-xs', props?.className)}>
      {payload.map((item: any) => (
        <div key={item.value} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
};

export const ChartTooltipContent = ({ active, payload, label, isPieChart }: { active?: boolean; payload?: any[]; label?: ReactNode; isPieChart?: boolean }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-soft">
      {!isPieChart && label ? <p className="mb-1 text-muted-foreground">{String(label)}</p> : null}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={`${entry.name}-${entry.value}`} className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="font-semibold">{Number(entry.value ?? 0).toLocaleString('es-CO')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
