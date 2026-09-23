# Neuigkeiten

Was sich an NØNE geändert hat – von Hand geschrieben, für alle sichtbar.

## Wo man schreibt

**Moderation → „Neuigkeiten"** (nur mit Verwaltungsrolle): **Neuer Eintrag**,
pro Eintrag **Bearbeiten** und **Löschen** (mit Rückfrage).

| Feld | Bedeutung |
| --- | --- |
| Titel | höchstens 100 Zeichen |
| Art | Neu · Verbessert · Behoben – als Etikett sichtbar |
| Datum | frei wählbar, Vorgabe heute |
| Version | Auswahl aus den letzten 30 ausgerollten Fassungen, wie im Fuss der Seite (z. B. `c7f1ae6`); die erste ist mit „(neueste Version)" markiert. Oder „ohne Version". |
| Beschreibung | höchstens 2000 Zeichen, Zeilenumbrüche bleiben |

**Veröffentlichen** macht den Eintrag sofort sichtbar; **Als Entwurf speichern**
hält ihn zurück (nur die Verwaltung sieht ihn, markiert mit „Entwurf").
Ein veröffentlichter Eintrag lässt sich mit **Zurück zu Entwurf** wieder
verstecken. Jede Änderung erscheint im Discord-Log („📰 …").

## Wo man es sieht

- **Menüpunkt „Neuigkeiten"** für alle, auch ohne Anmeldung, und im Fuss der
  Seite. Ein Punkt daneben, solange es einen veröffentlichten Eintrag gibt,
  den dieses Gerät noch nicht gesehen hat; er geht aus, sobald man die Seite
  öffnet.
- **Seite /neuigkeiten**: alle Einträge, neueste zuerst, mit Datum, Art,
  Version. Der jüngste Eintrag mit Version trägt „(neueste Version)".
- **Startseite**: der neueste Eintrag als kurze Zeile mit Link.

## Technik

- Firestore: `neuigkeiten/{id}`. Lesen: veröffentlicht alle, Entwürfe nur die
  Verwaltung; schreiben nur die Verwaltung mit geprüften Werten und eigener
  Kennung (`firestore.rules`).
- Die Versionen kommen beim Bauen aus der Git-Geschichte (`__VERSIONEN__` in
  `vite.config.ts`); der Pages-Ablauf holt dafür die letzten 30 Commits.
- „Gesehen" merkt sich das Gerät (localStorage), nicht das Konto.
- Logik und Tests: `src/services/neuigkeiten.ts`.
