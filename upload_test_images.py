#!/usr/bin/env python3
"""
Skript pro nahrání testovacích obrázků do aplikace.
"""
import os
import sys
import requests
import json
from pathlib import Path

# Konfigurace
API_URL = "http://localhost:8000"
TEST_IMAGES_DIR = Path("public/test-images")
PROJECT_NAME = "Testovací projekt"
PROJECT_DESCRIPTION = "Projekt s testovacími obrázky sféroidů"

def login():
    """Přihlášení do aplikace a získání tokenu."""
    
    # Použití správného endpointu a formátu dat
    login_data = {
        "username": "test@example.com",
        "password": "password"
    }
    
    # API používá OAuth2 s formdata
    try:
        response = requests.post(
            f"{API_URL}/auth/token", 
            data=login_data,  # Použití data místo json
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if response.status_code == 200:
            token_data = response.json()
            return token_data.get("access_token")
        else:
            print(f"Chyba při přihlášení: {response.status_code}")
            print(f"Odpověď: {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Chyba při přihlášení: {e}")
        return None

def create_project(token):
    """Vytvoření testovacího projektu."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    project_data = {
        "name": PROJECT_NAME,
        "description": PROJECT_DESCRIPTION
    }
    
    try:
        response = requests.post(f"{API_URL}/projects", json=project_data, headers=headers)
        if response.status_code == 201:
            return response.json().get("id")
        else:
            print(f"Chyba při vytváření projektu: {response.status_code}")
            print(f"Odpověď: {response.text}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Chyba při vytváření projektu: {e}")
        return None

def upload_image(token, project_id, image_path):
    """Nahrání obrázku do projektu."""
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    try:
        with open(image_path, 'rb') as img_file:
            # Příprava formdata pro nahrání souboru
            files = {'file': (os.path.basename(image_path), img_file, 'image/png')}
            data = {'project_id': str(project_id)}
            
            response = requests.post(
                f"{API_URL}/images/upload", 
                files=files,
                data=data,
                headers=headers
            )
            
            if response.status_code == 201:
                print(f"Obrázek {os.path.basename(image_path)} úspěšně nahrán")
                return True
            else:
                print(f"Chyba při nahrávání obrázku {os.path.basename(image_path)}: {response.status_code}")
                print(f"Odpověď: {response.text}")
                return False
    except Exception as e:
        print(f"Chyba při nahrávání obrázku {os.path.basename(image_path)}: {e}")
        return False

def main():
    """Hlavní funkce pro nahrání testovacích obrázků."""
    print("Spouštím nahrávání testovacích obrázků...")
    
    # Kontrola existence testovacích obrázků
    if not TEST_IMAGES_DIR.exists():
        print(f"Adresář s testovacími obrázky {TEST_IMAGES_DIR} neexistuje!")
        return
    
    # Získání seznamu obrázků
    image_files = list(TEST_IMAGES_DIR.glob("*.png"))
    if not image_files:
        print("V adresáři nejsou žádné testovací obrázky!")
        return
    
    print(f"Nalezeno {len(image_files)} testovacích obrázků.")
    
    # Přihlášení
    token = login()
    if not token:
        print("Nepodařilo se přihlásit.")
        return
    
    # Vytvoření projektu
    project_id = create_project(token)
    if not project_id:
        print("Nepodařilo se vytvořit projekt.")
        return
    
    print(f"Vytvořen projekt s ID {project_id}.")
    
    # Nahrání obrázků
    success_count = 0
    for image_path in image_files:
        if upload_image(token, project_id, image_path):
            success_count += 1
    
    print(f"Nahráno {success_count} z {len(image_files)} obrázků.")
    print(f"Přejděte do aplikace a přihlaste se. Váš nový projekt najdete v seznamu.")

if __name__ == "__main__":
    main() 