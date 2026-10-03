# Erklärvideo (15 s, 1080×1920)

`none-chat-erklaervideo.mp4` erklärt NØNE in vier Schritten: verifizieren, zufällig verbunden, anonym chatten, Verlauf weg.

Quelle ist `index.html` (CSS-Animationen, per `seek(t)` angehalten). Neu rendern:

```bash
cp ../../src/assets/logo.png ../../src/assets/logo-text.png \
   ../../node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2 .
node render.mjs            # schreibt frames/f0000.png … f0449.png
ffmpeg -framerate 30 -i frames/f%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart none-chat-erklaervideo.mp4
```
