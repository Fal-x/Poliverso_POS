import { Legend, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartLegendContent, ChartTooltipContent } from '@/components/application/charts/charts-base';

export interface PieChartDatum {
  name: string;
  value: number;
  fill?: string;
}

interface PieChartProps {
  data?: PieChartDatum[];
}

export const PieChartLg = ({ data = [] }: PieChartProps) => {
  return (
    <ResponsiveContainer height={280} className="max-w-96">
      <RechartsPieChart
        margin={{
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        }}
      >
        <Legend verticalAlign="top" align="right" layout="vertical" content={ChartLegendContent} />
        <Tooltip content={<ChartTooltipContent isPieChart />} />

        <Pie
          isAnimationActive={false}
          startAngle={-270}
          endAngle={-630}
          stroke="none"
          data={data}
          dataKey="value"
          nameKey="name"
          fill="currentColor"
          innerRadius={70}
          outerRadius={140}
        />
      </RechartsPieChart>
    </ResponsiveContainer>
  );
};
