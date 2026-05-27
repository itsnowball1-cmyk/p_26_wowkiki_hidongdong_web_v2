#!/bin/bash
# dump 파일을 MariaDB 10.3 으로 import.
# dump 첫 줄의 `/*M!999999\- enable the sandbox mode */` 는 MariaDB 11.x 전용 CLI
# 디렉티브로 10.3 파서가 거부하므로 import 직전에만 제거하고 보낸다 (dump 원본은
# 손대지 않는다).
set -euo pipefail
echo "[init] importing /tmp/dump.sql into ${MYSQL_DATABASE} ..."
sed '/enable the sandbox mode/d' /tmp/dump.sql \
  | mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" "${MYSQL_DATABASE}"
echo "[init] import done."
