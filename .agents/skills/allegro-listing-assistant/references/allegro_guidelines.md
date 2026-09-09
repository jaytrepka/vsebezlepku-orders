# Allegro Listing Guidelines & Parameters for Gluten-Free Foods

## 1. Top Categories on Allegro.pl

| Category Path | Category ID / Name | Target Products |
| :--- | :--- | :--- |
| `Supermarket > Produkty spożywcze > Makarony` | Makarony bezglutenowe | Massimo Zero, Tortelloni PM |
| `Supermarket > Produkty spożywcze > Pieczywo i wyroby cukiernicze` | Ciastka i wafle bezglutenowe | Savoiardi, Piaceri donuty, muffiny |
| `Supermarket > Produkty spożywcze > Mąki i mieszanki` | Mąki bezglutenowe | PM mouky, Caputo Fioreglut |
| `Supermarket > Produkty spożywcze > Dania gotowe i konserwy` | Dania gotowe | Plněné těstoviny |

## 2. Parameter Mapping Dictionary

| Parameter Name (Allegro) | Expected Value | Purpose |
| :--- | :--- | :--- |
| `Cechy dodatkowe` | `bezglutenowy`, `ekologiczny` (if organic) | Required for buyers filtering for gluten-free |
| `Waga netto` | e.g. `250 g` / `500 g` | Shipping & unit comparison |
| `Kraj pochodzenia` | `Włochy` | Highlight Italian authenticity |
| `Stan` | `Nowy` | New condition |
| `Marka` | `Piaceri Mediterranei` / `Massimo Zero` | Brand registry & search filtering |

## 3. Polish Description Template (Allegro Section Format)

```html
<section>
  <div class="item item-12">
    <section class="text-section">
      <h2>Piaceri Mediterranei Tortelloni Dyniowe Bezglutenowe 250g</h2>
      <p>Wyśmienite, tradycyjne włoskie tortelloni bezglutenowe z delikatnym nadzieniem z dyni, ricotty i sera Grana Padano. Idealne dla osób na diecie bezglutenowej oraz celiaków.</p>
      <p><strong>Cechy produktu:</strong></p>
      <ul>
        <li>100% Bezglutenowe z certyfikatem</li>
        <li>Bez oleju palmowego i bez konserwantów</li>
        <li>Jaja z wolnego wybiegu</li>
        <li>Szybkie przygotowanie: gotowe w 2 minuty</li>
      </ul>
      <p><strong>Składniki:</strong> Skrobia kukurydziana, mąka ryżowa, <strong>jaja</strong> 15%, dynia 10%, ser ricotta (serwatka, <strong>mleko</strong>, <strong>śmietanka</strong>, sól, regulator kwasowości: kwas cytrynowy)...</p>
      <p><strong>Wartości odżywcze na 100g:</strong> Wartość energetyczna: 933 kJ / 222 kcal, Tłuszcz: 6,7g (w tym nasycone: 3,7g), Węglowodany: 32,5g (w tym cukry: 6,3g), Błonnik: 4,2g, Białko: 5,7g, Sól: 1,26g.</p>
    </section>
  </div>
</section>
```
