#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/xiaoxuan/app}"
ENV_FILE="${ENV_FILE:-/srv/xiaoxuan/shared/app.env}"
LOCK_FILE="${LOCK_FILE:-/tmp/xiaoxuan-deploy.lock}"

exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Another deployment is running."; exit 1; }

cd "$APP_DIR"
test -f "$ENV_FILE" || { echo "Missing $ENV_FILE"; exit 1; }

export APP_UID="${APP_UID:-$(id -u)}"
export APP_GID="${APP_GID:-$(id -g)}"

previous_image="$(docker image inspect xiaoxuan-site:latest --format '{{.Id}}' 2>/dev/null || true)"
if [ -n "$previous_image" ]; then
  docker tag "$previous_image" xiaoxuan-site:rollback
fi

rollback() {
  trap - ERR
  echo "Deployment failed; restoring previous image."
  if docker image inspect xiaoxuan-site:rollback >/dev/null 2>&1; then
    docker tag xiaoxuan-site:rollback xiaoxuan-site:latest
    docker compose --env-file "$ENV_FILE" up -d --no-build --force-recreate web
  fi
}
trap rollback ERR

docker compose --env-file "$ENV_FILE" build --pull web
docker compose --env-file "$ENV_FILE" up -d --no-deps web

for attempt in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:3000/api/health >/dev/null; then
    trap - ERR
    docker image prune -f --filter "until=168h" >/dev/null
    echo "Deployment succeeded: $(date --iso-8601=seconds)"
    exit 0
  fi
  sleep 2
done

echo "Health check timed out."
exit 1
