# Discord für die Moderation

Ein privater Server, auf dem neue Meldungen und Supportanfragen als
Benachrichtigung ankommen und das Team sich abspricht. Eingerichtet wird er
vom Ablauf **Discord einrichten** – du legst nur den leeren Server und einen
Bot an. Alles geht auch vom Handy aus.

## Was am Ende da ist

| Kanal | Wofür |
| --- | --- |
| `#meldungen` | neue Meldungen aus dem Chat – nur lesen |
| `#support` | neue Supportanfragen und Antworten im Supportchat – nur lesen |
| `#mod-chat` | Absprachen im Team |

Jede Benachrichtigung nennt nur **Art, Kategorie und Zeitpunkt** und
verlinkt in die Moderation. Kein Pseudonym, kein Text, kein Verlauf, kein
Anhang: Discord ist ein Dienst ausserhalb der EU. Gelesen und entschieden
wird wie bisher in der Moderation. Meldungen mit dem Grund „minderjährig"
kommen mit 🔴 und „Vorrang".

## Einrichten

### 1. Server anlegen

Discord → **+** → *Eigenen erstellen* → *Für mich und meine Freunde*.
Name zum Beispiel „NØNE Moderation", als Bild das Ø-Logo. Sonst nichts
anlegen – die Kanäle kommen gleich.

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
https://discord.com/oauth2/authorize?client_id=APPLICATION_ID&scope=bot&permissions=805383184
```

Öffnen, deinen Server wählen, *Autorisieren*. Die Zahl steht für genau diese
Rechte, nicht mehr: Kanäle ansehen, Nachrichten senden, Nachrichten
verwalten (zum Anheften), Verlauf lesen, Kanäle verwalten, Rollen verwalten
(für „nur lesen"), Webhooks verwalten.

### 4. Server-ID hinterlegen

Discord → Einstellungen → *Erweitert* → **Entwicklermodus** an. Dann lange
auf das Server-Symbol drücken (am Rechner: Rechtsklick) → *Server-ID
kopieren*. Als GitHub-Secret `DISCORD_SERVER_ID` hinterlegen.

### 5. Einrichten lassen

GitHub → Actions → **Discord einrichten** → *Run workflow*.

Der Ablauf legt Kategorie, Kanäle und Webhooks an, heftet in jedem Kanal
einen kurzen Hinweis an und schreibt die beiden Webhook-Adressen direkt in
den **Google Secret Manager** (`DISCORD_WEBHOOK_MELDUNGEN`,
`DISCORD_WEBHOOK_SUPPORT`). Sie erscheinen nirgends – nicht im Protokoll,
nicht in GitHub, nicht im Repository.

Danach startet **Firebase Functions** von selbst und rollt die
Benachrichtigungen aus. Voraussetzung dafür: Firebase auf Blaze und die
Rollen aus [tarife.md](tarife.md#wenn-das-ausrollen-an-rechten-scheitert).

Der Ablauf ist beliebig oft startbar. Was besteht, bleibt stehen. Er findet
die Kanäle über ihren Namen – wer einen umbenennt, bekommt beim nächsten
Durchgang einen neuen dazu.

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
  Der Bot wird nur beim Einrichten gebraucht; wer mag, setzt den Token
  danach zurück und hinterlegt ihn erst wieder, wenn neu eingerichtet wird.
- **Benachrichtigungen abschalten**: im Secret Manager bei beiden
  Geheimnissen eine neue Version `nicht-eingerichtet` anlegen und *Firebase
  Functions* erneut starten.
