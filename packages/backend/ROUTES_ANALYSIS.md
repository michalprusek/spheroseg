# Analýza API Routes Struktury

## Identifikované Problémy

### 1. Duplicitní definice routes

#### a) Duplicitní health check endpoints
- `/api/health` je definováno na 3 místech:
  - `src/app.ts` (řádek 28) - hlavní health endpoint
  - `src/routes/api.ts` (řádek 38) - duplicitní definice
  - `src/routes/health.ts` - samostatný router pro health check
  - `src/routes/health.js` - JavaScript verze stejného endpointu
  - `src/routes/status.ts` - obsahuje podobné endpointy (`/`, `/check`)

#### b) Duplicitní mounting routes
- V `src/routes/index.ts`:
  - `/users` je mountováno 2x (řádek 32 a 33)
  - `/segmentation` a `/segmentations` - duplicitní mounting (řádky 37-38)
  - `/projects` je mountováno 2x (řádek 35 a 36 pro imageRoutes)

### 2. Nekonzistentní verzování

#### a) Smíšený přístup k verzování
- Existuje `/v1` routing v `src/routes/v1/index.ts`
- Zároveň legacy routes jsou mountovány přímo na root
- V `src/routes/api.ts` je definováno `API_V1_PREFIX` ale není použito

#### b) Duplicitní registrace
- Routes jsou registrovány jak v `/api` (přes index.ts) tak v `/api/v1`
- Některé routes jsou dostupné na více URL

### 3. Nepoužívané soubory

- `src/routes/fixed-images.js` - izolovaný JavaScript soubor, není nikde importován
- `src/routes/projects.test.ts` - test soubor v hlavní složce routes místo v `__tests__`
- `src/routes/health.js` - JavaScript verze, když existuje TypeScript varianta

### 4. Konflikty v route definicích

#### a) Překrývající se cesty
- `src/routes/api.ts` definuje vlastní router s `/projects`, `/users`
- `src/routes/index.ts` definuje stejné routes
- Oba jsou mountovány na `/api`, což může způsobit konflikty

#### b) Nekonzistentní struktura
- Některé routes používají samostatné soubory (auth.ts, users.ts)
- Jiné jsou seskupené (userProfile.ts, userStats.ts by měly být pod users)
- Metrics mají 3 různé implementace:
  - `metricsRoutes.ts`
  - `dbMetrics.ts`
  - `performance.ts`

### 5. Chybějící standardizace

#### a) Různé přístupy k exportům
- Některé soubory exportují Router instance
- Jiné exportují funkce pro setup
- Nekonzistentní naming (camelCase vs kebab-case)

#### b) Chybějící dokumentace
- Většina routes nemá OpenAPI/Swagger dokumentaci
- Nekonzistentní komentáře a JSDoc

## Doporučení

### 1. Odstranit duplicity
```bash
# Smazat nepoužívané soubory
rm src/routes/health.js
rm src/routes/fixed-images.js
rm src/routes/projects.test.ts  # přesunout do __tests__
```

### 2. Sjednotit health check endpointy
- Ponechat pouze jeden health check v `app.ts`
- Odstranit duplicitní definice v `api.ts` a `health.ts`
- Integrovat funkcionalitu ze `status.ts`

### 3. Implementovat správné verzování
```typescript
// src/routes/index.ts
const router = express.Router();

// Pouze verzované routes
router.use('/v1', v1Routes);
router.use('/v2', v2Routes); // pro budoucí verze

// Žádné legacy routes na root úrovni
```

### 4. Reorganizovat strukturu
```
src/routes/
├── v1/
│   ├── auth.ts
│   ├── users/
│   │   ├── index.ts
│   │   ├── profile.ts
│   │   └── stats.ts
│   ├── projects/
│   │   ├── index.ts
│   │   ├── images.ts
│   │   ├── shares.ts
│   │   └── duplication.ts
│   ├── segmentation.ts
│   └── monitoring/
│       ├── metrics.ts
│       ├── performance.ts
│       └── database.ts
└── index.ts
```

### 5. Vyřešit konflikty v mounting
- Odstranit `src/routes/api.ts` nebo jej refaktorovat
- Používat pouze jeden centrální bod pro mounting routes
- Zajistit, že každá route je definována pouze jednou

### 6. Standardizovat přístup
- Všechny routes by měly exportovat Router instance
- Používat konzistentní naming (kebab-case pro soubory)
- Přidat TypeScript types pro všechny routes
- Implementovat middleware pro validaci a error handling

## Kritické problémy k okamžitému řešení

1. **Duplicitní `/users` mounting** - může způsobit nepředvídatelné chování
2. **Konflikt mezi `api.ts` a `index.ts`** - nejasné, který router má přednost
3. **Nepoužívané JavaScript soubory** - potenciální bezpečnostní riziko
4. **Chybějící verzování** - ztěžuje budoucí API změny