import { apiGet, apiPatch } from './api';
import type { Bank, BankAccount } from '../types';

export function fetchBanks(): Promise<Bank[]> {
  return apiGet<Bank[]>('/banks/');
}

export function fetchBankAccount(): Promise<BankAccount> {
  return apiGet<BankAccount>('/users/me/bank/');
}

export function updateBankAccount(data: {
  bank_id: number | null;
  account_holder: string;
  account_number: string;
}): Promise<BankAccount> {
  return apiPatch<BankAccount>('/users/me/bank/', data);
}
