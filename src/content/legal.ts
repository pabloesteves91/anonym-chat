/**
 * Rechtstexte.
 *
 * Alles an einem Ort, damit der Betreiberblock genau einmal gepflegt werden
 * muss. Die mit ⚠︎ markierten Werte sind Platzhalter und müssen vor dem
 * öffentlichen Start ersetzt werden – ohne vollständige Angaben ist ein
 * Impressum in der Schweiz nicht rechtskonform (Art. 3 Abs. 1 lit. s UWG).
 *
 * Diese Texte sind sorgfältig geschrieben, aber keine Rechtsberatung. Vor
 * dem Start gehören sie einmal vor juristische Augen – besonders die
 * Datenschutzerklärung, weil Ausweisdaten verarbeitet werden.
 */

export const BETREIBER = {
  /** Firma oder vollständiger Name der verantwortlichen Person. */
  name: 'NØNE, F. Berta',
  strasse: 'Im Grüntal 10',
  ort: '8405 Winterthur',
  land: 'Schweiz',
  email: 'support@none-chat.ch',
  /** Optional: CHE-Nummer, nur bei eingetragener Firma. */
  handelsregister: '',
  /** Optional: MWST-Nummer, nur wenn mehrwertsteuerpflichtig. */
  mwst: '',
  /** Für Meldungen zu Inhalten – darf dieselbe Adresse sein. */
  meldeEmail: 'support@none-chat.ch',
} as const

/** Sind die Platzhalter noch drin? Dann zeigt die Seite einen Hinweis. */
export const BETREIBER_UNVOLLSTAENDIG = Object.values(BETREIBER).some((wert) => wert.includes('⚠︎'))

export const STAND = '24. September 2026'

export interface Abschnitt {
  titel: string
  absaetze?: string[]
  liste?: string[]
}

export interface Rechtstext {
  slug: string
  titel: string
  kicker: string
  vorspann: string
  abschnitte: Abschnitt[]
}

// Zeilenweise, wie auf einem Briefkopf – die Seite bricht an den Zeilenenden um.
const adresse = `${BETREIBER.name}\n${BETREIBER.strasse}\n${BETREIBER.ort}\n${BETREIBER.land}`

export const IMPRESSUM: Rechtstext = {
  slug: 'impressum',
  titel: 'Impressum',
  kicker: 'Wer hinter NØNE steht',
  vorspann:
    'Angaben zum Betrieb von NØNE gemäss Art. 3 Abs. 1 lit. s des Bundesgesetzes gegen den unlauteren Wettbewerb (UWG).',
  abschnitte: [
    {
      titel: 'Verantwortlich für NØNE',
      absaetze: [adresse, `E-Mail: ${BETREIBER.email}`],
    },
    {
      titel: 'Registereinträge',
      absaetze: [
        BETREIBER.handelsregister
          ? `Handelsregister: ${BETREIBER.handelsregister}`
          : 'Kein Handelsregistereintrag vorhanden.',
        BETREIBER.mwst ? `Mehrwertsteuernummer: ${BETREIBER.mwst}` : 'Nicht mehrwertsteuerpflichtig.',
      ],
    },
    {
      titel: 'Inhalte melden',
      absaetze: [
        `Missbrauch, rechtswidrige Inhalte oder Hinweise auf minderjährige Nutzende melden Sie direkt im Chat über „Melden“ oder an ${BETREIBER.meldeEmail}. Meldungen werden von Hand geprüft.`,
      ],
    },
    {
      titel: 'Haftung',
      absaetze: [
        'Die Inhalte der Chats stammen von den Nutzenden. Wir prüfen sie nicht vorab, sondern reagieren auf Meldungen und auf Treffer des automatischen Wortfilters.',
        'Für Inhalte verlinkter Seiten Dritter wird keine Haftung übernommen; verantwortlich ist deren jeweiliger Betreiber.',
      ],
    },
  ],
}

