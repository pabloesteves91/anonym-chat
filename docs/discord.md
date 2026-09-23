# Discord für die Moderation

Ein privater Server, auf dem neue Meldungen und Supportanfragen als
Benachrichtigung ankommen und das Team sich abspricht. Server, Kanäle und
Rollen richtest du selbst ein. Der Ablauf **Discord einrichten** legt nur in
zwei Kanälen je einen Webhook an und hinterlegt die Adressen im Google Secret
Manager. Alles geht auch vom Handy aus.

## Was ankommt

| Kanal | Kanal-ID | Wofür |
| --- | --- | --- |
| `#meldungen` | `1552305430670217327` | neue Meldungen aus dem Chat |
| `#support` | `1552305324583551056` | neue Supportanfragen und Antworten im Supportchat |
| Log-Kanal | GitHub-Secret `DISCORD_KANAL_LOG` | Protokoll: wer was entschieden hat |

Die IDs von Meldungen und Support stehen in `.github/workflows/discord.yml`,
die des Log-Kanals im Secret `DISCORD_KANAL_LOG`. Wer die Kanäle neu anlegt,
trägt dort die neuen IDs ein (Entwicklermodus an, lange auf den Kanal drücken
→ *Kanal-ID kopieren*). Sie sind kein Geheimnis.

Ist ein Supportfall **erledigt**, verschwinden seine Benachrichtigungen
(neue Anfrage und Antworten im Supportchat) wieder aus `#support` – der Kanal
zeigt, was offen ist. Das Protokoll dazu steht weiter im Log-Kanal.
Benachrichtigungen von vor dieser Einrichtung (23.09.2026) kennt der Server
nicht und bleiben stehen; die löscht man einmal von Hand.

Jede Benachrichtigung nennt nur **Art, Kategorie und Zeitpunkt** und
verlinkt in die Moderation. Kein Pseudonym, kein Text, kein Verlauf, kein
Anhang: Discord ist ein Dienst ausserhalb der EU. Gelesen und entschieden
wird wie bisher in der Moderation. Meldungen mit dem Grund „minderjährig"
kommen mit 🔴 und „Vorrang".

## Das Protokoll im Log-Kanal

