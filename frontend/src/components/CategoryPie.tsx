import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CategorySummary, Category } from '../types';

interface Props {
  data: CategorySummary[];
}

const CATEGORY_COLORS: Record<Category, string> = {
  stock: '#3B82F6',
  bond: '#10B981',
  gold: '#F59E0B',
  dollar_rp: '#8B5CF6',
  cash: '#6B7280',
};

const CATEGORY_NAMES: Record<Category, string> = {
  stock: '주식 ETF',
  bond: '채권 ETF',
  gold: '금 ETF',
  dollar_rp: '달러RP',
  cash: 'KRW 현금',
};

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: CategorySummary & { fill: string };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-800">{CATEGORY_NAMES[item.payload.category]}</p>
      <p className="text-gray-600">
        {item.payload.total_krw.toLocaleString('ko-KR')}원
      </p>
      <p className="text-gray-500">{item.payload.percentage.toFixed(1)}%</p>
    </div>
  );
}

export default function CategoryPie({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        데이터가 없습니다
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    name: CATEGORY_NAMES[d.category],
    value: d.total_krw,
    fill: CATEGORY_COLORS[d.category],
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => (
            <span className="text-xs text-gray-700">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
