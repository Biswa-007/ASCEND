import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { IconBrandGithub } from '@tabler/icons-react';

interface ProjectFormProps {
  initialName?: string;
  initialRepoUrl?: string;
  onSubmit: (name: string, repoUrl: string) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  loading?: boolean;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({
  initialName = '',
  initialRepoUrl = '',
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  loading = false,
}) => {
  const [name, setName] = useState(initialName);
  const [repoUrl, setRepoUrl] = useState(initialRepoUrl);
  const [errors, setErrors] = useState<{ name?: string; repoUrl?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!repoUrl.trim()) e.repoUrl = 'Repository URL is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit(name.trim(), repoUrl.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Project Name"
        placeholder="my-app"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        id="project-form-name"
      />
      <Input
        label="GitHub Repository URL"
        placeholder="https://github.com/username/repo"
        value={repoUrl}
        onChange={(e) => setRepoUrl(e.target.value)}
        error={errors.repoUrl}
        leftAddon={<IconBrandGithub size={16} />}
        id="project-form-repo"
      />
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" variant="primary" loading={loading}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
};
