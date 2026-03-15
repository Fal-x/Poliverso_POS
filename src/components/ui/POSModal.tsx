import { ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
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
  overlayClassName?: string;
  contentClassName?: string;
  bodyClassName?: string;
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
  overlayClassName,
  contentClassName,
  bodyClassName,
}: POSModalProps) {
  const { icon: Icon, color } = typeStyles[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className={cn('modal-overlay', overlayClassName)}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn('modal-content relative overflow-hidden w-full', sizeStyles[size], contentClassName)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-100/60 to-transparent" />
            <div className="relative z-10">
            {/* Header */}
            {(title || showClose) && (
              <div className="flex items-center justify-between px-6 py-2 md:px-7 md:py-2.5 border-b border-border/50">
                <div className="flex items-center gap-3">
                  {type !== 'default' && <Icon className={cn('h-6 w-6', color)} />}
                  {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
                </div>
                {showClose && (
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div className={cn('px-6 pt-3 pb-6 md:px-8 md:pt-4 md:pb-8', bodyClassName)}>
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 p-6 md:p-8 border-t border-border">
                {footer}
              </div>
            )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="modal-overlay"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="modal-content p-8 text-center"
          >
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
