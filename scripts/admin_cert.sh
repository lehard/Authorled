#!/usr/bin/env bash
# Client certificate of the owner for the Authentik admin interface (admin.soavtor.app;
# openspec/specs/runtime, «Обратный прокси»; README, Module auth, «Admin interface»).
# Runs on the owner's computer, never on the server. The keys stay in the directory below;
# only ca.pem goes to the server as /etc/authorled/admin-client-ca.pem.
#
#   scripts/admin_cert.sh init [--replace-ca] [--dir <dir>]   CA (10 years) and a client certificate
#   scripts/admin_cert.sh client [--dir <dir>]                a new client certificate (2 years)
#
# The directory is ~/.config/authorled/admin-ca unless --dir names another one. The password of the
# .p12 is asked twice and stored nowhere. The .p12 uses PBE-SHA1-3DES with a SHA1 MAC: the
# Keychain of macOS does not import the newer PKCS#12 encryption.

set -euo pipefail

readonly CA_DAYS=3650
readonly CLIENT_DAYS=730
readonly CA_SUBJECT="/O=Authorled/CN=Authorled admin CA"

fail() {
    echo "admin_cert: $*" >&2
    exit 1
}

usage() {
    echo "usage: admin_cert.sh init [--replace-ca] [--dir <dir>] | client [--dir <dir>]" >&2
    exit 2
}

[[ $# -ge 1 ]] || usage
command_name="$1"
shift
replace_ca=0
dir="${HOME}/.config/authorled/admin-ca"
while [[ $# -gt 0 ]]; do
    case "$1" in
    --replace-ca) replace_ca=1 ;;
    --dir)
        [[ $# -ge 2 ]] || usage
        dir="$2"
        shift
        ;;
    *) usage ;;
    esac
    shift
done
[[ "$command_name" == init || "$command_name" == client ]] || usage
[[ "$command_name" == init || $replace_ca -eq 0 ]] || fail "--replace-ca belongs to init"

command -v openssl >/dev/null || fail "openssl is not installed"

make_ca() {
    if [[ -e "${dir}/ca.key" || -e "${dir}/ca.pem" ]]; then
        [[ $replace_ca -eq 1 ]] || fail "a CA already exists in ${dir}; pass --replace-ca to replace it (the server then needs the new ca.pem)"
    fi
    cat >"${dir}/ca.cnf" <<'EOF'
[req]
distinguished_name = dn
[dn]
[ca]
basicConstraints = critical, CA:TRUE, pathlen:0
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
EOF
    openssl ecparam -name prime256v1 -genkey -noout -out "${dir}/ca.key"
    chmod 600 "${dir}/ca.key"
    openssl req -x509 -new -key "${dir}/ca.key" -sha256 -days "$CA_DAYS" -subj "$CA_SUBJECT" \
        -config "${dir}/ca.cnf" -extensions ca -out "${dir}/ca.pem"
    rm -f "${dir}/ca.srl"
}

ask_password() {
    local first second
    read -r -s -p "Password of client.p12: " first
    echo >&2
    read -r -s -p "Repeat the password: " second
    echo >&2
    [[ -n "$first" ]] || fail "the password of client.p12 must not be empty"
    [[ "$first" == "$second" ]] || fail "the passwords differ"
    P12_PASSWORD="$first"
    export P12_PASSWORD
}

make_client() {
    [[ -f "${dir}/ca.key" && -f "${dir}/ca.pem" ]] || fail "no CA in ${dir}; run: admin_cert.sh init"
    cat >"${dir}/client.cnf" <<'EOF'
[client]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = clientAuth
authorityKeyIdentifier = keyid
EOF
    local subject
    subject="/O=Authorled/CN=Authorled admin $(hostname -s)"
    ask_password
    openssl ecparam -name prime256v1 -genkey -noout -out "${dir}/client.key"
    chmod 600 "${dir}/client.key"
    openssl req -new -key "${dir}/client.key" -subj "$subject" -out "${dir}/client.csr"
    openssl x509 -req -in "${dir}/client.csr" -CA "${dir}/ca.pem" -CAkey "${dir}/ca.key" \
        -CAcreateserial -sha256 -days "$CLIENT_DAYS" -extfile "${dir}/client.cnf" -extensions client \
        -out "${dir}/client.pem" 2>/dev/null
    rm -f "${dir}/client.csr"
    openssl verify -CAfile "${dir}/ca.pem" "${dir}/client.pem" >/dev/null || fail "the new client certificate does not verify against ca.pem"
    openssl pkcs12 -export -inkey "${dir}/client.key" -in "${dir}/client.pem" -certfile "${dir}/ca.pem" \
        -name "Authorled admin" -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1 \
        -passout env:P12_PASSWORD -out "${dir}/client.p12"
    chmod 600 "${dir}/client.p12"
    unset P12_PASSWORD
}

mkdir -p "$dir"
chmod 700 "$dir"
if [[ "$command_name" == init ]]; then
    make_ca
fi
make_client

ca_end="$(openssl x509 -in "${dir}/ca.pem" -noout -enddate | cut -d= -f2)"
client_end="$(openssl x509 -in "${dir}/client.pem" -noout -enddate | cut -d= -f2)"
cat <<EOF
admin_cert: done in ${dir}
  CA:                 ca.pem (valid until ${ca_end}); ca.key never leaves this computer
  client certificate: client.p12 (valid until ${client_end}); renew before that with: admin_cert.sh client
Next:
  1. Import client.p12 into the login keychain: open "${dir}/client.p12"
  2. Put ca.pem on the server as /etc/authorled/admin-client-ca.pem (root, 0644) and reload Caddy
     (only when the CA is new): README, Module auth, «Admin interface».
  3. Open https://admin.soavtor.app/if/admin/ and choose the certificate «Authorled admin».
EOF
