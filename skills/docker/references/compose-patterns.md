# Docker Compose v2 Patterns

Advanced Compose patterns for networking, volumes, profiles, secrets, and production configurations.

## Contents

- [Service Dependencies & Health](#service-dependencies--health) — Ordered startup, conditions
- [Profiles](#profiles) — Selective service activation
- [Networking](#networking) — Custom networks, DNS, service discovery
- [Volumes](#volumes) — Named volumes, bind mounts, backup
- [Secrets](#secrets) — File-based secrets, reading in app
- [Environment Variables](#environment-variables) — .env files, interpolation
- [Multi-File Compose](#multi-file-compose) — Override pattern, production config
- [Development Patterns](#development-patterns) — Compose Watch, init container
- [Production Checklist](#production-checklist)

---

## Service Dependencies & Health

### Ordered Startup with Health Checks

```yaml
services:
  db:
    image: postgres:17
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s
    environment:
      POSTGRES_DB: app
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  migrations:
    build: .
    command: ["npm", "run", "migrate"]
    depends_on:
      db:
        condition: service_healthy
    restart: "no"  # Run once, exit

  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
      migrations:
        condition: service_completed_successfully
    ports:
      - "3000:3000"
```

### Dependency Conditions

| Condition | Use Case |
|-----------|----------|
| `service_started` | Default, fire-and-forget |
| `service_healthy` | Wait for health check to pass |
| `service_completed_successfully` | Wait for exit code 0 (migrations, setup) |

---

## Profiles

### Selective Service Activation

```yaml
services:
  api:
    build: .
    # No profile — always starts

  db:
    image: postgres:17
    # No profile — always starts

  redis:
    image: redis:7-alpine
    # No profile — always starts

  # Development-only services
  mailhog:
    image: mailhog/mailhog
    profiles: ["dev"]
    ports:
      - "8025:8025"

  adminer:
    image: adminer
    profiles: ["dev"]
    ports:
      - "8080:8080"

  # Monitoring stack
  prometheus:
    image: prom/prometheus
    profiles: ["monitoring"]
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana
    profiles: ["monitoring"]
    ports:
      - "3001:3000"
```

```bash
# Start core services only
docker compose up

# Start with dev tools
docker compose --profile dev up

# Start with monitoring
docker compose --profile monitoring up

# Start everything
docker compose --profile dev --profile monitoring up
```

---

## Networking

### Custom Networks

```yaml
services:
  api:
    networks:
      - frontend
      - backend

  db:
    networks:
      - backend  # Not accessible from frontend network

  nginx:
    networks:
      - frontend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access
```

### DNS & Service Discovery

Services resolve each other by service name within the same network:

```yaml
services:
  api:
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/app     # "db" resolves
      REDIS_URL: redis://redis:6379                       # "redis" resolves
      CACHE_URL: http://cache:11211                       # "cache" resolves
```

---

## Volumes

### Named Volumes vs Bind Mounts

```yaml
services:
  db:
    volumes:
      # Named volume — managed by Docker, persistent, performant
      - pgdata:/var/lib/postgresql/data

  api:
    volumes:
      # Bind mount — local directory synced to container (dev only)
      - ./src:/app/src
      # Anonymous volume — prevents container write from overwriting
      - /app/node_modules

volumes:
  pgdata:
    driver: local
```

### Volume Backup Pattern

```yaml
services:
  backup:
    image: alpine
    profiles: ["backup"]
    volumes:
      - pgdata:/data:ro
      - ./backups:/backups
    command: >
      sh -c "tar czf /backups/pgdata-$(date +%Y%m%d-%H%M%S).tar.gz -C /data ."
```

---

## Secrets

### File-Based Secrets

```yaml
services:
  api:
    environment:
      # Reference secret file path
      DB_PASSWORD_FILE: /run/secrets/db_password
      JWT_SECRET_FILE: /run/secrets/jwt_secret
    secrets:
      - db_password
      - jwt_secret

secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

### Reading Secrets in Application

```bash
# Shell script pattern
DB_PASSWORD=$(cat /run/secrets/db_password)
```

```javascript
// Node.js pattern
import { readFileSync } from 'fs'
const password = process.env.DB_PASSWORD_FILE
  ? readFileSync(process.env.DB_PASSWORD_FILE, 'utf8').trim()
  : process.env.DB_PASSWORD
```

---

## Environment Variables

### Multiple .env Files

```yaml
services:
  api:
    env_file:
      - .env                # Base config
      - .env.local          # Local overrides (gitignored)
    environment:
      # Explicit overrides take precedence
      NODE_ENV: production
```

### Variable Interpolation

```yaml
# .env
POSTGRES_VERSION=17
APP_PORT=3000

# docker-compose.yml
services:
  db:
    image: postgres:${POSTGRES_VERSION}
  api:
    ports:
      - "${APP_PORT}:3000"
```

---

## Multi-File Compose

### Override Pattern

```bash
# Base + override (auto-merged)
# docker-compose.yml         ← base
# docker-compose.override.yml ← dev overrides (auto-loaded)

docker compose up  # loads both automatically

# Production: explicit file
docker compose -f docker-compose.yml -f docker-compose.prod.yml up
```

```yaml
# docker-compose.yml (base)
services:
  api:
    build: .
    environment:
      NODE_ENV: production

# docker-compose.override.yml (dev — auto-loaded)
services:
  api:
    build:
      target: builder  # Use build stage with dev tools
    volumes:
      - ./src:/app/src  # Hot reload
    environment:
      NODE_ENV: development
      DEBUG: "app:*"
    ports:
      - "9229:9229"  # Debug port

# docker-compose.prod.yml (explicit)
services:
  api:
    image: registry.example.com/api:${TAG}
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "1"
          memory: 512M
    restart: unless-stopped
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

---

## Development Patterns

### Hot Reload with Watch (Compose Watch)

```yaml
services:
  api:
    build: .
    develop:
      watch:
        # Sync source files — triggers hot reload
        - action: sync
          path: ./src
          target: /app/src
        # Rebuild on dependency changes
        - action: rebuild
          path: package.json
        # Sync + restart on config changes
        - action: sync+restart
          path: ./config
          target: /app/config
```

```bash
docker compose watch  # Starts with file watching
docker compose up --watch  # Combined: launch + watch
```

`initial_sync: true` on a watch rule syncs all matching files immediately on startup before monitoring for changes.

### Init Container Pattern

```yaml
services:
  init:
    build: .
    command: ["sh", "-c", "npm run migrate && npm run seed"]
    depends_on:
      db:
        condition: service_healthy
    restart: "no"

  api:
    build: .
    depends_on:
      init:
        condition: service_completed_successfully
```

---

## Production Checklist

A production Compose file should combine the patterns above: `deploy.resources` (limits + reservations), `restart: unless-stopped`, `healthcheck` on every service, `depends_on` with `service_healthy`, `secrets` for credentials, `logging` with `max-size`/`max-file`, and named volumes for persistent data.
