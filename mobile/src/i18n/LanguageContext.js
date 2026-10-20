// Language Context - إدارة اللغة في التطبيق
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { translations, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, getTranslation } from './translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [isRTL, setIsRTL] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language on startup
  useEffect(() => {
    loadSavedLanguage();
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const [appLanguage, legacyLanguage] = await Promise.all([
        AsyncStorage.getItem('app_language'),
        AsyncStorage.getItem('saqr_language'),
      ]);
      const savedLanguage = appLanguage || legacyLanguage;
      if (savedLanguage && translations[savedLanguage]) {
        setLanguageState(savedLanguage);
        const langConfig = SUPPORTED_LANGUAGES.find(l => l.code === savedLanguage);
        setIsRTL(langConfig?.rtl || false);
      }
    } catch (error) {
      console.log('Error loading language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setLanguage = async (langCode) => {
    try {
      if (!translations[langCode]) {
        console.warn(`Language ${langCode} not supported`);
        return;
      }

      // Save to storage
      await AsyncStorage.setItem('app_language', langCode);
      await AsyncStorage.setItem('saqr_language', langCode);
      
      // Update state
      setLanguageState(langCode);
      
      // Update RTL
      const langConfig = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
      const newIsRTL = langConfig?.rtl || false;
      setIsRTL(newIsRTL);
      
      // Note: In production, you might need to restart the app for RTL to take effect
      // I18nManager.forceRTL(newIsRTL);
      
      console.log(`Language changed to: ${langCode}, RTL: ${newIsRTL}`);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  // Translation function
  const t = (key) => getTranslation(language, key);

  // Get all translations
  const allTranslations = translations[language] || translations[DEFAULT_LANGUAGE];

  const value = {
    language,
    setLanguage,
    isRTL,
    isLoading,
    t,
    translations: allTranslations,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook to use language
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
