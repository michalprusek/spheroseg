# Struktura projektu Cell Segmentation Hub

## Přehled

Aplikace je rozdělena na frontend a backend části. Frontend je implementován v React s TypeScript a Vite, zatímco backend je postaven na Node.js/Express a využívá PostgreSQL databázi.

## Frontend (`/src`)

Frontend je implementován pomocí React, TypeScript a Vite. Využívá moderní komponenty z knihovny Shadcn/UI.

### Hlavní adresáře

- `/src/components` - Znovupoužitelné UI komponenty
- `/src/contexts` - React kontexty pro správu stavu (auth, language, theme)
- `/src/hooks` - Custom React hooks
- `/src/lib` - Pomocné funkce a utility
- `/src/pages` - Stránky aplikace
- `/src/translations` - Jazykové překlady
- `/src/types` - TypeScript typy
- `/src/styles` - CSS styly
- `/public` - Statické soubory (obrázky, ikony)

### Klíčové soubory

- `/src/main.tsx` - Vstupní bod aplikace
- `/src/App.tsx` - Hlavní komponent aplikace
- `/src/vite-env.d.ts` - TypeScript deklarace pro Vite
- `/index.html` - HTML šablona

## Backend (`/backend`)

Backend je implementován v Node.js s Express a TypeScript. Pro práci s databází používá Prisma ORM.

### Adresářová struktura

- `/backend/src` - Zdrojový kód
  - `/backend/src/config` - Konfigurace aplikace
  - `/backend/src/controllers` - Kontrolery pro zpracování HTTP požadavků
  - `/backend/src/middleware` - Middlewary (auth, error handling)
  - `/backend/src/routes` - Definice API tras
  - `/backend/src/services` - Business logika
  - `/backend/src/utils` - Pomocné utility
- `/backend/prisma` - Prisma ORM schema a migrace
- `/backend/tests` - Testy
- `/backend/scripts` - Skripty pro vývoj a nasazení

### Klíčové soubory

- `/backend/src/index.ts` - Vstupní bod aplikace
- `/backend/prisma/schema.prisma` - Prisma schema definující databázový model
- `/backend/.env` - Konfigurační proměnné
- `/backend/tsconfig.json` - TypeScript konfigurace

## Docker konfigurace

- `/docker-compose.yml` - Konfigurace Docker Compose
- `/backend/Dockerfile` - Dockerfile pro backend

## Databázový model

Aplikace používá PostgreSQL databázi s následujícími hlavními tabulkami:

1. `users` - Uživatelské účty
2. `profiles` - Uživatelské profily
3. `projects` - Projekty segmentace
4. `images` - Nahrané obrázky
5. `access_requests` - Žádosti o přístup

## API Endpoint přehled

### Autentizace
- `POST /api/auth/register` - Registrace nového uživatele
- `POST /api/auth/login` - Přihlášení uživatele
- `PUT /api/auth/password` - Změna hesla

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

## Postup nasazení

1. Klonování repozitáře
2. Nastavení proměnných prostředí
3. Spuštění pomocí Docker Compose
4. Inicializace databáze
5. Přístup přes webový prohlížeč

## Technologický stack

### Frontend
- React 18
- TypeScript
- Vite
- Shadcn/UI (postaveno na Tailwind CSS)
- React Router
- Zod pro validaci

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- JWT autentizace
- bcrypt pro hashování hesel
- multer pro upload souborů

### Databáze
- PostgreSQL

### Infrastruktura
- Docker
- Docker Compose 