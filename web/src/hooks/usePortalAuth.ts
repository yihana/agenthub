import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface PortalUser {
  id: number;
  userid: string;
  fullName: string;
  email?: string;
  companyCode?: string;
  roles: string[];
  permissions: string[];
  isAdmin: boolean;
}

const TOKEN_KEY = 'portal-token';

export const usePortalAuth = () => {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const verifyToken = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setIsLoggedIn(false);
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/portal-auth/verify', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        localStorage.removeItem(TOKEN_KEY);
        setIsLoggedIn(false);
        setUser(null);
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      setUser(data.user);
      setIsLoggedIn(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Portal auth verify error:', error);
      localStorage.removeItem(TOKEN_KEY);
      setIsLoggedIn(false);
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    verifyToken();
  }, [verifyToken]);

  const login = useCallback(
    async (userid: string, password: string) => {
      const response = await fetch('/api/portal-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid, password })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '로그인에 실패했습니다.');
      }

      const data = await response.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      setIsLoggedIn(true);

      const redirectTo = (location.state as { from?: string } | null)?.from || '/portal-dashboard';
      navigate(redirectTo);
    },
    [location.state, navigate]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setIsLoggedIn(false);
    navigate('/portal-login');
  }, [navigate]);

  return {
    user,
    isLoggedIn,
    isLoading,
    login,
    logout
  };
};
