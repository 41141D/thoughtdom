import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ku', 'ar'],
  defaultLocale: 'en',
  // Always show the locale prefix in the URL, e.g. /en, /ku/why
  localePrefix: 'always'
});
