#!/usr/bin/env python3
"""
Skript pro vytvoření testovacího uživatele v databázi.
"""
import sys
import os
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import logging

# Import potřebných modulů - přizpůsobeno pro strukturu v kontejneru
from db.database import SessionLocal, engine, Base
from models.models import User
from services.auth import get_password_hash

# Konfigurace
TEST_USERNAME = "test@example.com"
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "password"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_test_user():
    """
    Vytvoření testovacího uživatele v databázi, pokud neexistuje.
    """
    db = SessionLocal()
    try:
        # Kontrola, zda uživatel existuje
        existing_user = db.query(User).filter(User.username == TEST_USERNAME).first()
        if existing_user:
            logger.info(f"Testovací uživatel '{TEST_USERNAME}' již existuje.")
            return existing_user

        # Vytvoření uživatele
        hashed_password = get_password_hash(TEST_PASSWORD)
        new_user = User(
            username=TEST_USERNAME,
            email=TEST_EMAIL,
            hashed_password=hashed_password,
            is_active=True
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        logger.info(f"Testovací uživatel '{TEST_USERNAME}' byl vytvořen.")
        return new_user
    except IntegrityError:
        db.rollback()
        logger.error("Chyba při vytváření uživatele - pravděpodobně již existuje.")
        return None
    except Exception as e:
        db.rollback()
        logger.error(f"Chyba při vytváření testovacího uživatele: {e}")
        return None
    finally:
        db.close()

if __name__ == "__main__":
    try:
        logger.info("Spouštím vytváření testovacího uživatele...")
        user = create_test_user()
        if user:
            logger.info(f"Testovací uživatel je k dispozici. ID: {user.id}")
        else:
            logger.warning("Testovací uživatel nebyl vytvořen.")
    except Exception as e:
        logger.error(f"Neočekávaná chyba: {e}")
        sys.exit(1) 