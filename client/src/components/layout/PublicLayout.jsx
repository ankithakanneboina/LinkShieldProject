import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from '../Logo';
import { useAuth } from '../../context/AuthContext';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/about', label: 'About' },
];

const linkClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'
  }`;

export default function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-navy-800 focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-navy-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="LinkShield home">
            <Logo />
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <Link to="/dashboard" className="btn btn-primary btn-sm">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">
                  Log in
                </Link>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Create account
                </Link>
              </>
            )}
          </div>
          <button
            type="button"
            className="btn btn-ghost -mr-2 px-2 md:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="public-mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
        {open && (
          <div id="public-mobile-nav" className="border-t border-line bg-navy-900 px-4 pb-4 pt-2 md:hidden">
            <nav aria-label="Mobile" className="flex flex-col">
              {LINKS.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex gap-2">
              {user ? (
                <Link to="/dashboard" className="btn btn-primary flex-1">
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="btn btn-secondary flex-1">
                    Log in
                  </Link>
                  <Link to="/register" className="btn btn-primary flex-1">
                    Create account
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-navy-900/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-6 text-ink-mute">
              Estimates whether a URL looks like phishing by reading its text. LinkShield never visits the link, and a
              result is an estimate, not a guarantee.
            </p>
          </div>
          <nav aria-label="Product" className="flex flex-col gap-2 text-sm">
            <Link className="text-ink-soft hover:text-ink" to="/how-it-works">
              How it works
            </Link>
            <Link className="text-ink-soft hover:text-ink" to="/about">
              About the model and data
            </Link>
            <Link className="text-ink-soft hover:text-ink" to={user ? '/scan' : '/register'}>
              {user ? 'Scan a URL' : 'Create an account'}
            </Link>
          </nav>
          <div className="text-sm text-ink-mute">
            <p>Training data</p>
            <a
              className="mt-2 block text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink"
              href="https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset"
              target="_blank"
              rel="noopener noreferrer"
            >
              UCI PhiUSIIL Phishing URL Dataset
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