export const DATENSCHUTZ: Rechtstext = {
  slug: 'datenschutz',
  titel: 'Datenschutzerklärung',
  kicker: 'Welche Daten anfallen und wie lange',
  vorspann:
    'Diese Erklärung gilt für NØNE und richtet sich nach dem revidierten Schweizer Datenschutzgesetz (revDSG) und, soweit Nutzende aus dem EWR betroffen sind, nach der DSGVO.',
  abschnitte: [
    {
      titel: 'Verantwortliche Stelle',
      absaetze: [adresse, `E-Mail: ${BETREIBER.email}`],
    },
    {
      titel: 'Welche Daten wir verarbeiten',
      liste: [
        'Kontodaten: E-Mail-Adresse und, je nach Anmeldeart, Ihr Passwort (von Firebase nur als Hash gespeichert, nie im Klartext) oder die Kennung Ihres Anmeldedienstes (Google oder Apple). Grundlage ist die Erfüllung des Nutzungsvertrags.',
        'Mobilnummer: zur Bestätigung per SMS und damit eine Sperre nicht durch ein neues Konto umgangen werden kann.',
        'Ausweisfoto und Selfie: ausschliesslich zur einmaligen Alters- und Identitätsprüfung.',
        'Profil: Pseudonym, Sprache, Altersgruppe. Diese Angaben machen Sie selbst.',
        'Suche: Sprache und die Interessen, nach denen Sie filtern, stehen nur während der Suche in der Warteschlange und werden danach gelöscht.',
        'Gesprächsfeedback: Ihre freiwillige Bewertung eines Gesprächs (gut, neutral, unangenehm). Die bewertete Person sieht sie nie; die Bewertung selbst wird nach sieben Tagen gelöscht. Drei Bewertungen „unangenehm" von drei verschiedenen Personen führen zu einem Hinweis an die Moderation, nie zu einer automatischen Sperre.',
        'Statistik: Anzahl und Dauer Ihrer Gespräche sowie die Anzahl erhaltener Bewertungen als „Gutes Gespräch“. Nur Sie sehen sie.',
        'Zahlungen: gewählter Tarif, Betrag und Laufzeit. Karten- und andere Zahlungsdaten geben Sie direkt bei Stripe ein; wir erhalten sie nicht.',
        'Chatnachrichten: Inhalt, Zeitpunkt und beteiligte Konten.',
        'Meldungen: Grund, Freitext und ein Ausschnitt des gemeldeten Gesprächs.',
        'Supportanfragen: Thema, Betreff, Ihre Beschreibung, die Adresse für die Antwort sowie freiwillig angehängte Bilder. Mitgesendet werden ausserdem Ihre Konto-ID, Ihr Anzeigename, der Stand Ihrer Verifizierung und Ihr Tarif. Eröffnet die Moderation einen Supportchat, kommen die darin geschriebenen Nachrichten dazu; wer auf Seiten des Supports schreibt, wird Ihnen nicht angezeigt.',
        'Technische Daten: Firebase protokolliert Zugriffe, um Missbrauch und Angriffe abzuwehren.',
      ],
    },
    {
      titel: 'Wie lange wir Daten aufbewahren',
      liste: [
        'Ausweisfoto und Selfie werden unmittelbar nach dem Entscheid über die Verifizierung gelöscht. Sie werden nie an Dritte weitergegeben und nie in Ihrem Browser dauerhaft gespeichert.',
        'Chatnachrichten werden 72 Stunden aufbewahrt und danach automatisch gelöscht. Das dient ausschliesslich der Missbrauchsprüfung.',
        'Meldungen und Sperren bleiben so lange bestehen, wie sie für die Durchsetzung der Nutzungsregeln nötig sind.',
        'Bilder, die Sie einer Supportanfrage anhängen, werden gelöscht, sobald die Anfrage abgeschlossen ist. Der Text der Anfrage und der Supportchat bleiben erhalten, bis die Moderation die abgeschlossene Anfrage löscht; bis dahin begründen sie, was entschieden wurde. Mit der Anfrage wird auch der Chat gelöscht.',
        'Kontodaten bleiben bis zur Löschung des Kontos bestehen.',
      ],
    },
    {
      titel: 'Wer die Chats lesen kann',
      absaetze: [
        'Ihr Gegenüber sieht im Chat nur Ihr Pseudonym und dass Sie die Verifizierung durchlaufen haben – weder Namen noch Nummer noch E-Mail-Adresse.',
        'Die Moderation kann Verläufe innerhalb der 72 Stunden einsehen, um Meldungen zu prüfen. Jeder solche Zugriff wird protokolliert; das Protokoll lässt sich nicht nachträglich verändern.',
      ],
    },
    {
      titel: 'Auftragsverarbeiter',
      absaetze: [
        'Wir betreiben NØNE auf Google Firebase (Authentifizierung, Datenbank, Dateispeicher, Serverfunktionen). Die Datenbank liegt in der Region "eur3" (Europa), der Dateispeicher in "europe-west3" (Frankfurt), die Serverfunktionen laufen in "europe-west1" (Belgien) und "europe-west6" (Zürich).',
        'Für den SMS-Versand wird Firebase Phone Authentication eingesetzt; dabei wird Ihre Mobilnummer an Google übermittelt.',
        'Die Website wird über Firebase Hosting (Google) ausgeliefert, die frühere Adresse zusätzlich über GitHub Pages. Bei beiden fallen serverseitige Zugriffsprotokolle an, auf die wir keinen Einfluss haben.',
        'Zahlungen wickelt Stripe ab (Stripe Payments Europe, Ltd., Irland). Dafür übermitteln wir Stripe Ihre E-Mail-Adresse, Ihre Kontokennung und den gewählten Tarif. Stripe kann Daten auch in die USA übermitteln; dafür gelten die Datenschutzbestimmungen von Stripe.',
        'Für die Abstimmung der Moderation nutzen wir einen privaten Server bei Discord (USA). Dorthin gehen Hinweise auf neue Meldungen, Supportanfragen und Verifizierungsanträge – nur Art, Kategorie und Zeitpunkt –, Benachrichtigungen über Zahlungen und beendete Abos mit Tarif, Betrag, Laufzeit und einer verkürzten Kontokennung sowie ein Protokoll der Moderationsentscheide mit einer verkürzten Kontokennung, etwa dass ein Supportfall erledigt, ein Tarif vergeben oder eine Geschlechtsangabe korrigiert wurde. Pseudonyme, Nachrichten, Anhänge, Ausweisdaten und Zahlungsdaten wie Kartennummern gehen nicht an Discord.',
        'Es findet keine Verarbeitung zu Werbezwecken statt und es werden keine Daten verkauft.',
      ],
    },
    {
      titel: 'Cookies und lokaler Speicher',
      absaetze: [
        'Wir setzen keine Werbe- oder Analyse-Cookies. Gespeichert wird im Browser nur, was den Dienst funktionieren lässt: die Anmeldung und Ihre Anzeigeeinstellungen. Eine Einwilligung ist dafür nicht erforderlich.',
      ],
    },
    {
      titel: 'Ihre Rechte',
      absaetze: [
        `Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Datenherausgabe. Angemeldete Personen stellen die Anfrage am einfachsten über die Supportseite; sonst schreiben Sie an ${BETREIBER.email}. Zur Beschwerde steht Ihnen der Eidgenössische Datenschutz- und Öffentlichkeitsbeauftragte (EDÖB) offen, für Betroffene aus dem EWR die jeweilige Aufsichtsbehörde.`,
        `Die Löschung Ihres Kontos veranlassen Sie über die Supportseite (Thema „Konto löschen") oder über ${BETREIBER.email}; wir führen sie von Hand aus, sobald wir Ihre Anfrage dem Konto zuordnen können. Damit verschwinden Profil und Mitgliedschaft; bestehende Meldungen und Sperren bleiben bestehen, weil sie sonst wirkungslos wären.`,
      ],
    },
    {
      titel: 'Änderungen',
      absaetze: [
        `Diese Erklärung kann angepasst werden, wenn sich der Dienst ändert. Massgeblich ist die hier veröffentlichte Fassung. Stand: ${STAND}.`,
      ],
    },
  ],
}

