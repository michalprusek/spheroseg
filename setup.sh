#!/bin/bash

# Barvy pro lepší čitelnost
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${GREEN}Spouštím Spheroid Segmentation Platform v Docker kontejnerech...${RESET}"

# Kontrola, zda je Docker spuštěn
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Docker není spuštěn. Spusťte Docker a zkuste to znovu.${RESET}"
  exit 1
fi

# Vytvoření adresářů pro ukládání souborů
echo -e "${YELLOW}Vytvářím adresáře pro ukládání souborů...${RESET}"
mkdir -p backend/uploads/images backend/uploads/thumbnails backend/uploads/temp

# Spuštění Docker Compose
echo -e "${YELLOW}Spouštím Docker kontejnery...${RESET}"
docker compose up -d

# Kontrola, zda jsou kontejnery spuštěny
echo -e "${YELLOW}Kontroluji, zda jsou kontejnery spuštěny...${RESET}"
sleep 5

# Spuštění migrace
echo -e "${YELLOW}Spouštím databázové migrace...${RESET}"
docker exec -it spheroseg-backend npx prisma migrate deploy

# Spuštění seedu
echo -e "${YELLOW}Nahrávám testovací data...${RESET}"
docker exec -it spheroseg-backend npx prisma db seed

echo -e "${GREEN}Aplikace je připravena!${RESET}"
echo -e "${GREEN}Backend API: http://localhost:8000/api${RESET}"
echo -e "${GREEN}Frontend: http://localhost:8080${RESET}"
echo -e "${GREEN}Přihlašovací údaje: demo@example.com / password123${RESET}" 