#!/bin/sh
set -e

export DB_HOST=$(node -p "require('./dist/config/app').config.db.host")
export DB_PORT=$(node -p "require('./dist/config/app').config.db.port")
export DB_USER=$(node -p "require('./dist/config/app').config.db.user")
export DB_PASSWORD=$(node -p "require('./dist/config/app').config.db.password")
export DB_NAME=$(node -p "require('./dist/config/app').config.db.name")

echo "Database connection parameters extracted:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo "  DB Name: $DB_NAME"

# Fallback defaults if any are empty
[ -z "$DB_HOST" ] && DB_HOST="db"
[ -z "$DB_PORT" ] && DB_PORT="5432"

# Validate DB_PORT is numeric, fallback if invalid
case "$DB_PORT" in
  ''|*[!0-9]*)
    echo "Warning: Invalid DB_PORT '$DB_PORT', falling back to 5432"
    DB_PORT="5432"
    ;;
esac
[ -z "$DB_USER" ] && DB_USER="postgres"
[ -z "$DB_PASSWORD" ] && DB_PASSWORD="postgres"
[ -z "$DB_NAME" ] && DB_NAME="postgres"

export DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME

echo "Waiting for database to be ready at $DB_HOST:$DB_PORT..."
./wait-for-it.sh postgres:${DB_PORT} -t 30 -- echo "Postgres is up - continuing"

echo "Running database migrations..."
node dist/db/migrate.js

echo "Starting backend server..."
npm start