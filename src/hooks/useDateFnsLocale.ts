/**
 * useDateFnsLocale
 *
 * Returns the correct date-fns locale object for the currently active language.
 * Use this wherever date-fns `format()` is called so dates display in the
 * user's language (e.g. "Juni" instead of "June" in German).
 *
 * Usage:
 *   const locale = useDateFnsLocale();
 *   format(date, 'MMMM d, yyyy', { locale });
 */

import { useTranslation } from 'react-i18next';
import { de, enUS } from 'date-fns/locale';

export function useDateFnsLocale() {
  const { i18n } = useTranslation();
  return i18n.language === 'de' ? de : enUS;
}
