"""Evidence-based explanations.

A risk factor is shown to a user only when BOTH hold:
  1. its trigger condition is true for the URL's actual extracted features, and
  2. during training the same condition was measurably associated with phishing
     (support >= MIN_SUPPORT and phishing rate >= LIFT_REQUIRED x the dataset base rate).

Rule statistics come from ``compute_rule_stats`` (run by the training script) and are stored in the
model bundle, so explanations can never be invented or hard-coded for a model that does not support them.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Mapping

import numpy as np

MIN_SUPPORT = 200
LIFT_REQUIRED = 1.15
HIGH_RATE = 0.85
MEDIUM_RATE = 0.65


@dataclass(frozen=True)
class Rule:
    code: str
    title: str
    feature: str
    trigger: Callable[[Mapping], object]  # works on scalars (live) and pandas Series (training)
    detail: str  # format string; may use {value}


RULES: tuple[Rule, ...] = (
    Rule("ip_address", "Host is an IP address", "has_ip_address", lambda f: f["has_ip_address"] == 1,
         "The URL uses a numeric IP address instead of a domain name."),
    Rule("at_symbol", "URL contains an @ symbol", "has_at_symbol", lambda f: f["has_at_symbol"] == 1,
         "An @ symbol can hide the real destination because browsers ignore text before it."),
    Rule("url_shortener", "Known URL-shortening service", "is_shortener", lambda f: f["is_shortener"] == 1,
         "The link hides its final destination behind a URL shortener."),
    Rule("punycode", "Punycode (xn--) domain label", "has_punycode", lambda f: f["has_punycode"] == 1,
         "Punycode can be used to imitate well-known domains with look-alike characters."),
    Rule("suspicious_keywords", "Suspicious keywords in the URL", "suspicious_keyword_count",
         lambda f: f["suspicious_keyword_count"] >= 2, "The URL contains {value:.0f} words often used to lure victims (for example login, verify, secure)."),
    Rule("many_subdomains", "Many subdomains", "num_subdomains", lambda f: f["num_subdomains"] >= 3,
         "The host has {value:.0f} subdomain levels; attackers pad hosts with subdomains to imitate a trusted name."),
    Rule("long_url", "Unusually long URL", "url_length", lambda f: f["url_length"] >= 75,
         "The URL is {value:.0f} characters long."),
    Rule("long_domain", "Unusually long hostname", "domain_length", lambda f: f["domain_length"] >= 30,
         "The hostname is {value:.0f} characters long."),
    Rule("long_path", "Unusually long path", "path_length", lambda f: f["path_length"] >= 60,
         "The path is {value:.0f} characters long."),
    Rule("long_query", "Unusually long query string", "query_length", lambda f: f["query_length"] >= 60,
         "The query string is {value:.0f} characters long."),
    Rule("many_hyphens", "Many hyphens", "num_hyphens", lambda f: f["num_hyphens"] >= 4,
         "The URL contains {value:.0f} hyphens."),
    Rule("many_digits", "High proportion of digits", "digit_ratio", lambda f: f["digit_ratio"] >= 0.25,
         "{value:.0%} of the characters in the URL are digits."),
    Rule("many_special_chars", "Many unusual characters", "num_special_chars", lambda f: f["num_special_chars"] >= 8,
         "The URL contains {value:.0f} special characters beyond the usual . - / : _"),
    Rule("encoded_characters", "Percent-encoded characters", "num_encoded_chars", lambda f: f["num_encoded_chars"] >= 3,
         "The URL contains {value:.0f} percent-encoded sequences, which can hide the real text."),
    Rule("deceptive_https_token", "'http' or 'https' inside the address", "has_deceptive_https_token",
         lambda f: f["has_deceptive_https_token"] == 1, "The text http(s) appears inside the host or path, a trick to look secure."),
    Rule("unusual_port", "Unusual port number", "has_unusual_port", lambda f: f["has_unusual_port"] == 1,
         "The URL specifies a port other than 80 or 443."),
    Rule("high_domain_entropy", "Random-looking hostname", "domain_entropy", lambda f: f["domain_entropy"] >= 3.8,
         "The hostname has high character randomness (entropy {value:.2f} bits)."),
    Rule("double_slash_path", "Double slash after the host", "has_double_slash_in_path",
         lambda f: f["has_double_slash_in_path"] == 1, "A '//' sequence appears after the scheme, which is used in redirect tricks."),
    Rule("no_https", "Connection is not HTTPS", "is_https", lambda f: f["is_https"] == 0,
         "The URL uses plain HTTP, so traffic is not encrypted."),
    Rule("many_query_params", "Many query parameters", "num_query_params", lambda f: f["num_query_params"] >= 5,
         "The URL has {value:.0f} query parameters."),
    Rule("long_label", "Very long hostname label", "longest_label_length", lambda f: f["longest_label_length"] >= 20,
         "One part of the hostname is {value:.0f} characters long."),
    Rule("deep_path", "Deeply nested path", "path_depth", lambda f: f["path_depth"] >= 5,
         "The path has {value:.0f} nested segments."),
)

RULES_BY_CODE = {r.code: r for r in RULES}


def compute_rule_stats(feature_df, y_phishing) -> dict[str, dict]:
    """Measure, on training data, how strongly each rule's condition is associated with phishing."""
    y = np.asarray(y_phishing).astype(bool)
    base = float(y.mean())
    stats: dict[str, dict] = {}
    for rule in RULES:
        mask = np.asarray(rule.trigger(feature_df)).astype(bool)
        support = int(mask.sum())
        rate = float(y[mask].mean()) if support else 0.0
        supported = support >= MIN_SUPPORT and rate >= base * LIFT_REQUIRED
        stats[rule.code] = {
            "support": support,
            "phishing_rate": round(rate, 4),
            "base_rate": round(base, 4),
            "lift": round(rate / base, 3) if base else 0.0,
            "supported": bool(supported),
        }
    return stats


def _severity(rate: float) -> str:
    return "high" if rate >= HIGH_RATE else "medium" if rate >= MEDIUM_RATE else "low"


def build_risk_factors(features: Mapping[str, float], rule_stats: Mapping[str, dict],
                       influence_by_feature: Mapping[str, float]) -> list[dict]:
    """Return triggered, data-supported risk factors for one URL, strongest first."""
    out: list[dict] = []
    for rule in RULES:
        st = rule_stats.get(rule.code)
        if not st or not st.get("supported"):
            continue
        if not bool(rule.trigger(features)):
            continue
        value = float(features[rule.feature])
        evidence = (f" In the training data, {st['phishing_rate']:.0%} of URLs with this trait were phishing "
                    f"(overall: {st['base_rate']:.0%}; {st['support']:,} examples).")
        out.append({
            "code": rule.code,
            "title": rule.title,
            "description": rule.detail.format(value=value) + evidence,
            "severity": _severity(st["phishing_rate"]),
            "feature": rule.feature,
            "value": value,
            "model_influence": influence_by_feature.get(rule.feature),
        })
    order = {"high": 0, "medium": 1, "low": 2}
    out.sort(key=lambda r: (order[r["severity"]], -abs(r["model_influence"] or 0.0)))
    return out
