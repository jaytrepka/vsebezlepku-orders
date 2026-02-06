import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Parsed Czech labels from the Google Doc
const czechLabels = [
  {
    productName: "BROWNIES 200g",
    nazev: "BROWNIES 200g",
    slozeni: "Cukr třtinový, kousky hořké čokolády 23,6 % (cukr, kakaová hmota, kakaové máslo, dextróza, emulgátor: sójový lecitin), vejce, slunečnicový olej, rýžová mouka, kukuřičný škrob, zvlhčovadla: glycerol, sorbitol; kakaový prášek, konzervant: sorban draselný; zahušťovadlo: xanthanová guma; aroma. Může obsahovat stopy mléčných bílkovin, sezamových semínek a ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1782 kJ / 426 kcal. Tuky 22g (z toho nasycené mastné kyseliny 5,6g). Sacharidy 51g (z toho cukry 37g). Vláknina 3,1g. Bílkoviny 4,4g. Sůl 0,07g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "BRUSCHETTINE Mediterranee 100g",
    nazev: "BRUSCHETTINE Mediterranee 100g",
    slozeni: "Voda, kukuřičný škrob, rýžová mouka, extra panenský olivový olej ze Sicílie (10 %), cukr, pivovarské kvasnice, zahušťovadla: guarová mouka; rostlinná vlákna: psyllium, hydroxypropylmethylcelulóza; sůl, černé olivy, oregano, rozmarýn, granule kapary. Může obsahovat sezam.",
    nutricniHodnoty: "Energetická hodnota: 1697 kJ / 406 kcal. Tuky 15,2g (z toho nasycené mastné kyseliny 2,3g). Sacharidy 67g (z toho cukry 3,7g). Vláknina 4,4g. Bílkoviny 2,5g. Sůl 0,1g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "BRUSCHETTINE s paprikou a chilli 100g",
    nazev: "BRUSCHETTINE s paprikou a chilli 100g",
    slozeni: "Voda, kukuřičný škrob, rýžová mouka, extra panenský olivový olej ze Sicílie (9 %), cukr, rajčatový koncentrát (3 %), pivovarské kvasnice, sůl, zahušťovadla (guarová mouka, hydroxypropylmethylcelulóza), sladká paprika v prášku (1 %), rostlinná vlákna (psyllium), chilli v prášku (0,5 %). Může obsahovat sezam.",
    nutricniHodnoty: "Energetická hodnota: 1658 kJ / 397 kcal. Tuky 15g (z toho nasycené mastné kyseliny 2g). Sacharidy 65g (z toho cukry 4g). Vláknina 4,5g. Bílkoviny 2,6g. Sůl 0,02g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "FARFALLE 400g",
    nazev: "FARFALLE 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CANNELLONI",
    nazev: "CANNELLONI",
    slozeni: "Žlutá kukuřičná mouka (49,8 %), bílá kukuřičná mouka (49,8 %), emulgátor: mono- a diglyceridy mastných kyselin. Může obsahovat stopy sóji a vajec.",
    nutricniHodnoty: "Energetická hodnota: 1511kJ / 356 kcal. Tuky 2,0g (z toho nasycené mastné kyseliny 1,0g). Sacharidy 76,8g (z toho cukry 1,0g). Vláknina 1,5g. Bílkoviny 7,0g. Sůl 0,06g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CANTUCCI 200g",
    nazev: "CANTUCCI 200g",
    slozeni: "Kukuřičný škrob, cukr, vejce, mandle 12 %, slunečnicový olej, glukózový sirup, modifikovaný kukuřičný škrob, med, psyllium vláknina, čekanková vláknina, zahušťovadla (guarová guma, hydroxypropylmethylcelulóza), sůl, kypřící látky (disodný pyrofosfát, jedlá soda, kukuřičný škrob), aroma. Může obsahovat stopy sóji, sezamu a jiných ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1916 kJ / 456 kcal. Tuky 17g (z toho nasycené mastné kyseliny 1,8g). Sacharidy 68g (z toho cukry 9,9g). Vláknina 3,9g. Bílkoviny 5,5g. Sůl 0,6g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "ATTIMI KŘEHKÉ LÍSKOOŘÍŠKOVÉ KOLÁČKY 120g",
    nazev: "ATTIMI KŘEHKÉ LÍSKOOŘÍŠKOVÉ KOLÁČKY 120g",
    slozeni: "Lískooříškový krém 30% [cukr, slunečnicový olej, lískové oříšky (4% hotového výrobku), kakaový prášek (2,5% hotového výrobku), rýžový sirup, kakaové máslo, emulgátor (slunečnicový lecitin), aromata]; rostlinný margarín (bambucký tuk, slunečnicový olej, voda, koncentrát citronové šťávy, emulgátory mono- a diglyceridy mastných kyselin; přírodní aroma), deglutinovaný pšeničný škrob, cukr, modifikovaný kukuřičný škrob, rýžová mouka, vejce, vláknina psyllium, zahušťovadla (xanthanová guma, hydroxy-propyl-methylcelulóza), sůl. Může obsahovat sóju, jiné ořechy a hořčici.",
    nutricniHodnoty: "Energetická hodnota: 2186 kJ / 524 kcal. Tuky 31g (z toho nasycené mastné kyseliny 11g). Sacharidy 56g (z toho cukry 24g). Vláknina 5,5g. Bílkoviny 2,7g. Sůl 0,5g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "SFOGLIATINE KŘEHKÉ SUŠENKY S MERUŇKOVOU GLAZUROU 150g",
    nazev: "SFOGLIATINE KŘEHKÉ SUŠENKY S MERUŇKOVOU GLAZUROU 150g",
    slozeni: "Rostlinný margarín [slunečnicový olej, bambucký tuk, voda, emulgátory (E471), sůl, regulátor kyselosti (E330), aromata], deglutinovaný pšeničný škrob, poleva 20% (cukr, vaječný bílek), meruňková poleva 6% [glukózo-fruktózový sirup, cukr, meruňkové pyré 1% (v hotovém výrobku), zahušťovadla pektin, karobová guma, tetrafosforečnan sodný; regulátory kyselosti: kyselina citronová, citrát vápenatý; barvivo (E160c), konzervant: sorban draselný; aromata], rýžová mouka, voda, modifikovaný kukuřičný škrob, cukr, vejce, vláknina psyllium, zahušťovadla: xantanová guma, hydroxy-propyl-methylcelulóza; sůl. Může obsahovat sóju a ořechy.",
    nutricniHodnoty: "Energetická hodnota: 1978 kJ / 474 kcal. Tuky 26g (z toho nasycené mastné kyseliny 11g). Sacharidy 55g (z toho cukry 17g). Vláknina 5,5g. Bílkoviny 2,6g. Sůl 0,6g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "PAVONETTI - bezlepkové křehké sušenky 140g",
    nazev: "PAVONETTI - bezlepkové křehké sušenky 140g",
    slozeni: "Rostlinný margarín [rostlinný tuk (bambucké maslo), slunečnicový olej s vysokým obsahem kyseliny olejové, voda, koncentrovaná citronová šťáva, emulgátor: mono- a diglyceridy mastných kyselin, přírodní aroma]; bezlepkový pšeničný škrob, hořká čokoláda 17 % (kakaová hmota, cukr, kakaové máslo); cukr, rýžová mouka, vejce, modifikovaný kukuřičný škrob, vláknina psyllium, zahušťovadla (xanthanová guma, hydroxypropylmethylcelulóza), sůl, aroma. Může obsahovat sóju, hořčici a ořechy.",
    nutricniHodnoty: "Energetická hodnota: 2171 kJ / 521 kcal. Tuky 31g (z toho nasycené mastné kyseliny 17g). Sacharidy 54g (z toho cukry 17g). Vláknina 6,3g. Bílkoviny 2,7g. Sůl 0,6g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "VENTAGLIETTI - bezlepkové křehké vějířky 140g",
    nazev: "VENTAGLIETTI - bezlepkové křehké vějířky 140g",
    slozeni: "Rostlinný margarín [slunečnicový olej, bambucký tuk, voda, emulgátor (E471), sůl, regulátor kyselosti (E330), aromata], bezlepkový pšeničný škrob, cukr, rýžová mouka, voda, vejce, modifikovaný kukuřičný škrob, vláknina psyllium, zahušťovadla (xanthanová guma, hydroxypropylmethylcelulóza), sůl, aroma. Může obsahovat sóju a ořechy.",
    nutricniHodnoty: "Energetická hodnota: 2146 kJ / 515 kcal. Tuky 30g (z toho nasycené mastné kyseliny 13g). Sacharidy 55g (z toho cukry 10g). Vláknina 6,5g. Bílkoviny 2,5g. Sůl 0,6g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "SUŠENKY BISCOTTI PETIT 200g",
    nazev: "SUŠENKY BISCOTTI PETIT 200g",
    slozeni: "Kukuřičný škrob, bramborový škrob, cukr, slunečnicový olej, kukuřičná mouka, rýžová mouka, čerstvá vejce 4,9 %, emulgátory: mono- a diglyceridy mastných kyselin; med, zahušťovadlo: guarová guma; modifikovaný tapiokový škrob, sušené odstředěné mléko bez laktózy 0,2 %, kypřicí látky: hydrogenuhličitan amonný, hydrogenuhličitan sodný; aromata, sůl. Může obsahovat sóju. Obsah laktózy je nižší než 0,1 g na 100 g.",
    nutricniHodnoty: "Energetická hodnota: 1925 kJ / 457 kcal. Tuky 14g (z toho nasycené mastné kyseliny 2,8g). Sacharidy 81g (z toho cukry 19g). Vláknina 0,5g. Bílkoviny 1,5g. Sůl 0,45g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "PISTÁCIOVÉ OPLATKY 150g",
    nazev: "PISTÁCIOVÉ OPLATKY 150g",
    slozeni: "Bramborový škrob, glukóza, kokosový olej, cukr, pistácie 12%, rýžová mouka, sušené odstředěné mléko bez laktózy 4,9%, emulgátor: sójový lecitin; sůl, zahušťovadlo: guarová mouka; kypřící látka: hydrogenuhličitan sodný. Může obsahovat jiné ořechy a sezam. Obsah laktózy je nižší než 0,1 g na 100 g.",
    nutricniHodnoty: "Energetická hodnota: 2150 kJ / 513 kcal. Tuky 25,1g (z toho nasycené mastné kyseliny 18,3g). Sacharidy 66,1g (z toho cukry 25,1g). Vláknina 1,8g. Bílkoviny 4,9g. Sůl <0,25g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CEREÁLIE MEDOVÉ KROUŽKY 300g",
    nazev: "CEREÁLIE MEDOVÉ KROUŽKY 300g",
    slozeni: "Kukuřičná mouka (79%), cukr, med (1%), glukózový sirup, sůl. Může obsahovat stopy ořechů a sóji.",
    nutricniHodnoty: "Energetická hodnota: 1617 kJ / 381 kcal. Tuky 1g (z toho nasycené mastné kyseliny 0,3g). Sacharidy 86g (z toho cukry 19g). Vláknina 2g. Bílkoviny 6g. Sůl 0,3g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CEREÁLIE QUADROTTI DARK 300g",
    nazev: "CEREÁLIE QUADROTTI DARK 300g",
    slozeni: "Lískový krém 35 % [cukr, rostlinné tuky (slunečnicový, kakaové máslo), kakaový prášek se sníženým obsahem tuku, lískové ořechy (2,5 % hotového výrobku), syrovátkový prášek, sušené odstředěné mléko, emulgátor: slunečnicový lecitin; aroma], rýžová mouka 25,5 %, kukuřičná mouka 23 %, kakaový prášek 4,1 %, černý kakaový prášek 2,5 %, cukr, sůl. Může obsahovat sóju a ořechy.",
    nutricniHodnoty: "Energetická hodnota: 1861 kJ / 442 kcal. Tuky 14g (z toho nasycené mastné kyseliny 3,2g). Sacharidy 72g (z toho cukry 31g). Vláknina 2,5g. Bílkoviny 5,8g. Sůl 0,51g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CEREÁLIE DUHOVÉ KROUŽKY 300g",
    nazev: "CEREÁLIE DUHOVÉ KROUŽKY 300g",
    slozeni: "Kukuřičná mouka 57,8 %, cukr, bezlepková ovesná mouka 18,8 %, rostlinný koncentrát (spirulina, světlice barvířská, ředkvička, citron, batát), sůl, přírodní aroma. Může obsahovat sóju, mléko a ořechy.",
    nutricniHodnoty: "Energetická hodnota: 1588 kJ / 375 kcal. Tuky 2g (z toho nasycené mastné kyseliny 0,5g). Sacharidy 80g (z toho cukry 19g). Vláknina 3,9g. Bílkoviny 7,2g. Sůl 0,71g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CEREÁLNÍ TYČINKY ČOKOLÁDOVÉ 129g",
    nazev: "CEREÁLNÍ TYČINKY ČOKOLÁDOVÉ 129g (6ks)",
    slozeni: "Rýžové vločky (52,4%) (rýže (82%), kukuřičné otruby (6%), cukr, kukuřičná mouka, sůl), glukózový sirup, tmavá čokoláda 10% (kakaová pasta, cukr, kakaové máslo, emulgátor: slunečnicová lecitina, přírodní aroma vanilky. Minimální obsah kakaa 60%), cukr, inulin (z čekanky), kousky tmavé čokolády 5% (cukr, kakaová pasta, kakaové máslo, emulgátor: slunečnicová lecitina, přírodní aroma vanilky. Minimální obsah kakaa 46%), zvlhčovače: sorbitol, glycerol; kokosový olej, povlak: arabská guma, emulgátor: slunečnicová lecitina, sůl, kypřící činidlo: jedlá soda, čokoládové aroma.",
    nutricniHodnoty: "Energetická hodnota: 1661 kJ / 394 kcal. Tuky 9g (z toho nasycené mastné kyseliny 5,8g). Sacharidy 70g (z toho cukry 24g). Vláknina 7g. Bílkoviny 4,8g. Sůl 0,4g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CEREÁLNÍ TYČINKY S BRUSINKAMI 129g",
    nazev: "CEREÁLNÍ TYČINKY S BRUSINKAMI 129g (6ks)",
    slozeni: "Rýžové a kukuřičné vločky 56 % (rýže (82 %), kukuřičné otruby (6 %), cukr, kukuřičná mouka, sůl), glukózový sirup, sušené brusinky 9 % (brusinky, cukr, přírodní aroma, slunečnicový olej), cukr, inulin (z čekanky), zvlhčující látky: sorbitol a glycerol; kokosový olej, potahovací látka: arabská guma; emulgátor: slunečnicový lecitin; sůl, okyselující látka: kyselina citronová; kypřící látka: hydrogenuhličitan sodný; aroma.",
    nutricniHodnoty: "Energetická hodnota: 349 kJ / 83 kcal. Tuky 3,5g (z toho nasycené mastné kyseliny 2,8g). Sacharidy 79g (z toho cukry 23g). Vláknina 7g. Bílkoviny 5g. Sůl 0,3g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CIOCOMIX MINICOOKIES 200g",
    nazev: "CIOCOMIX MINICOOKIES 200g",
    slozeni: "Cukr, kousky hořké čokolády 19 % (cukr, kakaová hmota, kakaové máslo, emulgátor: sójový lecitin, přírodní aroma vanilky), celozrnná ovesná mouka, rýžová mouka, třtinový cukr, vejce, slunečnicový olej, glukózový sirup (kukuřice), sůl, kypřící látky: uhličitan sodný, uhličitan amonný; zahušťovadlo: xanthanová guma. Může obsahovat stopy mléka, sezamu a ořechů.",
    nutricniHodnoty: "Energetická hodnota: 2116 kJ / 505 kcal. Tuky 22g (z toho nasycené mastné kyseliny 6,7g). Sacharidy 67g (z toho cukry 35g). Vláknina 3,8g. Bílkoviny 7,8g. Sůl 0,65g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CIOCOPUNTA ČOKOLÁDOVÉ MINIKORNOUTKY 108g",
    nazev: "CIOCOPUNTA ČOKOLÁDOVÉ MINIKORNOUTKY 108g (6ks)",
    slozeni: "Krém z lískových ořechů 55,5 % (třtinový cukr, rostlinné oleje a tuky (slunečnicový s vysokým obsahem kyseliny olejové, kakaový), pasta z lískových ořechů 15 %, glukózový sirup, odtučněný kakaový prášek, rostlinná vláknina (inulin), emulgátor: slunečnicový lecitin; přírodní aroma), rýžová mouka, cukr, kukuřičný škrob, kukuřičná mouka, slunečnicový olej vysokoleicový, rostlinná vláknina (bambusová), sójová mouka, emulgátor: sójový lecitin; sůl, karamelizovaný cukr, odtučněný kakaový prášek, přírodní aroma. Může obsahovat stopy mléka.",
    nutricniHodnoty: "Energetická hodnota: 2065 kJ / 494 kcal. Tuky 26g (z toho nasycené mastné kyseliny 5,5g). Sacharidy 57g (z toho cukry 36g). Vláknina 7,8g. Bílkoviny 4,1g. Sůl 0,23g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CIOCOPUNTA PISTÁCIOVÉ MINIKORNOUTKY 108g",
    nazev: "CIOCOPUNTA PISTÁCIOVÉ MINIKORNOUTKY 108g (6ks)",
    slozeni: "Krém z pistácií 55,5 % (cukr, rafinovaný kokosový olej, glukózový sirup, pasta z pistácií 13 %, vláknina (inulin), emulgátor: slunečnicový lecitin; sůl, přírodní aroma), hořká čokoláda 13,5 % (kakaová hmota, cukr, kakaové máslo, emulgátor: sójový lecitin; přírodní aroma vanilky), rýžová mouka, cukr, kukuřičný škrob, kukuřičná mouka, slunečnicový olej vysokoleicový, vláknina (bambusová), sójová mouka, emulgátor: sójový lecitin; sůl, karamelizovaný cukr, odtučněný kakaový prášek, přírodní aroma vanilky. Může obsahovat stopy mléka a dalších ořechů.",
    nutricniHodnoty: "Energetická hodnota: 2072 kJ / 496 kcal. Tuky 25g (z toho nasycené mastné kyseliny 16g). Sacharidy 60g (z toho cukry 37g). Vláknina 7,7g. Bílkoviny 3g. Sůl 0,28g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "COUS COUS kukuřičný 375g",
    nazev: "COUS COUS kukuřičný 375g",
    slozeni: "Kukuřičná mouka 100%",
    nutricniHodnoty: "Energetická hodnota: 1494kJ / 352 kcal. Tuky 1,0g (z toho nasycené mastné kyseliny 0,2g). Sacharidy 77g (z toho cukry 0,5g). Vláknina 2,5g. Bílkoviny 7,5g. Sůl 0,02g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CRACKERS TRADICIONALES 200g",
    nazev: "CRACKERS TRADICIONALES 200g",
    slozeni: "Kukuřičný škrob (43%), voda, rýžová mouka, slunečnicový olej (10%), kukuřičná mouka, kypřící látky: hydrogenuhličitan amonný; cukr, sůl. Může obsahovat stopy mléka, sóji, vajec a sezamu.",
    nutricniHodnoty: "Energetická hodnota: 1852 kJ / 442 kcal. Tuky 16g (z toho nasycené mastné kyseliny 1,5g). Sacharidy 68g (z toho cukry 2,5g). Vláknina 1,5g. Bílkoviny 1,5g. Sůl 1,3g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CRACKERS SE ZELENINOVOU PŘÍCHUTÍ 200g",
    nazev: "CRACKERS SE ZELENINOVOU PŘÍCHUTÍ 200g",
    slozeni: "Kukuřičný škrob, voda, rýžová mouka, slunečnicový olej, cukr, pivovarské kvasnice, zahušťovadlo: guarová mouka; sůl, rajčatové pyré 0,3 %, rostlinná vlákna: psyllium, hydroxypropylmethylcelulóza; špenátový prášek, mrkvový prášek, kypřicí látky: disodný pyrofosfát, jedlá soda; sladká paprika. Může obsahovat stopy mléka, sóji, vajec a sezamu.",
    nutricniHodnoty: "Energetická hodnota: 1735 kJ / 413 kcal. Tuky 13g (z toho nasycené mastné kyseliny 1,5g). Sacharidy 69g (z toho cukry 3,8g). Vláknina 4,5g. Bílkoviny 2,5g. Sůl 1,5g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "DITALINI RIGATI 400g",
    nazev: "DITALINI RIGATI 400g",
    slozeni: "Bílá kukuřičná mouka, rýžová mouka, voda, rýžový škrob, emulgátor: monoacylglyceroly a diacylglyceroly. Může obsahovat stopy sóji, lupiny.",
    nutricniHodnoty: "Energetická hodnota: 1508 kJ / 355 kcal. Tuky 0,9g (z toho nasycené mastné kyseliny 0,3g). Sacharidy 80g (z toho cukry 1g). Vláknina 1g. Bílkoviny 5g. Sůl 0,02g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "DONUTY PISTÁCIOVÉ 90g",
    nazev: "DONUTY PISTÁCIOVÉ 90g (2ks)",
    slozeni: "Pistáciový krém 30 % [cukr, rafinovaný kokosový olej, glukózový sirup, pistácie 10 % (z hotového výrobku 3 %), vláknina, emulgátor: sójový lecitin; sůl, přírodní aroma], čerstvá vejce, cukr, bambucký tuk, kukuřičný škrob, rýžová mouka, sušené mléko bez laktózy, zahušťovadlo: xanthanová guma; kypřící látky: diphosphorečnan sodný, hydrogenuhličitan sodný; sůl, mléčné bílkoviny, přírodní aroma. Může obsahovat stopy sezamu a dalších ořechů.",
    nutricniHodnoty: "Energetická hodnota: 2004 kJ / 479 kcal. Tuky 23g (z toho nasycené mastné kyseliny 15g). Sacharidy 58g (z toho cukry 39g). Vláknina 2g. Bílkoviny 6g. Sůl 0,64g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "DONUTY S KAKAOVOU POLEVOU 80g",
    nazev: "DONUTY S KAKAOVOU POLEVOU 80g (2ks)",
    slozeni: "Čerstvá vejce, cukr, polevová hmota s kakaem 10% (cukr, plně ztužený kokosový olej, kakaový prášek 17%, lískové ořechy 3,5%, sušené mléko, emulgátor: sójový lecitin; aroma), bambucký tuk, kukuřičný škrob, rýžová mouka, sušené mléko bez laktózy, zahušťovadla: xanthanová guma; kypřící látka: diphosphorečnan sodný, hydrogenuhličitan sodný; mléčné bílkoviny, sůl, přírodní aroma. Může obsahovat stopy sezamu a dalších ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1913 kJ / 456 kcal. Tuky 22g (z toho nasycené mastné kyseliny 15g). Sacharidy 56g (z toho cukry 35g). Vláknina 1g. Bílkoviny 6g. Sůl 0,63g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "DONUTY S KAKAOVOU POLEVOU 160g",
    nazev: "DONUTY S KAKAOVOU POLEVOU 160g (4ks)",
    slozeni: "Čerstvá vejce, cukr, polevová hmota s kakaem 10% (cukr, plně ztužený kokosový olej, kakaový prášek 17%, lískové ořechy 3,5%, sušené mléko, emulgátor: sójový lecitin; aroma), bambucký tuk, kukuřičný škrob, rýžová mouka, sušené mléko bez laktózy, zahušťovadla: xanthanová guma; kypřící látka: diphosphorečnan sodný, hydrogenuhličitan sodný; mléčné bílkoviny, sůl, přírodní aroma. Může obsahovat stopy sezamu a dalších ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1913 kJ / 456 kcal. Tuky 22g (z toho nasycené mastné kyseliny 15g). Sacharidy 56g (z toho cukry 35g). Vláknina 1g. Bílkoviny 6g. Sůl 0,63g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "DONUTY S BÍLOU POLEVOU 80g",
    nazev: "DONUTY S BÍLOU POLEVOU 80g (2ks)",
    slozeni: "Čerstvá vejce, cukr, bílá polevová hmota 10% (cukr, plně ztužený rostlinný tuk, sušené odstředěné mléko, emulgátor: sójový lecitin; aroma), bambucký tuk, kukuřičný škrob, rýžová mouka, sušené mléko bez laktózy, zahušťovadlo: xanthanová guma; kypřící látky: difosforečnan sodný, hydrogenuhličitan sodný; mléčné bílkoviny, sůl, přírodní aroma. Může obsahovat stopy sezamu a ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1958 kJ / 468 kcal. Tuky 24g (z toho nasycené mastné kyseliny 17g). Sacharidy 55g (z toho cukry 33g). Vláknina 1g. Bílkoviny 6g. Sůl 0,64g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "DONUTY S BÍLOU POLEVOU 160g",
    nazev: "DONUTY S BÍLOU POLEVOU 160g (4ks)",
    slozeni: "Čerstvá vejce, cukr, bílá polevová hmota 10% (cukr, plně ztužený rostlinný tuk, sušené odstředěné mléko, emulgátor: sójový lecitin; aroma), bambucký tuk, kukuřičný škrob, rýžová mouka, sušené mléko bez laktózy, zahušťovadlo: xanthanová guma; kypřící látky: difosforečnan sodný, hydrogenuhličitan sodný; mléčné bílkoviny, sůl, přírodní aroma. Může obsahovat stopy sezamu a ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1958 kJ / 468 kcal. Tuky 24g (z toho nasycené mastné kyseliny 17g). Sacharidy 55g (z toho cukry 33g). Vláknina 1g. Bílkoviny 6g. Sůl 0,64g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "FUSILLI 400g",
    nazev: "FUSILLI 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "FUSILLI celozrnné 400g",
    nazev: "FUSILLI celozrnné 400g",
    slozeni: "Celozrnná kukuřičná mouka (60 %), celozrnná rýžová mouka (40 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1495 kJ / 353 kcal. Tuky 2,5g (z toho nasycené mastné kyseliny 0,6g). Sacharidy 73g (z toho cukry 1,5g). Vláknina 4g. Bílkoviny 7,5g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "GNOCCHI 200g",
    nazev: "GNOCCHI 200g",
    slozeni: "Rýžový škrob, bramborová mouka, cukr, bramborové vločky, rýžová mouka, zahušťovadla: xanthan, guarová guma; sůl, barviva: kurkuma. Může obsahovat sóju a vejce.",
    nutricniHodnoty: "Energetická hodnota: 1502 kJ / 354 kcal. Tuky 0,5g (z toho nasycené mastné kyseliny 0,2g). Sacharidy 82g (z toho cukry 5g). Vláknina 2g. Bílkoviny 2,5g. Sůl 1,3g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "GNOCCHETTI SARDI 400g",
    nazev: "GNOCCHETTI SARDI 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "LASAGNE 250g",
    nazev: "LASAGNE 250g",
    slozeni: "Bílá kukuřičná mouka, žlutá kukuřičná mouka, emulgátory: mono- a diglyceridy mastných kyselin. Může obsahovat stopy sóji a vajec.",
    nutricniHodnoty: "Energetická hodnota: 1511 kJ / 356 kcal. Tuky 2,0g (z toho nasycené mastné kyseliny 1,0g). Sacharidy 76,8g (z toho cukry 1,0g). Vláknina 1,5g. Bílkoviny 7,0g. Sůl 0,06g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "LINGUINE 400g",
    nazev: "LINGUINE 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "MEZZI RIGATONI 400g",
    nazev: "MEZZI RIGATONI 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "MUFFIN S ČOKOLÁDOVÝMI KOUSKY 200g",
    nazev: "MUFFIN S ČOKOLÁDOVÝMI KOUSKY 200g (4ks)",
    slozeni: "Čerstvá vejce, čokoládové kousky 15% (cukr, kakaová hmota, kakaové máslo, emulgátor: slunečnicový lecitin; aroma), cukr, bambucký tuk, rýžová mouka, kukuřičný škrob, zahušťovadla: xanthanová guma; kypřící látky: diphosphorečnan sodný, hydrogenuhličitan sodný; sůl, přírodní aroma. Může obsahovat stopy mléka, sóji, sezamu a ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1922 kJ / 459 kcal. Tuky 24g (z toho nasycené mastné kyseliny 14g). Sacharidy 52g (z toho cukry 29g). Vláknina 2g. Bílkoviny 5g. Sůl 0,6g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "MUFFIN S ČOKOLÁDOVÝMI KOUSKY 50g",
    nazev: "MUFFIN S ČOKOLÁDOVÝMI KOUSKY 50g",
    slozeni: "Čerstvá vejce, čokoládové kousky 15% (cukr, kakaová hmota, kakaové máslo, emulgátor: slunečnicový lecitin; aroma), cukr, bambucký tuk, rýžová mouka, kukuřičný škrob, zahušťovadla: xanthanová guma; kypřící látky: diphosphorečnan sodný, hydrogenuhličitan sodný; sůl, přírodní aroma. Může obsahovat stopy mléka, sóji, sezamu a ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1922 kJ / 459 kcal. Tuky 24g (z toho nasycené mastné kyseliny 14g). Sacharidy 52g (z toho cukry 29g). Vláknina 2g. Bílkoviny 5g. Sůl 0,6g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "PAN BAULETTO 300g",
    nazev: "PAN BAULETTO 300g",
    slozeni: "Kukuřičný škrob, voda, slunečnicový olej, cukr, psyllium vláknina, mléčný prášek, zahušťovadla: guarová mouka, hydroxypropylmethylcelulóza, xanthanová guma; mořská sůl, kvasnice, upravená tapioka škrob, laktóza a mléčné proteiny, přírodní aroma. Může obsahovat sóju a sezam.",
    nutricniHodnoty: "Energetická hodnota: 1302 kJ / 311 kcal. Tuky 10g (z toho nasycené mastné kyseliny 1,1g). Sacharidy 50g (z toho cukry 5,5g). Vláknina 5g. Bílkoviny 2,5g. Sůl 1,1g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "PANE CON NOCI 150g",
    nazev: "PANE CON NOCI 150g",
    slozeni: "Kukuřičný škrob, voda, slunečnicový olej, vlašské ořechy (8 %), cukr, psyllium vláknina, mléčný prášek, zahušťovadla: guarová mouka, hydroxypropylmethylcelulóza, xanthanová guma; mořská sůl, kvasnice, upravená tapioka škrob, laktóza a mléčné proteiny, přírodní aroma. Může obsahovat sóju, sezam a stopy dalších ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1386 kJ / 331 kcal. Tuky 14g (z toho nasycené mastné kyseliny 1,4g). Sacharidy 47g (z toho cukry 5,5g). Vláknina 5g. Bílkoviny 3,5g. Sůl 1,1g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "PENNE RIGATE 400g",
    nazev: "PENNE RIGATE 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "PENNE RIGATE celozrnné 400g",
    nazev: "PENNE RIGATE celozrnné 400g",
    slozeni: "Celozrnná kukuřičná mouka (60 %), celozrnná rýžová mouka (40 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1495 kJ / 353 kcal. Tuky 2,5g (z toho nasycené mastné kyseliny 0,6g). Sacharidy 73g (z toho cukry 1,5g). Vláknina 4g. Bílkoviny 7,5g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "PIPE RIGATE 400g",
    nazev: "PIPE RIGATE 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "PIZZETTE 200g",
    nazev: "PIZZETTE 200g (4ks)",
    slozeni: "Kukuřičný škrob, voda, rajčatová omáčka 20 %, slunečnicový olej, mozzarella 7,5 % (mléčný extrakt, sůl, regulátor kyselosti: kyselina mléčná), cukr, pivovarské kvasnice, sůl, rostlinná vlákna: psyllium; zahušťovadla: hydroxypropylmethylcelulóza, guarová mouka; oregano, kypřicí látka: jedlá soda. Může obsahovat sóju a sezam.",
    nutricniHodnoty: "Energetická hodnota: 1105 kJ / 264 kcal. Tuky 10g (z toho nasycené mastné kyseliny 2,1g). Sacharidy 41g (z toho cukry 4g). Vláknina 3g. Bílkoviny 4g. Sůl 1,6g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "PLUMCAKE S ČOKOLÁDOVÝMI KOUSKY 180g",
    nazev: "PLUMCAKE S ČOKOLÁDOVÝMI KOUSKY 180g (6ks)",
    slozeni: "Čerstvá vejce, cukr, čokoládové kapky 10% (cukr, kakaová hmota, kakaové máslo, emulgátor: slunečnicový lecitin; přírodní aroma vanilky), bambucký tuk, kukuřičný škrob, rýžová mouka, sušené mléko bez laktózy, zahušťovadla: xanthanová guma; kypřící látky: diphosphorečnan sodný, hydrogenuhličitan sodný; mléčné bílkoviny, sůl, přírodní aroma. Může obsahovat stopy sóji, sezamu a ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1807 kJ / 431 kcal. Tuky 20g (z toho nasycené mastné kyseliny 12g). Sacharidy 55g (z toho cukry 31g). Vláknina 1g. Bílkoviny 6g. Sůl 0,63g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "SEDANI RIGATI 400g",
    nazev: "SEDANI RIGATI 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "SPAGHETTI 400g",
    nazev: "SPAGHETTI 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "SPAGHETTI celozrnné 400g",
    nazev: "SPAGHETTI celozrnné 400g",
    slozeni: "Celozrnná kukuřičná mouka (60 %), celozrnná rýžová mouka (40 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1495 kJ / 353 kcal. Tuky 2,5g (z toho nasycené mastné kyseliny 0,6g). Sacharidy 73g (z toho cukry 1,5g). Vláknina 4g. Bílkoviny 7,5g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "SPAGHETTINI 400g",
    nazev: "SPAGHETTINI 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "TAGLIATELLE 250g",
    nazev: "TAGLIATELLE 250g",
    slozeni: "Bílá kukuřičná mouka, žlutá kukuřičná mouka, emulgátory: mono- a diglyceridy mastných kyselin. Může obsahovat stopy sóji a vajec.",
    nutricniHodnoty: "Energetická hodnota: 1511 kJ / 356 kcal. Tuky 2,0g (z toho nasycené mastné kyseliny 1,0g). Sacharidy 76,8g (z toho cukry 1,0g). Vláknina 1,5g. Bílkoviny 7,0g. Sůl 0,06g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "TARALLI MEDITERRANEAN 200g",
    nazev: "TARALLI MEDITERRANEAN 200g",
    slozeni: "Kukuřičný škrob, rýžová mouka, extra panenský olivový olej ze Sicílie (17 %), bílé víno, voda, tapiokový modifikovaný škrob, zahušťovadla: hydroxypropyl-methylcelulóza, guarová mouka, xantanová guma, hydroxypropylcelulóza; mořská sůl, pivovarské kvasnice, cukr. Může obsahovat stopy sezamu a sóji.",
    nutricniHodnoty: "Energetická hodnota: 1911 kJ / 456 kcal. Tuky 19g (z toho nasycené mastné kyseliny 2,9g). Sacharidy 66g (z toho cukry 1g). Vláknina 2,5g. Bílkoviny 1,7g. Sůl 0,8g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "TARALLI S EXTRA PANENSKÝM OLIVOVÝM OLEJEM 200g",
    nazev: "TARALLI S EXTRA PANENSKÝM OLIVOVÝM OLEJEM 200g",
    slozeni: "Kukuřičný škrob, rýžová mouka, extra panenský olivový olej 17 %, bílé víno, voda, tapiokový modifikovaný škrob, zahušťovadla: hydroxypropyl-methylcelulóza, guarová mouka, xantanová guma, hydroxypropylcelulóza; mořská sůl, pivovarské kvasnice, cukr. Může obsahovat stopy sezamu a sóji.",
    nutricniHodnoty: "Energetická hodnota: 1911 kJ / 456 kcal. Tuky 19g (z toho nasycené mastné kyseliny 2,9g). Sacharidy 66g (z toho cukry 1g). Vláknina 2,5g. Bílkoviny 1,7g. Sůl 0,8g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "TORTIGLIONI 400g",
    nazev: "TORTIGLIONI 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CROISSANT ČOKOLÁDOVÝ 200g",
    nazev: "CROISSANT ČOKOLÁDOVÝ 200g (4ks)",
    slozeni: "Čokoládový krém 30 % (cukr, slunečnicový olej, odtučněný kakaový prášek 14 %, lískové ořechy, sušená syrovátka, sójový lecitin, aroma), voda, kukuřičný škrob, rýžová mouka, cukr, vejce, slunečnicový olej, tapiokový škrob, psyllium vláknina, zahušťovadla: guarová guma, hydroxypropyl-methylcelulóza; sůl, pivovarské kvasnice, kakaový prášek, bambucký tuk, emulgátor: mono- a diglyceridy mastných kyselin; modifikovaný tapiokový škrob, aroma. Může obsahovat sezam a stopy mléka a dalších ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1736 kJ / 414 kcal. Tuky 17g (z toho nasycené mastné kyseliny 2,8g). Sacharidy 60g (z toho cukry 30g). Vláknina 2g. Bílkoviny 3,8g. Sůl 0,75g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CROISSANT MERUŇKOVÝ 200g",
    nazev: "CROISSANT MERUŇKOVÝ 200g (4ks)",
    slozeni: "Meruňková náplň 30 % [glukózo-fruktózový sirup, meruňkové pyré 35 %, cukr, zahušťovadla: E440ii, guma (karob); okyselující látka: E330; aroma, konzervant: E202; rostlinné koncentráty (dýně, mrkev)], voda, kukuřičný škrob, rýžová mouka, cukr, vejce, slunečnicový olej, tapiokový škrob, psyllium vláknina, zahušťovadla: guarová guma, hydroxypropyl-methylcelulóza; sůl, pivovarské kvasnice, kakaový prášek, bambucký tuk, emulgátor: mono- a diglyceridy mastných kyselin; modifikovaný tapiokový škrob, aroma. Může obsahovat sezam a stopy mléka, sóji a ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1523 kJ / 362 kcal. Tuky 9g (z toho nasycené mastné kyseliny 1,7g). Sacharidy 66g (z toho cukry 33g). Vláknina 2g. Bílkoviny 3g. Sůl 0,78g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "CROISSANT PRÁZDNÝ 150g",
    nazev: "CROISSANT PRÁZDNÝ 150g (4ks)",
    slozeni: "Voda, kukuřičný škrob, rýžová mouka, cukr, vejce, slunečnicový olej, tapiokový škrob, psyllium vláknina, zahušťovadla: guarová guma, hydroxypropyl-methylcelulóza; sůl, pivovarské kvasnice, kakaový prášek, bambucký tuk, emulgátor: mono- a diglyceridy mastných kyselin; modifikovaný tapiokový škrob, aroma. Může obsahovat sezam a stopy mléka, sóji a ořechů.",
    nutricniHodnoty: "Energetická hodnota: 1452 kJ / 345 kcal. Tuky 10g (z toho nasycené mastné kyseliny 2,1g). Sacharidy 60g (z toho cukry 15g). Vláknina 2g. Bílkoviny 3,3g. Sůl 0,92g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  },
  {
    productName: "Massimo Zero RISONI 400g",
    nazev: "Massimo Zero RISONI 400g",
    slozeni: "Kukuřičná mouka*, rýžová mouka*, mono a diglyceridy mastných kyselin. (*z ekologického zemědělství). Může obsahovat stopy sóji.",
    nutricniHodnoty: "Energetická hodnota: 1481kJ / 349 kcal. Tuky 1,5g (z toho nasycené mastné kyseliny 0,3g). Sacharidy 76g (z toho cukry 0,5g). Vláknina 2,1g. Bílkoviny 7,2g. Sůl 0,02g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Molino Casillo S.p.A., Corato BA, Itálie"
  },
  {
    productName: "STELLINE 400g",
    nazev: "STELLINE 400g",
    slozeni: "Kukuřičná mouka (60 %), rýžová mouka (35 %), pohanková mouka (5 %). Může obsahovat sóju.",
    nutricniHodnoty: "Energetická hodnota: 1503 kJ / 354 kcal. Tuky 1,6g (z toho nasycené mastné kyseliny 1g). Sacharidy 77g (z toho cukry 1,5g). Vláknina 1,6g. Bílkoviny 7g. Sůl 0,015g.",
    skladovani: "Skladujte na suchém místě při pokojové teplotě.",
    vyrobce: "Piaceri Mediterranei – Italy"
  }
];

export async function POST(request: NextRequest) {
  try {
    const results = {
      created: 0,
      updated: 0,
      linked: 0,
      errors: [] as string[],
    };

    for (const label of czechLabels) {
      try {
        // Try to find existing label
        const existing = await prisma.productLabel.findUnique({
          where: { 
            productName_language: {
              productName: label.productName,
              language: "cs"
            }
          },
        });

        let labelId: string;

        if (existing) {
          await prisma.productLabel.update({
            where: { id: existing.id },
            data: {
              nazev: label.nazev,
              slozeni: label.slozeni,
              nutricniHodnoty: label.nutricniHodnoty,
              skladovani: label.skladovani,
              vyrobce: label.vyrobce,
            },
          });
          labelId = existing.id;
          results.updated++;
        } else {
          const newLabel = await prisma.productLabel.create({
            data: { ...label, language: "cs" },
          });
          labelId = newLabel.id;
          results.created++;
        }

        // Link to order items that contain this product name
        const updateResult = await prisma.orderItem.updateMany({
          where: {
            productName: { contains: label.productName, mode: "insensitive" },
            labelId: null,
          },
          data: {
            labelId: labelId,
          },
        });
        
        results.linked += updateResult.count;
      } catch (error) {
        results.errors.push(`${label.productName}: ${String(error)}`);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json(
      { error: "Import failed", details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: "POST to import labels",
    count: czechLabels.length 
  });
}
