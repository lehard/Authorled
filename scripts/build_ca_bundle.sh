#!/usr/bin/env bash

############################################################################
#
#    Build litellm/certs/ca-bundle.pem for the LiteLLM proxy
#
#    The proxy uses this file as SSL_CERT_FILE, so it must hold the public
#    CAs (DeepSeek) and the Russian Trusted Root CA and Sub CA (GigaChat).
#    Public CAs come from certifi in the active Python environment.
#
#    Usage (with .venv active):
#      ./scripts/build_ca_bundle.sh
#
############################################################################

set -euo pipefail

CURR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "${CURR_DIR}")"
OUT="${REPO_ROOT}/litellm/certs/ca-bundle.pem"
BASE_URL="https://gu-st.ru/content/lending"
CERTS=(russian_trusted_root_ca_pem.crt russian_trusted_sub_ca_pem.crt)

CERTIFI_BUNDLE="$(python -c 'import certifi; print(certifi.where())')"

WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

for cert in "${CERTS[@]}"; do
    curl --fail --silent --show-error --max-time 30 -o "${WORK}/${cert}" "${BASE_URL}/${cert}"
    subject="$(openssl x509 -in "${WORK}/${cert}" -noout -subject)"
    if [[ "${subject}" != *"Russian Trusted"* ]]; then
        echo "Unexpected certificate subject in ${cert}: ${subject}" >&2
        exit 1
    fi
    echo "${subject}"
    openssl x509 -in "${WORK}/${cert}" -noout -fingerprint -sha256
done

mkdir -p "$(dirname "${OUT}")"
# The downloaded certificates may lack a trailing newline; without the explicit
# one, END and BEGIN lines of adjacent certificates merge and the bundle is unreadable.
{
    cat "${CERTIFI_BUNDLE}"
    for cert in "${CERTS[@]}"; do
        printf '\n'
        cat "${WORK}/${cert}"
    done
    printf '\n'
} > "${OUT}"
python -c 'import ssl, sys; ssl.create_default_context(cafile=sys.argv[1])' "${OUT}"
echo "Wrote ${OUT}"
