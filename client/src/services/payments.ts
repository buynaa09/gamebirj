import { apiGet, apiPost } from './api';
import type { QPayPayment } from '../types';

export function createQPayInvoice(
  accountId: number,
  kind: 'sale' | 'rent',
  duration = 1,
): Promise<QPayPayment> {
  return apiPost<QPayPayment>('/payments/qpay/invoice/', {
    account_id: accountId,
    kind,
    duration,
  });
}

export function fetchPaymentStatus(paymentId: number): Promise<QPayPayment> {
  return apiGet<QPayPayment>(`/payments/qpay/${paymentId}/status/`);
}

export function cancelQPayPayment(paymentId: number): Promise<QPayPayment> {
  return apiPost<QPayPayment>(`/payments/qpay/${paymentId}/cancel/`, {});
}

export function fetchMyPayments(): Promise<QPayPayment[]> {
  return apiGet<QPayPayment[]>('/payments/mine/');
}
