#!/bin/sh
set -eu

mkdir -p /app/content /app/data

if [ -z "$(find /app/content -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
  cp -a /app/seed/content/. /app/content/
fi

if [ -z "$(find /app/data -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
  cp -a /app/seed/data/. /app/data/
fi

exec "$@"
