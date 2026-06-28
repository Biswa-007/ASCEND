import React from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IconSearch, IconX } from '@tabler/icons-react';

interface LogSearchProps {
  value: string;
  onChange: (value: string) => void;
  resultCount?: number;
}

export const LogSearch: React.FC<LogSearchProps> = ({ value, onChange, resultCount }) => (
  <div className="flex items-center gap-2">
    <div className="relative flex-1 max-w-xs">
      <Input
        placeholder="Search logs…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        leftAddon={<IconSearch size={14} />}
        rightAddon={
          value ? (
            <button
              onClick={() => onChange('')}
              className="text-gray-500 hover:text-gray-300 transition-colors"
            >
              <IconX size={14} />
            </button>
          ) : undefined
        }
        id="log-search-input"
      />
    </div>
    {value && resultCount !== undefined && (
      <span className="text-xs text-gray-500 shrink-0">
        {resultCount} {resultCount === 1 ? 'match' : 'matches'}
      </span>
    )}
    {value && (
      <Button size="sm" variant="ghost" onClick={() => onChange('')}>
        Clear
      </Button>
    )}
  </div>
);
