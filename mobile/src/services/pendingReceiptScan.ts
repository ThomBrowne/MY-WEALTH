import type { ReceiptScanResult } from './api';

let pendingReceiptScan: ReceiptScanResult | null = null;

export function setPendingReceiptScan(result: ReceiptScanResult) {
  pendingReceiptScan = result;
}

export function consumePendingReceiptScan() {
  const result = pendingReceiptScan;
  pendingReceiptScan = null;
  return result;
}
