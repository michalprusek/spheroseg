from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, MetaData, Table, text
from sqlalchemy.sql import func
from passlib.context import CryptContext
import os
from dotenv import load_dotenv
import logging

# Nastavení loggeru
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Načtení proměnných prostředí
load_dotenv()

# Připojení k databázi
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/spheroseg")
engine = create_engine(DATABASE_URL)
metadata = MetaData()

# Definice tabulky users (musí odpovídat aktuálnímu schématu v databázi)
users = Table(
    'users',
    metadata,
    Column('id', Integer, primary_key=True, index=True),
    Column('username', String, unique=True, index=True),
    Column('email', String, unique=True, index=True),
    Column('hashed_password', String),
    Column('is_active', Boolean, default=True),
    Column('created_at', DateTime(timezone=True), server_default=func.now()),
)

try:
    # Zjištění, zda existují sloupce
    connection = engine.connect()
    insp = connection.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"))
    columns = [row[0] for row in insp]
    
    # Přidání chybějících sloupců
    if 'full_name' not in columns:
        logger.info("Sloupec full_name neexistuje v tabulce users, přidávání...")
        connection.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR"))
        connection.commit()
        logger.info("Sloupec full_name byl přidán.")
    
    if 'profile_picture' not in columns:
        logger.info("Sloupec profile_picture neexistuje v tabulce users, přidávání...")
        connection.execute(text("ALTER TABLE users ADD COLUMN profile_picture VARCHAR"))
        connection.commit()
        logger.info("Sloupec profile_picture byl přidán.")

    if 'language' not in columns:
        logger.info("Sloupec language neexistuje v tabulce users, přidávání...")
        connection.execute(text("ALTER TABLE users ADD COLUMN language VARCHAR DEFAULT 'cs-CZ'"))
        connection.commit()
        logger.info("Sloupec language byl přidán.")

    if 'theme' not in columns:
        logger.info("Sloupec theme neexistuje v tabulce users, přidávání...")
        connection.execute(text("ALTER TABLE users ADD COLUMN theme VARCHAR DEFAULT 'light'"))
        connection.commit()
        logger.info("Sloupec theme byl přidán.")
    
    if 'segmentation_settings' not in columns:
        logger.info("Sloupec segmentation_settings neexistuje v tabulce users, přidávání...")
        connection.execute(text("ALTER TABLE users ADD COLUMN segmentation_settings VARCHAR"))
        connection.commit()
        logger.info("Sloupec segmentation_settings byl přidán.")
    
    connection.close()
            
except Exception as e:
    logger.error(f"Chyba při kontrole sloupců: {str(e)}")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_user(username: str, email: str, password: str):
    try:
        # Kontrola, zda uživatel již existuje
        with engine.connect() as conn:
            result = conn.execute(
                users.select().where(users.c.username == username)
            ).fetchone()
            
            if result:
                logger.warning(f"Uživatel {username} již existuje.")
                return
        
        # Vytvoření hashe hesla
        hashed_password = pwd_context.hash(password)
        
        # Vložení uživatele do databáze
        with engine.connect() as conn:
            conn.execute(
                users.insert().values(
                    username=username,
                    email=email,
                    hashed_password=hashed_password,
                    is_active=True,
                    full_name=f"Test User ({username})"
                )
            )
            conn.commit()
            logger.info(f"Uživatel {username} byl úspěšně vytvořen.")
    
    except Exception as e:
        logger.error(f"Chyba při vytváření uživatele: {str(e)}")
        raise

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        logger.error("Použití: python create_user.py <username> <password> [email]")
        sys.exit(1)
    
    username = sys.argv[1]
    password = sys.argv[2]
    email = sys.argv[3] if len(sys.argv) > 3 else f"{username}@example.com"
    
    logger.info("Spouštím vytváření testovacího uživatele...")
    try:
        create_user(username, email, password)
        logger.info("Hotovo.")
    except Exception as e:
        logger.error(f"Testovací uživatel nebyl vytvořen: {str(e)}")
        sys.exit(1) 