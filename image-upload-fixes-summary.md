# Souhrn oprav pro nahrávání obrázků

## Opravené problémy:

### 1. **500 Error při nahrávání obrázků**
- **Příčina**: Chybný import databázového modulu v `images.ts`
- **Oprava**: Změněno z `import pool from '../db'` na `import { getPool } from '../db'`
- **Soubor**: `/packages/backend/src/routes/images.ts`

### 2. **500 Error při generování TIFF/BMP preview**
- **Příčina**: Endpoint `/api/preview/generate` neexistuje v backendu
- **Oprava**: Dočasně zakázáno a použití canvas preview pro TIFF/BMP soubory
- **Soubor**: `/packages/frontend/src/utils/tiffPreview.ts`

### 3. **Chyba při generování thumbnailů**
- **Příčina**: Některé formáty obrázků (TIFF/BMP) nelze načíst jako Image element
- **Oprava**: Přidána detekce TIFF/BMP souborů a použití canvas preview
- **Soubor**: `/packages/frontend/src/api/imageUpload.ts`

### 4. **400 Error při batch segmentaci**
- **Příčina**: Backend validátor očekával UUID formát, ale frontend generuje `img-timestamp-random`
- **Oprava**: Upraven regex ve validátoru z `/^img-\d+-\d+$/` na `/^img-\d+-\d{4}$/`
- **Soubor**: `/packages/backend/src/validators/segmentationValidators.ts`

## Zbývající problémy k řešení:

1. **Preview endpoint**: Implementovat backend endpoint pro generování preview TIFF/BMP souborů
2. **IndexedDB synchronizace**: Občasné varování "Image not found in IndexedDB"

## Testování:
Po restartu služeb by mělo fungovat:
- Nahrávání JPEG/PNG souborů
- Nahrávání TIFF/BMP souborů (s canvas preview)
- Generování thumbnailů pro všechny formáty
- Spuštění batch segmentace