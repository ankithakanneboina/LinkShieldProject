/**
 * Shows a submitted URL as inert text with the host emphasised. It is deliberately NOT a link:
 * LinkShield users are inspecting URLs that may be malicious, so we never make them one click from opening it.
 */
export default function UrlText({ url, className = '', truncate = false }) {
  const match = /^(https?:\/\/)([^/?#]*)(.*)$/i.exec(url || '');
  return (
    <code
      className={`font-mono text-sm ${truncate ? 'block truncate' : 'block break-all'} ${className}`}
      title={url}
    >
      {match ? (
        <>
          <span className="text-ink-mute">{match[1]}</span>
          <span className="font-medium text-ink">{match[2]}</span>
          <span className="text-ink-soft">{match[3]}</span>
        </>
      ) : (
        url
      )}
    </code>
  );
}
