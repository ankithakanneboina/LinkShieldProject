from __future__ import annotations

import ipaddress
import math
import re
from collections import Counter
from urllib.parse import urlsplit

EXTRACTOR_VERSION = "1.1"  # 1.1: a leading "www." is ignored (dataset artefact, see strip_www)
MAX_URL_LENGTH = 2048

FEATURE_NAMES: list[str] = [
    "url_length",
    "domain_length",
    "path_length",
    "query_length",
    "num_dots",
    "num_hyphens",
    "num_subdomains",
    "num_digits",
    "digit_ratio",
    "num_special_chars",
    "is_https",
    "has_ip_address",
    "has_at_symbol",
    "is_shortener",
    "suspicious_keyword_count",
    "has_punycode",
    "num_encoded_chars",
    "has_unusual_port",
    "domain_entropy",
    "has_double_slash_in_path",
    "has_deceptive_https_token",
    "num_query_params",
    "longest_label_length",
    "path_depth",
]

SHORTENER_DOMAINS = frozenset(
    {
        "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly",
        "rebrand.ly", "rb.gy", "shorturl.at", "tiny.cc", "t.ly", "s.id", "lnkd.in", "adf.ly", "bl.ink",
        "shorte.st", "v.gd", "x.co", "tr.im", "soo.gd", "qr.ae", "clck.ru", "u.to", "trib.al", "ift.tt",
        "dlvr.it", "fb.me", "amzn.to", "youtu.be", "wp.me", "mcaf.ee", "po.st", "su.pr", "bit.do",
    }
)

SUSPICIOUS_KEYWORDS: tuple[str, ...] = (
    "login", "signin", "sign-in", "logon", "verify", "verification", "secure", "security", "account",
    "update", "confirm", "banking", "password", "passwd", "credential", "wallet", "billing", "invoice",
    "suspend", "suspended", "unlock", "recover", "authenticate", "webscr", "paypal", "ebay", "apple-id",
    "appleid", "microsoft", "office365", "netflix", "support", "helpdesk", "alert", "validate",
)

# Two-label public suffixes that matter for finding the registrable domain without a full PSL.
_MULTIPART_SUFFIXES = frozenset(
    {
        "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "com.au", "net.au", "org.au", "edu.au", "gov.au",
        "co.in", "net.in", "org.in", "gov.in", "ac.in", "firm.in", "co.jp", "ne.jp", "or.jp", "ac.jp",
        "com.br", "net.br", "org.br", "com.cn", "net.cn", "org.cn", "com.mx", "com.ar", "com.tr", "com.sg",
        "com.hk", "com.tw", "com.my", "com.ph", "com.vn", "com.pk", "com.ng", "co.za", "co.nz", "co.kr",
        "co.id", "co.il", "com.ua", "com.pl", "com.ru", "com.eg", "com.sa", "com.co", "com.pe", "com.ve",
    }
)

_SCHEME_RE = re.compile(r"^([A-Za-z][A-Za-z0-9+.\-]*):(?!//)")
_HOST_PORT_RE = re.compile(r"^[^/?#:@]+:\d+(?:[/?#]|$)")
_HAS_SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*://")
_PCT_RE = re.compile(r"%[0-9A-Fa-f]{2}")
_CONTROL_OR_SPACE_RE = re.compile(r"[\s\x00-\x1f\x7f]")
_IPV4_LIKE_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
_DECIMAL_HOST_RE = re.compile(r"^\d{8,10}$")
_HEX_HOST_RE = re.compile(r"^0x[0-9a-fA-F]{6,8}$")
_EMBEDDED_HTTP_RE = re.compile(r"https?(?::|%3a)", re.IGNORECASE)


class InvalidURLError(ValueError):
    """Raised when a string cannot be accepted as an http(s) URL."""


def normalize_url(raw: str) -> tuple[str, bool]:
    """Validate ``raw`` and return ``(normalized_url, scheme_assumed)``.

    A missing scheme is assumed to be ``https://``. Only http and https are accepted.
    The URL text is otherwise left unchanged so that training and prediction see identical strings.
    """
    if not isinstance(raw, str):
        raise InvalidURLError("URL must be a string")
    s = raw.strip()
    if not s:
        raise InvalidURLError("URL is empty")
    if len(s) > MAX_URL_LENGTH:
        raise InvalidURLError(f"URL is longer than {MAX_URL_LENGTH} characters")
    if _CONTROL_OR_SPACE_RE.search(s):
        raise InvalidURLError("URL must not contain whitespace or control characters")

    assumed = False
    if not _HAS_SCHEME_RE.match(s):
        # "javascript:...", "mailto:...", "data:..." have a scheme but no "//"; "host:8080/x" is a host and port.
        if _SCHEME_RE.match(s) and not _HOST_PORT_RE.match(s):
            raise InvalidURLError("Only http and https URLs are supported")
        if s.startswith("//"):
            s = s[2:]
        s = "https://" + s
        assumed = True

    try:
        parts = urlsplit(s)
        host = parts.hostname
        _ = parts.port  # raises ValueError for an invalid port
    except ValueError as exc:
        raise InvalidURLError("URL could not be parsed") from exc

    if parts.scheme.lower() not in ("http", "https"):
        raise InvalidURLError("Only http and https URLs are supported")
    if not host:
        raise InvalidURLError("URL has no host")
    return s, assumed


