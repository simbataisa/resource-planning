#!/bin/sh
# Runs once, on the first start with an empty data volume (design 12.2, 11 "IdP isolation").
# Two databases, two roles. Neither role can connect to the other's database.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v app_pw="$APP_DB_PASSWORD" -v kc_pw="$KEYCLOAK_DB_PASSWORD" <<'SQL'
-- CREATEDB lets `prisma migrate dev` create its shadow database. Local only:
-- server environments create the app role without it (design 12.4).
CREATE ROLE app_user LOGIN CREATEDB PASSWORD :'app_pw';
CREATE ROLE keycloak_user LOGIN PASSWORD :'kc_pw';

CREATE DATABASE app OWNER app_user;
CREATE DATABASE keycloak OWNER keycloak_user;

REVOKE ALL ON DATABASE app FROM PUBLIC;
REVOKE ALL ON DATABASE keycloak FROM PUBLIC;
GRANT CONNECT ON DATABASE app TO app_user;
GRANT CONNECT ON DATABASE keycloak TO keycloak_user;
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname app <<'SQL'
ALTER SCHEMA public OWNER TO app_user;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname keycloak <<'SQL'
ALTER SCHEMA public OWNER TO keycloak_user;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL

echo "sit-sizing: databases 'app' and 'keycloak' created with separate roles"
