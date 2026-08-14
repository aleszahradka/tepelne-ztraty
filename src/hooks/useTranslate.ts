import { useHeatLossStore } from '../store';
import { cs } from '../locales/cs';
import { en } from '../locales/en';

export function getLocalized(field: string | { cs: string; en: string } | undefined, lang: 'cs' | 'en'): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field['cs'] || field['en'] || '';
}

export function useTranslate() {
  const language = useHeatLossStore((state) => state.language);
  const translations = language === 'cs' ? cs : en;

  return {
    t: translations,
    language,
    setLanguage: useHeatLossStore((state) => state.setLanguage),
    getLocalized: (field: string | { cs: string; en: string } | undefined) => getLocalized(field, language)
  };
}
