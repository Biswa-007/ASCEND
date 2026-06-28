import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftAddon, rightAddon, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-300"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3 text-gray-400 pointer-events-none">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full rounded-lg border bg-gray-900 text-gray-100 placeholder-gray-500',
              'px-3 py-2 text-sm transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500',
              error
                ? 'border-red-700 focus:ring-red-500/30 focus:border-red-500'
                : 'border-gray-700 hover:border-gray-600',
              leftAddon ? 'pl-10' : '',
              rightAddon ? 'pr-10' : '',
              className,
            ].join(' ')}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 text-gray-400">
              {rightAddon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-gray-500">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
