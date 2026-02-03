# VšeBezLepku Objednávky

Webová aplikace pro správu objednávek z e-shopu vsebezlepku.cz a generování štítků na produkty.

## Funkce

- 📧 **Synchronizace emailů** - Čte potvrzovací emaily z Gmailu a extrahuje objednávky
- 📦 **Správa objednávek** - Přehled všech objednávek s produkty
- 🏷️ **Štítky produktů** - Vytvoření štítků s informacemi (složení, nutriční hodnoty, atd.)
- 🖨️ **Generování PDF** - Export štítků na A4 (24 pozic, 36×70mm) s volitelnou počáteční pozicí

## Technologie

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- Gmail API
- pdf-lib

## Instalace

1. Klonujte repozitář
2. Nainstalujte závislosti:
   ```bash
   npm install
   ```

3. Vytvořte `.env` soubor podle `.env.example`

4. Nastavte Google Cloud projekt:
   - Přejděte na https://console.cloud.google.com/
   - Vytvořte nový projekt
   - Povolte Gmail API
   - Vytvořte OAuth 2.0 credentials
   - Nastavte redirect URI: `http://localhost:3000/api/auth/callback`

5. Spusťte migrace databáze:
   ```bash
   npx prisma migrate dev
   ```

6. Spusťte vývojový server:
   ```bash
   npm run dev
   ```

## Použití

1. Připojte Gmail účet kliknutím na "Připojit Gmail"
2. Nastavte počet dní zpět a synchronizujte emaily
3. Pro produkty bez štítků klikněte na "Přidat štítek" a vyplňte údaje
4. Vyberte objednávky, nastavte počáteční pozici a klikněte na "Generovat štítky"

## Štítky

Formát štítků: A4 papír s 24 pozicemi (3 sloupce × 8 řádků)
- Rozměr štítku: 36 × 70 mm
- Obsah: Název, Složení, Nutriční hodnoty, Skladování, Výrobce

## Licence

MIT
