/**
 * i18n – Plan Prep Coach
 *
 * Two supported languages: English (en) and German (de).
 * Language preference is persisted in localStorage under the key "ppc-language".
 * Falls back to English when no preference is saved.
 *
 * Import this file once in main.tsx before anything else.
 * All components use the `useTranslation` hook from react-i18next.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import de from './locales/de.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

/** localStorage key used to persist the language preference. */
export const LANGUAGE_STORAGE_KEY = 'ppc-language';

/** Returns true when the user has not yet chosen a language. */
export function isFirstOpen(): boolean {
  return localStorage.getItem(LANGUAGE_STORAGE_KEY) === null;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      de: { translation: de },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

export default i18n;
