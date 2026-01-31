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
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/30',
  success: 'bg-success text-success-foreground hover:bg-success/90 shadow-lg shadow-success/30',
  danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/30',
  warning: 'bg-warning text-warning-foreground hover:bg-warning/90 shadow-lg shadow-warning/30',
  accent: 'bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/30',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border',
  ghost: 'bg-transparent hover:bg-secondary text-foreground',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 min-h-[36px] text-sm gap-1.5',
  md: 'px-4 py-3 min-h-[44px] text-base gap-2',
  lg: 'px-6 py-4 min-h-[56px] text-lg gap-2',
  xl: 'px-8 py-5 min-h-[68px] text-xl gap-3',
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
          'inline-flex items-center justify-center rounded-xl font-semibold',
          'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring',
          'focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98]',
          'disabled:opacity-50 disabled:pointer-events-none',
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
