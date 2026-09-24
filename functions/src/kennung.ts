/**
 * Die Kurzkennung eines Kontos für Discord: „Konto a1b2c3" – die ersten sechs
 * Zeichen, in der Moderation auffindbar, für Dritte ohne Aussage.
 *
 * Eigene Datei ohne Firebase, damit reine Texte sie nutzen und die Tests sie
 * ohne die Pakete der Funktionen laden können.
 */
export const kurzkennung = (uid: unknown) => `Konto ${String(uid ?? '').slice(0, 6) || '?'}`
