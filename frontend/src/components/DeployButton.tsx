import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { DeployModal } from './DeployModal';
import { IconRocket } from '@tabler/icons-react';

interface DeployButtonProps {
  onDeploy: (name: string, repoUrl: string) => Promise<void>;
  defaultRepoUrl?: string;
  defaultName?: string;
  mode?: 'create' | 'deploy';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const DeployButton: React.FC<DeployButtonProps> = ({
  onDeploy,
  defaultRepoUrl = '',
  defaultName = '',
  mode = 'deploy',
  size = 'md',
  label = 'Deploy',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDeploy = async (name: string, repoUrl: string) => {
    setLoading(true);
    try {
      await onDeploy(name, repoUrl);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        size={size}
        leftIcon={<IconRocket size={14} />}
        onClick={() => setIsOpen(true)}
      >
        {label}
      </Button>
      <DeployModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onDeploy={handleDeploy}
        defaultName={defaultName}
        defaultRepoUrl={defaultRepoUrl}
        mode={mode}
        loading={loading}
      />
    </>
  );
};
