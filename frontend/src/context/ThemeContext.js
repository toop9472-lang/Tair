import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('saqr_theme');
    return saved || 'dark';
  });

  const [systemTheme, setSystemTheme] = useState('dark');

  useEffect(() => {
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    const handler = (e) => setSystemTheme(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    localStorage.setItem('saqr_theme', theme);
    
    const effectiveTheme = theme === 'system' ? systemTheme : theme;
    
    // Apply theme to document
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(effectiveTheme);
    
    // Update CSS variables
    if (effectiveTheme === 'dark') {
      document.documentElement.style.setProperty('--bg-primary', '#0a0a0f');
      document.documentElement.style.setProperty('--bg-secondary', '#111118');
      document.documentElement.style.setProperty('--bg-card', 'rgba(17, 17, 24, 0.8)');
      document.documentElement.style.setProperty('--text-primary', '#ffffff');
      document.documentElement.style.setProperty('--text-secondary', 'rgba(255, 255, 255, 0.7)');
      document.documentElement.style.setProperty('--text-muted', 'rgba(255, 255, 255, 0.5)');
      document.documentElement.style.setProperty('--border-color', 'rgba(255, 255, 255, 0.1)');
      document.documentElement.style.setProperty('--accent-primary', '#3b82f6');
      document.documentElement.style.setProperty('--accent-secondary', '#60a5fa');
    } else {
      document.documentElement.style.setProperty('--bg-primary', '#f8fafc');
      document.documentElement.style.setProperty('--bg-secondary', '#ffffff');
      document.documentElement.style.setProperty('--bg-card', 'rgba(255, 255, 255, 0.9)');
      document.documentElement.style.setProperty('--text-primary', '#0f172a');
      document.documentElement.style.setProperty('--text-secondary', '#475569');
      document.documentElement.style.setProperty('--text-muted', '#94a3b8');
      document.documentElement.style.setProperty('--border-color', 'rgba(0, 0, 0, 0.1)');
      document.documentElement.style.setProperty('--accent-primary', '#2563eb');
      document.documentElement.style.setProperty('--accent-secondary', '#3b82f6');
    }
  }, [theme, systemTheme]);

  const effectiveTheme = theme === 'system' ? systemTheme : theme;
  const isDark = effectiveTheme === 'dark';

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const setThemeMode = (mode) => {
    setTheme(mode); // 'dark', 'light', or 'system'
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      effectiveTheme,
      isDark,
      toggleTheme,
      setThemeMode,
      colors: {
        bg: isDark ? '#0a0a0f' : '#f8fafc',
        bgSecondary: isDark ? '#111118' : '#ffffff',
        bgCard: isDark ? 'rgba(17, 17, 24, 0.8)' : 'rgba(255, 255, 255, 0.9)',
        text: isDark ? '#ffffff' : '#0f172a',
        textSecondary: isDark ? 'rgba(255, 255, 255, 0.7)' : '#475569',
        textMuted: isDark ? 'rgba(255, 255, 255, 0.5)' : '#94a3b8',
        border: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        accent: isDark ? '#3b82f6' : '#2563eb',
        accentLight: isDark ? '#60a5fa' : '#3b82f6',
      }
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
