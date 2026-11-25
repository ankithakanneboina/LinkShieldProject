// Disclaimer text is copied verbatim from docs/API.md ("Disclaimer text").
export const DISCLAIMER =
  'LinkShield provides an automated risk estimate based only on the characteristics of the URL text. It does not open, visit or inspect the website. Machine-learning predictions can be wrong: a "legitimate" result does not guarantee that a website is safe, and a "phishing" result does not prove that it is malicious. Always use your own judgement and verify sensitive links through official channels.';

export const RISK_LEVELS = ['low', 'medium', 'high'];
export const RISK_LABEL = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' };
export const PREDICTION_LABEL = { phishing: 'Phishing', legitimate: 'Legitimate' };
export const SEVERITY_LABEL = { high: 'Strong signal', medium: 'Moderate signal', low: 'Weak signal' };

// Chart colours. blue/orange is the validated categorical pair; risk colours are the reserved status palette.
export const COLORS = {
  legitimate: '#3987e5',
  phishing: '#d95926',
  low: '#0ca30c',
  medium: '#fab219',
  high: '#d03b3b',
  neutral: '#7f93c9',
  surface: '#0d1733',
  grid: '#1a2a55',
  axis: '#8493b8',
};

export const FEEDBACK_CATEGORIES = [
  { value: 'correct', label: 'The result was accurate' },
  { value: 'false_positive', label: 'It flagged a site that is legitimate' },
  { value: 'false_negative', label: 'It marked a malicious site as legitimate' },
  { value: 'unclear_explanation', label: 'The explanation was unclear' },
  { value: 'other', label: 'Something else' },
];
export const FEEDBACK_LABEL = Object.fromEntries(FEEDBACK_CATEGORIES.map((c) => [c.value, c.label]));

export const FEATURE_LABELS = {
  url_length: 'URL length',
  domain_length: 'Hostname length',
  path_length: 'Path length',
  query_length: 'Query length',
  num_dots: 'Dots',
  num_hyphens: 'Hyphens',
  num_subdomains: 'Subdomains',
  num_digits: 'Digits',
  digit_ratio: 'Digit ratio',
  num_special_chars: 'Special characters',
  is_https: 'Uses HTTPS',
  has_ip_address: 'IP address as host',
  has_at_symbol: 'Contains @',
  is_shortener: 'URL shortener',
  suspicious_keyword_count: 'Suspicious keywords',
  has_punycode: 'Punycode label',
  num_encoded_chars: 'Encoded characters',
  has_unusual_port: 'Unusual port',
  domain_entropy: 'Hostname randomness (entropy)',
  has_double_slash_in_path: 'Double slash after host',
  has_deceptive_https_token: "'http(s)' inside the address",
  num_query_params: 'Query parameters',
  longest_label_length: 'Longest hostname label',
  path_depth: 'Path depth',
};

export const BOOLEAN_FEATURES = new Set([
  'is_https',
  'has_ip_address',
  'has_at_symbol',
  'is_shortener',
  'has_punycode',
  'has_unusual_port',
  'has_double_slash_in_path',
  'has_deceptive_https_token',
]);

export const FEATURE_GROUPS = [
  {
    title: 'Length and structure',
    keys: ['url_length', 'domain_length', 'path_length', 'query_length', 'path_depth', 'num_query_params'],
  },
  {
    title: 'Hostname',
    keys: [
      'num_subdomains',
      'longest_label_length',
      'domain_entropy',
      'num_dots',
      'num_hyphens',
      'has_ip_address',
      'has_punycode',
      'is_shortener',
    ],
  },
  {
    title: 'Characters',
    keys: [
      'num_digits',
      'digit_ratio',
      'num_special_chars',
      'num_encoded_chars',
      'has_at_symbol',
      'has_double_slash_in_path',
    ],
  },
  {
    title: 'Protocol and tricks',
    keys: ['is_https', 'has_unusual_port', 'has_deceptive_https_token', 'suspicious_keyword_count'],
  },
];

export const ACTIVITY_LABEL = { scan: 'Scan', registration: 'Registration', feedback: 'Feedback' };
