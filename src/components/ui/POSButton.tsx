import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'success' | 'danger' | 'warning' | 'accent' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface POSButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'btn-pos-primary',
  success: 'btn-pos-success',
  danger: 'btn-pos-danger',
  warning: 'btn-pos-warning',
  accent: 'btn-pos-accent',
  secondary: 'btn-pos-secondary',
  ghost: 'btn-pos-ghost',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'btn-pos-sm',
  md: 'btn-pos-md',
  lg: 'btn-pos-lg',
  xl: 'btn-pos-xl',
};

export const POSButton = forwardRef<HTMLButtonElement, POSButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'lg',
    icon: Icon,
    iconPosition = 'left',
    fullWidth = false,
    loading = false,
    disabled,
    children,
    ...props 
  }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'btn-pos',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <>
            {Icon && iconPosition === 'left' && <Icon className="h-5 w-5" />}
            {children}
            {Icon && iconPosition === 'right' && <Icon className="h-5 w-5" />}
          </>
        )}
      </button>
    );
  }
);

POSButton.displayName = 'POSButton';
