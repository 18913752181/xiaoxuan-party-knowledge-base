#!/bin/sh
set -eu

mkdir -p /app/content /app/data

if [ -z "$(find /app/content -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
  cp -a /app/seed/content/. /app/content/
fi

if [ -z "$(find /app/data -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
  cp -a /app/seed/data/. /app/data/
fi

# Publish newly bundled education-base illustrations into empty database image
# fields. Existing admin edits remain authoritative and are never overwritten.
node /app/deploy/sync-education-base-visuals.mjs

exec "$@"
