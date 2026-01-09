import React from 'react';
import AppHeader from './AppHeader';

interface PageLayoutProps {
  children: React.ReactNode;
  user?: {
    id: number;
    userid: string;
    fullName: string;
    email: string;
    isAdmin: boolean;
  } | null;
  onLogout: () => void;
  onLogin: () => void;
  isLoggedIn: boolean;
}

const PageLayout: React.FC<PageLayoutProps> = ({ 
  children, 
  user, 
  onLogout, 
  onLogin, 
  isLoggedIn 
}) => {
  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={onLogout} 
        onLogin={onLogin} 
        isLoggedIn={isLoggedIn}
        onTitleClick={() => window.location.href = '/'}
      />
      <main className="app-main">
        <div className="page-container">
          {children}
        </div>
      </main>
    </div>
  );
};

export default PageLayout;
