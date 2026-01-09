import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/utility.css';

interface RouteGuardProps {
  children: React.ReactNode;
}

const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    const checkMenuAccess = async () => {
      // 로그인되지 않은 경우 체크하지 않음 (로그인 페이지 등)
      if (!isLoggedIn) {
        setIsChecking(false);
        setIsAllowed(true);
        return;
      }

      // 메인 페이지(/)는 항상 허용
      if (location.pathname === '/') {
        setIsChecking(false);
        setIsAllowed(true);
        return;
      }

      // 로그인 페이지는 항상 허용 (IAS 없는 경우만 아래 로직 사용 일단은 코드만 남겨둠)
      // if (location.pathname === '/login') {
      //   setIsChecking(false);
      //   setIsAllowed(true);
      //   return;
      // }

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setIsChecking(false);
          setIsAllowed(true);
          return;
        }

        // 경로 인코딩하여 API 호출
        const encodedPath = encodeURIComponent(location.pathname);
        const response = await fetch(`/api/menus/check-path/${encodedPath}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.isActive) {
            // 메뉴가 활성화되어 있거나 메뉴로 등록되지 않은 경로
            setIsAllowed(true);
          } else {
            // 비활성화된 메뉴: 에러 페이지로 이동 (원인 비노출)
            setIsAllowed(false);
            navigate('/error', { replace: true });
          }
        } else {
          // API 오류 시 접근 허용 (하위 호환성)
          console.warn('메뉴 상태 확인 실패, 접근 허용:', response.status);
          setIsAllowed(true);
        }
      } catch (error) {
        console.error('메뉴 상태 확인 오류:', error);
        // 오류 시 접근 허용 (하위 호환성)
        setIsAllowed(true);
      } finally {
        setIsChecking(false);
      }
    };

    checkMenuAccess();
  }, [location.pathname, isLoggedIn, navigate]);

  if (isChecking) {
    return (
      <div className="fullpage-center">
        접근 권한 확인 중...
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
};

export default RouteGuard;

