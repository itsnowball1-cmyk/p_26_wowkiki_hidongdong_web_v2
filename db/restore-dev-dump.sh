#!/bin/bash
# 로컬 개발 DB 시딩: 대표님이 pgAdmin으로 뜬 실제 dev Postgres(Supabase) 백업을
# 로컬 Postgres 컨테이너에 그대로 복원한다. (schema-delta/pgloader 경로는 이제 안 씀 —
# 이 dump 가 이미 wowkiki_hidongdong 스키마 전체 + 데이터를 담고 있음)
set -euo pipefail
cd "$(dirname "$0")/.."

DUMP="${1:-backup/dump-postgres-202608111024.sql}"
if [ ! -f "$DUMP" ]; then
  echo "[restore] $DUMP 없음" >&2
  exit 1
fi

echo "[restore] 기존 로컬 데이터 초기화(새 dump로 덮어쓰기 위해 볼륨 삭제 후 재기동)..."
docker compose down -v 2>/dev/null || true

echo "[restore] target(postgres) 기동..."
docker compose up -d db
until docker compose exec -T db pg_isready -U postgres -d wowkiki >/dev/null 2>&1; do sleep 1; done

echo "[restore] citext 확장(스키마 안에 필요, dump 자체엔 CREATE EXTENSION 이 빠져있음) 선생성..."
docker compose exec -T db psql -U postgres -d wowkiki -c \
  "CREATE SCHEMA IF NOT EXISTS wowkiki_hidongdong; CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA wowkiki_hidongdong;"

echo "[restore] dump 복원 (custom-format 이라 psql 이 아니라 pg_restore 사용)..."
echo "[restore]  --no-owner --no-privileges 로 로컬에 없는 role 대상 GRANT/OWNER 문은 통째로 건너뜀..."
docker compose exec -T db pg_restore -U postgres -d wowkiki --no-owner --no-privileges < "$DUMP" || true

echo "[restore] 앱 연결 기본 search_path 를 wowkiki_hidongdong 로 고정..."
docker compose exec -T db psql -U postgres -d wowkiki -c \
  "ALTER DATABASE wowkiki SET search_path TO wowkiki_hidongdong, public;"

echo "[restore] 완료. 테이블/행 수 확인:"
docker compose exec -T db psql -U postgres -d wowkiki -c \
  "SELECT schemaname, relname, n_live_tup FROM pg_stat_user_tables WHERE schemaname='wowkiki_hidongdong' ORDER BY relname;"
