# Database Setup Guide - RegularTravelManager

This guide helps you set up a local PostgreSQL database with PostGIS for development and testing.

## Quick Start (Docker - Recommended)

1. **Start the database:**
   ```bash
   docker-compose up -d
   ```

2. **Run migrations:**
   ```bash
   cd apps/api
   npx ts-node src/database/migration-runner.ts setup
   ```

3. **Run tests:**
   ```bash
   npm run test
   ```

## Manual Installation

### Prerequisites
- PostgreSQL 15+ with PostGIS extension
- Node.js and npm

### 1. Install PostgreSQL + PostGIS

**macOS (Homebrew):**
```bash
brew install postgresql postgis
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get install postgresql postgresql-contrib postgis postgresql-15-postgis-3
sudo systemctl start postgresql
```

### 2. Create Databases

```bash
# Connect as postgres user
sudo -u postgres psql

# Create user and databases
CREATE USER nissim WITH PASSWORD '';
ALTER USER nissim CREATEDB;
CREATE DATABASE travel_manager_dev OWNER nissim;
CREATE DATABASE travel_manager_test OWNER nissim;
\q
```

### 3. Enable PostGIS Extensions

```bash
# Development database
psql -d travel_manager_dev -c "CREATE EXTENSION postgis; CREATE EXTENSION \"uuid-ossp\";"

# Test database
psql -d travel_manager_test -c "CREATE EXTENSION postgis; CREATE EXTENSION \"uuid-ossp\";"
```

### 4. Environment Variables

Create `apps/api/.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=travel_manager_dev
DB_USERNAME=nissim
DB_PASSWORD=

TEST_DATABASE_URL=postgresql://nissim@localhost:5432/travel_manager_test
```

## Database Schema

The database includes:
- **Employees** with home address coordinates
- **Projects and Subprojects** with Swiss locations
- **Travel Requests** with calculated distances
- **PostGIS functions** for geographic calculations
- **Swiss business context** with real coordinates

### Sample Data
The seed data includes:
- 3 employees (Hans Müller, Anna Schneider, Marco Rossi)
- 2 projects with 4 subprojects across Switzerland
- Sample travel requests with distance calculations

## Migration Commands

```bash
cd apps/api

# Run all migrations
npx ts-node src/database/migration-runner.ts migrate

# Seed with sample data
npx ts-node src/database/migration-runner.ts seed

# Full setup (migrate + seed)
npx ts-node src/database/migration-runner.ts setup

# Check migration status
npx ts-node src/database/migration-runner.ts status

# Reset database (careful!)
npx ts-node src/database/migration-runner.ts reset
```

## Testing

### Run All Tests
```bash
cd apps/api
npm run test
```

### Test Categories
- **Schema Tests**: Database structure validation
- **PostGIS Tests**: Geographic function testing with Swiss coordinates
- **Migration Tests**: Schema versioning and rollback
- **Connection Tests**: Pool management and configuration

### Verify Setup
```bash
# Test PostGIS installation
psql -d travel_manager_test -c "SELECT PostGIS_Version();"

# Test Swiss distance calculation (Zürich to Bern ≈ 94km)
psql -d travel_manager_test -c "SELECT ST_Distance(ST_GeomFromText('POINT(8.540192 47.376887)', 4326)::geography, ST_GeomFromText('POINT(7.447447 46.947974)', 4326)::geography) / 1000.0;"
```

## Troubleshooting

**Database connection errors:**
```bash
# Check if PostgreSQL is running
pg_ctl status

# Check database exists
psql -l | grep travel_manager

# Check user permissions
psql -d travel_manager_test -c "CREATE TABLE test (id INT); DROP TABLE test;"
```

**PostGIS extension errors:**
```bash
# Check PostGIS installation
psql -d travel_manager_test -c "\dx"

# Reinstall if needed
psql -d travel_manager_test -c "DROP EXTENSION IF EXISTS postgis CASCADE; CREATE EXTENSION postgis;"
```

**Docker issues:**
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs postgres

# Restart
docker-compose restart
```

## Swiss Geographic Context

The database includes authentic Swiss business locations:
- **Zürich**: Financial center (8.540192, 47.376887)
- **Bern**: Capital city (7.447447, 46.947974)
- **Basel**: Industrial hub (7.588576, 47.559599)
- **Geneva**: International city (6.143158, 46.204391)
- **Lausanne**: Olympic city (6.633597, 46.519653)
- **St. Gallen**: Eastern Switzerland (9.376716, 47.424057)

All coordinates use WGS84 (EPSG:4326) and distance calculations use PostGIS geographic functions for accurate straight-line distances.