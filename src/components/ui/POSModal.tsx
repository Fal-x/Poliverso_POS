import { ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { POSButton } from './POSButton';

type ModalType = 'default' | 'success' | 'error' | 'warning' | 'info';
type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface POSModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  type?: ModalType;
  size?: ModalSize;
  children: ReactNode;
  showClose?: boolean;
  footer?: ReactNode;
}

const typeStyles: Record<ModalType, { icon: typeof AlertTriangle; color: string }> = {
  default: { icon: Info, color: 'text-primary' },
  success: { icon: CheckCircle, color: 'text-success' },
  error: { icon: XCircle, color: 'text-destructive' },
  warning: { icon: AlertTriangle, color: 'text-warning' },
  info: { icon: Info, color: 'text-primary' },
};

const sizeStyles: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] w-full',
};

export function POSModal({
  isOpen,
  onClose,
  title,
  type = 'default',
  size = 'md',
  children,
  showClose = true,
  footer,
}: POSModalProps) {
  if (!isOpen) return null;

  const { icon: Icon, color } = typeStyles[type];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={cn('modal-content w-full', sizeStyles[size])}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between p-6 md:p-8 border-b border-border">
            <div className="flex items-center gap-3">
              {type !== 'default' && <Icon className={cn('h-6 w-6', color)} />}
              {title && <h2 className="text-xl font-semibold">{title}</h2>}
            </div>
            {showClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6 md:p-8">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-6 md:p-8 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Modal de error predefinido
interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  details?: string;
}

export function ErrorModal({ 
  isOpen, 
  onClose, 
  title = "Error", 
  message, 
  details 
}: ErrorModalProps) {
  return (
    <POSModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      type="error"
      footer={
        <POSButton variant="danger" onClick={onClose}>
          Cerrar
        </POSButton>
      }
    >
      <div className="space-y-4">
        <p className="text-lg">{message}</p>
        {details && (
          <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20">
            <p className="text-sm text-muted-foreground font-mono">{details}</p>
          </div>
        )}
      </div>
    </POSModal>
  );
}

// Modal de confirmación predefinido
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar",
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = 'primary',
  loading = false,
}: ConfirmModalProps) {
  return (
    <POSModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      type={variant === 'danger' ? 'warning' : 'default'}
      footer={
        <>
          <POSButton variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </POSButton>
          <POSButton variant={variant} onClick={onConfirm} loading={loading}>
            {confirmText}
          </POSButton>
        </>
      }
    >
      <p className="text-lg">{message}</p>
    </POSModal>
  );
}

// Modal de sincronización
interface SyncModalProps {
  isOpen: boolean;
  status: 'syncing' | 'success' | 'error';
  message?: string;
}

export function SyncModal({ isOpen, status, message }: SyncModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content p-8 text-center">
        {status === 'syncing' && (
          <>
            <div className="h-16 w-16 mx-auto mb-4 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-lg font-medium">{message || 'Sincronizando...'}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-success" />
            <p className="text-lg font-medium">{message || 'Sincronización exitosa'}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-medium">{message || 'Error de sincronización'}</p>
          </>
        )}
      </div>
    </div>
  );
}
