export type AssetType = 'etf_kr' | 'dollar_rp' | 'cash_krw';
export type Category = 'stock' | 'bond' | 'gold' | 'dollar_rp' | 'cash';

export interface Holding {
  id: number;
  name: string;
  ticker?: string;
  asset_type: AssetType;
  quantity: number;
  category: Category;
  created_at: string;
}

export interface HoldingWithValue extends Holding {
  current_price_krw: number;
  total_value_krw: number;
  percentage: number;
}

export interface CategorySummary {
  category: Category;
  total_krw: number;
  total_usd: number;
  percentage: number;
  holdings: HoldingWithValue[];
}

export interface PortfolioSummary {
  total_krw: number;
  total_usd: number;
  exchange_rate: number;
  by_category: CategorySummary[];
  holdings: HoldingWithValue[];
}

export interface Target {
  id: number;
  category: Category;
  sub_category?: string;
  name: string;
  ticker?: string;
  target_pct: number;
  parent_id?: number;
}

export interface RebalanceItem {
  name: string;
  ticker?: string;
  category: string;
  sub_category?: string;
  current_pct: number;
  target_pct: number;
  gap_pct: number;
  buy_amount_krw: number;
  buy_quantity: number;
  price_per_unit_krw: number;
}

export interface RebalancePlan {
  budget_krw: number;
  items: RebalanceItem[];
  remaining_krw: number;
  total_buy_krw: number;
}
