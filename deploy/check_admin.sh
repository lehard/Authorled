#!/usr/bin/env bash
# Checks the admin interface of Authentik after a deploy (openspec/specs/runtime, «Проверка после деплоя»;
# openspec/specs/auth, «Интерфейс Authentik», «Потоки на публичных адресах»):
#   1. the admin host has a valid server certificate, asks for a client certificate of the owner's CA
#      and refuses a connection without one (no HTTP answer);
#   2. the Host of the admin host over the TLS name of the Authentik host is refused by the proxy;
#   3. /if/admin/ on the Authentik host answers 404;
#   4. a default flow of Authentik answers 404 on the Authentik host and on the service host;
#   5. the sign-in flow of the product is open on the service host.
# Nothing is changed; a flow started by check 5 is an anonymous session that expires on its own.
#
#   deploy/check_admin.sh admin.soavtor.app https://auth.soavtor.app https://app.soavtor.app

set -euo pipefail

[[ $# -eq 3 ]] || { echo "usage: check_admin.sh <admin host> <Authentik origin> <service origin>" >&2; exit 2; }
admin_host="$1"
auth_origin="${2%/}"
app_origin="${3%/}"
auth_host="${auth_origin#https://}"
readonly CA_NAME="CN=Authorled admin CA"
failed=0

error() {
    echo "::error::$*" >&2
    failed=1
}

expect() {
    local want="$1" got="$2" what="$3"
    if [[ "$got" != "$want" ]]; then
        error "${what} answered ${got} instead of ${want}"
    else
        echo "check_admin: ${what} ${got}"
    fi
}

status() {
    curl -sS -o /dev/null --max-time 15 -w '%{http_code}' "$@"
}

# 1. Without DNS or a server certificate the refusal below would pass too, so the handshake is checked first.
handshake="$(openssl s_client -connect "${admin_host}:443" -servername "$admin_host" -verify_hostname "$admin_host" \
    </dev/null 2>/dev/null || true)"
if ! grep -q 'Verify return code: 0 (ok)' <<<"$handshake"; then
    error "${admin_host}: the server certificate does not verify (DNS, certificate of the site)"
elif ! sed -n '/Acceptable client certificate CA names/,/^[A-Z]/p' <<<"$handshake" | grep -q "$CA_NAME"; then
    error "${admin_host}: the server does not ask for a client certificate of «${CA_NAME}»"
else
    echo "check_admin: ${admin_host} asks for a client certificate of «${CA_NAME}»"
fi
if code="$(curl -sS -o /dev/null --max-time 15 -w '%{http_code}' "https://${admin_host}/if/admin/" 2>/dev/null)"; then
    error "https://${admin_host}/if/admin/ answered ${code} without a client certificate"
else
    echo "check_admin: https://${admin_host}/if/admin/ refused without a client certificate"
fi

# 2. The proxy refuses a Host that differs from the TLS name (strict SNI-Host with client_auth).
code="$(status -H "Host: ${admin_host}" "${auth_origin}/if/admin/")"
if [[ "$code" == 421 || "$code" == 403 ]]; then
    echo "check_admin: Host ${admin_host} over ${auth_host} ${code}"
else
    error "Host ${admin_host} over ${auth_host} answered ${code} instead of 421 or 403"
fi

# 3–5.
expect 404 "$(status "${auth_origin}/if/admin/")" "${auth_origin}/if/admin/"
expect 404 "$(status "${auth_origin}/api/v3/flows/executor/default-authentication-flow/")" \
    "${auth_origin}/api/v3/flows/executor/default-authentication-flow/"
expect 404 "$(status "${app_origin}/api/v3/flows/executor/default-authentication-flow/")" \
    "${app_origin}/api/v3/flows/executor/default-authentication-flow/"
expect 200 "$(status "${app_origin}/api/v3/flows/executor/authorled-authentication/?query=")" \
    "${app_origin}/api/v3/flows/executor/authorled-authentication/"

exit "$failed"
