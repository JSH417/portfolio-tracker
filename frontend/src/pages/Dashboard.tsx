import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import { getPortfolio } from '../api';
import type { PortfolioSummary, Category } from '../types';
import CategoryPie from '../components/CategoryPie';
import PortfolioTreemap from '../components/PortfolioTreemap';

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

const CATEGORY_BG: Record<Category, string> = {
  stock: 'bg-blue-50 border-blue-200',
  bond: 'bg-green-50 border-green-200',
  gold: 'bg-yellow-50 border-yellow-200',
  dollar_rp: 'bg-purple-50 border-purple-200',
  cash: 'bg-gray-50 border-gray-200',
};

type SortKey = 'name' | 'total_value_krw' | 'percentage';

function formatKRW(amount: number): string {
  if (amount >= 100_000_000) {
    return `${(amount / 100_000_000).toFixed(2)}억원`;
  }
  if (amount >= 10_000) {
    return `${(amount / 10_000).toFixed(0)}만원`;
  }
  return `${amount.toLocaleString('ko-KR')}원`;
}

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('total_value_krw');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPortfolio();
      setPortfolio(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError('포트폴리오 데이터를 불러오지 못했습니다. 백엔드 서버를 확인해주세요.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortedHoldings = portfolio
    ? [...portfolio.holdings].sort((a, b) => {
        const mul = sortAsc ? 1 : -1;
        if (sortKey === 'name') return mul * a.name.localeCompare(b.name);
        return mul * (a[sortKey] - b[sortKey]);
      })
    : [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-500">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">데이터 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <AlertCircle className="text-red-400 mb-3" size={48} />
        <p className="text-red-600 font-semibold text-center mb-2">오류 발생</p>
        <p className="text-gray-500 text-sm text-center mb-6">{error}</p>
        <button
          onClick={fetchPortfolio}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm"
        >
          <RefreshCw size={16} />
          다시 시도
        </button>
      </div>
    );
  }

  if (!portfolio) return null;

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(k)}
      className={`text-xs font-medium px-1 py-0.5 rounded transition-colors ${
        sortKey === k ? 'text-blue-600 font-semibold' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
    </button>
  );

  return (
    <div className="px-4 pt-5 pb-4 space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-blue-200 text-xs font-medium mb-1">총 자산</p>
            <p className="text-3xl font-bold tracking-tight">
              {formatKRW(portfolio.total_krw)}
            </p>
            <p className="text-blue-200 text-sm mt-1">
              ≈ ${portfolio.total_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          </div>
          <button
            onClick={fetchPortfolio}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
            aria-label="새로고침"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full font-medium">
            1 USD = {portfolio.exchange_rate.toLocaleString('ko-KR')}원
          </span>
          {lastUpdated && (
            <span className="text-blue-200 text-xs">
              업데이트: {lastUpdated.toLocaleTimeString('ko-KR')}
            </span>
          )}
        </div>
      </div>

      {/* Category Cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">자산 카테고리</h2>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {portfolio.by_category.map((cat) => (
            <div
              key={cat.category}
              className={`border rounded-xl p-3.5 ${CATEGORY_BG[cat.category]}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[cat.category] }}
                  />
                  <span className="text-sm font-semibold text-gray-800">
                    {CATEGORY_NAMES[cat.category]}
                  </span>
                </div>
                <span
                  className="text-sm font-bold"
                  style={{ color: CATEGORY_COLORS[cat.category] }}
                >
                  {cat.percentage.toFixed(1)}%
                </span>
              </div>
              <p className="text-base font-bold text-gray-900 mb-2">
                {cat.total_krw.toLocaleString('ko-KR')}원
              </p>
              <div className="w-full bg-white/60 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(cat.percentage, 100)}%`,
                    backgroundColor: CATEGORY_COLORS[cat.category],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Donut chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">비중 분포</h2>
        <CategoryPie data={portfolio.by_category} />
      </div>

      {/* Treemap */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">트리맵</h2>
        <PortfolioTreemap data={portfolio.holdings} />
      </div>

      {/* Holdings Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">보유 종목</h2>
          <div className="flex gap-1">
            <SortBtn k="name" label="이름" />
            <SortBtn k="total_value_krw" label="금액" />
            <SortBtn k="percentage" label="비중" />
          </div>
        </div>
        <div className="overflow-x-auto -mx-4 px-4">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left pb-2 font-medium">종목</th>
                <th className="text-right pb-2 font-medium">수량</th>
                <th className="text-right pb-2 font-medium">현재가</th>
                <th className="text-right pb-2 font-medium">평가금액</th>
                <th className="text-right pb-2 font-medium">비중</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedHoldings.map((h) => (
                <tr key={h.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[h.category] }}
                      />
                      <div>
                        <p className="font-medium text-gray-900 text-xs leading-tight">
                          {h.name}
                        </p>
                        {h.ticker && (
                          <p className="text-xs text-gray-400">{h.ticker}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-right text-gray-700 text-xs">
                    {h.quantity.toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2.5 text-right text-gray-700 text-xs">
                    {h.current_price_krw.toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-gray-900 text-xs">
                    {h.total_value_krw.toLocaleString('ko-KR')}원
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: CATEGORY_COLORS[h.category] }}
                    >
                      {h.percentage.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
