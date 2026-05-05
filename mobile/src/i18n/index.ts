import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ko from './ko';
import en from './en';

export type Language = 'ko' | 'en';
export const LANGUAGES: Record<Language, string> = { ko: '한국어', en: 'English' };
const LANG_KEY = '@language';

// Synchronous init with Korean default — no loading state needed
i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Async: restore saved language (causes a single re-render if stored lang ≠ 'ko')
AsyncStorage.getItem(LANG_KEY).then((saved) => {
  if (saved === 'en' || saved === 'ko') i18n.changeLanguage(saved);
}).catch(() => {});

export async function changeLanguage(lang: Language) {
  await i18n.changeLanguage(lang);
  AsyncStorage.setItem(LANG_KEY, lang).catch(() => {});
}

export function currentLanguage(): Language {
  return (i18n.language === 'en' ? 'en' : 'ko') as Language;
}

export default i18n;
