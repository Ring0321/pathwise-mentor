#!/usr/bin/env bash
set -euo pipefail

CODE_FILE="${1:-/tmp/sepath-teacher-access-code.txt}"
ENV_FILE="${2:-/etc/sepath/sepath-api.env}"
SERVICE_NAME="${3:-sepath-api}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash deploy/tencent/sync_teacher_access_code.sh"
  exit 1
fi

if [ ! -f "$CODE_FILE" ]; then
  echo "Teacher access-code file does not exist: $CODE_FILE"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "SE-Path environment file does not exist: $ENV_FILE"
  exit 1
fi

ACCESS_CODE="$(tr -d '\r\n' < "$CODE_FILE")"
if [ -z "$ACCESS_CODE" ]; then
  echo "Teacher access code is empty"
  exit 1
fi

umask 077
BACKUP_FILE="${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
TMP_FILE="$(mktemp)"

cp "$ENV_FILE" "$BACKUP_FILE"
grep -v '^SEPATH_TEACHER_ACCESS_CODE=' "$ENV_FILE" > "$TMP_FILE" || true
printf 'SEPATH_TEACHER_ACCESS_CODE=%s\n' "$ACCESS_CODE" >> "$TMP_FILE"
install -m 600 "$TMP_FILE" "$ENV_FILE"
rm -f "$TMP_FILE" "$CODE_FILE"

systemctl restart "$SERVICE_NAME"
systemctl is-active "$SERVICE_NAME"
echo "Teacher access code synchronized and service restarted."
