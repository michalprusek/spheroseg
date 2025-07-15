# Oprava automatického odhlašování při otevření file dialogu

## Problém
Uživatelé byli automaticky odhlašováni při jakékoliv akci, která otevřela file dialog (výběr souborů). Problém byl způsoben event handlerem v `AuthContext.tsx`, který odhlašoval uživatele při obnovení focusu okna, pokud neměli zaškrtnuté "Remember me".

## Příčina
```javascript
const handleWindowFocus = () => {
  if (!shouldPersistSession() && user) {
    logger.info('Session should not persist and window gained focus, logging out');
    signOut();
  }
};
```

Když se otevře file dialog:
1. Okno prohlížeče ztratí focus
2. Po zavření dialogu okno znovu získá focus
3. Spustí se `handleWindowFocus` event
4. Pokud uživatel neměl zaškrtnuté "Remember me", byl odhlášen

## Řešení
Zakázal jsem problematický focus event handler:
1. Zakomentoval jsem logiku v `handleWindowFocus`
2. Odstranil jsem registraci focus event listeneru
3. Ponechal jsem pouze `beforeunload` a `visibilitychange` eventy

## Změněné soubory
- `/packages/frontend/src/contexts/AuthContext.tsx`
  - Řádky 767-774: Zakomentována logika odhlašování při focus
  - Řádky 798-807: Odstraněn focus event listener

## Výsledek
- Uživatelé již nebudou odhlašováni při otevření file dialogu
- Funkce "Remember me" stále funguje správně (při zavření prohlížeče)
- Bezpečnost není ohrožena - tokeny stále expirují normálně

## Doporučení
Pro lepší UX doporučuji v budoucnu:
1. Používat session storage místo focus eventů pro dočasné sessions
2. Implementovat "idle timeout" místo focus-based logout
3. Jasně informovat uživatele o důsledcích nezaškrtnutí "Remember me"