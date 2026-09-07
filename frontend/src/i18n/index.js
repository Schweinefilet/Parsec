// The public face of the i18n layer.
//
// Split three ways on purpose: the provider is a component and lives alone so
// fast refresh can reload it, the context and its hooks have no JSX and are
// reachable from plain modules, and this file is the one import path the rest
// of the app uses.

export { I18nProvider } from './I18nProvider';
export { useI18n, useT, I18nContext, intlTag } from './context';
export { LOCALES, DEFAULT_LOCALE, localeByCode, isLocale } from './locales';
export { loadLocale } from './load';
