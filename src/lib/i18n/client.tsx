"use client";

import { createContext, useContext } from "react";
import {
  DEFAULT_LOCALE,
  getDictionary,
  type Dictionary,
  type Locale,
} from "./index";

const I18nContext = createContext<{ locale: Locale; dict: Dictionary }>({
  locale: DEFAULT_LOCALE,
  dict: getDictionary(DEFAULT_LOCALE),
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <I18nContext.Provider value={{ locale, dict: getDictionary(locale) }}>
      {children}
    </I18nContext.Provider>
  );
}

/** Client-side counterpart of getI18n(). */
export function useI18n() {
  return useContext(I18nContext);
}
