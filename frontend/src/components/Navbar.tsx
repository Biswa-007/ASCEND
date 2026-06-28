import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/context/AuthContext';
import {
  IconRocket,
  IconLayoutDashboard,
  IconFolder,
  IconLogout,
  IconChevronDown,
  IconUser,
} from '@tabler/icons-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
      isActive
        ? 'bg-brand-600/20 text-brand-400 border border-brand-700/30'
        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60',
    ].join(' ');

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 text-gray-100 hover:text-white transition-colors"
          >
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 shadow-lg shadow-brand-900/30">
              <IconRocket size={18} stroke={2} />
            </div>
            <span className="font-bold text-base tracking-tight gradient-text">Ascend</span>
          </Link>

          {/* Nav links */}
          <div className="hidden sm:flex items-center gap-1">
            <NavLink to="/dashboard" className={navLinkClass}>
              <IconLayoutDashboard size={16} />
              Dashboard
            </NavLink>
            <NavLink to="/projects" className={navLinkClass}>
              <IconFolder size={16} />
              Projects
            </NavLink>
          </div>

          {/* User menu */}
          {user && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:text-gray-100 hover:bg-gray-800/60 transition-colors border border-transparent hover:border-gray-700/50"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-brand-400 to-violet-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {user.email[0].toUpperCase()}
                </div>
                <span className="hidden sm:block max-w-[160px] truncate">{user.email}</span>
                <IconChevronDown
                  size={14}
                  className={['transition-transform duration-200', menuOpen ? 'rotate-180' : ''].join(' ')}
                />
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-800 bg-gray-900 shadow-xl shadow-black/40 py-1 animate-slide-up">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <div className="flex items-center gap-2 text-gray-400">
                      <IconUser size={14} />
                      <p className="text-xs truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-colors"
                  >
                    <IconLogout size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};
