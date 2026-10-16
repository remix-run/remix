Reject `Content-Range` values where `last-pos` precedes `first-pos` or reaches the complete length, which RFC 9110 defines as invalid (see #12028).
