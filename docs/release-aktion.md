# Release-Aktion

Zum Start von NØNE unter der richtigen Adresse:

- **14 Tage alles gratis:** Jedes Konto hat alle Plus-Funktionen – unbegrenzt
  chatten, Filter, eigener Anzeigename, bevorzugt in der Warteschlange. Ohne
  Buchung. Danach fallen Gratiskonten von selbst auf „Frei" zurück.
- **30 Tage 20 % auf alles:** ab demselben Starttag. Bei Plus jährlich und
  Lifetime auf die ganze Zahlung, bei Plus monatlich nur auf den ersten
  Monat – ab dem zweiten wird normal abgerechnet.

## Wo man es einstellt

**Moderation → ganz unten „Release-Aktion"** (nur mit Verwaltungsrolle):

| Feld | Standard | Bedeutung |
| --- | --- | --- |
| Aktion eingeschaltet | aus | Hauptschalter. Aus heisst: keine Gratiszeit, kein Rabatt, kein Hinweis. |
| Starttag | – | Tag, an dem die Domain live geht. Beginn um 00:00 Uhr. „Heute" setzt das heutige Datum. |
| Gratis-Tage | 14 | 0 bis 90. 0 = keine Gratiszeit. |
| Rabatt in % | 20 | 0 bis 90. 0 = kein Rabatt. |
| Rabatt-Tage | 30 | ab dem Starttag, 0 bis 365. |

**Speichern** wirkt sofort für alle – offene Seiten aktualisieren sich von
selbst. Die Vorschau unter den Feldern zeigt vorher, bis wann was gilt.

**Abschalten:** Haken bei „Aktion eingeschaltet" weg, speichern. Jede
Änderung erscheint im Discord-Log („🎉 Release-Aktion …", mit wer).

## Wo es auf der Seite steht

Solange etwas davon gilt – und nur dann:

- Startseite: Hinweis unter dem Einstieg
- Tarife: Hinweis über den Karten, rabattierte Preise durchgestrichen neben
  dem normalen, bei monatlich „−20 % im ersten Monat, danach CHF 7.90", und
  eine Frage „Was gilt während der Release-Aktion?" in den FAQ
- Tarifwahl nach der Anmeldung: Hinweis, dass in der Gratiszeit nichts
  gewählt werden muss, und die rabattierten Preise

## Technik

- Gespeichert in Firestore unter `einstellungen/aktion`. Lesen dürfen alle,
  schreiben nur die Verwaltung, mit denselben Grenzen wie im Formular
  (`firestore.rules`).
- Die Gratiszeit hebt in `grenzen()` (`src/services/plans.ts`) die
  Tarifgrenzen auf – dort, wo sie auch sonst gelten: im Browser.
- Der Rabatt wirkt an der Kasse: `createCheckoutSession` liest dieselbe
  Einstellung und hängt einen Stripe-Gutschein `RELEASE-20` an (angelegt beim
  ersten Kauf, `duration: once`). Solange die Kasse aus ist, werden Tarife von
  Hand vergeben – dann bitte den Rabatt bei der Abrechnung selbst beachten.
- Logik und Tests: `src/services/aktion.ts`, `functions/src/aktion.ts`.
