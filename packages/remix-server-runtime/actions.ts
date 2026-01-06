export function throwIfPotentialCSRFAttack(headers: Headers) {
  let originHeader = headers.get("origin");
  let originDomain =
    typeof originHeader === "string" && originHeader !== "null"
      ? new URL(originHeader).host
      : originHeader;
  let host = parseHostHeader(headers);

  if (originDomain && (!host || originDomain !== host.value)) {
    if (host) {
      // This seems to be an CSRF attack. We should not proceed with the action.
      throw new Error(
        `${host.type} header does not match \`origin\` header from a forwarded ` +
          `action request. Aborting the action.`
      );
    } else {
      // This is an attack. We should not proceed with the action.
      throw new Error(
        "`x-forwarded-host` or `host` headers are not provided. One of these " +
          "is needed to compare the `origin` header from a forwarded action " +
          "request. Aborting the action."
      );
    }
  }
}

function parseHostHeader(headers: Headers) {
  let forwardedHostHeader = headers.get("x-forwarded-host");
  let forwardedHostValue = forwardedHostHeader?.split(",")[0]?.trim();
  let hostHeader = headers.get("host");

  return forwardedHostValue
    ? {
        type: "x-forwarded-host",
        value: forwardedHostValue,
      }
    : hostHeader
    ? {
        type: "host",
        value: hostHeader,
      }
    : undefined;
}
