import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconBrandGithub, IconRocket } from '@tabler/icons-react';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (name: string, repoUrl: string) => Promise<void>;
  defaultName?: string;
  defaultRepoUrl?: string;
  /** If projectId is given, we're deploying an existing project (no name/repo needed) */
  mode?: 'create' | 'deploy';
  loading?: boolean;
}

export const DeployModal: React.FC<DeployModalProps> = ({
  isOpen,
  onClose,
  onDeploy,
  defaultName = '',
  defaultRepoUrl = '',
  mode = 'create',
  loading = false,
}) => {
  const [name, setName] = useState(defaultName);
  const [repoUrl, setRepoUrl] = useState(defaultRepoUrl);
  const [errors, setErrors] = useState<{ name?: string; repoUrl?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (mode === 'create' && !name.trim()) e.name = 'Project name is required';
    if (!repoUrl.trim()) e.repoUrl = 'Repository URL is required';
    else if (!/^https?:\/\/.+/.test(repoUrl)) e.repoUrl = 'Must be a valid URL (https://...)';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onDeploy(name.trim(), repoUrl.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Create & Deploy Project' : 'Deploy Project'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            leftIcon={<IconRocket size={16} />}
          >
            {mode === 'create' ? 'Create & Deploy' : 'Deploy Now'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === 'create' && (
          <Input
            label="Project Name"
            placeholder="my-awesome-app"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            id="deploy-project-name"
          />
        )}
        <Input
          label="GitHub Repository URL"
          placeholder="https://github.com/username/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          error={errors.repoUrl}
          leftAddon={<IconBrandGithub size={16} />}
          id="deploy-repo-url"
        />
        <p className="text-xs text-gray-500">
          Ascend will clone your repository and build + deploy it automatically.
        </p>
      </form>
    </Modal>
  );
};