def _split(url: str):
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    return parts, host


def is_ip_host(host: str) -> bool:
    if not host:
        return False
    if _IPV4_LIKE_RE.match(host) or _DECIMAL_HOST_RE.match(host) or _HEX_HOST_RE.match(host):
        return True
    try:
        ipaddress.ip_address(host.strip("[]"))
        return True
    except ValueError:
        return False


def registrable_domain(host: str) -> str:
    """Approximate registrable domain (eTLD+1) using a small multi-part suffix list."""
    if not host or is_ip_host(host):
        return host
    labels = host.split(".")
    if len(labels) <= 2:
        return host
    if ".".join(labels[-2:]) in _MULTIPART_SUFFIXES:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def _entropy(text: str) -> float:
    if not text:
        return 0.0
    n = len(text)
    return -sum((c / n) * math.log2(c / n) for c in Counter(text).values())


def count_suspicious_keywords(url_lower: str) -> int:
    return sum(1 for kw in SUSPICIOUS_KEYWORDS if kw in url_lower)


def matched_suspicious_keywords(url: str) -> list[str]:
    """Keywords that were counted in ``suspicious_keyword_count`` (host, path and query only)."""
    parts, host = _split(url)
    text = (host + parts.path + "?" + parts.query).lower()
    return [kw for kw in SUSPICIOUS_KEYWORDS if kw in text]


def strip_www(url: str) -> str:
    """Remove a leading "www." from the host.

    In the PhiUSIIL dataset most legitimate URLs start with "www." while bare domains are mostly phishing, so
    models learn "no www => phishing" (e.g. https://github.com scored 100%). That is a collection artefact, not a
    real property of phishing, so "www." is ignored in training AND serving.
    """
    m = re.match(r"^([A-Za-z][A-Za-z0-9+.-]*://)(?:[^/?#@]*@)?(www\.)", url, re.IGNORECASE)
    if not m:
        return url
    return url[: m.start(2)] + url[m.end(2):]


def extract_features(url: str) -> dict[str, float]:
    """Extract the ordered feature dictionary from an already-normalized URL."""
    url = strip_www(url)
    parts, host = _split(url)
    path, query = parts.path or "", parts.query or ""
    rest = url.split("://", 1)[1] if "://" in url else url
    n = len(url)
    digits = sum(ch.isdigit() for ch in url)
    labels = [l for l in host.split(".") if l]
    ip_host = is_ip_host(host)

    if ip_host or not labels:
        num_subdomains = 0
    else:
        reg_labels = len(registrable_domain(host).split("."))
        num_subdomains = max(len(labels) - reg_labels, 0)
        if labels[0] == "www" and num_subdomains > 0:
            num_subdomains -= 1

    reg = registrable_domain(host)
    try:
        port = parts.port
    except ValueError:
        port = None

    text_for_keywords = (host + path + "?" + query).lower()

    feats = {
        "url_length": n,
        "domain_length": len(host),
        "path_length": len(path),
        "query_length": len(query),
        "num_dots": url.count("."),
        "num_hyphens": url.count("-"),
        "num_subdomains": num_subdomains,
        "num_digits": digits,
        "digit_ratio": digits / n if n else 0.0,
        "num_special_chars": sum(1 for ch in url if not ch.isalnum() and ch not in ".-/:_"),
        "is_https": int(parts.scheme.lower() == "https"),
        "has_ip_address": int(ip_host),
        "has_at_symbol": int("@" in url),
        "is_shortener": int(host in SHORTENER_DOMAINS or reg in SHORTENER_DOMAINS),
        "suspicious_keyword_count": count_suspicious_keywords(text_for_keywords),
        "has_punycode": int(any(l.startswith("xn--") for l in labels)),
        "num_encoded_chars": len(_PCT_RE.findall(url)),
        "has_unusual_port": int(port is not None and port not in (80, 443)),
        "domain_entropy": _entropy(host),
        "has_double_slash_in_path": int("//" in rest),
        "has_deceptive_https_token": int("http" in host or bool(_EMBEDDED_HTTP_RE.search(path + "?" + query))),
        "num_query_params": len([p for p in query.split("&") if p]) if query else 0,
        "longest_label_length": max((len(l) for l in labels), default=0),
        "path_depth": len([s for s in path.split("/") if s]),
    }
    return {k: feats[k] for k in FEATURE_NAMES}


def features_from_raw(raw_url: str) -> tuple[str, bool, dict[str, float]]:
    """Normalize ``raw_url`` then extract features. The single entry point used by training and serving."""
    normalized, assumed = normalize_url(raw_url)
    return normalized, assumed, extract_features(normalized)
