# Tarife

## Das Modell

Ein Gratiszugang, der für sich allein brauchbar ist, und ein bezahlter, der
Wartezeit und Filter verbessert. Die Trennlinie liegt bewusst nicht bei der
Sicherheit: Verifizierung, Wortfilter, Meldewege und Moderation sind in jedem
Tarif gleich. Wer dafür Geld verlangt, verkauft Schutz an die, die ihn sich
leisten können – und überlässt den Rest sich selbst.

| Tarif | Preis | Laufzeit |
| --- | --- | --- |
| Frei | CHF 0 | unbegrenzt |
| Plus monatlich | CHF 7.90 | 30 Tage, verlängert sich |
| Plus jährlich | CHF 69.– | 365 Tage, verlängert sich |
| Lifetime | CHF 179.– | ohne Ablauf |

Unterschiede:

| | Frei | Plus |
| --- | --- | --- |
| Chats pro Tag | 10 | unbegrenzt |
| Sprache wählen | ja | ja |
| Interessen filtern | nein | ja |
| Warteschlange | normal | bevorzugt |
| Anzeigename | gewürfelt | frei wählbar |

Die Zahlen stehen in `src/services/plans.ts`. Wer sie ändert, ändert sie an
genau einer Stelle; Preisseite, Profil und Chat lesen von dort.

### Warum diese Grenzen

- **10 Chats pro Tag** ist genug, um den Dienst kennenzulernen und
  gelegentlich zu nutzen, und zu wenig, um ihn den ganzen Abend laufen zu
  lassen. Wer ihn täglich nutzt, merkt die Grenze; wer ihn ausprobiert, nie.
- **Der Interessenfilter** ist der einzige echte Komfortvorteil: Er macht aus
  dem Zufall eine Auswahl. Gratis bleibt die Suche nach Sprache, damit sich
  überhaupt sinnvoll reden lässt.
- **Der Vorrang** stellt zahlende Konten in der Warteschlange nach vorn, nicht
  anstelle der anderen. Bei wenig Verkehr merkt das niemand, bei viel schon.
- **Der eigene Name** ist absichtlich kostenpflichtig: Ein gewürfelter Name
  macht Wiedererkennung über Chats hinweg schwerer, was dem Gratiszugang
  eher nützt als schadet. Wer ihn selbst setzt, durchläuft weiterhin die
  Namensprüfung (`wordFilter.ts`) – Kontaktdaten und Anzüglichkeiten gehen
  auch bezahlt nicht.
- **Lifetime** ist ein Vertrauensvorschuss in beide Richtungen: Geld jetzt,
  Leistung auf unbestimmte Zeit. Das trägt sich nur, wenn es die Ausnahme
  bleibt – als Angebot für die ersten Unterstützenden, nicht als
  Dauerangebot neben dem Abo.

## Wie ein Tarif heute vergeben wird

In drei Schritten, weil der mittlere ausserhalb der App stattfindet:

1. **Die Person wählt.** Nach der ersten Anmeldung geht ein Fenster auf; dieselbe
   Auswahl gibt es jederzeit auf `/preise`. Ein Gratistarif gilt sofort, ein
   bezahlter wird zu einem Eintrag in `planRequests/{uid}`.
2. **Das Geld kommt an.** Heute noch von Hand – Überweisung, Twint, was auch
   immer verabredet ist. Der Wunsch in der App sagt darüber nichts aus.
3. **Die Moderation schaltet frei.** `/admin` → „Tarif vergeben" zeigt die
   offenen Wünsche. „Übernehmen" füllt das Formular, „Setzen" schaltet frei
   und hakt den Wunsch ab.

Wichtig an dieser Trennung: Ein Wunsch ist kein Zahlungseingang. Die Liste
sagt nur, wer sich was ausgesucht hat.

Die Security Rules lassen das ausschliesslich der Moderationskennung zu:

```
allow update: if isModerator()
  || (isOwner(userId) && request.resource.data.membership == resource.data.membership);
```

Ein Konto kann seinen eigenen Tarif also nicht ändern – auch nicht mit
umgeschriebenem Browsercode.

## Was die Kasse braucht

Bezahlen lässt sich noch nichts, und zwar aus einem Grund, der sich nicht
umgehen lässt: Ein Browser darf über einen bezahlten Zugang nicht selbst
entscheiden. Die Quittung des Zahlungsanbieters muss von etwas geprüft
werden, das die Person nicht kontrolliert.

Der übliche Weg mit Firebase:

1. **Stripe Checkout** für die Bezahlung. Drei Preise anlegen: zwei Abos
   (monatlich, jährlich) und eine einmalige Zahlung für Lifetime.
2. **Cloud Function** (oder ein kleiner Server) mit zwei Aufgaben:
   - eine Sitzung eröffnen und den Link zurückgeben,
   - den Webhook von Stripe entgegennehmen, die Signatur prüfen und
     `users/{uid}.membership` setzen.
3. **Die Rules bleiben, wie sie sind.** Die Function schreibt mit dem
   Admin-SDK und geht an den Rules vorbei; die Kennung der Moderation
   bleibt der einzige andere Weg.
4. **Verlängerung und Kündigung** kommen ebenfalls als Webhook
   (`customer.subscription.updated`, `.deleted`). `membership.bis` wird
   dabei fortgeschrieben; läuft es ab, fällt `aktiverPlan()` von selbst auf
   `frei` zurück – dafür braucht es keinen weiteren Schreibvorgang.

Solange das fehlt, ist auf der Preisseite offen gesagt, dass die Kasse
fehlt. Eine Seite, die zum Kauf auffordert und dann nichts tut, ist
schlimmer als eine, die es zugibt.

## Die Tagesgrenze

Gezählt wird in `users/{uid}.usage` – ein Tagesstempel und eine Zahl.
Geprüft wird vor der Suche, gezählt erst, wenn tatsächlich jemand gefunden
ist: Wer zehn Minuten wartet und dann abbricht, hat kein Gespräch geführt
und soll auch keines abgebucht bekommen. Um Mitternacht (lokale Zeit)
stimmt der Tagesstempel nicht mehr und die Zählung beginnt von vorn.

Das ist eine Bremse, kein Riegel: Der Browser schreibt die Zahl selbst und
könnte sie auch nicht schreiben. Verlässlich wird es mit derselben
Serverfunktion, die auch die Kasse bedient – bis dahin fällt Missbrauch in
der Moderation auf, weil dort alle Räume einer Person sichtbar sind.
