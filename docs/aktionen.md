# Aktionen

Gratiszeiten, Rabatte und Gutscheincodes – angelegt, geändert und gelöscht in
der App, ohne Code und ohne Ausrollen.

## Wo

**Moderation → „Aktionen"** (nur mit Verwaltungsrolle). Dort:

- **Neue Aktion** – leeres Formular
- **Release-Aktion vorbereiten** – Vorlage mit 14 Tagen gratis und 30 Tagen
  20 % auf alles (nur sichtbar, solange es keine Aktion „Release" gibt)
- pro Aktion **Bearbeiten** und **Löschen** (mit Rückfrage)

Die Liste zeigt, was jede Aktion gerade tut: *Läuft …*, *Geplant ab …*,
*Abgelaufen* oder *Ausgeschaltet*. **Speichern wirkt sofort für alle** –
offene Seiten aktualisieren sich von selbst.

## Was eine Aktion kann

| Feld | Bedeutung |
| --- | --- |
| Name | nur intern, z. B. „Release", „Sommer 2027" |
| Eingeschaltet | Hauptschalter. Aus heisst: wirkt nicht, kein Hinweis. |
| Starttag | Beginn um 00:00 Uhr. Gratis- und Rabatttage zählen ab hier. |
| Gratis-Tage | 0–90. So lange hat **jedes Konto alle Plus-Funktionen**, ohne Buchung. |
| Rabatt in % | 0–90 |
| Rabatt-Tage | 0–365, ab dem Starttag |
| Rabatt gilt für | Plus monatlich, Plus jährlich, Lifetime – einzeln wählbar |
| Bei Abos gilt der Rabatt | nur für die erste Zahlung · für die ersten N Monate (1–24) · dauerhaft |
| Gutscheincode | leer = gilt für alle. Mit Code: nur wer ihn eingibt. |
| Eigener Hinweistitel / -text | leer = wird aus den Werten erzeugt |

Die **Vorschau** unter dem Formular zeigt vor dem Speichern, bis wann was gilt
und wie der Hinweis auf der Seite aussieht.

**Mehrere Aktionen zugleich:** Pro Tarif gilt der höchste Rabatt; Rabatte
werden nicht zusammengezählt. Gratis ist es, solange irgendeine Aktion gratis
ist.

## Gutscheincodes

- 3–20 Zeichen, A–Z, 0–9 und Bindestrich; Kleinbuchstaben werden zu grossen.
- Eingelöst auf der **Tarifseite** („Gutscheincode") oder per Link:
  `…/#/preise?code=SOMMER25`
- Ein Code gibt nur Rabatt, nie Gratiszeit.
- Codes sind **nicht auflistbar**: Wer den Code nicht kennt, sieht die Aktion
  nicht. Ein Hinweis erscheint nur bei der Person, die ihn eingelöst hat.
- Wer mit Code einen Tarif wünscht, dessen Wunsch trägt den Code – sichtbar in
  „Tarife vergeben". Die Regeln lassen dort nur Codes zu, die es gibt.

## Auf der Seite

Solange eine Aktion läuft – und nur dann:

- Startseite und Tarifseite: ein Hinweis pro Aktion (eigener oder erzeugter Text)
- Tarifkarten: rabattierter Preis, der normale durchgestrichen daneben, darunter
  z. B. „−20 % im ersten Monat, danach CHF 7.90" und „Bis und mit …"
- FAQ: „Was gilt während der laufenden Aktion?" mit den genauen Bedingungen
- Tarifwahl nach der Anmeldung: Hinweis auf die Gratiszeit, rabattierte Preise

## Abschalten

Aktion bearbeiten → Haken bei „Eingeschaltet" weg → Speichern. Oder löschen.
Jede Änderung erscheint im Discord-Log („🎉 Aktion … angelegt/geändert",
„🗑️ … gelöscht").

## Technik

- Firestore: `aktionen/{id}`, Gutscheine unter `aktionen/code-<CODE>`. Lesen:
  öffentliche Aktionen alle, Gutscheine nur einzeln mit Code; schreiben nur die
  Verwaltung, mit denselben Grenzen wie das Formular (`firestore.rules`).
- Die Gratiszeit hebt in `grenzen()` (`src/services/plans.ts`) die
  Tarifgrenzen auf – dort, wo sie auch sonst gelten: im Browser.
- Der Rabatt wirkt an der Kasse: `createCheckoutSession` rechnet ihn selbst
  aus (der Browser schickt nur den Code) und hängt einen Stripe-Gutschein an
  – `once`, `repeating` (N Monate) oder `forever`. Solange die Kasse aus ist,
  werden Tarife von Hand vergeben – dann den Rabatt bei der Abrechnung selbst
  beachten.
- Logik und Tests: `src/services/aktion.ts`, `functions/src/aktion.ts`.
