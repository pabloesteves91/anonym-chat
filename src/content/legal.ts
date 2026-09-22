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
  name: '⚠︎ Name oder Firma eintragen',
  strasse: '⚠︎ Strasse und Nummer',
  ort: '⚠︎ PLZ und Ort',
  land: 'Schweiz',
  email: '⚠︎ kontakt@example.ch',
  /** Optional: CHE-Nummer, nur bei eingetragener Firma. */
  handelsregister: '',
  /** Optional: MWST-Nummer, nur wenn mehrwertsteuerpflichtig. */
  mwst: '',
  /** Für Meldungen zu Inhalten – darf dieselbe Adresse sein. */
  meldeEmail: '⚠︎ meldung@example.ch',
} as const

/** Sind die Platzhalter noch drin? Dann zeigt die Seite einen Hinweis. */
export const BETREIBER_UNVOLLSTAENDIG = Object.values(BETREIBER).some((wert) => wert.includes('⚠︎'))

export const STAND = '21. September 2026'

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

const adresse = `${BETREIBER.name}, ${BETREIBER.strasse}, ${BETREIBER.ort}, ${BETREIBER.land}`

export const IMPRESSUM: Rechtstext = {
  slug: 'impressum',
  titel: 'Impressum',
  kicker: 'Wer hinter diesem Dienst steht',
  vorspann: 'Angaben gemäss Art. 3 Abs. 1 lit. s des Bundesgesetzes gegen den unlauteren Wettbewerb (UWG).',
  abschnitte: [
    {
      titel: 'Verantwortlich für diesen Dienst',
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
        `Missbrauch, rechtswidrige Inhalte oder Hinweise auf minderjährige Nutzende melden Sie direkt im Chat über "Melden" oder an ${BETREIBER.meldeEmail}. Meldungen werden von Hand geprüft.`,
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
    'Diese Erklärung richtet sich nach dem revidierten Schweizer Datenschutzgesetz (revDSG) und, soweit Nutzende aus dem EWR betroffen sind, nach der DSGVO.',
  abschnitte: [
    {
      titel: 'Verantwortliche Stelle',
      absaetze: [adresse, `E-Mail: ${BETREIBER.email}`],
    },
    {
      titel: 'Welche Daten wir bearbeiten',
      liste: [
        'Kontodaten: E-Mail-Adresse und die Kennung Ihres Anmeldedienstes (Google oder Apple). Grundlage ist die Erfüllung des Nutzungsvertrags.',
        'Mobilnummer: zur Bestätigung per SMS und damit eine Sperre nicht durch ein neues Konto umgangen werden kann.',
        'Ausweisfoto und Selfie: ausschliesslich zur einmaligen Alters- und Identitätsprüfung.',
        'Profil: Pseudonym, Sprache, Altersgruppe, Interessen. Diese Angaben machen Sie selbst.',
        'Chatnachrichten: Inhalt, Zeitpunkt und beteiligte Konten.',
        'Meldungen: Grund, Freitext und ein Ausschnitt des gemeldeten Gesprächs.',
        'Technische Daten: Firebase protokolliert Zugriffe, um Missbrauch und Angriffe abzuwehren.',
      ],
    },
    {
      titel: 'Wie lange wir Daten aufbewahren',
      liste: [
        'Ausweisfoto und Selfie werden unmittelbar nach dem Entscheid über die Verifizierung gelöscht. Sie werden nie an Dritte weitergegeben und nie in Ihrem Browser dauerhaft gespeichert.',
        'Chatnachrichten werden 72 Stunden aufbewahrt und danach automatisch gelöscht. Das dient ausschliesslich der Missbrauchsprüfung.',
        'Meldungen und Sperren bleiben so lange bestehen, wie sie für die Durchsetzung der Nutzungsregeln nötig sind.',
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
      titel: 'Auftragsbearbeiter',
      absaetze: [
        'Wir betreiben den Dienst auf Google Firebase (Authentifizierung, Datenbank, Dateispeicher). Die Datenbank liegt in der Region "eur3" (Europa), der Dateispeicher in "europe-west3" (Frankfurt).',
        'Für den SMS-Versand wird Firebase Phone Authentication eingesetzt; dabei wird Ihre Mobilnummer an Google übermittelt.',
        'Die Auslieferung der Website erfolgt über GitHub Pages. Dabei fallen serverseitige Zugriffsprotokolle an, auf die wir keinen Einfluss haben.',
        'Es findet keine Bearbeitung zu Werbezwecken statt und es werden keine Daten verkauft.',
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
        `Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Datenherausgabe. Schreiben Sie dafür an ${BETREIBER.email}. Zur Beschwerde steht Ihnen der Eidgenössische Datenschutz- und Öffentlichkeitsbeauftragte (EDÖB) offen, für Betroffene aus dem EWR die jeweilige Aufsichtsbehörde.`,
        `Die Löschung Ihres Kontos veranlassen Sie über ${BETREIBER.email}; wir führen sie aus, sobald wir Ihre Anfrage dem Konto zuordnen können. Damit verschwinden Profil und Mitgliedschaft; bestehende Meldungen und Sperren bleiben bestehen, weil sie sonst wirkungslos wären.`,
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
    'Mit der Anmeldung stimmen Sie diesen Bedingungen zu. Wer sie verletzt, verliert den Zugang – und zwar dauerhaft, weil die Verifizierung an eine Person gebunden ist.',
  abschnitte: [
    {
      titel: '1. Wer teilnehmen darf',
      absaetze: [
        'Der Dienst steht ausschliesslich volljährigen Personen ab 18 Jahren offen. Das Alter wird anhand eines amtlichen Ausweises geprüft.',
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
        'Monats- und Jahresabos verlängern sich automatisch, solange sie nicht vor Ablauf der Laufzeit gekündigt werden. Gekündigt wird im Profil; der Zugang bleibt bis zum Ende der bezahlten Laufzeit bestehen.',
        'Der Lifetime-Zugang gilt für die Dauer des Bestehens dieses Dienstes. Wird der Dienst eingestellt, besteht kein Anspruch auf Rückerstattung über den nicht genutzten Teil eines laufenden Abos hinaus.',
        'Ein gesetzliches Widerrufsrecht besteht bei digitalen Diensten in der Schweiz nicht. Bei einer Sperre wegen eines Verstosses wird nicht zurückerstattet.',
      ],
    },
    {
      titel: '7. Verfügbarkeit',
      absaetze: [
        'Der Dienst wird mit Sorgfalt betrieben, aber ohne Zusicherung einer bestimmten Verfügbarkeit. Wartungsarbeiten, Störungen und Weiterentwicklungen können zu Unterbrüchen führen.',
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
