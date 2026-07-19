#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_DIR="${SOURCE_DIR:-/srv/xiaoxuan/shared}"
BACKUP_DIR="${BACKUP_DIR:-/srv/xiaoxuan/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
timestamp="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
tar --create --gzip --file "$BACKUP_DIR/xiaoxuan-$timestamp.tar.gz" \
  --directory "$SOURCE_DIR" content data app.env
find "$BACKUP_DIR" -type f -name 'xiaoxuan-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete
