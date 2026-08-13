import {createSharedPathnamesNavigation} from 'next-intl/navigation';
import {routing} from './routing';

// Same pathnames across all locales (e.g. /login is /login in both en and ku),
// just prefixed with the locale segment. Use these instead of next/link and
// next/navigation anywhere a link should stay locale-aware.
export const {Link, redirect, usePathname, useRouter} = createSharedPathnamesNavigation(routing);
