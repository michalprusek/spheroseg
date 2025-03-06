import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Database connection parameters
db_params = {
    "host": os.environ.get("DB_HOST", "postgres"),
    "database": os.environ.get("DB_NAME", "spheroseg"),
    "user": os.environ.get("DB_USER", "spheroseg"),
    "password": os.environ.get("DB_PASSWORD", "spheroseg"),
}

def run_migration():
    """Run the database migration script"""
    print("Starting database migration...")
    
    # Connect to the database
    connection = psycopg2.connect(**db_params)
    connection.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = connection.cursor()
    
    try:
        # Read the migration SQL file
        with open("./db/migration.sql", "r") as f:
            migration_sql = f.read()
        
        # Execute the migration script
        print("Executing migration SQL...")
        cursor.execute(migration_sql)
        
        print("Migration completed successfully!")
    except Exception as e:
        print(f"Error during migration: {e}")
    finally:
        cursor.close()
        connection.close()

if __name__ == "__main__":
    run_migration()