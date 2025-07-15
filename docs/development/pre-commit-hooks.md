# Pre-commit Hooks Documentation

Komplexní systém pre-commit hooks pro zajištění kvality kódu v Spheroseg projektu.

## Přehled

Pre-commit hooks jsou automatické kontroly, které se spouštějí před každým commitem a zajišťují dodržování standardů kvality kódu. Systém blokuje commit pokud jsou nalezeny problémy a poskytuje jasné chybové zprávy pro jejich opravu.

## Komponenty Systému

### 1. Husky Git Hooks

**Soubory:**
- `.husky/pre-commit` - Spouští kontroly kvality před commitem
- `.husky/commit-msg` - Validuje formát commit zprávy

**Funkcionalita:**
- Automatické spouštění lint-staged na upravené soubory
- Spouštění kritických testů pro změněné balíčky
- Validace commit zpráv podle conventional commits

### 2. Lint-staged Konfigurace

**Soubor:** `.lintstagedrc.js`

**Pravidla podle typu souborů:**
```javascript
// TypeScript/JavaScript soubory
'packages/frontend/**/*.{ts,tsx,js,jsx}': [
  'npx eslint --fix --max-warnings 0',
  'prettier --write',
]

// CSS/SCSS soubory  
'packages/frontend/**/*.{css,scss}': [
  'prettier --write',
]

// JSON soubory
'**/*.json': [
  'prettier --write',
]

// Markdown soubory
'**/*.md': [
  'prettier --write',
]
```

### 3. Commitlint Konfigurace

**Soubor:** `commitlint.config.js`

**Podporované typy commitů:**
- `feat` - Nová funkcionalita
- `fix` - Oprava chyby
- `docs` - Změny dokumentace
- `style` - Změny stylu kódu
- `refactor` - Refaktoring kódu
- `perf` - Zlepšení výkonu
- `test` - Přidání nebo aktualizace testů
- `chore` - Údržbové úkoly
- `ci` - CI/CD změny
- `build` - Změny build systému
- `security` - Bezpečnostní opravy
- `deps` - Aktualizace závislostí

**Podporované scope:**
- `frontend`, `backend`, `ml`, `shared`, `types`
- `docs`, `ci`, `deps`, `config`, `auth`, `api`, `db`
- `ui`, `performance`, `security`, `test`, `build`

**Formát commit zprávy:**
```
type(scope): Subject začínající velkým písmenem

Volitelný popis v těle commit zprávy.

Volitelný footer s odkazy na issues.
```

### 4. Import Validace

**Soubor:** `scripts/validate-imports.js`

**Funkcionalita:**
- Vynucuje hranice závislostí mezi balíčky
- Validuje externí závislosti proti schválenému seznamu
- Detekuje zakázané importy (např. frontend → backend)
- Kontroluje hluboké relativní importy

**Pravidla pro balíčky:**
```javascript
// Frontend může importovat pouze:
allowedInternal: ['@spheroseg/shared', '@spheroseg/types']

// Backend nemůže importovat:
forbiddenPatterns: [/\.\.\/\.\.\/frontend/, /\.\.\/\.\.\/ml/]

// Shared a Types mají nejpřísnější omezení
```

### 5. Pre-commit Framework

**Soubor:** `.pre-commit-config.yaml`

**Hooks:**
- **trailing-whitespace** - Odstraní mezery na konci řádků
- **end-of-file-fixer** - Zajistí newline na konci souborů
- **check-yaml** - Validuje YAML syntaxi
- **check-json** - Validuje JSON syntaxi
- **check-merge-conflict** - Detekuje merge konflikty
- **check-added-large-files** - Blokuje velké soubory
- **no-commit-to-branch** - Chrání main/master větve

## Instalace a Nastavení

### Automatická Instalace
Hooks se automaticky nastaví při instalaci závislostí:
```bash
npm install  # Automaticky spustí husky install
```

### Manuální Nastavení
```bash
# Instalace husky (pokud potřeba)
npx husky install

# Test pre-commit hooks
git add .
git commit -m "test: Test pre-commit hooks system"
```

## Použití

### Běžný Workflow
1. Proveďte změny v kódu
2. Přidejte soubory do stagingu: `git add .`
3. Proveďte commit: `git commit -m "feat(frontend): Add new component"`
4. Hooks se automaticky spustí a:
   - Opraví formátování kde je to možné
   - Spustí linting a type checking
   - Spustí kritické testy pro změněné balíčky
   - Validují commit zprávu

### Příklad Úspěšného Commitu
```bash
git add src/components/NewComponent.tsx
git commit -m "feat(frontend): Add responsive navigation component"

# Výstup:
🔍 Running pre-commit checks...
✅ ESLint passed
✅ Prettier formatting applied
✅ TypeScript compilation successful
✅ Critical tests passed
✅ Commit message valid
✅ All pre-commit checks passed!
```

