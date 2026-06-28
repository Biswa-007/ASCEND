import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => (
  <div
    className={[
      'flex flex-col items-center justify-center text-center py-16 px-6 gap-4',
      className,
    ].join(' ')}
  >
    {icon && (
      <div className="p-4 rounded-2xl bg-gray-800/60 text-gray-500 mb-2">
        {icon}
      </div>
    )}
    <div>
      <h3 className="text-lg font-semibold text-gray-200 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-xs mx-auto">{description}</p>
      )}
    </div>
    {action && <div className="mt-2">{action}</div>}
  </div>
);
