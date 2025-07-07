# SpherosegV4 - Refactoring a optimalizace

Tento dokument obsahuje komplexní plán refaktoringu a optimalizace aplikace SpherosegV4 pro zlepšení kvality kódu, výkonu a udržitelnosti.

## Obsah

1. [Bezpečnostní optimalizace](#bezpečnostní-optimalizace)
2. [Optimalizace frontendu](#optimalizace-frontendu)
3. [Optimalizace backendu](#optimalizace-backendu)
4. [Optimalizace databáze](#optimalizace-databáze)
5. [Optimalizace monitoringu](#optimalizace-monitoringu)
6. [Optimalizace CI/CD](#optimalizace-cicd)
7. [Optimalizace dokumentace](#optimalizace-dokumentace)
8. [Optimalizace testů](#optimalizace-testů)

## Bezpečnostní optimalizace

### 1. Konsolidace bezpečnostních middleware

**Cíl:** Sjednotit všechny bezpečnostní middleware do jednoho modulu.

**Implementace:**
- Vytvořit jednotný modul `security` v backendu
- Sjednotit autentizační middleware
- Implementovat jednotný systém pro CORS, CSP a další bezpečnostní hlavičky
- Centralizovat validaci JWT tokenů

**Soubory k úpravě:**
- `packages/backend/src/middleware/auth.ts` → `packages/backend/src/security/middleware/auth.ts`
- `packages/backend/src/middleware/cors.ts` → `packages/backend/src/security/middleware/cors.ts`
- `packages/backend/src/middleware/securityHeaders.ts` → `packages/backend/src/security/middleware/headers.ts`

**Přínosy:**
- Snížení duplicitního kódu o 50%+
- Konzistentní implementace bezpečnostních opatření
- Jednodušší údržba a aktualizace bezpečnostních funkcí
- Lepší přehled o bezpečnostních mechanismech

### 2. Optimalizace rate limitingu

**Cíl:** Vytvořit škálovatelný systém pro omezení počtu požadavků.

**Implementace:**
- Implementovat hierarchický rate limiting
- Nastavit různé limity pro různé endpointy
- Přidat podporu pro Redis backend pro distribuované nasazení
- Implementovat IP whitelisting pro interní služby

**Soubory k úpravě:**
- `packages/backend/src/middleware/rateLimiter.ts` → `packages/backend/src/security/middleware/rateLimiter.ts`

**Přínosy:**
- Lepší ochrana proti DoS útokům
- Flexibilnější konfigurace limitů
- Podpora pro horizontální škálování
- Minimální dopad na legitimní uživatele

### 3. Audit a aktualizace závislostí

**Cíl:** Identifikovat a aktualizovat zastaralé nebo zranitelné závislosti.

**Implementace:**
- Provést npm audit a opravit nalezené zranitelnosti
- Aktualizovat závislosti na nejnovější stabilní verze
- Odstranit nepoužívané závislosti
- Implementovat automatické kontroly závislostí v CI/CD

**Soubory k úpravě:**
- `package.json`
- `packages/*/package.json`

**Přínosy:**
- Odstranění známých zranitelností
- Snížení velikosti node_modules
- Rychlejší instalace a buildy
- Prevence budoucích bezpečnostních problémů

## Optimalizace frontendu

### 1. Konsolidace správy stavu

**Cíl:** Vytvořit jednotný systém pro správu stavu aplikace.

**Implementace:**
- Standardizovat na Zustand pro globální stav
- React Query pro data z API (již částečně implementováno)
- Lokální React state pro UI komponenty
- Vytvořit modulární store s typovou bezpečností
- Implementovat middleware pro persistenci a devtools

**Soubory k úpravě:**
- Vytvořit `packages/frontend/src/store/index.ts`
- Vytvořit `packages/frontend/src/store/slices/`
- Refaktorovat existující Context API na Zustand

**Přínosy:**
- Snížení duplicitního kódu o 40%+
- Konzistentní přístup ke stavu
- Lepší výkon a testovatelnost
- Jednodušší debugging s devtools

### 2. Sjednocení komponent UI

**Cíl:** Vytvořit jednotný systém komponent.

**Implementace:**
- Refaktorovat duplicitní komponenty
- Vytvořit knihovnu znovupoužitelných komponent
- Standardizovat props a rozhraní komponent
- Implementovat design system

**Soubory k úpravě:**
- `packages/frontend/src/components/`
- Vytvořit nový adresář `packages/frontend/src/design-system/`

**Přínosy:**
- Konzistentní uživatelské rozhraní
- Snížení duplicitního kódu o 30-40%
- Rychlejší vývoj nových funkcí
- Lepší testovatelnost komponent

### 2. Optimalizace načítání dat

**Cíl:** Zlepšit výkon a uživatelskou zkušenost při načítání dat.

**Implementace:**
- Implementovat React Query pro správu stavu a cachování
- Optimalizovat datové modely pro efektivnější přenos
- Přidat podporu pro stránkování a virtualizaci seznamů
- Implementovat prefetching pro často používané data

**Soubory k úpravě:**
- `packages/frontend/src/hooks/useData.ts`
- `packages/frontend/src/api/`
- `packages/frontend/src/context/DataContext.tsx`

**Přínosy:**
- Rychlejší načítání dat
- Snížení počtu síťových požadavků
- Lepší UX při práci s velkými datovými sadami
- Efektivnější využití paměti

### 3. Optimalizace bundlů

**Cíl:** Zmenšit velikost JavaScript bundlů.

**Implementace:**
- Implementovat code splitting a lazy loading
- Optimalizovat importy třetích stran
- Nastavit tree shaking pro nepoužívaný kód
- Implementovat preloading kritických komponent

**Soubory k úpravě:**
- `packages/frontend/vite.config.ts`
- `packages/frontend/src/App.tsx`
- `packages/frontend/src/routes/`

**Přínosy:**
- Rychlejší načítání aplikace o 30-50%
- Menší velikost bundlů
- Lepší výkon na mobilních zařízeních
- Efektivnější využití sítě

### 4. Sjednocení formulářů

**Cíl:** Vytvořit jednotný systém pro správu formulářů.

**Implementace:**
- Implementovat React Hook Form s Zod validací
- Vytvořit znovupoužitelné formulářové komponenty
- Standardizovat zpracování chyb a validaci
- Implementovat automatické ukládání rozpracovaných formulářů

**Soubory k úpravě:**
- `packages/frontend/src/components/forms/`
- Vytvořit nový soubor `packages/frontend/src/hooks/useForm.ts`

**Přínosy:**
- Konzistentní uživatelská zkušenost
- Snížení duplicitního kódu o 50%+
- Lepší validace a zpracování chyb
- Rychlejší implementace nových formulářů

### 5. Konsolidace grafových komponent

**Cíl:** Vytvořit jednotnou knihovnu pro vizualizaci dat.

**Implementace:**
- Standardizovat na Recharts
- Vytvořit základní komponenty pro běžné grafy
- Implementovat jednotný systém stylování
- Přidat hooks pro transformaci dat

**Soubory k úpravě:**
- Vytvořit `packages/frontend/src/components/charts/`
- Vytvořit `packages/frontend/src/hooks/useChartData.ts`
- Refaktorovat existující grafy

**Přínosy:**
- Konzistentní vizualizace dat
- Snížení velikosti bundlu
- Rychlejší implementace nových grafů
- Lepší responzivita

### 6. Optimalizace navigace

**Cíl:** Vytvořit jednotný navigační systém.

**Implementace:**
- Refaktorovat navigační komponenty
- Implementovat breadcrumbs pro lepší orientaci
- Optimalizovat mobilní navigaci
- Přidat podporu pro klávesové zkratky

**Soubory k úpravě:**
- `packages/frontend/src/components/Navbar.tsx`
- `packages/frontend/src/components/Sidebar.tsx`
- Vytvořit nový soubor `packages/frontend/src/components/navigation/`

**Přínosy:**
- Konzistentní navigace napříč aplikací
- Lepší uživatelská zkušenost
- Snížení duplicitního kódu
- Lepší přístupnost aplikace

## Optimalizace backendu

### 1. Konsolidace konfigurace

**Cíl:** Vytvořit jednotný konfigurační systém.

**Implementace:**
- Centrální konfigurační objekt s validací (Zod)
- Hierarchická konfigurace (default, environment, local)
- Feature flags systém
- Hot reloading konfigurace
- Dokumentace všech konfiguračních hodnot

**Soubory k úpravě:**
- Vytvořit `packages/frontend/src/config/index.ts`
- Vytvořit `packages/backend/src/config/index.ts`
- Vytvořit `packages/shared/src/config/types.ts`

**Přínosy:**
- Snazší konfigurace pro různá prostředí
- Prevence chyb díky validaci
- Dynamická změna konfigurace
- Lepší dokumentace

### 2. Standardizace API endpointů

**Cíl:** Sjednotit strukturu a chování API endpointů.

**Implementace:**
- Implementovat jednotný formát odpovědí
- Standardizovat zpracování chyb
- Implementovat verzování API
- Vytvořit middleware pro validaci požadavků

**Soubory k úpravě:**
- `packages/backend/src/routes/`
- `packages/backend/src/controllers/`
- Vytvořit nový soubor `packages/backend/src/middleware/apiValidator.ts`

**Přínosy:**
- Konzistentní API rozhraní
- Snazší integrace s frontendem
- Lepší dokumentace API
- Snížení duplicitního kódu o 30%+

### 2. Optimalizace databázových operací

**Cíl:** Zlepšit výkon a spolehlivost databázových operací.

**Implementace:**
- Implementovat connection pooling
- Optimalizovat často používané dotazy
- Implementovat cachování výsledků
- Přidat monitorování výkonu dotazů

**Soubory k úpravě:**
- `packages/backend/src/db/index.ts`
- `packages/backend/src/db/queries/`
- Vytvořit nový soubor `packages/backend/src/db/cache.ts`

**Přínosy:**
- Rychlejší databázové operace o 20-40%
- Snížení zátěže databáze
- Lepší škálovatelnost
- Detailnější monitoring výkonu

### 3. Implementace jednotného loggeru

**Cíl:** Vytvořit jednotný systém pro logování.

**Implementace:**
- Implementovat strukturované logování
- Přidat podporu pro různé úrovně logování
- Implementovat rotaci logů
- Přidat kontextové informace do logů

**Soubory k úpravě:**
- `packages/backend/src/utils/logger.ts`
- `packages/backend/src/middleware/requestLogger.ts`

**Přínosy:**
- Lepší diagnostika problémů
- Konzistentní formát logů
- Snazší analýza logů
- Efektivnější využití diskového prostoru

### 4. Optimalizace zpracování souborů

**Cíl:** Zlepšit výkon a spolehlivost při práci se soubory.

**Implementace:**
- Implementovat streaming pro velké soubory
- Optimalizovat zpracování obrázků
- Implementovat validaci souborů
- Přidat podporu pro resumable uploads

**Soubory k úpravě:**
- `packages/backend/src/services/fileService.ts`
- `packages/backend/src/controllers/uploadController.ts`

**Přínosy:**
- Podpora pro větší soubory
- Nižší využití paměti
- Lepší uživatelská zkušenost při uploadu
- Zvýšená bezpečnost

### 5. Konsolidace notifikačního systému

**Cíl:** Rozšířit existující toast systém na komplexní notifikační systém.

**Implementace:**
- In-app notifikační centrum
- Push notifikace (Web Push API)
- Email notifikace
- Notifikační preference a správa
- Real-time notifikace přes WebSocket

**Soubory k úpravě:**
- Rozšířit `packages/frontend/src/services/unifiedNotificationService.ts`
- Vytvořit `packages/frontend/src/components/NotificationCenter.tsx`
- Vytvořit `packages/backend/src/services/notificationService.ts`

**Přínosy:**
- Konzistentní notifikace napříč kanály
- Lepší user engagement
- Centralizovaná správa notifikací
- Personalizované notifikace

### 6. Implementace job queue

**Cíl:** Zlepšit zpracování dlouhotrvajících úloh.

**Implementace:**
- Implementovat systém front pro asynchronní zpracování
- Přidat podporu pro retry mechanismy
- Implementovat monitorování stavu úloh
- Přidat notifikace o dokončení úloh

**Soubory k úpravě:**
- Vytvořit nový adresář `packages/backend/src/jobs/`
- Vytvořit nový soubor `packages/backend/src/services/queueService.ts`

**Přínosy:**
- Lepší škálovatelnost
- Odolnost vůči výpadkům
- Snížení zátěže serveru
- Lepší uživatelská zkušenost při dlouhotrvajících operacích

## Optimalizace databáze

### 1. Optimalizace schématu

**Cíl:** Zlepšit strukturu databáze pro lepší výkon a udržitelnost.

**Implementace:**
- Analyzovat a optimalizovat indexy
- Normalizovat/denormalizovat data podle potřeby
- Implementovat partitioning pro velké tabulky
- Optimalizovat datové typy

**Soubory k úpravě:**
- `packages/backend/src/db/migrations/`
- `packages/backend/src/db/schema.ts`

**Přínosy:**
- Rychlejší dotazy o 20-50%
- Efektivnější využití diskového prostoru
- Lepší škálovatelnost
- Snazší údržba

### 2. Implementace migračního systému

**Cíl:** Zlepšit správu databázových změn.

**Implementace:**
- Implementovat verzované migrace
- Přidat podporu pro rollback
- Implementovat validaci migrací
- Přidat automatické testy pro migrace

**Soubory k úpravě:**
- `packages/backend/src/db/migrations/`
- Vytvořit nový soubor `packages/backend/src/scripts/migrate.ts`

**Přínosy:**
- Bezpečnější aktualizace databáze
- Lepší sledování změn
- Snazší nasazení v různých prostředích
- Prevence ztráty dat

### 3. Optimalizace dotazů

**Cíl:** Zlepšit výkon často používaných dotazů.

**Implementace:**
- Analyzovat a optimalizovat složité dotazy
- Implementovat materialized views pro složité agregace
- Optimalizovat JOIN operace
- Implementovat paginaci pro velké výsledky

**Soubory k úpravě:**
- `packages/backend/src/db/queries/`
- `packages/backend/src/services/`

**Přínosy:**
- Rychlejší odezva aplikace
- Nižší zátěž databáze
- Lepší škálovatelnost
- Konzistentnější výkon

## Optimalizace monitoringu

### 1. Konsolidace analytických nástrojů

**Cíl:** Vytvořit jednotný analytický systém.

**Implementace:**
- Centrální analytický service
- Typově bezpečné události
- Abstrakce nad analytickými nástroji (GA, Mixpanel)
- Web Vitals tracking
- User behavior tracking

**Soubory k úpravě:**
- Vytvořit `packages/frontend/src/analytics/index.ts`
- Vytvořit `packages/frontend/src/hooks/useAnalytics.ts`
- Implementovat tracking napříč aplikací

**Přínosy:**
- Konzistentní analytická data
- Lepší pochopení uživatelského chování
- A/B testing možnosti
- Měření výkonu aplikace

### 2. Sjednocení monitorovacích systémů

**Cíl:** Vytvořit jednotný systém pro monitoring aplikace.

**Implementace:**
- Sjednotit Prometheus metriky
- Implementovat zdravotní kontroly
- Přidat alerting pro kritické situace
- Implementovat distribuované trasování

**Soubory k úpravě:**
- `packages/backend/src/monitoring/`
- `packages/backend/src/middleware/metricsMiddleware.ts`

**Přínosy:**
- Lepší přehled o stavu aplikace
- Rychlejší detekce problémů
- Detailnější analýza výkonu
- Proaktivní řešení problémů

### 2. Implementace aplikačního loggingu

**Cíl:** Zlepšit sběr a analýzu logů.

**Implementace:**
- Implementovat strukturované logování
- Přidat kontextové informace do logů
- Implementovat centralizovaný sběr logů
- Přidat vizualizaci a analýzu logů

**Soubory k úpravě:**
- `packages/backend/src/utils/logger.ts`
- `packages/frontend/src/utils/logger.ts`

**Přínosy:**
- Rychlejší diagnostika problémů
- Lepší přehled o chování aplikace
- Detailnější analýza uživatelského chování
- Proaktivní detekce problémů

### 3. Implementace uživatelské analýzy

**Cíl:** Zlepšit sběr a analýzu uživatelských dat.

**Implementace:**
- Implementovat anonymizovaný sběr uživatelských akcí
- Přidat analýzu cest uživatelů
- Implementovat měření výkonu z pohledu uživatele
- Přidat vizualizaci uživatelských dat

**Soubory k úpravě:**
- Vytvořit nový adresář `packages/frontend/src/analytics/`
- Vytvořit nový soubor `packages/backend/src/services/analyticsService.ts`

**Přínosy:**
- Lepší pochopení uživatelského chování
- Identifikace problematických míst v aplikaci
- Data pro informované rozhodování o vývoji
- Měřitelné zlepšení uživatelské zkušenosti

## Optimalizace CI/CD

### 1. Optimalizace build procesu

**Cíl:** Zrychlit a zefektivnit build proces.

**Implementace:**
- Implementovat paralelní buildy
- Optimalizovat caching
- Implementovat inkrementální buildy
- Optimalizovat Docker image

**Soubory k úpravě:**
- `turbo.json`
- `Dockerfile`
- `docker-compose.yml`

**Přínosy:**
- Rychlejší buildy o 30-50%
- Efektivnější využití CI/CD zdrojů
- Rychlejší feedback loop pro vývojáře
- Menší Docker images

### 2. Rozšíření automatických testů

**Cíl:** Zlepšit pokrytí a kvalitu automatických testů.

**Implementace:**
- Rozšířit unit testy
- Implementovat integrační testy
- Přidat end-to-end testy
- Implementovat performance testy

**Soubory k úpravě:**
- `packages/*/src/__tests__/`
- Vytvořit nový adresář `e2e-tests/`

**Přínosy:**
- Vyšší kvalita kódu
- Rychlejší detekce regresí
- Větší důvěra v změny
- Lepší dokumentace chování aplikace

### 3. Implementace automatických code reviews

**Cíl:** Zlepšit kvalitu kódu a snížit manuální práci při code reviews.

**Implementace:**
- Implementovat statickou analýzu kódu
- Přidat automatické kontroly stylu
- Implementovat detekci duplicitního kódu
- Přidat kontroly bezpečnosti

**Soubory k úpravě:**
- `.github/workflows/`
- `.eslintrc.js`
- `.prettierrc`

**Přínosy:**
- Konzistentnější kvalita kódu
- Snížení manuální práce při code reviews
- Rychlejší feedback pro vývojáře
- Prevence běžných chyb

## Optimalizace dokumentace

### 1. Sjednocení dokumentace API

**Cíl:** Vytvořit jednotnou a aktuální dokumentaci API.

**Implementace:**
- Implementovat OpenAPI/Swagger dokumentaci
- Přidat automatické generování dokumentace z kódu
- Implementovat interaktivní API explorer
- Přidat příklady použití

**Soubory k úpravě:**
- `packages/backend/src/routes/`
- Vytvořit nový soubor `packages/backend/src/swagger.ts`

**Přínosy:**
- Lepší pochopení API
- Snazší integrace s externími systémy
- Rychlejší onboarding nových vývojářů
- Snížení počtu dotazů na podporu

### 2. Rozšíření uživatelské dokumentace

**Cíl:** Zlepšit kvalitu a dostupnost uživatelské dokumentace.

**Implementace:**
- Rozšířit README soubory
- Přidat interaktivní tutoriály
- Implementovat kontextovou nápovědu
- Přidat video návody

**Soubory k úpravě:**
- `README.md`
- `packages/frontend/src/pages/Documentation.tsx`

**Přínosy:**
- Lepší uživatelská zkušenost
- Snížení počtu dotazů na podporu
- Rychlejší adopce nových funkcí
- Vyšší spokojenost uživatelů

### 3. Implementace dokumentace kódu

**Cíl:** Zlepšit dokumentaci kódu pro vývojáře.

**Implementace:**
- Přidat JSDoc/TSDoc komentáře
- Implementovat automatické generování dokumentace
- Přidat diagramy architektury
- Dokumentovat klíčové algoritmy a rozhodnutí

**Soubory k úpravě:**
- Všechny zdrojové soubory
- Vytvořit nový adresář `docs/`

**Přínosy:**
- Rychlejší onboarding nových vývojářů
- Lepší pochopení kódu
- Snazší údržba a refaktoring
- Zachování znalostí o projektu

## Další konsolidace

### 1. Konsolidace lokalizace

**Cíl:** Vytvořit komplexní lokalizační systém.

**Implementace:**
- Standardizovat na react-i18next
- Extrahovat všechny texty
- Implementovat namespace organizaci
- Intl API pro formátování
- Automatická detekce jazyka

**Soubory k úpravě:**
- Vytvořit `packages/frontend/src/i18n/`
- Vytvořit `packages/frontend/src/utils/format.ts`
- Refaktorovat komponenty

**Přínosy:**
- Snadné přidání nových jazyků
- Konzistentní UI
- Lepší mezinárodní podpora
- A/B testing textů

### 2. Konsolidace správy metadat

**Cíl:** Vytvořit jednotný systém pro správu metadat.

**Implementace:**
- Jednotný service pro extrakci metadat
- Standardizované schéma metadat
- Verzování metadat
- UI komponenty pro zobrazení/editaci
- Vyhledávání podle metadat

**Soubory k úpravě:**
- Vytvořit `packages/backend/src/services/metadataService.ts`
- Vytvořit `packages/frontend/src/hooks/useMetadata.ts`
- Vytvořit `packages/frontend/src/components/MetadataViewer.tsx`

**Přínosy:**
- Konzistentní zpracování metadat
- Lepší vyhledávání
- Snížení duplicit o 40%+
- Rozšířené možnosti filtrování

### 3. Konsolidace testovacích utilit

**Cíl:** Vytvořit jednotný systém pro testování.

**Implementace:**
- Centrální test utilities
- Factory functions pro test data
- Standardizované mocking
- Shared test fixtures
- Typově bezpečné test helpers

**Soubory k úpravě:**
- Vytvořit `packages/frontend/src/test-utils/`
- Vytvořit `packages/backend/src/test-utils/`
- Refaktorovat existující testy

**Přínosy:**
- Rychlejší psaní testů
- Konzistentnější coverage
- Snazší údržba
- Lepší typová bezpečnost

## Optimalizace testů

### 1. Rozšíření unit testů

**Cíl:** Zvýšit pokrytí a kvalitu unit testů.

**Implementace:**
- Rozšířit pokrytí testů
- Implementovat property-based testing
- Přidat testy hraničních případů
- Implementovat snapshot testing pro UI komponenty

**Soubory k úpravě:**
- `packages/*/src/__tests__/`

**Přínosy:**
- Vyšší kvalita kódu
- Rychlejší detekce regresí
- Lepší dokumentace chování
- Větší důvěra v změny

### 2. Implementace integračních testů

**Cíl:** Testovat interakce mezi komponentami.

**Implementace:**
- Implementovat testy API endpointů
- Přidat testy databázových operací
- Implementovat testy autentizace a autorizace
- Přidat testy pro kritické business procesy

**Soubory k úpravě:**
- Vytvořit nový adresář `packages/backend/src/__integration_tests__/`

**Přínosy:**
- Detekce problémů s integrací
- Testování reálných scénářů
- Větší důvěra v systém jako celek
- Prevence regresí v kritických procesech

### 3. Implementace end-to-end testů

**Cíl:** Testovat aplikaci z pohledu uživatele.

**Implementace:**
- Implementovat Playwright testy
- Přidat testy pro kritické uživatelské cesty
- Implementovat vizuální regresní testy
- Přidat testy přístupnosti

**Soubory k úpravě:**
- Vytvořit nový adresář `e2e-tests/`

**Přínosy:**
- Testování reálných uživatelských scénářů
- Detekce problémů s UI
- Zajištění konzistentního chování napříč prohlížeči
- Prevence regresí v uživatelském rozhraní

### 4. Implementace performance testů

**Cíl:** Testovat výkon aplikace.

**Implementace:**
- Implementovat load testy
- Přidat testy odezvy API
- Implementovat testy renderování UI
- Přidat testy pro kritické operace

**Soubory k úpravě:**
- Vytvořit nový adresář `performance-tests/`

**Přínosy:**
- Detekce výkonnostních problémů
- Stanovení baseline pro výkon
- Prevence výkonnostních regresí
- Data pro optimalizaci

## Závěr

Tento plán refaktoringu a optimalizace poskytuje komplexní přehled možných vylepšení aplikace SpherosegV4. Implementace těchto doporučení by měla vést k výraznému zlepšení kvality kódu, výkonu a udržitelnosti aplikace.

Doporučujeme postupovat podle priorit:

1. Bezpečnostní optimalizace
2. Optimalizace frontendu a backendu
3. Optimalizace databáze a monitoringu
4. Optimalizace CI/CD a testů
5. Optimalizace dokumentace

Každá sekce obsahuje konkrétní úkoly, které lze implementovat nezávisle, což umožňuje flexibilní plánování a postupnou implementaci.