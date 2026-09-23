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

## Konten, die den Dienst betreiben

Moderation und Verwaltung haben keine Tarifgrenzen – sie stehen gar nicht
erst im Tarifmodell. Das Tarif-Fenster nach der Anmeldung erscheint ihnen
nicht, und auf der Preisseite steht, dass die Übersicht nur zeigt, was
anderen angeboten wird.

Vergeben darf einen Tarif ausschliesslich die Verwaltung. Die Moderation
kann es nicht, und zwar nicht nur in der Oberfläche: Die Regel für
`users` lässt ihr genau drei Felder offen (`verified`,
`verificationStatus`, `verifiedAt`) und `membership` nicht.

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

## Die Kasse einrichten

Der Code steht: `functions/` enthält zwei Funktionen, und die Oberfläche
kann bezahlen. Abgeschaltet ist alles über eine einzige Zeile in
`src/services/kasse.ts` (`KASSE_AKTIV = false`), damit kein Knopf ins Leere
führt, solange die Gegenseite fehlt.

Was noch fehlt, ist alles, was ein Stripe-Konto braucht – und das kann nur
tun, wer Zugang dazu hat.

### 1. Drei Preise in Stripe anlegen

Dashboard → Produktkatalog. Alle in **CHF**:

| Produkt | Preis | Art |
| --- | --- | --- |
| Plus monatlich | 7.90 | wiederkehrend, monatlich |
| Plus jährlich | 69.00 | wiederkehrend, jährlich |
| Lifetime | 179.00 | einmalig |

Jeder Preis bekommt eine Kennung, die mit `price_` beginnt.

Unter **Einstellungen → Zahlungsmethoden** zusätzlich **TWINT** aktivieren.
Für ein Schweizer Publikum ist das wichtiger als Kreditkarten.

### 2. Kennungen eintragen

Die drei Kennungen in `functions/src/tarife.ts` einsetzen. Sie sind kein
Geheimnis – sie stehen in jeder Checkout-Adresse – und gehören deshalb ins
Repository, nicht in die Secrets.

### 3. Firebase auf Blaze umstellen

Cloud Functions gibt es im Gratistarif nicht. Bei diesen Mengen kostet
Blaze praktisch nichts, verlangt aber eine hinterlegte Karte. **Gleichzeitig
einen Budgetalarm einrichten** (Cloud-Konsole → Abrechnung → Budgets): Ohne
ihn merkt man Missbrauch erst auf der Rechnung.

### 4. Den geheimen Schlüssel als Repository-Secret hinterlegen

GitHub → **Settings → Secrets and variables → Actions → New repository
secret**, Name `STRIPE_SECRET_KEY`. Der Wert steht in Stripe unter
**Entwickler → API-Schlüssel** und beginnt mit `sk_`.

Er gehört dorthin und **nirgendwo sonst** – nicht ins Repository, nicht in
eine Chatnachricht, nicht in eine Umgebungsdatei. Wer ihn hat, kann in
deinem Namen abrechnen und zurückerstatten.

Ein Terminal braucht es dafür nicht: Der Ablauf „Firebase Functions"
schreibt den Schlüssel von dort in den Google Secret Manager, wo die
Funktionen ihn lesen.

### 5. Einmal ausrollen und die Webhook-Adresse holen

GitHub → **Actions → Firebase Functions → Run workflow**.

Das Webhook-Geheimnis gibt es noch nicht – der Ablauf setzt dafür einen
Platzhalter und sagt es in der Ausgabe. Am Ende steht dort die Adresse von
`stripeWebhook`.

Diese in Stripe unter **Entwickler → Webhooks → Endpunkt hinzufügen**
eintragen und drei Ereignisse abonnieren:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### 6. Das Webhook-Geheimnis hinterlegen und erneut ausrollen

Stripe zeigt nach dem Anlegen ein Geheimnis, das mit `whsec_` beginnt.
Dieses als zweites Repository-Secret `STRIPE_WEBHOOK_SECRET` hinterlegen und
**Actions → Firebase Functions → Run workflow** noch einmal starten.

Ohne dieses Geheimnis nimmt die Funktion nichts an – und das ist der Punkt:
Sonst könnte jede Person, die die Adresse kennt, sich selbst einen
Lifetime-Zugang schicken.

### 7. Die Kasse einschalten

In `src/services/kasse.ts` `KASSE_AKTIV` auf `true` setzen und pushen. Ab
dann führt "Diesen Tarif möchte ich" nicht mehr zur Wunschliste, sondern
zur Bezahlung.

### 8. Im Testmodus durchspielen

Stripe hat einen Testmodus mit eigenen Schlüsseln. Kartennummer
`4242 4242 4242 4242`, beliebiges künftiges Datum, beliebige Prüfziffer.
Danach muss in Firestore unter `users/<Kennung>.membership` der Tarif
stehen – gesetzt von der Funktion, nicht vom Browser.

### Wenn das Ausrollen an Rechten scheitert

Funktionen auszurollen verlangt mehr als Regeln auszurollen. Fehlt dem
Dienstkonto eine Rolle, nennt die Fehlermeldung sie. Erfahrungsgemäss
gebraucht werden, zusätzlich zu „Firebase-Administrator":

| Rolle | Wofür |
| --- | --- |
| Cloud Functions Admin | die Funktionen anlegen und ersetzen |
| Service Account User | sie unter einem Dienstkonto laufen lassen |
| Secret Manager Admin | die Stripe-Schlüssel und die Discord-Webhooks ablegen und lesen |
| Cloud Build Editor | den Build, den Firebase dafür anstösst |
| Artifact Registry Administrator | das Ablegen des gebauten Abbilds |
| Eventarc Admin | die Auslöser für neue Meldungen und Supportanfragen |

Einzutragen in der **Google-Cloud-Konsole → IAM**, beim Konto
`firebase-adminsdk-…@anonym-chat-223af.iam.gserviceaccount.com`.

## Wie die Kasse arbeitet

```
Browser                 Funktion                  Stripe
   |  "ich will Plus"       |                        |
   |----------------------->|  Sitzung eröffnen      |
   |                        |----------------------->|
   |  Adresse zur Kasse     |                        |
   |<-----------------------|                        |
   |------------------------------------------------>|  bezahlen
   |                        |  Quittung (Webhook)    |
   |                        |<-----------------------|
   |                        |  Signatur prüfen       |
   |                        |  membership setzen     |
   |  zurück auf /preise    |                        |
```

Zwei Dinge daran sind wichtig:

- **Der Browser schickt nur die Tarifkennung**, nie einen Preis. Sonst
  liesse sich der Lifetime-Zugang zum Monatspreis buchen.
- **Der Zugang entsteht aus der Quittung**, nicht aus der Rückkehr des
  Browsers. Wer nach der Zahlung das Fenster schliesst, bekommt seinen
  Tarif trotzdem; wer die Rückkehr-Adresse von Hand aufruft, bekommt
  nichts.

Doppelte Zustellungen fängt eine Sperre in `stripeEvents` ab: Stripe stellt
im Zweifel mehrfach zu, und eine zweimal verarbeitete Quittung würde eine
Laufzeit verlängern, die niemand bezahlt hat.

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
