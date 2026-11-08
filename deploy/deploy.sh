#!/usr/bin/env bash
# Deploys one release on the production server (openspec/specs/runtime, «Деплой по релизу»).
# The workflow runs it over SSH as the user `deploy`, so it is always the version of the release:
#
#   ssh deploy@host bash -s -- v0.1.0 < deploy/deploy.sh
#
# The frontend and the product site of the release must already be in
# /srv/authorled/web/incoming/<tag> and /srv/authorled/site/incoming/<tag>.
# Any failed step stops the script; nothing is rolled back on its own.

set -euo pipefail

readonly ROOT=/srv/authorled
readonly APP="${ROOT}/app"
readonly WEB="${ROOT}/web"
readonly SITE="${ROOT}/site"
readonly BACKUPS="${ROOT}/backups"
readonly KEEP_BACKUPS=10
readonly VOLUME=authorled_pgdata
readonly COMPOSE=(docker compose -p authorled -f compose.yaml -f compose.prod.yaml)

fail() {
    echo "deploy: $*" >&2
    exit 1
}

check_inputs() {
    [[ $# -eq 1 ]] || fail "usage: deploy.sh <tag>"
    [[ "$1" =~ ^v[0-9A-Za-z._-]+$ ]] || fail "not a release tag: $1"
    [[ -d "${APP}/.git" ]] || fail "${APP} is not a clone of the repository"
    [[ -r "${APP}/.env" ]] || fail "${APP}/.env is missing or unreadable"
    [[ -d "${BACKUPS}" ]] || fail "${BACKUPS} is missing"
    [[ -f "${WEB}/incoming/$1/index.html" ]] || fail "frontend of $1 is missing in ${WEB}/incoming"
    [[ -f "${SITE}/incoming/$1/index.html" ]] || fail "site of $1 is missing in ${SITE}/incoming"
}

fetch_tag() {
    git fetch --tags --force --quiet origin
    git rev-parse --quiet --verify "refs/tags/$1^{commit}" >/dev/null || fail "tag $1 is not in the repository"
}

# Migrations only go forward, so the copy comes before the new code. One database holds the
# schemas ai, authorled and authentik.
backup_database() {
    if ! docker volume inspect "${VOLUME}" >/dev/null 2>&1; then
        echo "deploy: no volume ${VOLUME}, first deployment: nothing to back up"
        return
    fi
    "${COMPOSE[@]}" up -d --wait agentos-db

    local name part
    name="$(date -u +%Y%m%dT%H%M%SZ)-$1.dump"
    part="${BACKUPS}/${name}.part"
    if ! (umask 077 && "${COMPOSE[@]}" exec -T agentos-db pg_dump -U ai -d ai -Fc >"${part}"); then
        rm -f -- "${part}"
        fail "pg_dump failed, the code stays on the previous version"
    fi
    [[ -s "${part}" ]] || fail "the database copy is empty"
    "${COMPOSE[@]}" exec -T agentos-db pg_restore --list <"${part}" >/dev/null
    mv "${part}" "${BACKUPS}/${name}"
    echo "deploy: database copy ${name}"

    # Names start with the time, so the glob lists them from the oldest.
    local dumps=("${BACKUPS}"/*.dump)
    local extra=$((${#dumps[@]} - KEEP_BACKUPS))
    if ((extra > 0)); then
        rm -- "${dumps[@]:0:extra}"
    fi
}

# Static files of a release (the frontend or the site): incoming/<tag> becomes <tag>, `current`
# points to it, other versions go away.
switch_release() {
    local base="$1" tag="$2"
    rm -rf -- "${base:?}/${tag}"
    mv "${base}/incoming/${tag}" "${base}/${tag}"
    ln -sfn "${base}/${tag}" "${base}/current"
    local dir
    for dir in "${base}"/v*; do
        if [[ "${dir}" != "${base}/${tag}" ]]; then
            rm -rf -- "${dir}"
        fi
    done
}

# Authentik applies a blueprint again only when its file changes, so a new value in .env (an
# address of the product, the brand domain) would never reach it (openspec/specs/auth,
# «Конфигурация из blueprints»). Applying an unchanged blueprint again changes nothing.
apply_blueprints() {
    "${COMPOSE[@]}" up -d --wait authentik-server authentik-worker
    local files=(auth/blueprints/*.yaml)
    [[ -f "${files[0]}" ]] || fail "no blueprints in auth/blueprints"
    local file
    for file in "${files[@]}"; do
        "${COMPOSE[@]}" exec -T authentik-worker ak apply_blueprint "/blueprints/custom/${file##*/}" \
            || fail "blueprint ${file} was not applied"
    done
    echo "deploy: blueprints applied: ${#files[@]}"
}

main() {
    check_inputs "$@"
    local tag="$1"
    cd "${APP}"

    fetch_tag "${tag}"
    backup_database "${tag}"
    git checkout --quiet --detach "refs/tags/${tag}"
    "${COMPOSE[@]}" up -d --build
    apply_blueprints
    switch_release "${WEB}" "${tag}"
    switch_release "${SITE}" "${tag}"

    caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
    sudo -n systemctl reload caddy

    docker builder prune --force --filter until=168h >/dev/null
    docker image prune --force >/dev/null
    echo "deploy: ${tag} is running"
}

main "$@"
