import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default:  'bg-gray-800 text-gray-300 border-gray-700',
  success:  'bg-green-950/60 text-green-400 border-green-900/60',
  warning:  'bg-amber-950/60 text-amber-400 border-amber-900/60',
  danger:   'bg-red-950/60 text-red-400 border-red-900/60',
  info:     'bg-blue-950/60 text-blue-400 border-blue-900/60',
  purple:   'bg-purple-950/60 text-purple-400 border-purple-900/60',
};

const dotClasses: Record<BadgeVariant, string> = {
  default:  'bg-gray-400',
  success:  'bg-green-400',
  warning:  'bg-amber-400',
  danger:   'bg-red-400',
  info:     'bg-blue-400',
  purple:   'bg-purple-400',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs gap-1.5',
  md: 'px-2.5 py-1 text-sm gap-2',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  pulse = false,
  className = '',
}) => (
  <span
    className={[
      'inline-flex items-center font-medium rounded-full border',
      variantClasses[variant],
      sizeClasses[size],
      className,
    ].join(' ')}
  >
    {dot && (
      <span className="relative flex shrink-0 h-1.5 w-1.5">
        {pulse && (
          <span
            className={[
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              dotClasses[variant],
            ].join(' ')}
          />
        )}
        <span className={['relative inline-flex rounded-full h-1.5 w-1.5', dotClasses[variant]].join(' ')} />
      </span>
    )}
    {children}
  </span>
);
