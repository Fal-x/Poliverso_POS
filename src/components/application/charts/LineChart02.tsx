import { Area, AreaChart, CartesianGrid, Label, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartLegendContent, ChartTooltipContent } from '@/components/application/charts/charts-base';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cx } from '@/utils/cx';

export interface LinePoint {
  date: Date;
  A: number;
  B: number;
  C: number;
}

export const LineChart02 = ({ data }: { data: LinePoint[] }) => {
  const isDesktop = useBreakpoint('lg');

  const colors: Record<string, string> = {
    A: 'text-utility-brand-600',
    B: 'text-utility-brand-400',
    C: 'text-utility-brand-700',
  };

  return (
    <div className="flex h-60 flex-col gap-2">
      <ResponsiveContainer className="h-full">
        <AreaChart
          data={data}
          className="text-tertiary [&_.recharts-text]:text-xs"
          margin={{
            left: 5,
            right: 5,
            top: isDesktop ? 12 : 6,
            bottom: isDesktop ? 16 : 0,
          }}
        >
          <defs>
            <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="currentColor" className="text-utility-brand-700" stopOpacity="0.7" />
              <stop offset="95%" stopColor="currentColor" className="text-utility-brand-700" stopOpacity="0" />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="currentColor" className="text-utility-gray-100" />

          <Legend
            verticalAlign="top"
            align="right"
            layout={isDesktop ? 'vertical' : 'horizontal'}
            content={<ChartLegendContent className="-translate-y-2" />}
          />

          <XAxis
            fill="currentColor"
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            dataKey="date"
            tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short' })}
            padding={{ left: 10, right: 10 }}
          >
            {isDesktop && (
              <Label fill="currentColor" className="!text-xs font-medium max-lg:hidden" position="bottom">
                Día
              </Label>
            )}
          </XAxis>

          <YAxis fill="currentColor" axisLine={false} tickLine={false} interval="preserveStartEnd" tickFormatter={(value) => Number(value).toLocaleString()} />

          <Tooltip
            content={<ChartTooltipContent />}
            formatter={(value) => Number(value).toLocaleString()}
            labelFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: '2-digit' })}
            cursor={{
              className: 'stroke-utility-brand-600 stroke-2',
            }}
          />

          <Area
            isAnimationActive={false}
            className={cx(colors.A, '[&_.recharts-area-area]:translate-y-1.5 [&_.recharts-area-area]:[clip-path:inset(0_0_6px_0)]')}
            dataKey="A"
            name="Ventas"
            type="monotone"
            stroke="currentColor"
            strokeWidth={2}
            fill="url(#gradient)"
            fillOpacity={0.1}
            activeDot={{
              className: 'fill-bg-primary stroke-utility-brand-600 stroke-2',
            }}
          />

          <Area
            isAnimationActive={false}
            className={cx(colors.B, '[&_.recharts-area-area]:translate-y-1.5 [&_.recharts-area-area]:[clip-path:inset(0_0_6px_0)]')}
            dataKey="B"
            name="Meta"
            type="monotone"
            stroke="currentColor"
            strokeWidth={2}
            fill="none"
            strokeDasharray="0.1 8"
            strokeLinecap="round"
            activeDot={{
              className: 'fill-bg-primary stroke-utility-brand-600 stroke-2',
            }}
          />

          <Area
            isAnimationActive={false}
            className={cx(colors.C, '[&_.recharts-area-area]:translate-y-1.5 [&_.recharts-area-area]:[clip-path:inset(0_0_6px_0)]')}
            dataKey="C"
            name="% Cumplimiento"
            type="monotone"
            stroke="currentColor"
            strokeWidth={2}
            fill="none"
            strokeDasharray="0.1 8"
            strokeLinecap="round"
            activeDot={{
              className: 'fill-bg-primary stroke-utility-brand-600 stroke-2',
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
