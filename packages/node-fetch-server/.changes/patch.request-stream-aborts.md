Reject request body reads when clients abort uploads, and avoid writing fallback error responses after streaming response headers are already committed (see #11533 and #11534).
