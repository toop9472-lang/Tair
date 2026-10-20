#!/usr/bin/env bash
# طير — Daily MongoDB backup script.
#
# Dumps the current database to a timestamped .tar.gz file. Designed to be
# invoked from cron on a machine that has access to your production MongoDB
# (NOT this Kubernetes preview pod — pods are ephemeral).
#
# Usage:
#   # 1. Copy this file to your VPS / backup server
#   # 2. Set env vars:
#   export MONGO_URL="mongodb+srv://user:pass@cluster/db"
#   export DB_NAME="saqr_db"
#   export BACKUP_DIR="/var/backups/tair"
#   export RETENTION_DAYS=14              # optional (default: 14)
#   export S3_BUCKET=""                   # optional — if set, uploads to S3
#   # 3. Test manually:
#   ./backup_mongo.sh
#   # 4. Add to crontab (daily at 03:00 KSA time = 00:00 UTC):
#   0 0 * * * MONGO_URL=... DB_NAME=... BACKUP_DIR=... /path/to/backup_mongo.sh >> /var/log/tair-backup.log 2>&1

set -euo pipefail

MONGO_URL="${MONGO_URL:?MONGO_URL is required}"
DB_NAME="${DB_NAME:?DB_NAME is required}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tair}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

TS="$(date -u +%Y%m%d-%H%M%S)"
WORK_DIR="${BACKUP_DIR}/work-${TS}"
ARCHIVE="${BACKUP_DIR}/tair-${DB_NAME}-${TS}.tar.gz"

mkdir -p "${BACKUP_DIR}" "${WORK_DIR}"

echo "[$(date -u +%FT%TZ)] Starting mongodump for ${DB_NAME}"
mongodump --uri="${MONGO_URL}" --db="${DB_NAME}" --out="${WORK_DIR}" --gzip --quiet

echo "[$(date -u +%FT%TZ)] Compressing to ${ARCHIVE}"
tar -czf "${ARCHIVE}" -C "${WORK_DIR}" .
rm -rf "${WORK_DIR}"

SIZE=$(du -h "${ARCHIVE}" | awk '{print $1}')
echo "[$(date -u +%FT%TZ)] Backup complete: ${ARCHIVE} (${SIZE})"

# Optional: upload to S3-compatible storage
if [ -n "${S3_BUCKET:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    echo "[$(date -u +%FT%TZ)] Uploading to s3://${S3_BUCKET}/"
    aws s3 cp "${ARCHIVE}" "s3://${S3_BUCKET}/" --only-show-errors
  else
    echo "[warn] S3_BUCKET set but 'aws' CLI missing — skipping upload"
  fi
fi

# Retention: delete backups older than RETENTION_DAYS
echo "[$(date -u +%FT%TZ)] Pruning backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -maxdepth 1 -name "tair-*.tar.gz" -type f -mtime "+${RETENTION_DAYS}" -delete || true

echo "[$(date -u +%FT%TZ)] Done."