### Příklad Neúspěšného Commitu
```bash
git commit -m "add stuff"

# Výstup:
❌ Commit message validation failed:
  - Subject must be at least 10 characters
  - Must include type and scope: type(scope): Subject
  - Valid format: feat(frontend): Add responsive navigation component
```

## Řešení Problémů

### ESLint Chyby
```bash
# Automatická oprava
npm run lint:fix

# Kontrola problémů
npm run lint
```

### TypeScript Chyby
```bash
# Kontrola typu
cd packages/frontend && npx tsc --noEmit

# Nebo pro všechny balíčky
npm run type-check
```

### Test Chyby
```bash
# Spuštění testů pro konkrétní balíček
cd packages/frontend && npm test
cd packages/backend && npm test

# Spuštění pouze kritických testů
npm run test -- --testNamePattern="(critical|auth|security)"
```

### Import Validace Chyby
```bash
# Spuštění import validace
node scripts/validate-imports.js

# Častá řešení:
# 1. Odstraňte zakázané importy mezi balíčky
# 2. Použijte path aliasy místo hlubokých relativních cest
# 3. Přidejte externí závislosti do ALLOWED_EXTERNAL_DEPS
```

## Konfigurace

### Zakázání Konkrétních Kontrol
```javascript
// .lintstagedrc.js - dočasné zakázání
'packages/frontend/**/*.{ts,tsx,js,jsx}': [
  // 'npx eslint --fix --max-warnings 0',  // disabled
  'prettier --write',
],
```

### Přidání Nových Pravidel
```javascript
// .lintstagedrc.js
'**/*.{vue,svelte}': [
  'npx eslint --fix',
  'prettier --write',
],
```

### Aktualizace Allowed Dependencies
```javascript
// scripts/validate-imports.js
const ALLOWED_EXTERNAL_DEPS = new Set([
  'react', 'react-dom',
  'your-new-dependency',  // přidat zde
]);
```

## Performance

### Optimalizace
- **Paralelní zpracování**: Lint-staged spouští úkoly paralelně
- **Pouze změněné soubory**: Kontroly se aplikují pouze na staged soubory
- **Rychlé testy**: Spouští se pouze kritické testy, ne celá test suite
- **Caching**: ESLint a TypeScript používají cache pro rychlejší běh

### Benchmark
```
Typický commit (5-10 souborů): 15-30 sekund
Velký commit (50+ souborů): 1-3 minuty
Pouze dokumentace: 5-10 sekund
```

## Integrace s CI/CD

Pre-commit hooks doplňují CI/CD pipeline:
- **Pre-commit**: Rychlé kontroly na lokálním prostředí
- **CI**: Kompletní test suite, build, deploy kontroly
- **Redundance**: CI znovu ověří všechny kontroly pro jistotu

## Migrace a Upgrade

### Aktualizace Husky
```bash
npm install --save-dev husky@latest
npx husky-init
```

### Přidání Nových Hooks
```bash
npx husky add .husky/post-commit "echo 'Commit completed'"
npx husky add .husky/pre-push "npm run test"
```

## Best Practices

1. **Commitujte často**: Menší commity = rychlejší hooks
2. **Fixujte problémy okamžitě**: Nechte hooks opravit co můžou automaticky
3. **Kvalitní commit zprávy**: Dodržujte conventional commits formát
4. **Testujte před commitem**: Spouštějte testy lokálně před commitováním
5. **Aktualizujte dokumentaci**: Při změnách API nebo komponent

## Monitoring a Metriky

### Logování
Hooks zapisují výsledky do:
- Console output při běhu
- Git hooks log (pokud nastaven)
- CI/CD logs při push

### Metriky Úspěšnosti
- **Pass Rate**: % commitů, které prošly na první pokus
- **Fix Rate**: % problémů automaticky opravených
- **Time to Fix**: Průměrný čas na opravu problémů

## Podpora a Troubleshooting

### Časté Problémy
1. **Hook se nespustí**: Zkontrolujte `.git/config` nastavení
2. **ESM vs CommonJS**: Přejmenujte `.js` na `.cjs` nebo aktualizujte import
3. **Missing dependencies**: Instalujte chybějící nástroje
4. **Performance**: Použijte `--max-workers=2` pro omezení paralelizmu

### Debug Mode
```bash
DEBUG=1 git commit -m "debug commit"
npx husky debug
```

### Bypassing Hooks (Emergency)
```bash
# Pouze v emergency situacích!
git commit --no-verify -m "emergency: Fix production issue"
```

---

**Poznámka**: Pre-commit hooks jsou důležitou součástí development workflow. Při problémech kontaktujte tým nebo vytvořte issue v GitHub repository.