import { ReactNode } from 'react';
import { POSHeader } from './POSHeader';

interface POSLayoutProps {
  children: ReactNode;
  userName?: string;
  userRole?: string;
  showHeader?: boolean;
  onLogout?: () => void;
  logoutDisabled?: boolean;
}

export function POSLayout({ 
  children, 
  userName,
  userRole,
  showHeader = true,
  onLogout,
  logoutDisabled = false
}: POSLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showHeader && (
        <POSHeader userName={userName} userRole={userRole} onLogout={onLogout} logoutDisabled={logoutDisabled} />
      )}
      <main className="flex-1 flex overflow-hidden">
        {children}
      </main>
    </div>
  );
}
