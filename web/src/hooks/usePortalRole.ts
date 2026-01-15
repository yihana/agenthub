import { useCallback, useEffect, useState } from 'react';

const ROLE_STORAGE_KEY = 'portal-role';

export type PortalRole = 'user' | 'admin';

export const usePortalRole = () => {
  const [role, setRole] = useState<PortalRole>('user');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = window.localStorage.getItem(ROLE_STORAGE_KEY) as PortalRole | null;
    if (stored === 'admin' || stored === 'user') {
      setRole(stored);
    }
  }, []);

  const toggleRole = useCallback(() => {
    setRole((prev) => {
      const nextRole: PortalRole = prev === 'admin' ? 'user' : 'admin';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
      }
      return nextRole;
    });
  }, []);

  return { role, toggleRole };
};
