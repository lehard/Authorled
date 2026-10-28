#!/bin/sh
# Writes the public signing keys of the Authentik provider to /out/jwks.json.
# The provider is created by the blueprints a few seconds after the server is healthy, so the
# script waits for the keys up to AUTH_JWKS_WAIT_SECONDS and then fails; it never writes a file
# without keys.
set -eu

: "${AUTHENTIK_URL:?AUTHENTIK_URL must be set}"
: "${AUTH_APPLICATION_SLUG:?AUTH_APPLICATION_SLUG must be set}"
: "${AUTH_JWKS_WAIT_SECONDS:?AUTH_JWKS_WAIT_SECONDS must be set}"

url="${AUTHENTIK_URL}/application/o/${AUTH_APPLICATION_SLUG}/jwks/"
tmp="/out/jwks.json.tmp"
deadline=$(( $(date +%s) + AUTH_JWKS_WAIT_SECONDS ))

while :; do
    if curl --fail --silent --max-time 30 "${url}" -o "${tmp}" && grep -q '"kid"' "${tmp}"; then
        mv "${tmp}" /out/jwks.json
        echo "authentik-jwks-export: wrote /out/jwks.json from ${url}"
        exit 0
    fi
    if [ "$(date +%s)" -ge "${deadline}" ]; then
        rm -f "${tmp}"
        echo "authentik-jwks-export: no signing keys at ${url} after ${AUTH_JWKS_WAIT_SECONDS}s" >&2
        exit 1
    fi
    sleep 3
done
