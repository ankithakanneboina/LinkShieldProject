import { Link } from 'react-router-dom';
import Disclaimer from '../components/Disclaimer';
import { usePageTitle } from '../hooks/usePageTitle';

const STACK = [
  ['Interface', 'React, Tailwind CSS, React Router, Axios, Recharts'],
  ['API', 'Node.js and Express with JWT access tokens and rotating refresh tokens'],
  ['Database', 'PostgreSQL'],
  ['Model service', 'Python, FastAPI, scikit-learn, pandas, NumPy and Joblib'],
];

export default function AboutPage() {
  usePageTitle('About');
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold sm:text-4xl">About LinkShield</h1>
      <p className="prose-ls mt-3">
        LinkShield is an AI-powered phishing URL detection and risk analysis platform. It helps people pause before
        opening a suspicious link by estimating how much the link looks like phishing and explaining why.
      </p>

      <section className="mt-12" aria-labelledby="model-title">
        <h2 id="model-title" className="text-2xl font-bold">
          The model
        </h2>
        <div className="prose-ls mt-3 space-y-4">
          <p>
            Three classifiers are trained and compared: a decision tree, a random forest and gradient boosting. The
            comparison uses cross-validation on the training split only, and the best model by F1 score for the phishing
            class is selected. The test split is not used to choose it.
          </p>
          <p>
            Training and test URLs never share a registered domain. Splitting by domain avoids a common source of
            inflated results, where many URLs from the same site land on both sides of the split.
          </p>
          <p>
            The selected model's probabilities are calibrated on a separate held-out split, and the cut-offs for the
            phishing label and for the low, medium and high categories are derived from that data. Accuracy, precision,
            recall, F1 and the confusion matrix for the deployed model are available to administrators on the admin page.
          </p>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="data-title">
        <h2 id="data-title" className="text-2xl font-bold">
          Training data
        </h2>
        <div className="prose-ls mt-3 space-y-4">
          <p>
            The model is trained on the{' '}
            <a
              className="text-cyan-400 underline underline-offset-4 hover:text-cyan-300"
              href="https://archive.ics.uci.edu/dataset/967/phiusiil+phishing+url+dataset"
              target="_blank"
              rel="noopener noreferrer"
            >
              PhiUSIIL Phishing URL Dataset
            </a>{' '}
            from the UCI Machine Learning Repository, released under the Creative Commons Attribution 4.0 licence.
          </p>
          <p>
            Citation: Prasad, A. and Chandra, S. (2024). PhiUSIIL Phishing URL (Website) [Dataset]. UCI Machine Learning
            Repository. The accompanying paper is in Computers and Security, DOI 10.1016/j.cose.2023.103545.
          </p>
          <p>
            Only the URL text from the dataset is used. Features that depend on downloading the web page are not, because
            LinkShield works from a URL string alone.
          </p>
        </div>
      </section>

      <section className="mt-12" aria-labelledby="limits-title">
        <h2 id="limits-title" className="text-2xl font-bold">
          Limits you should know about
        </h2>
        <ul className="prose-ls mt-3 list-disc space-y-2 pl-5">
          <li>The model sees only the URL. It cannot tell if a well-formed address belongs to a compromised or newly created site.</li>
          <li>It was trained on one dataset collected at one point in time. Attackers change tactics, so accuracy on today's links can differ from the reported evaluation.</li>
          <li>Short or ordinary-looking phishing URLs can look the same as legitimate ones, and unusual legitimate URLs can look suspicious.</li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="stack-title">
        <h2 id="stack-title" className="text-2xl font-bold">
          Built with
        </h2>
        <dl className="mt-4 divide-y divide-line rounded-xl border border-line">
          {STACK.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]">
              <dt className="text-sm font-medium text-ink">{k}</dt>
              <dd className="text-sm text-ink-soft">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Disclaimer className="mt-12" />
      <div className="mt-8 flex gap-3">
        <Link to="/how-it-works" className="btn btn-secondary">
          How it works
        </Link>
        <Link to="/register" className="btn btn-primary">
          Create an account
        </Link>
      </div>
    </div>
  );
}
