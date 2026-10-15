import React, { createContext, useContext, useState, useEffect } from "react";
import { UI_TRANSLATIONS } from "../constants/translations";

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem("cdss_language") || "en";
  });

  const setLanguage = (lang) => {
    if (["en", "hi", "mr", "gu"].includes(lang)) {
      setLanguageState(lang);
      localStorage.setItem("cdss_language", lang);
    }
  };

  const t = (key) => {
    const langDict = UI_TRANSLATIONS[language] || UI_TRANSLATIONS.en;
    return langDict[key] || UI_TRANSLATIONS.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    return {
      language: "en",
      setLanguage: () => {},
      t: (k) => k,
    };
  }
  return context;
}
