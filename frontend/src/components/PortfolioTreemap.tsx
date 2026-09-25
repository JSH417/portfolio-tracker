import { Treemap, ResponsiveContainer } from 'recharts';
import type { HoldingWithValue, Category } from '../types';

interface Props {
  data: HoldingWithValue[];
}

const CATEGORY_COLORS: Record<Category, string> = {
  stock: '#3B82F6',
  bond: '#10B981',
  gold: '#F59E0B',
  dollar_rp: '#8B5CF6',
  cash: '#6B7280',
};

const CATEGORY_COLORS_LIGHT: Record<Category, string> = {
  stock: '#DBEAFE',
  bond: '#D1FAE5',
  gold: '#FEF3C7',
  dollar_rp: '#EDE9FE',
  cash: '#F3F4F6',
};

interface TreemapNode {
  name: string;
  value: number;
  category: Category;
  percentage: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  depth?: number;
  index?: number;
}

interface CustomContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  value?: number;
  depth?: number;
  index?: number;
  root?: TreemapNode;
  category?: Category;
  percentage?: number;
}

function CustomContent(props: CustomContentProps) {
  const { x = 0, y = 0, width = 0, height = 0, name = '', category, percentage = 0, depth = 0 } = props;

  if (depth !== 1 || width < 10 || height < 10) return null;

  const color = category ? CATEGORY_COLORS[category] : '#6B7280';
  const lightColor = category ? CATEGORY_COLORS_LIGHT[category] : '#F3F4F6';
  const showText = width > 50 && height > 30;
  const showPercent = width > 70 && height > 50;

  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={height - 2}
        rx={4}
        ry={4}
        fill={lightColor}
        stroke={color}
        strokeWidth={1.5}
      />
      {showText && (
        <text
          x={x + width / 2}
          y={y + height / 2 - (showPercent ? 8 : 0)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={Math.min(12, width / 6)}
          fontWeight="600"
        >
          {name.length > 10 ? name.slice(0, 10) + '…' : name}
        </text>
      )}
      {showPercent && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize={Math.min(11, width / 7)}
          fontWeight="400"
        >
          {percentage.toFixed(1)}%
        </text>
      )}
    </g>
  );
}

export default function PortfolioTreemap({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        보유 자산이 없습니다
      </div>
    );
  }

  const chartData = data.map((h) => ({
    name: h.name,
    value: Math.max(h.total_value_krw, 1),
    category: h.category,
    percentage: h.percentage,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <Treemap
        data={chartData}
        dataKey="value"
        aspectRatio={4 / 3}
        content={<CustomContent />}
      />
    </ResponsiveContainer>
  );
}
