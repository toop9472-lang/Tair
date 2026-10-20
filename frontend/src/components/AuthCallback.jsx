import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * AuthCallback Component
 * Processes session_id from Emergent Auth and creates user session
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = location.hash;
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        
        if (!sessionIdMatch) {
          console.error('No session_id found in URL');
          navigate('/login', { replace: true });
          return;
        }

        const sessionId = sessionIdMatch[1];

        // Call backend to process session
        const response = await fetch(`${API_URL}/api/auth/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ session_id: sessionId }),
        });

        if (!response.ok) {
          throw new Error('Failed to process session');
        }

        const data = await response.json();

        // Store user token for API calls (if provided)
        if (data.token) {
          localStorage.setItem('user_token', data.token);
        }

        // Navigate to home with user data
        navigate('/', { 
          replace: true, 
          state: { user: data.user } 
        });

      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/login', { replace: true });
      }
    };

    processAuth();
  }, [navigate, location.hash]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center animate-pulse">
          <img src="/logo_saqr.png" alt="صقر" className="w-10 h-10 object-contain" />
        </div>
        <p className="text-gray-600 text-lg">جاري تسجيل الدخول...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
