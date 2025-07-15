# SpherosegV4 - Aplikace pro segmentaci buněk

## Vývojové prostředí

### Standardní režim

Pro spuštění aplikace v standardním režimu použijte:

```bash
docker-compose up -d
```

Aplikace bude dostupná na adrese http://localhost

### Development režim s hot reloadem

Pro vývoj s hot reloadem (automatické aktualizace při změnách kódu) použijte:

```bash
docker-compose up -d frontend-dev
```

Development server bude dostupný na adrese http://localhost:3000

#### Výhody development režimu:
- Automatické aktualizace při změnách kódu (hot reload)
- Rychlejší kompilace
- Lepší chybové hlášky
- Vývojářské nástroje

## Struktura projektu

- `frontend/` - React aplikace (TypeScript, Vite, Shadcn UI)
- `server/` - Backend API (Node.js, Express, PostgreSQL)
- `docker-compose.yml` - Konfigurace Docker kontejnerů

## Řešení problémů

### Restart celého prostředí

Pokud narazíte na problémy, zkuste restartovat celé Docker prostředí:

```bash
docker-compose down && docker-compose up -d
```

### Zobrazení logů

Pro zobrazení logů použijte:

```bash
docker-compose logs -f frontend-dev  # Pro logy frontend development serveru
docker-compose logs -f frontend      # Pro logy produkčního frontendu
docker-compose logs -f backend       # Pro logy backendu
```

### Přístup do kontejneru

Pro přístup do kontejneru použijte:

```bash
docker-compose exec frontend-dev sh  # Pro přístup do frontend development kontejneru
docker-compose exec frontend sh      # Pro přístup do produkčního frontend kontejneru
docker-compose exec backend sh       # Pro přístup do backend kontejneru
docker-compose exec db psql -U user -d spheroseg  # Pro přístup do databáze
```