| Eintrag | wann |
| --- | --- |
| 🟡 Supportfall übernommen | Stand „offen" → „in Arbeit", auch durch „Chat eröffnen" |
| ✅ Supportfall erledigt | Stand → „erledigt" |
| ⛔ / ✅ Meldung | Stand → „gesperrt" bzw. „geprüft" (und ↩️ zurück auf „offen") |
| 💳 Tarif | jede Vergabe, von Hand oder durch die Kasse („Kasse (Stripe)") |
| ⚧ Geschlechtsangabe korrigiert | nur Korrekturen durch die Moderation, nicht die Erstangabe |

Jeder Eintrag nennt die betroffene Person als **Kurzkennung** („Konto a1b2c3",
die ersten sechs Zeichen der Kontokennung) und wer es war als **E-Mail des
Mod-Kontos**. Wer es war, schreibt die App ins Dokument (`bearbeitetVon`,
`geaendertVon`); die Security Rules lassen dort nur die eigene Kennung zu –
eine Tat lässt sich niemand anderem unterschieben, und ohne Eintrag lässt sich
der Stand gar nicht ändern.

## Einrichten

### 1. Google-Cloud-Dienste einschalten (einmal)

Mit dem Google-Konto, dem das Firebase-Projekt gehört:

```
https://console.cloud.google.com/flows/enableapi?apiid=secretmanager.googleapis.com,cloudfunctions.googleapis.com,cloudbuild.googleapis.com,artifactregistry.googleapis.com,run.googleapis.com,eventarc.googleapis.com,pubsub.googleapis.com&project=anonym-chat-223af
```

Das Dienstkonto aus GitHub darf Dienste nicht selbst einschalten. Fragt
Google nach einer Zahlungsart: Das Projekt muss auf **Blaze** laufen.

Danach unter **IAM** beim Konto
`firebase-adminsdk-…@anonym-chat-223af.iam.gserviceaccount.com` die Rollen
aus [tarife.md](tarife.md#wenn-das-ausrollen-an-rechten-scheitert) vergeben –
vor allem **Secret Manager Admin**. Fehlt sie, meldet der Ablauf „Secret
Manager verweigert den Zugriff".

### 2. Bot anlegen

Im Browser <https://discord.com/developers/applications> öffnen:

1. **New Application** → Name „NØNE" → Create
2. Links **Bot**:
   - **Public Bot** ausschalten (sonst könnte ihn jemand anders einladen)
   - **Reset Token** → Token kopieren
3. Den Token als GitHub-Secret hinterlegen – **nicht in einen Chat, nicht
   ins Repository**: GitHub → `anonym-chat` → Settings → Secrets and
   variables → Actions → *New repository secret* →
   Name `DISCORD_BOT_TOKEN`, Wert der Token.

Privileged Gateway Intents braucht der Bot keine.

### 3. Bot in den Server holen

Links **General Information** → *Application ID* kopieren und in diese
Adresse einsetzen:

```
https://discord.com/oauth2/authorize?client_id=APPLICATION_ID&scope=bot&permissions=536871936
```

Öffnen, deinen Server wählen, *Autorisieren*. Die Zahl steht für genau zwei
Rechte: **Kanäle ansehen** und **Webhooks verwalten**. Wer den Bot schon mit
mehr Rechten eingeladen hat, muss nichts ändern.

### 4. Bot in die drei Kanäle lassen

Sind die Kanäle privat, sieht der Bot sie nicht – der Ablauf meldet dann
„Missing Access". Für `#meldungen`, `#support` und den Log-Kanal:
*Kanal bearbeiten* → *Berechtigungen* → Rolle **NØNE** (die Rolle des Bots)
hinzufügen → **Kanal ansehen** und **Webhooks verwalten** erlauben.

### 5. Webhooks anlegen lassen

GitHub → Actions → **Discord einrichten** → *Run workflow*.

Der Ablauf legt in allen drei Kanälen einen Webhook „NØNE" an (oder nimmt den
vorhandenen) und schreibt die Adressen direkt in den **Secret Manager**
(`DISCORD_WEBHOOK_MELDUNGEN`, `DISCORD_WEBHOOK_SUPPORT`,
`DISCORD_WEBHOOK_LOG`). Sie erscheinen
nirgends – nicht im Protokoll, nicht in GitHub, nicht im Repository. An den
Kanälen selbst ändert er nichts: kein Umbenennen, keine Rechte, keine
Nachrichten.

Danach startet **Firebase Functions** von selbst und rollt die
Benachrichtigungen aus. Scheitert das an Rechten, nennt die Meldung die
fehlende Rolle – siehe
[tarife.md](tarife.md#wenn-das-ausrollen-an-rechten-scheitert).

### 6. Benachrichtigungen aufs Handy

In Discord lange auf `#meldungen` drücken → *Benachrichtigungen* → **Alle
Nachrichten**. Dasselbe für `#support`.

### 7. Moderatorinnen und Moderatoren einladen

- Server-Einstellungen → *Sicherheit* → **2FA für Moderation verlangen**
- Einladungen nur einzeln verschicken: *Einladen* → Link bearbeiten →
  **Max. Nutzungen 1**, Ablauf 1 Tag
- Wer im Server ist, braucht zusätzlich die Rolle in der App (Admin-UID bzw.
  Moderatorenliste in `firestore.rules`) – Discord allein gibt keinen
  Zugriff auf die Moderation.

## Prüfen

Mit einem Testkonto eine Supportanfrage schicken: In `#support` erscheint
„🛟 Neue Supportanfrage" mit dem Thema. Kommt nichts, in der Firebase-Konsole
unter *Functions → Logs* nach `supportNachDiscord` schauen – dort steht, ob
Discord nicht eingerichtet ist oder die Nachricht abgelehnt hat.

## Wenn etwas nicht mehr stimmen soll

- **Webhook geleakt** (Adresse irgendwo gelandet): in Discord unter
  Kanal-Einstellungen → Integrationen → Webhooks „NØNE" löschen, dann
  *Discord einrichten* erneut starten. Er legt einen neuen an und
  überschreibt das Geheimnis.
- **Bot-Token geleakt**: im Developer Portal *Reset Token*, Secret ersetzen.
  Der Bot wird nur für diesen Ablauf gebraucht; wer mag, setzt den Token
  danach zurück und hinterlegt ihn erst wieder, wenn neu eingerichtet wird.
- **Benachrichtigungen abschalten**: im Secret Manager bei beiden
  Geheimnissen eine neue Version `nicht-eingerichtet` anlegen und *Firebase
  Functions* erneut starten.
