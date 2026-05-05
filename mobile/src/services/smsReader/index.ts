import { Platform } from 'react-native';
import { SmsImportResult } from './types';

export type { ParsedCardSms, SmsImportResult } from './types';

export async function readCardSms(): Promise<SmsImportResult> {
  if (Platform.OS === 'android') {
    const { readCardSms: androidRead } = await import('./android');
    return androidRead();
  }
  return { success: false, error: 'iOS는 지원하지 않습니다.' };
}
