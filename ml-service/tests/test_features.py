import math

import pytest

from linkshield_ml.features import (FEATURE_NAMES, InvalidURLError, extract_features, features_from_raw,
                                    normalize_url, registrable_domain)


def feats(url):
    return features_from_raw(url)[2]


def test_feature_count_and_order():
    f = feats("https://example.com/a")
    assert list(f.keys()) == FEATURE_NAMES
    assert 20 <= len(FEATURE_NAMES) <= 25


def test_basic_lengths_and_https():
    f = feats("https://www.example.com/path/to?x=1&y=2")
    assert f["url_length"] == len("https://www.example.com/path/to?x=1&y=2")
    assert f["domain_length"] == len("www.example.com")
    assert f["path_length"] == len("/path/to")
    assert f["query_length"] == len("x=1&y=2")
    assert f["is_https"] == 1 and f["path_depth"] == 2 and f["num_query_params"] == 2


def test_http_is_not_https():
    assert feats("http://example.com")["is_https"] == 0


def test_ip_address_variants():
    for host in ["http://192.168.1.10/x", "http://[::1]/x", "http://3232235777/x", "http://0xC0A80101/x"]:
        assert feats(host)["has_ip_address"] == 1, host
    assert feats("http://example.com")["has_ip_address"] == 0


def test_at_symbol_and_encoding_and_double_slash():
    f = feats("https://example.com//a%20b%2F@evil.com")
    assert f["has_at_symbol"] == 1 and f["num_encoded_chars"] == 2 and f["has_double_slash_in_path"] == 1


def test_shortener_punycode_port():
    assert feats("https://bit.ly/abc")["is_shortener"] == 1
    assert feats("https://xn--pple-43d.com")["has_punycode"] == 1
    assert feats("https://example.com:8443/")["has_unusual_port"] == 1
    assert feats("https://example.com:443/")["has_unusual_port"] == 0


def test_subdomains_and_registrable_domain():
    assert feats("https://www.example.com")["num_subdomains"] == 0
    assert feats("https://a.b.c.example.com")["num_subdomains"] == 3
    assert feats("https://a.example.co.uk")["num_subdomains"] == 1
    assert registrable_domain("login.shop.example.co.uk") == "example.co.uk"


def test_deceptive_https_token():
    assert feats("http://https-paypal.com/")["has_deceptive_https_token"] == 1
    assert feats("http://example.com/https://evil")["has_deceptive_https_token"] == 1
    assert feats("https://example.com/")["has_deceptive_https_token"] == 0


def test_keywords_count_distinct_words():
    assert feats("https://example.com/login/verify")["suspicious_keyword_count"] >= 2
    assert feats("https://example.com/gardening")["suspicious_keyword_count"] == 0


def test_entropy_and_digit_ratio():
    f = feats("https://aaaa.com")
    assert math.isclose(f["domain_entropy"], feats("https://aaaa.com")["domain_entropy"])
    assert feats("https://a1b2c3.com/123")["digit_ratio"] > 0.2


def test_normalization_assumes_https():
    assert normalize_url("example.com/x") == ("https://example.com/x", True)
    assert normalize_url("  http://example.com ") == ("http://example.com", False)
    assert normalize_url("example.com:8080/x")[0] == "https://example.com:8080/x"


@pytest.mark.parametrize("bad", ["", "   ", "javascript:alert(1)", "data:text/html,hi", "ftp://x.com", "file:///etc/passwd",
                                 "http://", "http://exa mple.com", "https://x.com:99999", "a" * 2100, None, 5])
def test_invalid_urls_rejected(bad):
    with pytest.raises(InvalidURLError):
        normalize_url(bad)


def test_feature_consistency_between_calls_and_entrypoints():
    url = "https://secure-login.example.tk/verify?id=1"
    n, _, via_raw = features_from_raw(url)
    assert via_raw == extract_features(n) == feats(url)  # identical logic for training and serving
