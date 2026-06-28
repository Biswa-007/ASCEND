import React from 'react';
import { Spinner } from '@/components/ui/Spinner';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Loading: React.FC<LoadingProps> = ({
  message = 'Loading...',
  fullScreen = false,
  size = 'md',
}) => (
  <div
    className={[
      'flex flex-col items-center justify-center gap-3',
      fullScreen ? 'fixed inset-0 bg-gray-950/80 z-50' : 'py-16',
    ].join(' ')}
  >
    <Spinner size={size} className="text-brand-400" />
    {message && <p className="text-sm text-gray-400">{message}</p>}
  </div>
);