export const AGB: Rechtstext = {
  slug: 'agb',
  titel: 'Nutzungsbedingungen',
  kicker: 'Die Regeln, auf die wir uns einigen',
  vorspann:
    'Mit der Anmeldung bei NØNE stimmen Sie diesen Bedingungen zu. Wer sie verletzt, verliert den Zugang – und zwar dauerhaft, weil die Verifizierung an eine Person gebunden ist.',
  abschnitte: [
    {
      titel: '1. Wer teilnehmen darf',
      absaetze: [
        'NØNE steht ausschliesslich volljährigen Personen ab 18 Jahren offen. Das Alter wird anhand eines amtlichen Ausweises geprüft.',
        'Pro Person ist ein Konto zulässig. Der Versuch, eine Sperre mit einem weiteren Konto, einer weiteren Nummer oder fremden Dokumenten zu umgehen, ist untersagt.',
      ],
    },
    {
      titel: '2. Verifizierung',
      absaetze: [
        'Für den Zugang zum Chat sind eine bestätigte Mobilnummer, ein Ausweisfoto und ein Selfie erforderlich. Die Prüfung erfolgt von Hand; ein Anspruch auf Freigabe besteht nicht.',
        'Wer gefälschte oder fremde Dokumente einreicht, wird dauerhaft gesperrt. Bei Verdacht auf strafbare Handlungen behalten wir uns eine Anzeige vor.',
      ],
    },
    {
      titel: '3. Verhalten im Chat',
      liste: [
        'Keine Belästigung, keine Drohungen, keine Beleidigungen.',
        'Keine sexuellen Inhalte gegenüber Personen, die das nicht wollen, und keine Aufforderung zu Bildern.',
        'Keine Werbung, keine Links auf andere Plattformen, kein Weiterverkauf von Kontakten.',
        'Keine Weitergabe der Identität oder der Nachrichten anderer – auch nicht als Screenshot.',
        'Keine Kontaktaufnahme mit Personen, die erkennbar minderjährig sind; ein solcher Verdacht ist sofort zu melden.',
      ],
    },
    {
      titel: '4. Inhalte auf eigene Verantwortung',
      absaetze: [
        'Gesprächspartner werden zufällig zugelost. Trotz Verifizierung, Wortfilter und Moderation lässt sich nicht ausschliessen, dass Ihnen sexuelle, verstörende oder beleidigende Inhalte begegnen. Die Teilnahme erfolgt auf eigene Verantwortung.',
        'Sie sind für das verantwortlich, was Sie schreiben. Geben Sie keine Daten preis, die Sie nicht preisgeben wollen – wir können nicht verhindern, dass Ihr Gegenüber mitliest, mitschreibt oder abfotografiert.',
      ],
    },
    {
      titel: '5. Moderation und Sperren',
      absaetze: [
        'Chatverläufe werden 72 Stunden aufbewahrt und können in dieser Zeit von der Moderation zur Prüfung einer Meldung eingesehen werden.',
        'Bei Verstössen können wir Konten verwarnen, vorübergehend oder dauerhaft sperren. Eine Sperre ist an die verifizierte Person gebunden und gilt damit auch für neue Konten.',
      ],
    },
    {
      titel: '6. Tarife und Zahlung',
      absaetze: [
        'Der Gratiszugang ist dauerhaft kostenlos und in der Anzahl Chats pro Tag begrenzt. Bezahlte Zugänge heben diese Grenze auf und schalten zusätzliche Filter frei.',
        `Monats- und Jahresabos verlängern sich automatisch, solange sie nicht vor Ablauf der Laufzeit gekündigt werden. Gekündigt wird über die Supportseite (Thema „Tarif und Zahlung“) oder per E-Mail an ${BETREIBER.email}; der Zugang bleibt bis zum Ende der bezahlten Laufzeit bestehen.`,
        'Der Lifetime-Zugang gilt für die Dauer des Bestehens dieses Dienstes. Wird der Dienst eingestellt, besteht kein Anspruch auf Rückerstattung über den nicht genutzten Teil eines laufenden Abos hinaus.',
        'Ein gesetzliches Widerrufsrecht besteht bei digitalen Diensten in der Schweiz nicht. Bei einer Sperre wegen eines Verstosses wird nichts zurückerstattet.',
      ],
    },
    {
      titel: '7. Verfügbarkeit',
      absaetze: [
        'NØNE wird mit Sorgfalt betrieben, aber ohne Zusicherung einer bestimmten Verfügbarkeit. Wartungsarbeiten, Störungen und Weiterentwicklungen können zu Unterbrüchen führen.',
      ],
    },
    {
      titel: '8. Anwendbares Recht',
      absaetze: [
        `Es gilt Schweizer Recht. Gerichtsstand ist, soweit gesetzlich zulässig, der Sitz des Betreibers (${BETREIBER.ort}). Zwingende Konsumentenschutzbestimmungen bleiben vorbehalten.`,
        `Stand: ${STAND}.`,
      ],
    },
  ],
}

export const RECHTSTEXTE: Rechtstext[] = [IMPRESSUM, DATENSCHUTZ, AGB]
