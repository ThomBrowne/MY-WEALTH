import { PermissionsAndroid } from 'react-native';
import { ParsedCardSms, SmsImportResult } from './types';
import { parseCardSms } from './parser';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function requestPermission(): Promise<boolean> {
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.READ_SMS,
    {
      title: 'SMS 읽기 권한',
      message: '카드 결제 문자를 인식하기 위해 SMS 읽기 권한이 필요합니다.',
      buttonPositive: '허용',
      buttonNegative: '거부',
    },
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function readCardSms(): Promise<SmsImportResult> {
  const permitted = await requestPermission();
  if (!permitted) {
    return { success: false, error: 'SMS 읽기 권한이 필요합니다.' };
  }

  return new Promise((resolve) => {
    const SmsAndroid = require('react-native-get-sms-android');

    SmsAndroid.list(
      JSON.stringify({ box: 'inbox', maxCount: 30, minDate: Date.now() - SEVEN_DAYS_MS }),
      (err: string) => resolve({ success: false, error: err }),
      (_count: number, smsList: string) => {
        const messages: Array<{ _id: number; body: string; date: number }> = JSON.parse(smsList);
        const parsed = messages
          .sort((a, b) => b.date - a.date)
          .map(msg => parseCardSms(msg.body, String(msg._id), msg.date))
          .filter((p): p is ParsedCardSms => p !== null);

        if (parsed.length === 0) {
          resolve({ success: false, error: '최근 7일 내 카드 결제 문자가 없습니다.' });
        } else {
          resolve({ success: true, data: parsed });
        }
      },
    );
  });
}
