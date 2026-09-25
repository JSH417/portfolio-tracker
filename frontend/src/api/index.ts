import axios from 'axios';
import type {
  PortfolioSummary,
  Holding,
  Target,
  RebalancePlan,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export interface HoldingCreate {
  name: string;
  ticker?: string;
  asset_type: string;
  quantity: number;
  category: string;
}

export interface HoldingUpdate {
  name?: string;
  ticker?: string;
  asset_type?: string;
  quantity?: number;
  category?: string;
}

export async function getPortfolio(): Promise<PortfolioSummary> {
  const res = await client.get<PortfolioSummary>('/api/portfolio');
  return res.data;
}

export async function getHoldings(): Promise<Holding[]> {
  const res = await client.get<Holding[]>('/api/holdings');
  return res.data;
}

export async function createHolding(data: HoldingCreate): Promise<Holding> {
  const res = await client.post<Holding>('/api/holdings', data);
  return res.data;
}

export async function updateHolding(id: number, data: HoldingUpdate): Promise<Holding> {
  const res = await client.put<Holding>(`/api/holdings/${id}`, data);
  return res.data;
}

export async function deleteHolding(id: number): Promise<void> {
  await client.delete(`/api/holdings/${id}`);
}

export async function getTargets(): Promise<Target[]> {
  const res = await client.get<Target[]>('/api/targets');
  return res.data;
}

export async function saveTargets(targets: Target[]): Promise<Target[]> {
  const res = await client.post<Target[]>('/api/targets', targets);
  return res.data;
}

export async function calculateRebalance(budget_krw: number): Promise<RebalancePlan> {
  const res = await client.post<RebalancePlan>('/api/rebalance', { budget_krw });
  return res.data;
}

export async function getExchangeRate(): Promise<{ usd_krw: number }> {
  const res = await client.get<{ usd_krw: number }>('/api/exchange-rate');
  return res.data;
}
