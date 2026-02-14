#!/usr/bin/env bash
set -euo pipefail

PG_BIN_DIR="/usr/lib/postgresql/14/bin"
PGDATA="${PGDATA:-$(pwd)/.pgdata}"
PGPORT="${PGPORT:-5433}"
PGHOST_ADDR="${PGHOST_ADDR:-127.0.0.1}"
PGLOG="$PGDATA/postgres.log"

init_db() {
  if [ ! -d "$PGDATA" ]; then
    "$PG_BIN_DIR/initdb" -D "$PGDATA" --auth-local=trust --auth-host=trust
  fi
}

start_db() {
  init_db
  "$PG_BIN_DIR/pg_ctl" -D "$PGDATA" -l "$PGLOG" -o "-p $PGPORT -h $PGHOST_ADDR -k $PGDATA" start
  "$PG_BIN_DIR/pg_isready" -h "$PGHOST_ADDR" -p "$PGPORT"
}

stop_db() {
  "$PG_BIN_DIR/pg_ctl" -D "$PGDATA" stop || true
}

status_db() {
  "$PG_BIN_DIR/pg_isready" -h "$PGHOST_ADDR" -p "$PGPORT"
}

bootstrap_app_db() {
  "$PG_BIN_DIR/psql" -h "$PGHOST_ADDR" -p "$PGPORT" -U davis -d postgres \
    -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='social') THEN CREATE ROLE social LOGIN PASSWORD 'social'; ELSE ALTER ROLE social WITH LOGIN PASSWORD 'social'; END IF; END \$\$;"

  "$PG_BIN_DIR/psql" -h "$PGHOST_ADDR" -p "$PGPORT" -U davis -d postgres \
    -tAc "SELECT 1 FROM pg_database WHERE datname='social_app';" | grep -q 1 || \
    "$PG_BIN_DIR/createdb" -h "$PGHOST_ADDR" -p "$PGPORT" -U davis -O social social_app

  "$PG_BIN_DIR/psql" -h "$PGHOST_ADDR" -p "$PGPORT" -U davis -d postgres \
    -c "ALTER DATABASE social_app OWNER TO social;"
}

case "${1:-}" in
  start)
    start_db
    ;;
  stop)
    stop_db
    ;;
  status)
    status_db
    ;;
  bootstrap)
    start_db
    bootstrap_app_db
    ;;
  *)
    echo "Usage: $0 {start|stop|status|bootstrap}" >&2
    exit 1
    ;;
esac
