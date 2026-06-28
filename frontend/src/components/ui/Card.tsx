import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  noPadding?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  header,
  footer,
  noPadding = false,
  onClick,
}) => {
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      className={[
        'rounded-xl border border-gray-800 bg-gray-900/80 backdrop-blur-sm',
        'shadow-lg shadow-black/20',
        'flex flex-col',
        isClickable
          ? 'cursor-pointer transition-all duration-200 hover:border-brand-700/50 hover:shadow-brand-900/20 hover:bg-gray-900'
          : '',
        className,
      ].join(' ')}
    >
      {header && (
        <div className="px-5 py-4 border-b border-gray-800/70 flex items-center justify-between">
          {header}
        </div>
      )}
      <div className={noPadding ? '' : 'p-5 flex-1'}>
        {children}
      </div>
      {footer && (
        <div className="px-5 py-3 border-t border-gray-800/70 bg-gray-950/30 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
};
