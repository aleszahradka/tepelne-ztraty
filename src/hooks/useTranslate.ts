import { useHeatLossStore } from '../store';
import { cs } from '../locales/cs';
import { en } from '../locales/en';

export function useTranslate() {
  const language = useHeatLossStore((state) => state.language);
  const translations = language === 'cs' ? cs : en;

  return {
    t: translations,
    language,
    setLanguage: useHeatLossStore((state) => state.setLanguage)
  };
}
