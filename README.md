# Spheroid Segmentation Platform

Web aplikace pro segmentaci a analýzu buněčných sferoiodů s využitím pokročilých obrazových algoritmů.

## Technologie

- **Frontend**: React, Vite, TypeScript, Shadcn/UI
- **Backend**: Node.js, Express, TypeScript, Prisma
- **Databáze**: PostgreSQL
- **Kontejnerizace**: Docker, Docker Compose

## Struktura projektu

- `backend/` - Backend API server
- `public/` - Veřejné statické soubory
- `src/` - Frontend zdrojové kódy
- `docker-compose.yml` - Konfigurace Docker Compose

## Požadavky

- Node.js 18+ 
- Docker a Docker Compose
- Git

## Instalace a spuštění

1. Klonování repozitáře:

```bash
git clone https://github.com/michalprusek/cell-segmentation-hub.git
cd cell-segmentation-hub
```

2. Spuštění pomocí Docker Compose:

```bash
docker compose up -d
```

Aplikace bude dostupná na následujících adresách:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- PostgreSQL: localhost:5432

3. Zastavení aplikace:

```bash
docker compose down
```

## Lokální vývoj

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
npm install
npm run dev
```

## API Dokumentace

API dokumentace je dostupná na adrese: http://localhost:8000/api/docs

## Licence

[MIT](LICENSE) 