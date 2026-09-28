import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ta from './locales/ta.json';

// Get saved language from localStorage or default to English
const savedLanguage = localStorage.getItem('appLanguage') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en
      },
      ta: {
        translation: ta
      }
    },
    lng: savedLanguage, // Default language
    fallbackLng: 'en', // Fallback language if translation is missing
    interpolation: {
      escapeValue: false // React already escapes values
    },
    react: {
      useSuspense: false // Disable suspense for now
    }
  });

export default i18n;
