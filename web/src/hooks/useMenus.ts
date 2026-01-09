import { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { useAuth } from './useAuth';

export interface MenuItem {
  id: number;
  parent_id?: number | null;
  menu_code: string;
  label: string;
  path?: string | null;
  icon_name?: string | null;
  description?: string | null;
  display_order: number;
  is_active: boolean;
  admin_only: boolean;
  items?: MenuItem[];
}

export interface PrimaryMenu {
  id: string;
  label: string;
  items: MenuItem[];
}

export const useMenus = () => {
  const [menus, setMenus] = useState<PrimaryMenu[]>([]);
  const [flatMenus, setFlatMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchMenus = async () => {
      try {
        setLoading(true);
        const response = await apiCall('/api/menus');
        
        if (!response.ok) {
          throw new Error('메뉴를 불러오는데 실패했습니다.');
        }
        
        const data = await response.json();
        
        if (data.success) {
          // 계층 구조 메뉴
          const hierarchicalMenus: PrimaryMenu[] = data.menus.map((menu: MenuItem) => ({
            id: menu.menu_code,
            label: menu.label,
            items: menu.items || []
          }));
          
          setMenus(hierarchicalMenus);
          setFlatMenus(data.flatMenus || []);
        } else {
          throw new Error(data.error || '메뉴를 불러오는데 실패했습니다.');
        }
      } catch (err: any) {
        console.error('메뉴 로드 오류:', err);
        setError(err.message || '메뉴를 불러오는데 실패했습니다.');
        // 오류 발생 시 빈 배열 설정
        setMenus([]);
        setFlatMenus([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMenus();
  }, [user]);

  return { menus, flatMenus, loading, error };
};

