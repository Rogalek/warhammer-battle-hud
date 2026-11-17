# Warhammer Battle HUD (`warhammer-battle-hud`)

[English](README.md) | **Polski**

Wszystko, czego postać potrzebuje w walce, na jednym ekranie i bez dodatkowych modułów: ramki drużyny, panel akcji i pasek amunicji. Moduł wykrywa aktywny system Warhammera.

Wymaga **Foundry VTT v14** i jednego z systemów: **WFRP 4e / 5e** (`wfrp4e` 10.0+), **The Old World** (`whtow`), **Imperium Maledictum** (`impmal`), **Wrath & Glory** (`wrath-and-glory`), **Soulbound** (`age-of-sigmar-soulbound`).

Nie włączaj go razem ze starszymi modułami *Warhammer Party Frames*, *Warhammer Ammo & Quick Gear* i *WFRP4e – Action HUD*, które zastępuje.

## 📥 Instalacja

Wklej w *Manifest URL* w **Dodatki → Zainstaluj moduł**:

```
https://github.com/TomasWarchol/warhammer-battle-hud/releases/latest/download/module.json
```

## 🧭 Pływający HUD

HUD (Przewaga, panel akcji i amunicja) unosi się nad sceną. Przeciągnij go za uchwyt po lewej; położenie zapisuje się przy koncie gracza, więc działa na każdym komputerze. **Podwójny klik** na uchwycie przywraca go nad pasek makr.

## ⚡ Przewaga (WFRP)

Duży licznik z przodu HUD-a pokazuje Przewagę postaci i świeci mocniej, im jest jej więcej, aż do maksimum. **Klik**: +1, **prawy klik**: −1. Ramki drużyny też ją wyróżniają. Można go ukryć w ustawieniach.

Pierwsza zakładka panelu akcji, **Przewaga**, pokazuje, na co postać może teraz wydać Przewagę, z kosztem (⚡1, ⚡2): użycia Przewagi z systemu (z Up in Arms: Grzmotnięcie, Sztuczka, Dodatkowy wysiłek, Ucieczka przed zagrożeniem, Dodatkowa Akcja), a z modułem **Underworld** (`wfrp4e-underworld`) także rozkazy taktyczne, które może wykonać Świta Herszta. Akcje, na które jeszcze brakuje Przewagi, są przygaszone. Klik na użyciu Przewagi odejmuje koszt, wysyła opis na czat i rzuca test, tak jak przycisk na karcie postaci; klik na rozkazie szajki otwiera okno rozkazu z Underworld.

## ⚔️ Panel akcji

Zakładki nad paskiem makr dla zaznaczonego tokena albo przypisanej postaci. W WFRP: cechy, umiejętności, walka, magia, religia, talenty, stany i Przewaga. W pozostałych systemach: testy systemu z wartościami postaci.

* **Lewy klik**: rzut, dodanie stanu lub Przewagi, talent na czat.
* **Prawy klik**: arkusz przedmiotu, zdjęcie stanu lub Przewagi.
* **Shift**: tajny rzut MG. **Alt**: pominięcie okna rzutu. **Ctrl + lewy / prawy** na broni i pancerzu: naprawa / uszkodzenie.

## 🏹 Amunicja

W systemach, które ją śledzą (WFRP, Imperium Maledictum, Wrath & Glory): wybór amunicji, przeładowanie i zakładanie broni lub tarczy jednym kliknięciem. Licznik robi się bursztynowy przy małej ilości i czerwony przy braku.

## 🖼️ Ramki drużyny

Portret, zdrowie, zasoby systemu i stany każdej postaci. **Klik** wskazuje cel, **podwójny klik** przechodzi do tokena, **prawy klik** otwiera kartę. Nagłówek przełącza Drużynę, Walkę i Zaznaczone tokeny, zwija ramki i przesuwa je po przeciągnięciu.

## 🎯 Token HUD

Cztery szybkie testy z wartościami na HUD tokena. Każdą część można wyłączyć w ustawieniach.

## 🌐 Języki

Angielski i polski są wbudowane. Aby dodać kolejny język:

```bash
npm run lang:add -- de "Deutsch"
```

## 📄 Licencja

MIT – zobacz [LICENSE](LICENSE).

Nieoficjalna twórczość fanowska, niezwiązana z Games Workshop ani Cubicle 7 i przez nie niepopierana. Warhammer i powiązane nazwy są znakami towarowymi Games Workshop Limited. Moduł nie zawiera tekstów ani grafik z podręczników – działa z treściami, które już posiadasz.
