# Siatki obrażeń

Mała aplikacja: PDF „Health Only” z aplikacji Warmachine plus jeden obrazek tła
daje PDF do druku. Każda kratka warjacka albo spirala bestii to osobna karta
63 × 88 mm (rozmiar MTG), z wgranym tłem pod siatką, znakami cięcia i odstępem
kilku milimetrów. Papier: A4 albo Letter.

Modele bez siatki (sam znacznik HP, podpisy jednostek, puste linie karty) są pomijane.
Kolor gałęzi spirali zostaje. Szare pola kratki zostają zasłonięte, puste pola
pokazują tło.

## Uruchomienie

```bash
cd /home/ubuntu/dmg-grids
pip install -r requirements.txt
python3 -m dmg_app.web
```

Strona jest na `http://127.0.0.1:8741`. Potrzebny jest Tesseract (`tesseract` w PATH).

Obróbka jest na serwerze. Nie ma kont ani bazy.
