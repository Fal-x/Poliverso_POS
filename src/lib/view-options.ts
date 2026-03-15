import type { UserRole } from '@/types/pos.types';

type ViewOption = {
  key: string;
  label: string;
  onClick: () => void;
};

export function buildViewOptions(role: UserRole | undefined, navigate: (path: string) => void): ViewOption[] {
  if (role === 'admin') {
    return [
      { key: 'admin', label: 'Administración', onClick: () => navigate('/admin') },
      { key: 'supervisor', label: 'Supervisor', onClick: () => navigate('/supervisor') },
      { key: 'cashier', label: 'Cajero', onClick: () => navigate('/cashier') },
      { key: 'programs', label: 'Programas', onClick: () => navigate('/programs') },
    ];
  }

  if (role === 'supervisor') {
    return [
      { key: 'supervisor', label: 'Supervisor', onClick: () => navigate('/supervisor') },
      { key: 'cashier', label: 'Cajero', onClick: () => navigate('/cashier') },
      { key: 'programs', label: 'Programas', onClick: () => navigate('/programs') },
    ];
  }

  return [
    { key: 'cashier', label: 'Cajero', onClick: () => navigate('/cashier') },
  ];
}
