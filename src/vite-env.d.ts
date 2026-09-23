/// <reference types="vite/client" />

/** Kurze Kennung des Builds, gesetzt in vite.config.ts. */
declare const __BUILD_ID__: string
/** Zeitpunkt des Builds als ISO-Zeichenkette. */
declare const __BUILD_ZEIT__: string
/** Die letzten 30 Fassungen aus der Git-Geschichte, neueste zuerst. */
declare const __VERSIONEN__: { id: string; datum: string; titel: string }[]
