# Projektregeln – SKAILE Building Challenge

Dieses Projekt ist ein Wettbewerbs-Build (Minigame) für die SKAILE Academy Building Challenge.

## Push-Regeln (strikt befolgen)

- **Nach jedem abgeschlossenen Arbeitsschritt sofort committen und zu `origin` pushen.**
  `git add -A`, kurze klare Commit-Message, `git push`. Sehr regelmäßig – immer dann,
  wenn wieder ein Stück fertig ist. Kein Timer, sondern an den Fortschritt gekoppelt.
- **Immer nur zu `origin` pushen** (mein eigenes Repo:
  `https://github.com/luishettinger-sys/Skaile-Minigame.git`). Das Push-Ziel niemals ändern.
- Lokal bauen und am Ende alles in einem Schwung hochladen ist **nicht erlaubt** –
  der Push-Verlauf wird bewertet, also progressiv pushen.

## Session-Start

- Zu Beginn jeder neuen Session zuerst `git log` und `git status` anschauen,
  kurz orientieren, dann nahtlos weiterbauen – weiterhin mit Push nach jedem Schritt.

## Build-Hinweise

- Tech-Stack: statisches Web (HTML + CSS + JavaScript, Canvas). Bleibt im Browser
  ohne Build-Step lauffähig – wichtig fürs Deployment und die Community-Bewertung.
- Asset-Pfade **relativ** halten (z.B. `./bild.png`) und auf korrekte
  **Groß-/Kleinschreibung** achten – Vercel/GitHub Pages laufen auf Linux und sind
  case-sensitive, lokal (macOS) nicht.
- Lokal testen über einen lokalen Server, z.B. `python3 -m http.server 8000`,
  dann `http://localhost:8000` öffnen.
