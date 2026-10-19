#!/bin/sh
# 确保数据目录可写，然后以非 root 用户运行
set -e
mkdir -p "${DATA_DIR:-/app/data}"
if [ "$(id -u)" = "0" ]; then
  chown -R app:app "${DATA_DIR:-/app/data}"
  exec setpriv --reuid=app --regid=app --init-groups "$@"
fi
exec "$@"
