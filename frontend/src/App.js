import React, { useEffect, useState } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { trackPageview } from "./tair/analytics";
import AuthCallback from "./components/AuthCallback";
import AuthScreen from "./tair/AuthScreen";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import AdminLogin from "./components/AdminLogin";
import AdminDashboard from "./components/AdminDashboard";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import DeleteAccountPage from "./pages/DeleteAccountPage";
import TairPage from "./pages/TairPage";
import TairShell from "./tair/TairShell";
import LegalDisclaimerGate from "./tair/LegalDisclaimerGate";
import { TermsPage as TairTermsPage, PrivacyPage as TairPrivacyPage } from "./tair/LegalPages";
import { Toaster } from "./components/ui/toaster";
import { toast } from "./hooks/use-toast";
import { LanguageProvider } from "./i18n/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";

const API_URL = process.env.REACT_APP_BACKEND_URL;
const DEVICE_ID_KEY = "tair_device_id";

// Router wrapper to detect session_id in URL
function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return <MainApp />;
}

function getOrCreateDeviceUser() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = "guest_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return {
    id,
    user_id: id,
    name: "زائر",
    email: "guest@tair.app",
    isGuest: true,
  };
}

function MainApp() {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminData, setAdminData] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("dir", "rtl");
    document.documentElement.setAttribute("lang", "ar");
  }, []);

  // Track pageviews on every route change for GA4
  useEffect(() => {
    trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const bootstrap = async () => {
      // Admin check first
      const adminToken = localStorage.getItem("admin_token");
      const savedAdmin = localStorage.getItem("admin_data");
      if (adminToken && savedAdmin) {
        setIsAdmin(true);
        setAdminData(JSON.parse(savedAdmin));
        setIsLoading(false);
        return;
      }

      // Restore Tair email-auth session from localStorage (fast path)
      try {
        const token = localStorage.getItem("user_token");
        const savedUser = localStorage.getItem("tair_user");
        if (token && savedUser) {
          const u = JSON.parse(savedUser);
          setUser(u);
          setIsLoading(false);
          return;
        }
      } catch (e) { /* ignore */ }

      // Legacy cookie-based session (for older accounts)
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data;
          setUser(userData);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        // ignore
      }

      // Fallback: auto-guest based on device id
      setUser(getOrCreateDeviceUser());
      setIsLoading(false);
    };
    bootstrap();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem("user_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("tair_user");
    // Reset to fresh guest (do NOT wipe device id so their data persists)
    setUser(getOrCreateDeviceUser());
    toast({ title: "تم تسجيل الخروج", description: "نراك قريباً!" });
  };

  const handleAdminLogin = (admin) => {
    setIsAdmin(true);
    setAdminData(admin);
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_data");
    setIsAdmin(false);
    setAdminData(null);
    toast({ title: "تم تسجيل الخروج", description: "نراك قريباً!" });
  };

  if (isLoading) {
    return (
      <div style={loaderStyles.wrap}>
        <div style={loaderStyles.card}>
          <img src="/tair_logo.png" alt="طير" style={loaderStyles.logo} />
          <p style={loaderStyles.text}>جاري التحميل…</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Admin */}
      <Route
        path="/admin/login"
        element={
          isAdmin ? (
            <Navigate to="/admin/dashboard" />
          ) : (
            <div className="dark admin-shell">
              <AdminLogin onAdminLogin={handleAdminLogin} />
            </div>
          )
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          isAdmin ? (
            <div className="dark admin-shell">
              <AdminDashboard admin={adminData} onLogout={handleAdminLogout} />
            </div>
          ) : (
            <Navigate to="/admin/login" />
          )
        }
      />

      {/* Static */}
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/delete-account" element={<DeleteAccountPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/landing" element={<TairPage />} />
      <Route path="/legal/terms" element={<TairTermsPage onBack={() => window.history.back()} />} />
      <Route path="/legal/privacy" element={<TairPrivacyPage onBack={() => window.history.back()} />} />

      {/* Auth (phone OTP + guest) */}
      <Route
        path="/auth"
        element={<AuthGate onLoginSuccess={setUser} />}
      />

      {/* Main App (Tair) — no auth wall, guest by default */}
      <Route
        path="/*"
        element={
          <LegalDisclaimerGate onNavigate={(p) => window.location.assign(`/legal/${p}`)}>
            <TairShell user={user} onLogout={handleLogout} onSetUser={setUser} />
          </LegalDisclaimerGate>
        }
      />
    </Routes>
  );
}

const loaderStyles = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f9fafb",
  },
  card: { textAlign: "center" },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
    animation: "tair-pulse 1.4s ease-in-out infinite",
  },
  text: {
    color: "#6b7280",
    fontSize: 14,
    marginTop: 14,
    fontWeight: 600,
    fontFamily: "'Tajawal', system-ui",
  },
};

function AppFrame() {
  const { pathname } = useLocation();
  return (
    <div className={pathname.startsWith("/admin") ? "App App--wide" : "App"}>
      <AppRouter />
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <AppFrame />
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
}

function AuthGate({ onLoginSuccess }) {
  const navigate = useNavigate();
  const handleSuccess = (userData) => {
    onLoginSuccess(userData);
    navigate("/", { replace: true });
  };
  const handleGuest = () => {
    // Just navigate home — App.js bootstrap creates a guest automatically.
    navigate("/", { replace: true });
  };
  return <AuthScreen onSuccess={handleSuccess} onGuest={handleGuest} />;
}

export default App;
