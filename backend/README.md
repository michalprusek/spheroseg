# Cell Segmentation Hub - Backend API

REST API server vytvořený v Node.js s Express a TypeScript pro aplikaci Cell Segmentation Hub.

## Adresářová struktura

```
/backend
  /prisma       - Databázové modely a migrace
  /src          - Zdrojový kód
    /config     - Konfigurace aplikace
    /controllers- Kontrolery pro API endpointy
    /middleware - Express middlewary
    /routes     - API trasy
    /services   - Byznys logika a komunikace s databází
    /utils      - Pomocné nástroje a utility
  /tests        - Testy
  /uploads      - Nahrané soubory
```

## Požadavky

- Node.js 18+
- PostgreSQL
- npm nebo yarn

## Instalace

```bash
# Instalace závislostí
npm install

# Kompilace TypeScript
npm run build
```

## Konfigurace

Vytvořte soubor `.env` v adresáři `/backend` podle vzoru:

```
# Node environment
NODE_ENV=development

# Server configuration
PORT=8000
API_PREFIX=/api

# Database configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/spheroseg

# JWT configuration
JWT_SECRET=your_very_secure_jwt_secret_key_for_development
JWT_EXPIRES_IN=24h

# File storage
STORAGE_TYPE=local
UPLOADS_FOLDER=uploads
MAX_FILE_SIZE=10485760
```

## Migrace a inicializace databáze

```bash
# Spuštění migrací
npx prisma migrate deploy

# Inicializace databáze pomocí seedu
npx prisma db seed

# Prohlížení databáze pomocí Prisma Studio
npx prisma studio
```

## Spuštění

```bash
# Vývojový režim s hot-reloadem
npm run dev

# Produkční režim
npm start
```

## API Dokumentace

### Autentizace
- `POST /api/auth/register` - Registrace nového uživatele
- `POST /api/auth/login` - Přihlášení uživatele
- `PUT /api/auth/password` - Změna hesla (vyžaduje autentizaci)

### Uživatelé
- `GET /api/users/profile` - Získání profilu přihlášeného uživatele
- `PUT /api/users/profile` - Aktualizace profilu

### Projekty
- `POST /api/projects` - Vytvoření projektu
- `GET /api/projects` - Seznam projektů
- `GET /api/projects/:id` - Detail projektu
- `PUT /api/projects/:id` - Aktualizace projektu
- `DELETE /api/projects/:id` - Smazání projektu
- `GET /api/projects/:projectId/images` - Seznam obrázků v projektu

### Obrázky
- `POST /api/images/:projectId` - Nahrání obrázku
- `GET /api/images/:id` - Detail obrázku
- `DELETE /api/images/:id` - Smazání obrázku
- `PUT /api/images/:id/segmentation` - Aktualizace stavu segmentace 