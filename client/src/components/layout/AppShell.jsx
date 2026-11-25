import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ChevronDown,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Search,
  User,
  X,
} from 'lucide-react';
import Logo from '../Logo';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { initials } from '../../lib/format';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/scan', label: 'Scan a URL', icon: Search },
  { to: '/history', label: 'Scan history', icon: History },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: User },
];

function SidebarNav({ isAdmin, onNavigate }) {
  const items = isAdmin ? [...NAV, { to: '/admin', label: 'Admin', icon: Lock }] : NAV;
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-navy-700 text-ink shadow-[inset_2px_0_0_0_#22d3ee]'
                : 'text-ink-soft hover:bg-navy-800 hover:text-ink'
            }`
          }
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarFooter({ onNavigate }) {
  return (
    <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4 text-sm">
      <Link to="/how-it-works" onClick={onNavigate} className="rounded-lg px-3 py-2 text-ink-mute hover:text-ink">
        How it works
      </Link>
      <Link to="/about" onClick={onNavigate} className="rounded-lg px-3 py-2 text-ink-mute hover:text-ink">
        About
      </Link>
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const signOut = async () => {
    setOpen(false);
    await logout();
    toast.info('You have been logged out.');
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2.5 hover:bg-navy-800"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-brand-500 text-xs font-bold text-navy-950">
          {initials(user?.name)}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:block">{user?.name}</span>
        <ChevronDown className="h-4 w-4 text-ink-mute" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="card absolute right-0 z-40 mt-2 w-56 overflow-hidden p-1.5">
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-ink-mute">{user?.email}</p>
          </div>
          <Link
            role="menuitem"
            to="/profile"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-soft hover:bg-navy-700 hover:text-ink"
          >
            <User className="h-4 w-4" aria-hidden="true" /> Profile
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-ink-soft hover:bg-navy-700 hover:text-ink"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const { user } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  useEffect(() => setDrawer(false), [location.pathname]);
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-navy-800 focus:px-3 focus:py-2">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-navy-900/80 p-4 lg:flex">
        <Link to="/dashboard" className="px-2 pt-1" aria-label="LinkShield dashboard">
          <Logo />
        </Link>
        <SidebarNav isAdmin={isAdmin} />
        <SidebarFooter />
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="relative flex h-full w-72 max-w-[85vw] flex-col gap-6 border-r border-line bg-navy-900 p-4"
          >
            <div className="flex items-center justify-between px-2 pt-1">
              <Logo />
              <button type="button" className="btn btn-ghost px-2" onClick={() => setDrawer(false)} aria-label="Close navigation">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarNav isAdmin={isAdmin} onNavigate={() => setDrawer(false)} />
            <SidebarFooter onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-navy-950/85 px-4 backdrop-blur sm:px-8">
          <button
            type="button"
            className="btn btn-ghost -ml-2 px-2 lg:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
            aria-expanded={drawer}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <Link to="/scan" className="btn btn-primary btn-sm">
              <Search className="h-4 w-4" aria-hidden="true" />
              New scan
            </Link>
            <UserMenu />
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
