#!/usr/bin/env bash
# Checks the frontend built for the server (openspec/specs/runtime, «Чистые данные сервера»):
# no quick sign-in of development. A text of the sign-in screen must be found first, so the check
# cannot pass just because the texts of the bundle are encoded differently.
#
#   deploy/check_web_build.sh web/dist

set -euo pipefail

[[ $# -eq 1 ]] || { echo "usage: check_web_build.sh <dist directory>" >&2; exit 2; }
dist="$1"
[[ -f "${dist}/index.html" ]] || { echo "check_web_build: no index.html in ${dist}" >&2; exit 1; }

if ! grep -rq "Другая почта" "${dist}"; then
    echo "check_web_build: the sign-in screen is not found in ${dist}" >&2
    exit 1
fi
if grep -rlE "Войти как (Сценарист|Редактор)" "${dist}"; then
    echo "check_web_build: quick sign-in of development is in the build" >&2
    exit 1
fi
echo "check_web_build: ok"
