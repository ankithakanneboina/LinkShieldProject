import { useState } from 'react';
import { api } from '../../api';
import { toApiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { FEEDBACK_CATEGORIES } from '../../lib/constants';
import { formatDateTime } from '../../lib/format';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import { TextAreaField } from '../ui/Field';

const MAX_COMMENTS = 1000;

export default function FeedbackForm({ scanId, existing, onSaved }) {
  const toast = useToast();
  const [category, setCategory] = useState(existing?.category || '');
  const [comments, setComments] = useState(existing?.comments || '');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!category) next.category = 'Choose the option that fits best.';
    if (comments.length > MAX_COMMENTS) next.comments = `Use ${MAX_COMMENTS} characters or fewer.`;
    setErrors(next);
    setSubmitError('');
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const { feedback } = await api.submitFeedback({
        scanId,
        category,
        ...(comments.trim() ? { comments: comments.trim() } : {}),
      });
      toast.success(existing ? 'Feedback updated.' : 'Feedback sent.');
      onSaved?.(feedback);
    } catch (err) {
      setSubmitError(toApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="feedback-title" className="card card-pad">
      <h2 id="feedback-title" className="text-xl font-bold">
        Was this result right?
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
        Your feedback is stored with this scan for review. It is not treated as a verified label and does not retrain the
        model automatically.
      </p>
      {existing && (
        <p className="mt-2 text-xs text-ink-mute">You sent feedback on {formatDateTime(existing.updatedAt || existing.createdAt)}. Sending again updates it.</p>
      )}

      <form onSubmit={submit} noValidate className="mt-5 space-y-5">
        <fieldset aria-describedby={errors.category ? 'feedback-category-error' : undefined}>
          <legend className="label">Feedback type</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FEEDBACK_CATEGORIES.map((c) => (
              <label
                key={c.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                  category === c.value ? 'border-cyan-400 bg-navy-700 text-ink' : 'border-line bg-navy-900/60 text-ink-soft hover:border-line-strong'
                }`}
              >
                <input
                  type="radio"
                  name="feedback-category"
                  value={c.value}
                  checked={category === c.value}
                  onChange={() => setCategory(c.value)}
                  className="h-4 w-4 accent-cyan-400"
                />
                {c.label}
              </label>
            ))}
          </div>
          {errors.category && (
            <p id="feedback-category-error" role="alert" className="mt-1.5 text-xs font-medium text-risk-high-text">
              {errors.category}
            </p>
          )}
        </fieldset>

        <TextAreaField
          label="Comments (optional)"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          maxLength={MAX_COMMENTS + 200}
          error={errors.comments}
          hint={`${comments.length} / ${MAX_COMMENTS}`}
          placeholder="Anything that would help an administrator understand your feedback"
        />

        {submitError && <Alert tone="error">{submitError}</Alert>}

        <Button type="submit" loading={saving}>
          {existing ? 'Update feedback' : 'Send feedback'}
        </Button>
      </form>
    </section>
  );
}
