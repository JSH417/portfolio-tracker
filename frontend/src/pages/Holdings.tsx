import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, AlertCircle, X } from 'lucide-react';
import { getHoldings, createHolding, updateHolding, deleteHolding } from '../api';
import type { Holding, AssetType, Category } from '../types';

const CATEGORY_NAMES: Record<Category, string> = {
  stock: '주식',
  bond: '채권',
  gold: '금',
  dollar_rp: '달러RP',
  cash: '현금',
};

const CATEGORY_COLORS: Record<Category, string> = {
  stock: 'bg-blue-100 text-blue-700',
  bond: 'bg-green-100 text-green-700',
  gold: 'bg-yellow-100 text-yellow-700',
  dollar_rp: 'bg-purple-100 text-purple-700',
  cash: 'bg-gray-100 text-gray-700',
};

interface FormState {
  name: string;
  asset_type: AssetType;
  ticker: string;
  category: Category;
  quantity: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  asset_type: 'etf_kr',
  ticker: '',
  category: 'stock',
  quantity: '',
};

function getQuantityLabel(asset_type: AssetType): string {
  if (asset_type === 'etf_kr') return '수량 (주)';
  if (asset_type === 'dollar_rp') return '금액 (USD)';
  return '금액 (원)';
}

export default function Holdings() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function fetchHoldings() {
    setLoading(true);
    setError(null);
    try {
      const data = await getHoldings();
      setHoldings(data);
    } catch {
      setError('보유 자산 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHoldings();
  }, []);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  }

  function openEdit(h: Holding) {
    setEditingId(h.id);
    setForm({
      name: h.name,
      asset_type: h.asset_type,
      ticker: h.ticker ?? '',
      category: h.category,
      quantity: String(h.quantity),
    });
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setFormError(null);
  }

  function validate(): boolean {
    if (!form.name.trim()) {
      setFormError('종목명을 입력해주세요.');
      return false;
    }
    if (form.asset_type === 'etf_kr' && !form.ticker.trim()) {
      setFormError('ETF 종목코드를 입력해주세요.');
      return false;
    }
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty <= 0) {
      setFormError('수량/금액은 0보다 커야 합니다.');
      return false;
    }
    return true;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      asset_type: form.asset_type,
      ticker: form.asset_type === 'etf_kr' ? form.ticker.trim() : undefined,
      category: form.category,
      quantity: parseFloat(form.quantity),
    };
    try {
      if (editingId !== null) {
        const updated = await updateHolding(editingId, payload);
        setHoldings((prev) => prev.map((h) => (h.id === editingId ? updated : h)));
      } else {
        const created = await createHolding(payload);
        setHoldings((prev) => [...prev, created]);
      }
      closeModal();
    } catch {
      setFormError('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      await deleteHolding(id);
      setHoldings((prev) => prev.filter((h) => h.id !== id));
      setConfirmDeleteId(null);
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-500">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        <AlertCircle className="text-red-400 mb-3" size={48} />
        <p className="text-red-600 font-semibold mb-2">오류 발생</p>
        <p className="text-gray-500 text-sm text-center mb-6">{error}</p>
        <button
          onClick={fetchHoldings}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 pt-5 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">보유 자산</h1>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            추가
          </button>
        </div>

        {/* Holdings list */}
        {holdings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-lg font-medium mb-1">보유 자산 없음</p>
            <p className="text-sm text-center">
              위의 &quot;추가&quot; 버튼을 눌러 자산을 추가해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {holdings.map((h) => (
              <div
                key={h.id}
                className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {h.name}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[h.category]}`}
                      >
                        {CATEGORY_NAMES[h.category]}
                      </span>
                    </div>
                    {h.ticker && (
                      <p className="text-xs text-gray-400 mb-1">{h.ticker}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      {h.asset_type === 'etf_kr' ? (
                        <span>{h.quantity.toLocaleString('ko-KR')}주</span>
                      ) : h.asset_type === 'dollar_rp' ? (
                        <span>${h.quantity.toLocaleString('en-US')}</span>
                      ) : (
                        <span>{h.quantity.toLocaleString('ko-KR')}원</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(h)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      aria-label="편집"
                    >
                      <Pencil size={16} />
                    </button>
                    {confirmDeleteId === h.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(h.id)}
                          disabled={deleting}
                          className="px-2.5 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
                        >
                          {deleting ? '삭제 중...' : '확인'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(h.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        aria-label="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-md shadow-2xl p-6 pb-8 sm:pb-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId !== null ? '자산 편집' : '자산 추가'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  종목명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="예: TIGER 미국S&P500"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                />
              </div>

              {/* Asset type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  자산 유형
                </label>
                <select
                  value={form.asset_type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      asset_type: e.target.value as AssetType,
                      ticker: '',
                    }))
                  }
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition-colors"
                >
                  <option value="etf_kr">한국 ETF</option>
                  <option value="dollar_rp">달러RP</option>
                  <option value="cash_krw">KRW 현금</option>
                </select>
              </div>

              {/* Ticker (ETF only) */}
              {form.asset_type === 'etf_kr' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    종목코드 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.ticker}
                    onChange={(e) => setForm((f) => ({ ...f, ticker: e.target.value }))}
                    placeholder="예: 379800"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                  />
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as Category }))
                  }
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white transition-colors"
                >
                  <option value="stock">주식</option>
                  <option value="bond">채권</option>
                  <option value="gold">금</option>
                  <option value="dollar_rp">달러RP</option>
                  <option value="cash">현금</option>
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getQuantityLabel(form.asset_type)} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                />
              </div>

              {/* Form error */}
              {formError && (
                <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-sm">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {formError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
