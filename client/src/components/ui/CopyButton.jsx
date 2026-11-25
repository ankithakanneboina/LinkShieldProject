import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function CopyButton({ text, label = 'Copy' }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard.');
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  };

  return (
    <button type="button" onClick={copy} className="btn btn-ghost btn-sm" aria-label={`${label} URL`}>
      {copied ? <Check className="h-4 w-4 text-risk-low-text" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? 'Copied' : label}
    </button>
  );
}
