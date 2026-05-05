export interface ParsedCardSms {
  id: string;
  amount: number;
  merchant: string;
  cardName: string;
  rawText: string;
  date: number;
}

export interface SmsImportResult {
  success: boolean;
  data?: ParsedCardSms[];
  error?: string;
}
