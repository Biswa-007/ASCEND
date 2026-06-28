import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { IconHome, IconRocket } from '@tabler/icons-react';

const NotFound: React.FC = () => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/5 rounded-full blur-3xl" />
    </div>

    <div className="relative text-center animate-fade-in">
      <div className="text-[8rem] font-black text-gray-800 leading-none select-none">404</div>
      <div className="flex justify-center mb-4 -mt-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-600/20 border border-brand-800/30 text-brand-400">
          <IconRocket size={28} />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-gray-100 mb-2">Page not found</h1>
      <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/dashboard">
        <Button variant="primary" leftIcon={<IconHome size={16} />} size="lg">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  </div>
);

export default NotFound;
