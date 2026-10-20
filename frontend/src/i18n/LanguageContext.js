/**
 * Language Context for i18n support
 * Supports: Arabic (ar), English (en), French (fr), Turkish (tr)
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import translations from './translations';

const LanguageContext = createContext();

const RTL_LANGUAGES = ['ar', 'ur'];

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Check localStorage for saved language
    const saved = localStorage.getItem('saqr_language');
    return saved || 'ar';
  });

  useEffect(() => {
    // Save language preference
    localStorage.setItem('saqr_language', language);
    
    // Update document direction
    const isRTL = RTL_LANGUAGES.includes(language);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key) => {
    return translations[language]?.[key] || translations['en']?.[key] || translations['ar'][key] || key;
  };

  const changeLanguage = (lang) => {
    if (availableLanguages.includes(lang)) {
      setLanguage(lang);
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'ar' ? 'en' : 'ar');
  };

  const availableLanguages = ['ar', 'en', 'fr', 'tr', 'ur', 'hi'];
  const isRTL = RTL_LANGUAGES.includes(language);

  return (
    <LanguageContext.Provider value={{ 
      language, 
      setLanguage,
      changeLanguage,
      toggleLanguage, 
      t, 
      isRTL,
      availableLanguages 
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export default LanguageContext;
