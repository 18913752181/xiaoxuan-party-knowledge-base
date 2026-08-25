#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/srv/xiaoxuan/app}"
ENV_FILE="${ENV_FILE:-/srv/xiaoxuan/shared/app.env}"
LOCK_FILE="${LOCK_FILE:-/tmp/xiaoxuan-deploy.lock}"
CONTENT_DIR="${CONTENT_DIR:-/srv/xiaoxuan/shared/content}"

exec 9>"$LOCK_FILE"
flock -n 9 || { echo "Another deployment is running."; exit 1; }

cd "$APP_DIR"
test -f "$ENV_FILE" || { echo "Missing $ENV_FILE"; exit 1; }

export APP_UID="${APP_UID:-$(id -u)}"
export APP_GID="${APP_GID:-$(id -g)}"

# Seed production content from the repository ONLY when the content directory
# is empty (first deployment). Afterwards, production is the source of truth:
# admin-panel edits live in shared/content and deployments must NOT wipe them.
# To sync production content back into the repository, commit it manually.
mkdir -p "$CONTENT_DIR"
if [ -d "$APP_DIR/content" ] && [ -z "$(ls -A "$CONTENT_DIR" 2>/dev/null)" ]; then
  case "$CONTENT_DIR" in
    /srv/xiaoxuan/shared/content|/srv/xiaoxuan/shared/content/)
      cp -a "$APP_DIR/content/." "$CONTENT_DIR/"
      echo "Seeded empty content directory from repository."
      ;;
    *)
      echo "Refusing to seed unexpected content directory: $CONTENT_DIR"
      exit 1
      ;;
  esac
fi

previous_image="$(docker image inspect xiaoxuan-site:latest --format '{{.Id}}' 2>/dev/null || true)"
if [ -n "$previous_image" ]; then
  docker tag "$previous_image" xiaoxuan-site:rollback
fi

rollback() {
  trap - ERR
  echo "Deployment failed; restoring previous image."
  if docker image inspect xiaoxuan-site:rollback >/dev/null 2>&1; then
    docker tag xiaoxuan-site:rollback xiaoxuan-site:latest
    docker compose --env-file "$ENV_FILE" up -d --no-build --force-recreate web reminder-dispatcher
  fi
}
trap rollback ERR

docker compose --env-file "$ENV_FILE" build --pull web
docker compose --env-file "$ENV_FILE" up -d --no-deps web reminder-dispatcher

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
