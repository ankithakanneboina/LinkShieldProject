// Copied verbatim from docs/API.md ("Disclaimer text"); shown in the UI and printed on every PDF report.
export const DISCLAIMER =
  'LinkShield provides an automated risk estimate based only on the characteristics of the URL text. It does not open, visit or inspect the website. Machine-learning predictions can be wrong: a "legitimate" result does not guarantee that a website is safe, and a "phishing" result does not prove that it is malicious. Always use your own judgement and verify sensitive links through official channels.';

export const PREDICTIONS = ['phishing', 'legitimate'];
export const RISK_CATEGORIES = ['low', 'medium', 'high'];
export const SEVERITIES = ['low', 'medium', 'high'];
export const FEEDBACK_CATEGORIES = ['correct', 'false_positive', 'false_negative', 'unclear_explanation', 'other'];
export const REFRESH_COOKIE = 'ls_refresh';
