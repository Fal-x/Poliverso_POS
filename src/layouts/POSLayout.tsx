import { ReactNode } from 'react';
import { POSHeader } from './POSHeader';

type HeaderViewOption = {
  key: string;
  label: string;
  onClick: () => void;
};

interface POSLayoutProps {
  children: ReactNode;
  userName?: string;
  userRole?: string;
  currentViewLabel?: string;
  showHeader?: boolean;
  onLogout?: () => void;
  logoutDisabled?: boolean;
  viewOptions?: HeaderViewOption[];
}

export function POSLayout({ 
  children, 
  userName,
  userRole,
  currentViewLabel,
  showHeader = true,
  onLogout,
  logoutDisabled = false,
  viewOptions = []
}: POSLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {showHeader && (
        <POSHeader
          userName={userName}
          userRole={userRole}
          currentViewLabel={currentViewLabel}
          onLogout={onLogout}
          logoutDisabled={logoutDisabled}
          viewOptions={viewOptions}
        />
      )}
      <main className="flex-1 flex overflow-hidden bg-background">
        {children}
      </main>
    </div>
  );
}
