# Image Upload Logout Issue - Fix Summary

## Problem
Uživatel se odhlašoval při výběru obrázků v dialogu pro nahrávání souborů.

## Root Cause
Problém byl způsoben konfliktem mezi výchozími hlavičkami axios a požadavky na multipart/form-data upload:
1. apiClient měl výchozí `Content-Type: application/json` 
2. Při FormData requestech se tato hlavička konfliktovala s potřebnou multipart/form-data hlavičkou
3. Backend nemohl správně zpracovat multipart request bez správné boundary
4. To vedlo k 401 chybě, která způsobila automatické odhlášení

## Implementované řešení

### 1. První pokus (částečně úspěšný)
- Odebrána explicitní `Content-Type: multipart/form-data` hlavička z imageUpload.ts
- Přidána logika do apiClient pro detekci FormData a odebrání Content-Type hlavičky
- Problém: Stále docházelo ke konfliktům s výchozími hlavičkami

### 2. Finální řešení (implementováno)
Vytvořen samostatný uploadClient speciálně pro file uploads:

**Nový soubor: `/packages/frontend/src/lib/uploadClient.ts`**
```typescript
const uploadClient: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 300000, // 5 minut pro velké soubory
  withCredentials: true,
  // Žádné výchozí hlavičky - nechat axios je nastavit
});
```

**Změny v `/packages/frontend/src/api/imageUpload.ts`**
- Změněno z `import apiClient` na `import uploadClient`
- Všechny upload requesty nyní používají `uploadClient` místo `apiClient`

## Výhody řešení
1. **Oddělení problémů**: Upload logika je oddělena od běžných JSON API requestů
2. **Žádné konflikty hlaviček**: uploadClient nemá žádné výchozí hlavičky
3. **Správná autentizace**: Authorization header se přidává správně v interceptoru
4. **Lepší timeout**: 5 minut pro velké soubory místo 30 sekund

## Testování
- ✅ Uživatel zůstává přihlášený při otevření upload dialogu
- ✅ Authorization header se správně posílá s FormData requesty
- ✅ Backend může zpracovat multipart/form-data s správnou boundary

## Doporučení pro budoucnost
1. Vždy používat uploadClient pro file uploads
2. Nikdy explicitně nenastavovat Content-Type pro FormData
3. Monitorovat backend logy pro 401 chyby při upload operacích