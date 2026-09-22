import type { Locale, LocalizedText } from './types.js';

let currentLocale: Locale = 'zh-TW';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(text: LocalizedText | undefined, locale?: Locale): string {
  if (!text) return '';
  const loc = locale ?? currentLocale;
  return text[loc] ?? text['zh-TW'] ?? text['en'] ?? Object.values(text)[0] ?? '';
}
