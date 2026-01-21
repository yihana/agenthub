import { useCallback, useEffect, useState } from 'react';

const ROLE_STORAGE_KEY = 'portal-role';
const COMPANY_STORAGE_KEY = 'portal-company';

export type PortalRole = 'system_admin' | 'operator_admin' | 'operator' | 'user';

export const roleLabels: Record<PortalRole, string> = {
  system_admin: '시스템 관리자',
  operator_admin: '운영 관리자',
  operator: '운영자',
  user: '사용자'
};

export const companyOptions = ['Hana Tech', 'Nova Systems', 'Zen Finance'] as const;
export type PortalCompany = typeof companyOptions[number];

export const usePortalRole = () => {
  const [role, setRole] = useState<PortalRole>('user');
  const [company, setCompany] = useState<PortalCompany>('Hana Tech');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const stored = window.localStorage.getItem(ROLE_STORAGE_KEY) as PortalRole | null;
    if (stored === 'system_admin' || stored === 'operator_admin' || stored === 'operator' || stored === 'user') {
      setRole(stored);
    }
    const storedCompany = window.localStorage.getItem(COMPANY_STORAGE_KEY) as PortalCompany | null;
    if (storedCompany && companyOptions.includes(storedCompany)) {
      setCompany(storedCompany);
    }
  }, []);

  const updateRole = useCallback((nextRole: PortalRole) => {
    setRole(nextRole);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ROLE_STORAGE_KEY, nextRole);
    }
  }, []);

  const updateCompany = useCallback((nextCompany: PortalCompany) => {
    setCompany(nextCompany);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COMPANY_STORAGE_KEY, nextCompany);
    }
  }, []);

  return { role, company, updateRole, updateCompany };
};
