import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Calculator, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { getTargets, saveTargets, calculateRebalance } from '../api';
import type { Target, RebalancePlan, Category } from '../types';

const CATEGORY_NAMES: Record<Category, string> = {
  stock: '주식 ETF',
  bond: '채권 ETF',
  gold: '금 ETF',
  dollar_rp: '달러RP',
  cash: 'KRW 현금',
};

const CATEGORY_COLORS: Record<Category, string> = {
  stock: '#3B82F6',
  bond: '#10B981',
  gold: '#F59E0B',
  dollar_rp: '#8B5CF6',
  cash: '#6B7280',
};

const TOP_CATEGORIES: Category[] = ['stock', 'bond', 'gold', 'dollar_rp', 'cash'];

interface LocalTarget extends Omit<Target, 'id'> {
  id: number;
  _localId: string;
}

let _nextLocalId = 1;
function nextLocalId() {
  return `local-${_nextLocalId++}`;
}

export default function Rebalance() {
  const [targets, setTargets] = useState<LocalTarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [savingTargets, setSavingTargets] = useState(false);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<Category>>(new Set(['stock']));

  const [budget, setBudget] = useState('');
  const [plan, setPlan] = useState<RebalancePlan | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTargets() {
      setLoadingTargets(true);
      try {
        const data = await getTargets();
        setTargets(
          data.map((t) => ({ ...t, _localId: nextLocalId() }))
        );
      } catch {
        setTargetsError('목표 비중 데이터를 불러오지 못했습니다.');
      } finally {
        setLoadingTargets(false);
      }
    }
    fetchTargets();
  }, []);

  // Derived: top-level targets by category
  const topLevelTargets = TOP_CATEGORIES.map((cat) => {
    const found = targets.find((t) => t.category === cat && !t.parent_id && !t.sub_category);
    return found ?? null;
  });

  const topLevelPct = topLevelTargets.reduce((sum, t) => sum + (t?.target_pct ?? 0), 0);

  function getSubTargets(cat: Category): LocalTarget[] {
    return targets.filter((t) => t.category === cat && (t.parent_id != null || t.sub_category));
  }

  function upsertTopLevel(cat: Category, pct: number) {
    setTargets((prev) => {
      const existing = prev.find((t) => t.category === cat && !t.parent_id && !t.sub_category);
      if (existing) {
        return prev.map((t) =>
          t._localId === existing._localId ? { ...t, target_pct: pct } : t
        );
      }
      return [
        ...prev,
        {
          id: 0,
          _localId: nextLocalId(),
          category: cat,
          name: CATEGORY_NAMES[cat],
          target_pct: pct,
        },
      ];
    });
  }

  function addSubTarget(cat: Category) {
    const parentTarget = targets.find((t) => t.category === cat && !t.parent_id && !t.sub_category);
    setTargets((prev) => [
      ...prev,
      {
        id: 0,
        _localId: nextLocalId(),
        category: cat,
        sub_category: '',
        name: '',
        target_pct: 0,
        parent_id: parentTarget?.id ?? 0,
      },
    ]);
    setExpandedCategories((prev) => new Set([...prev, cat]));
  }

  function updateSubTarget(localId: string, field: string, value: string | number) {
    setTargets((prev) =>
      prev.map((t) => (t._localId === localId ? { ...t, [field]: value } : t))
    );
  }

  function removeSubTarget(localId: string) {
    setTargets((prev) => prev.filter((t) => t._localId !== localId));
  }

  function addTopLevelTarget() {
    setTargets((prev) => [
      ...prev,
      {
        id: 0,
        _localId: nextLocalId(),
        category: 'stock',
        name: '',
        target_pct: 0,
      },
    ]);
  }

  async function handleSaveTargets() {
    setSavingTargets(true);
    setTargetsError(null);
    try {
      const payload = targets.map(({ _localId: _l, ...t }) => t) as Target[];
      const saved = await saveTargets(payload);
      setTargets(saved.map((t) => ({ ...t, _localId: nextLocalId() })));
    } catch {
      setTargetsError('저장 중 오류가 발생했습니다.');
    } finally {
      setSavingTargets(false);
    }
  }

  async function handleCalculate() {
    const budgetNum = parseFloat(budget.replace(/,/g, ''));
    if (isNaN(budgetNum) || budgetNum <= 0) {
      setCalcError('올바른 예산 금액을 입력해주세요.');
      return;
    }
    setCalculating(true);
    setCalcError(null);
    setPlan(null);
    try {
      const result = await calculateRebalance(budgetNum);
      setPlan(result);
    } catch {
      setCalcError('리밸런싱 계산 중 오류가 발생했습니다. 목표 비중이 설정되어 있는지 확인해주세요.');
    } finally {
      setCalculating(false);
    }
  }

  function toggleCategory(cat: Category) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }

  const pctWarning = Math.abs(topLevelPct - 100) > 0.01 && topLevelPct > 0;

  return (
    <div className="px-4 pt-5 pb-4 space-y-6">
      <h1 className="text-xl font-bold text-gray-900">리밸런싱</h1>

      {/* ── Section 1: Target allocation editor ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-800">목표 비중 설정</h2>
          <button
            onClick={handleSaveTargets}
            disabled={savingTargets || loadingTargets}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <Save size={14} />
            {savingTargets ? '저장 중...' : '저장'}
          </button>
        </div>

        {targetsError && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm mb-4">
            <AlertCircle size={16} className="flex-shrink-0" />
            {targetsError}
          </div>
        )}

        {loadingTargets ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Total indicator */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs text-gray-500">합계</span>
              <span
                className={`text-sm font-bold ${
                  pctWarning ? 'text-red-600' : 'text-green-600'
                }`}
              >
                {topLevelPct.toFixed(1)}%
                {pctWarning && ' ⚠ 100%가 아닙니다'}
              </span>
            </div>

            {/* Top-level category rows */}
            <div className="space-y-2">
              {TOP_CATEGORIES.map((cat) => {
                const t = topLevelTargets[TOP_CATEGORIES.indexOf(cat)];
                const subs = getSubTargets(cat);
                const isExpanded = expandedCategories.has(cat);
                const subTotal = subs.reduce((s, sub) => s + (sub.target_pct ?? 0), 0);

                return (
                  <div
                    key={cat}
                    className="border border-gray-100 rounded-xl overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-3.5 py-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                      />
                      <span className="text-sm font-semibold text-gray-700 flex-1">
                        {CATEGORY_NAMES[cat]}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={t?.target_pct ?? ''}
                        onChange={(e) => upsertTopLevel(cat, parseFloat(e.target.value) || 0)}
                        className="w-20 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-400">%</span>
                      {cat === 'stock' && (
                        <button
                          onClick={() => toggleCategory(cat)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Sub-categories (stock) */}
                    {cat === 'stock' && isExpanded && (
                      <div className="bg-gray-50 border-t border-gray-100 px-3.5 py-2 space-y-2">
                        {subs.length === 0 && (
                          <p className="text-xs text-gray-400 py-1">
                            세부 항목 없음
                          </p>
                        )}
                        {subs.map((sub) => (
                          <div
                            key={sub._localId}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="text"
                              value={sub.name}
                              onChange={(e) =>
                                updateSubTarget(sub._localId, 'name', e.target.value)
                              }
                              placeholder="이름"
                              className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 bg-white"
                            />
                            <input
                              type="text"
                              value={sub.ticker ?? ''}
                              onChange={(e) =>
                                updateSubTarget(sub._localId, 'ticker', e.target.value)
                              }
                              placeholder="코드"
                              className="w-16 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 bg-white"
                            />
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={sub.target_pct}
                              onChange={(e) =>
                                updateSubTarget(
                                  sub._localId,
                                  'target_pct',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-16 text-right border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500 bg-white"
                            />
                            <span className="text-xs text-gray-400">%</span>
                            <button
                              onClick={() => removeSubTarget(sub._localId)}
                              className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        {subs.length > 0 && (
                          <div className="flex justify-end pr-6">
                            <span
                              className={`text-xs font-medium ${
                                Math.abs(subTotal - 100) > 0.01 && subTotal > 0
                                  ? 'text-red-500'
                                  : 'text-gray-400'
                              }`}
                            >
                              세부 합계: {subTotal.toFixed(1)}%
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => addSubTarget(cat)}
                          className="flex items-center gap-1.5 text-xs text-blue-600 font-medium hover:text-blue-700 transition-colors py-1"
                        >
                          <Plus size={14} />
                          세부 항목 추가
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={addTopLevelTarget}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium mt-3 transition-colors"
            >
              <Plus size={16} />
              카테고리 추가
            </button>
          </>
        )}
      </div>

      {/* ── Section 2: Rebalance Calculator ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <h2 className="text-base font-bold text-gray-800 mb-4">리밸런싱 계획</h2>

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              월 투자 예산 (원)
            </label>
            <input
              type="number"
              min="0"
              step="10000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="예: 1000000"
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleCalculate}
              disabled={calculating || !budget}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              <Calculator size={16} />
              {calculating ? '계산 중...' : '계산'}
            </button>
          </div>
        </div>

        {calcError && (
          <div className="flex items-start gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm mb-4">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{calcError}</span>
          </div>
        )}

        {calculating && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {plan && !calculating && (
          <div>
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-500 font-medium mb-1">예산</p>
                <p className="text-sm font-bold text-blue-700">
                  {plan.budget_krw.toLocaleString('ko-KR')}원
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xs text-green-500 font-medium mb-1">매수 합계</p>
                <p className="text-sm font-bold text-green-700">
                  {plan.total_buy_krw.toLocaleString('ko-KR')}원
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-500 font-medium mb-1">잔여</p>
                <p className="text-sm font-bold text-gray-700">
                  {plan.remaining_krw.toLocaleString('ko-KR')}원
                </p>
              </div>
            </div>

            {/* Results table */}
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="w-full min-w-max text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left pb-2 pr-2 font-semibold text-gray-600">종목</th>
                    <th className="text-right pb-2 px-1 font-semibold text-gray-600 whitespace-nowrap">현재%</th>
                    <th className="text-right pb-2 px-1 font-semibold text-gray-600 whitespace-nowrap">목표%</th>
                    <th className="text-right pb-2 px-1 font-semibold text-gray-600">차이</th>
                    <th className="text-right pb-2 px-1 font-semibold text-gray-600 whitespace-nowrap">매수금액</th>
                    <th className="text-right pb-2 px-1 font-semibold text-gray-600 whitespace-nowrap">매수수량</th>
                    <th className="text-right pb-2 font-semibold text-gray-600">단가</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {plan.items.map((item, idx) => {
                    const isUnderweight = item.gap_pct < 0;
                    return (
                      <tr
                        key={idx}
                        className={`transition-colors ${
                          isUnderweight ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="py-2.5 pr-2">
                          <p className="font-semibold text-gray-900 leading-tight">{item.name}</p>
                          {item.ticker && (
                            <p className="text-gray-400">{item.ticker}</p>
                          )}
                        </td>
                        <td className="py-2.5 px-1 text-right text-gray-600">
                          {item.current_pct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-1 text-right text-gray-600">
                          {item.target_pct.toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-1 text-right">
                          <span
                            className={`font-semibold ${
                              item.gap_pct < 0 ? 'text-blue-600' : 'text-gray-400'
                            }`}
                          >
                            {item.gap_pct > 0 ? '+' : ''}
                            {item.gap_pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 px-1 text-right font-semibold text-gray-900">
                          {item.buy_amount_krw > 0
                            ? `${item.buy_amount_krw.toLocaleString('ko-KR')}원`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-1 text-right text-gray-700">
                          {item.buy_quantity > 0
                            ? item.buy_quantity.toLocaleString('ko-KR')
                            : '-'}
                        </td>
                        <td className="py-2.5 text-right text-gray-600">
                          {item.price_per_unit_krw > 0
                            ? `${item.price_per_unit_krw.toLocaleString('ko-KR')}`
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Note */}
            <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <span className="text-base">💡</span>
              <p className="text-xs text-blue-700 leading-relaxed">
                매도 없이 신규 자금으로만 리밸런싱합니다. 파란색 행은 현재 비중이 목표보다 낮은 항목입니다.
              </p>
            </div>
          </div>
        )}

        {!plan && !calculating && !calcError && (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <Calculator size={40} className="mb-3 text-gray-300" />
            <p className="text-sm">예산을 입력하고 계산 버튼을 눌러주세요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
