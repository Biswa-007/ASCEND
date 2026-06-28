import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { IconAlertTriangle } from '@tabler/icons-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  loading = false,
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    size="sm"
    footer={
      <>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="flex flex-col items-center gap-4 text-center py-2">
      <div className="p-3 rounded-xl bg-red-950/40 text-red-400">
        <IconAlertTriangle size={28} />
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-100 mb-1">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>
      </div>
    </div>
  </Modal>
);
