import { useState } from 'react';
import { Eye, FileSearch, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import Disclaimer from '../components/Disclaimer';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { FEATURE_GROUPS, FEATURE_LABELS } from '../lib/constants';

// An illustrative URL, not a real site and never scanned. It exists to show which parts of a link the model reads.
const SEGMENTS = [
  {
    id: 'scheme',
    text: 'https://',
    name: 'Scheme',
    body: 'Whether the link uses HTTPS. HTTPS only means the connection is encrypted, and phishing sites use it too, so it is one signal among many.',
  },
  {
    id: 'subdomains',
    text: 'login.mybank.com.',
    name: 'Subdomains',
    body: 'How many subdomain levels the host has, how long the hostname is, and how random its characters look. Attackers pad a host with a familiar name so the real domain is easy to miss.',
  },
  {
    id: 'domain',
    text: 'account-verify.example',
    name: 'Registered domain',
    body: 'The part the site owner actually registers, and the part that decides where you land. Hyphens, digits and look-alike (punycode) characters here are measured.',
  },
  {
    id: 'path',
    text: '/verify',
    name: 'Path',
    body: 'Path length and depth, plus words that are common in phishing lures, such as login, verify, secure or update.',
  },
  {
    id: 'query',
    text: '?session=8f2a',
    name: 'Query string',
    body: 'Query length, number of parameters and percent-encoded characters that can hide the real text of a link.',
  },
];

function UrlAnatomy() {
  const [active, setActive] = useState('subdomains');
  const current = SEGMENTS.find((s) => s.id === active);
  return (
    <div className="card overflow-hidden shadow-glow">
      <div className="flex items-center gap-2 border-b border-line bg-navy-800/70 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-navy-600" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-navy-600" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-navy-600" aria-hidden="true" />
        <span className="ml-2 text-xs text-ink-mute">Example link, not a real site and not scanned</span>
      </div>
      <div className="p-5 sm:p-6">
        <p className="text-sm text-ink-soft">Select a part of the link to see what LinkShield measures there.</p>
        <div className="mt-4 flex flex-wrap rounded-lg border border-line bg-navy-950/70 p-3 font-mono text-[0.95rem] leading-9 sm:text-base" role="group" aria-label="Parts of an example URL">
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-pressed={active === s.id}
              className={`rounded px-0.5 transition-colors ${
                active === s.id
                  ? 'bg-cyan-400/20 text-cyan-300 underline decoration-cyan-400 decoration-2 underline-offset-[6px]'
                  : 'text-ink-soft hover:bg-navy-700 hover:text-ink'
              }`}
            >
              {s.text}
            </button>
          ))}
        </div>
        <div aria-live="polite" className="mt-5 min-h-[7.5rem]">
          <h3 className="text-base font-semibold">{current.name}</h3>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">{current.body}</p>
        </div>
      </div>
    </div>
  );
}

const COMMITMENTS = [
  {
    icon: Eye,
    title: 'It reads text, it never visits',
    body: 'LinkShield only parses the characters of the URL. It does not open the page, follow redirects or download anything, so scanning a malicious link cannot expose you to it.',
  },
  {
    icon: FileSearch,
    title: 'It shows its reasons',
    body: 'Every flagged characteristic comes from the numbers extracted from your URL and is listed only if it was measurably more common in phishing links during training.',
  },
  {
    icon: Scale,
    title: 'It gives an estimate, not a guarantee',
    body: 'A calibrated probability and a risk category tell you how closely a link resembles known phishing. A low score never proves a site is safe.',
  },
];

export default function LandingPage() {
  usePageTitle('');
  const { user } = useAuth();
  const startTo = user ? '/scan' : '/register';

  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-20">
        <div>
          <h1 className="text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-[3.4rem]">Check a link before you click it.</h1>
          <p className="prose-ls mt-5 text-base">
            LinkShield reads the text of a URL, scores how closely it resembles known phishing links, and tells you which
            characteristics raised the score. It never visits the site.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={startTo} className="btn btn-primary px-5 py-3">
              {user ? 'Scan a URL' : 'Create an account'}
            </Link>
            <Link to="/how-it-works" className="btn btn-secondary px-5 py-3">
              See how it works
            </Link>
          </div>
        </div>
        <UrlAnatomy />
      </section>

      <section className="border-y border-line bg-navy-900/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">What the model looks at</h2>
          <p className="prose-ls mt-3">
            Twenty-four measurements taken from the URL string alone. There is no page content, no reputation lookup and
            no network request to the link.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURE_GROUPS.map((g) => (
              <div key={g.title} className="card card-pad">
                <h3 className="text-base font-semibold">{g.title}</h3>
                <ul className="mt-3 space-y-1.5">
                  {g.keys.map((k) => (
                    <li key={k} className="text-sm text-ink-soft">
                      {FEATURE_LABELS[k]}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {COMMITMENTS.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <Icon className="h-6 w-6 text-cyan-400" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-ink-soft">{body}</p>
            </div>
          ))}
        </div>
        <Disclaimer className="mt-12" />
      </section>

      <section className="border-t border-line bg-navy-900/50">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold">Got a link you are not sure about?</h2>
            <p className="mt-1.5 text-sm text-ink-soft">Paste it into the scanner and see the score and the reasons behind it.</p>
          </div>
          <Link to={startTo} className="btn btn-primary px-5 py-3">
            {user ? 'Open the scanner' : 'Create an account and scan'}
          </Link>
        </div>
      </section>
    </>
  );
}
