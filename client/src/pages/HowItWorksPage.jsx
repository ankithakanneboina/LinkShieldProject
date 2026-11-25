import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import Disclaimer from '../components/Disclaimer';
import { RiskBadge } from '../components/ui/Badges';
import { usePageTitle } from '../hooks/usePageTitle';

// This is an ordered pipeline, so numbering reflects real sequence.
const STEPS = [
  {
    title: 'You submit a URL',
    body: 'The scanner checks the text in your browser first: it must be 2,048 characters or fewer, contain no spaces and use http or https. If you leave out the scheme, https:// is assumed.',
  },
  {
    title: 'The server validates and normalizes it',
    body: 'The backend repeats those checks, because browser checks can be bypassed. The URL is treated purely as a string. It is never fetched, resolved or opened, which also rules out server-side request forgery through the scanner.',
  },
  {
    title: 'The ML service extracts 24 features',
    body: 'Lengths, counts of dots, hyphens, digits and subdomains, whether the host is an IP address, URL shorteners, punycode, an unusual port, percent-encoded characters, suspicious keywords and the randomness (entropy) of the hostname. The same extraction code is used for training and for live scans.',
  },
  {
    title: 'A trained model estimates the probability',
    body: 'A tree-based classifier selected during training outputs a phishing probability, which is calibrated on held-out data so that a score of 0.8 behaves like roughly an 80% estimate on that data. The risk score is that probability multiplied by 100.',
  },
  {
    title: 'The score is turned into a category and a label',
    body: 'The phishing or legitimate label and the low, medium and high cut-offs are chosen from validation results during training, not set by hand. The exact thresholds are recorded with the model and visible to administrators.',
  },
  {
    title: 'Reasons are attached from real values',
    body: 'A risk factor is listed only if its condition is true for your URL and that same condition was measurably more common among phishing URLs in the training data. The "what moved the score" bars show how the probability changes when each characteristic is replaced with a typical value.',
  },
  {
    title: 'The result is saved to your account',
    body: 'The scan, its features and its explanations are stored in the database and linked to your account. Only you can open, download or delete them.',
  },
];

const FAQ = [
  {
    q: 'Does LinkShield open the link I submit?',
    a: 'No. It analyzes the characters of the URL only. Nothing is requested from the website, so submitting a dangerous link does not expose you or our servers to it.',
  },
  {
    q: 'If a URL is marked legitimate, is it safe?',
    a: 'Not necessarily. The model cannot see the page, the owner or the content, and attackers can compromise sites that have perfectly normal-looking addresses. Treat the result as one input and verify sensitive links through official channels.',
  },
  {
    q: 'Why does a phishing result list no reasons?',
    a: 'Explanations are shown only when a known characteristic is present and supported by the training data. A model can combine many small signals that do not individually qualify, and in that case the list is empty rather than invented.',
  },
  {
    q: 'What happens to the feedback I send?',
    a: 'It is stored with the scan so an administrator can review it. It is not treated as a verified label and it does not retrain the model automatically.',
  },
];

function Faq({ q, a, index }) {
  const [open, setOpen] = useState(false);
  const id = `faq-${index}`;
  return (
    <div className="border-b border-line">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={id}
          className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-semibold hover:text-cyan-300"
        >
          {q}
          <ChevronDown className={`h-5 w-5 shrink-0 text-ink-mute transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h3>
      {open && (
        <p id={id} className="prose-ls pb-4">
          {a}
        </p>
      )}
    </div>
  );
}

export default function HowItWorksPage() {
  usePageTitle('How it works');
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold sm:text-4xl">How LinkShield works</h1>
      <p className="prose-ls mt-3">
        From the moment you paste a link to the moment you see a score, this is everything that happens.
      </p>

      <ol className="mt-10 space-y-6">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/50 bg-navy-800 font-mono text-sm text-cyan-300" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="prose-ls mt-1">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-14" aria-labelledby="categories-title">
        <h2 id="categories-title" className="text-2xl font-bold">
          Reading the risk category
        </h2>
        <div className="mt-5 space-y-3">
          <div className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="sm:w-36">
              <RiskBadge level="low" />
            </div>
            <p className="text-sm leading-6 text-ink-soft">The score is below the medium cut-off. On validation data, URLs scoring this low were almost always legitimate.</p>
          </div>
          <div className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="sm:w-36">
              <RiskBadge level="medium" />
            </div>
            <p className="text-sm leading-6 text-ink-soft">The model is unsure. Treat the link with care and check it another way before entering any details.</p>
          </div>
          <div className="card flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="sm:w-36">
              <RiskBadge level="high" />
            </div>
            <p className="text-sm leading-6 text-ink-soft">The score is at or above the high cut-off. On validation data, URLs scoring this high were almost always phishing.</p>
          </div>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="faq-title">
        <h2 id="faq-title" className="text-2xl font-bold">
          Common questions
        </h2>
        <div className="mt-4 border-t border-line">
          {FAQ.map((f, i) => (
            <Faq key={f.q} index={i} {...f} />
          ))}
        </div>
      </section>

      <Disclaimer className="mt-12" />
      <div className="mt-8 flex gap-3">
        <Link to="/register" className="btn btn-primary">
          Create an account
        </Link>
        <Link to="/about" className="btn btn-secondary">
          About the model and data
        </Link>
      </div>
    </div>
  );
}
