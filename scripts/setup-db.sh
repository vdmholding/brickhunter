#!/usr/bin/env bash
set -e

DB_NAME="${BRICKHUNTER_DB_NAME:-brickhunter}"
DB_USER="${BRICKHUNTER_DB_USER:-brickhunter}"
DB_PASS="${BRICKHUNTER_DB_PASS:-brickhunter}"

echo "Creating database user '$DB_USER'..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "  User already exists, skipping"

echo "Creating database '$DB_NAME'..."
sudo -u postgres createdb "$DB_NAME" 2>/dev/null || echo "  Database already exists, skipping"

echo "Granting privileges..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;"

echo ""
echo "Database ready. Connection string:"
echo "  postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo ""
echo "Add this to your .env file:"
echo "  DATABASE_URL=postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
echo ""
echo "Next steps:"
echo "  cp .env.example .env    # if you haven't already"
echo "  npm run migrate         # create tables"
echo "  npm run seed            # (optional) load Lego catalogue from Rebrickable"
