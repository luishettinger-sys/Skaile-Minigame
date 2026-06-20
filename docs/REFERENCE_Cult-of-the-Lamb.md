# Stil- & Design-Referenz: Cult of the Lamb (Hand-off-Briefing)

> **Zweck dieses Dokuments:** Übergabe an einen anderen Claude / Entwickler. Es soll als
> visuelle und strukturelle Referenz dienen, um unser eigenes Spiel (Roguelite-Shooter mit
> Duck-Protagonist, Wellen + Boons + Base/Meta-Upgrades, Toon-Look) gezielt am Look & Feel
> von **Cult of the Lamb** (Massive Monster / Devolver Digital, 2022) zu orientieren.
>
> **Wichtig:** Nicht 1:1 kopieren (Urheberrecht), sondern die *Designprinzipien* abschauen –
> Formensprache, Farb-Logik, UI-Lesbarkeit, Loop-Struktur. Eigene Motive (Duck statt Lamb).

---

## 0) Screenshot-Quellen (offiziell, Steam-CDN – direkt im Browser öffnen)

Diese URLs sind die offiziellen 1920×1080-Screenshots von der Steam-Seite (App 1313140).
An einen anderen Claude weitergeben oder selbst öffnen, um den Look zu studieren:

1. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_3bda2c2e740660fcde8c42eafab4cb7574ab54e6.1920x1080.jpg
2. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_805babf3c8dec217798c836daea48a63b47c192b.1920x1080.jpg
3. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_b26625d6f64a739ed1ddf832a5d26b665ab0619f.1920x1080.jpg
4. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_90f238e89ab4c4500d3baee273419bd23f8e5f84.1920x1080.jpg
5. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_f4ca3fd0416c3f41c57bc3809bb45f8f20e684ec.1920x1080.jpg
6. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_566aecf445ab0448191f1996600fd7ec80d0a0d7.1920x1080.jpg
7. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_1ffa960f90ddf6d19e08e1a1132f1b5d5c3984bd.1920x1080.jpg
8. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_468acea830d216876979ff7cf0443a0a226e79da.1920x1080.jpg
9. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_5b3ceefeff8c3ceb9d7ca08e82af8dd5c3ea57b1.1920x1080.jpg
10. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_51a91a5ffeeb78935b455ce53ccf9149a913cec1.1920x1080.jpg
11. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_14a1f4ec7c9e51245f397dd2eee293174410a12b.1920x1080.jpg
12. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_608342d523c1df1f6556ade12dbb003a0af5d6db.1920x1080.jpg
13. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_5091be0f7bb00dbe49499c57535725a397a3db2d.1920x1080.jpg
14. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_214faee099ba02b146b6f5c4acd7fc91454b86dd.1920x1080.jpg
15. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_8fc88da10fb8862f0e9b962552b265652828348f.1920x1080.jpg
16. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_fb882bcb70ed1563f7f2d963786329e0abbde85e.1920x1080.jpg
17. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_bb7f191e7d5c2fb09ad02a1694ee61dfe110dc2f.1920x1080.jpg
18. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_fcf7cb3e2b3c1a7bbc2b57f8a9e628ebc0bac5f5.1920x1080.jpg
19. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_3ace1b2f742ae552ea3b44784ff64c5bad987de5.1920x1080.jpg
20. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_2490b41f50ccd83642942c0e51e28325d804a4e0.1920x1080.jpg
21. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_5aef64a6c04e9954d6aca7232726a62f60e7736c.1920x1080.jpg
22. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_5f14932b9b89a638d4e5c83a3aae3f5e45ba45cf.1920x1080.jpg
23. https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1313140/ss_9285773c4ae0c4736dc23374b5132f1b5dfd0a82.1920x1080.jpg

**Trailer (für Bewegung/Game-Feel ansehen):**
- Launch Trailer: https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/256900500/movie.293x165.jpg (Steam-Seite App 1313140)
- Offizielle Steam-Seite: https://store.steampowered.com/app/1313140/Cult_of_the_Lamb/

**Weitere gute Bildquellen zum Recherchieren:** offizieller YouTube-Kanal von Devolver Digital,
das offizielle Press Kit unter `cultofthelamb.com/presskit`, sowie Gameplay-Videos
(Stichworte: "Cult of the Lamb base building", "Cult of the Lamb crusade gameplay").

---

## 1) Art-Style in einem Satz

**„Niedlich-makaber":** ein handgezeichneter, flacher 2D-Cartoon-Look mit dicken, leicht
unregelmäßigen Outlines, weichen runden Tierformen und Pastell-Grundtönen – kombiniert mit
düster-okkulten Motiven (Pentagramme, Kerzen, Blut, Augen). Der Reiz entsteht aus dem
**Kontrast** zwischen süßer Form und finsterem Thema. Optisch erinnert es an Tim-Burton-meets-
South-Park: rund und knuffig, aber mit schwarzem Humor.

---

## 2) Visuelle DNA (was den Look ausmacht)

**Formensprache**
- Alles ist **rund, weich, knollig**. Keine harten technischen Kanten. Charaktere sind im
  Grunde simple Ovale/Tropfenformen mit kurzen Stummelbeinen.
- **Wenige, klare Silhouetten** – jede Figur ist als Schattenriss erkennbar.
- **Dicke, dunkle (nicht reinschwarze) Outlines**, leicht „wackelig"/handgezeichnet, nicht
  vektor-perfekt. Das gibt den Indie-Charme.

**Gesichter / Charakter**
- Große ausdrucksstarke Augen (oft nur zwei schwarze Punkte oder leere weiße Ovale für die
  „besessenen" Anhänger). Minimal-Mimik, viel Wirkung.
- Persönlichkeit kommt über **Pose und Animation**, nicht über Detailreichtum.

**Farbe & Stimmung**
- **Pastellige Grundpalette** (gedämpftes Rosa, Mint, Lavendel, Creme) als Basis – wirkt
  freundlich. Darüber **kräftige Akzentfarben** für Wichtiges: ein sattes **Rot/Karminrot**
  (Blut, Gefahr), warmes **Kerzen-Orange/Gold** (Ritual, heilig), giftiges **Lila/Pink** für
  okkulte Magie.
- **Sektoren/Biome haben je eine eigene Leitfarbe** (sehr relevant für uns – siehe unsere
  „Sektor-Stimmungen"!): z.B. ein Gebiet kühl-blau, eins giftig-grün, eins rot-höllisch. So ist
  jeder Bereich auf einen Blick unterscheidbar.
- **Stimmungswechsel zwischen den zwei Spielhälften:** Die Basis/das Dorf ist hell, warm,
  einladend (Tagsüber-Pastell). Die Crusade-Dungeons sind dunkler, satter, bedrohlicher,
  mit stärkerem Kontrast und mehr Schwarz.

**Licht & Effekte**
- **Flacher Look, kaum realistische Schatten.** Statt 3D-Beleuchtung: gemalte Soft-Shadows
  unter Objekten (einfache Ellipsen-Schatten) für Bodenhaftung.
- **Glow/Bloom nur sparsam und gezielt** – Kerzen, magische Projektile, Ritual-Effekte leuchten.
  Der Rest bleibt matt. (Deckt sich mit unserer Entscheidung „matt / kein Bloom" bei Waffen.)
- **Partikel mit Charakter:** Blut-Spritzer, Sternchen, kleine Totenköpfe, Herzen – immer im
  selben flachen Cartoon-Stil, nie realistisch.
- Leichter **Vignette-Rand** und dezente Hintergrund-Unschärfe halten den Fokus in der Mitte.

**Kamera & Perspektive**
- **Leicht von oben (top-down / 3⁄4-Iso-Anmutung)**, sowohl im Dorf als auch im Dungeon.
- Charaktere werden trotzdem **von der Seite** gezeigt (man sieht ihr Profil/Gesicht), die Welt
  von schräg oben – diese „2.5D"-Mischung ist typisch und macht Figuren ausdrucksstark.

---

## 3) Spielstruktur / Game-Loop (das „wie ist es aufgebaut")

Cult of the Lamb ist ein **Hybrid aus zwei Spielen**, die sich abwechseln:

### A) Roguelite-Crawl („Crusades")
- Du verlässt die Basis und gehst in **prozedural zusammengesetzte Dungeons** (eines von
  mehreren Biomen/Bossgebieten).
- Aufbau: **Reihe von Räumen** → in jedem Raum Gegnerwelle clearen → Tür öffnet sich → weiter.
- Zwischen Räumen **Belohnungs-Knoten / Wegabzweigungen** (Kampf, Schätze, Anhänger retten,
  Ressourcen). Du **wählst den Pfad** über eine Mini-Karte.
- **Run-Aufwertungen unterwegs:** zufällige **Tarot-Karten** geben temporäre Boons für diesen
  Run (mehr HP, schnellere Waffe, Crit etc.) → **„wähle 1 aus mehreren"-Mechanik**. Genau unser
  Boon-System.
- **Waffe + Fluch (Fernangriff)** werden pro Run zufällig vergeben/gewechselt; verschiedene
  Waffentypen (Schwert, Hammer, Dolch, Axt) mit eigenem Tempo/Reichweite.
- **Boss am Ende** des Biom-Strangs. Tod = Run vorbei, du kehrst (geschwächt) zur Basis zurück,
  behältst aber gesammelte Ressourcen → **Meta-Progression**.

### B) Base/Management („der Cult")
- Zwischen den Runs verwaltest du dein **Dorf/Basis**: Gebäude bauen, Ressourcen verarbeiten,
  Anhänger (Follower) versorgen (Essen, Schlafplätze, Laune), Rituale/Predigten abhalten.
- Gesammelte Ressourcen aus den Crusades fließen in **dauerhafte Upgrades** (neue Gebäude,
  Rezepte, permanente Boni) → das ist die **Meta-Schicht**, die Runs leichter macht.
- **Fortschritt = Schleife:** Crusade → Beute → Basis ausbauen → stärker in die nächste Crusade.
  Es gibt ein klares **Endziel** (mehrere Bossbiome besiegen → Finalgegner) = unser
  „5-Sektoren-Ziel + Victory".

**Übertragung auf unser Spiel:** Wir haben dieselbe Doppelstruktur. Cult of the Lamb zeigt
mustergültig, wie man die zwei Hälften visuell trennt (heller Hub vs. dunkle Runs) und über
eine Ressourcen-/Upgrade-Schleife verbindet.

---

## 4) UI / HUD-Prinzipien (sehr gut abschaubar)

- **Diegetisch & thematisch:** UI-Rahmen sehen aus wie **Holz, Pergament, Knochen, Stoff** –
  passend zum okkulten Thema. Keine sterilen Standard-Buttons. Icons sind **handgezeichnete
  kleine Illustrationen**, keine generischen Symbole.
- **Sehr aufgeräumtes HUD im Kampf:** nur das Nötigste sichtbar – Herzchen/HP oben, Waffen-/
  Fluch-Anzeige unten, Mini-Karte/Pfad-Indikator. Maximale Lesbarkeit, minimaler Clutter.
- **Boon-/Karten-Auswahl als großes, zentrales Moment:** wenn du 1 aus 3 wählst, stoppt das
  Spiel, die Karten erscheinen **groß, beleuchtet, mit Illustration + kurzem Text**. Die Wahl
  fühlt sich bedeutsam an (klare Hierarchie: Bild groß, Name fett, Effekt klein).
- **Konsistente Farb-Codierung:** Gold = heilig/gut, Rot = Schaden/Gefahr, Lila = okkult/Magie,
  Grün = Heilung/Natur. Spieler lernen die Sprache sofort.
- **Sanfte Animationen:** Buttons/Karten wackeln, pulsieren, ploppen leicht beim Erscheinen –
  alles „squash & stretch", nie steif. Übergänge mit kleinen Tintenkleksen/Wischern.
- **Typografie:** runde, leicht handschriftliche/serifige Display-Schrift für Überschriften;
  gut lesbare klare Schrift für Mengen/Werte. Nie zu dünn.

---

## 5) Charakter-Design-Prinzipien (für unseren Duck + Monster)

- **Held = simple, knuffige Tierform mit einem starken Erkennungsmerkmal.** Beim Lamb: das
  weiße Fell + die rote Krone/Kapuze. Bei uns: der Duck braucht **ein einprägsames Markenzeichen**
  (z.B. eine bestimmte Kopfbedeckung/Farbe), das in jeder Pose sofort lesbar ist.
- **Getragene Waffe sichtbar & überzeichnet:** Waffen sind relativ **groß zur Figur**, klare
  Silhouette, leicht cartoonig proportioniert. (Passt zu unseren getragenen GLB-Waffen am Duck.)
- **Gegner = Variationen einfacher Formen** mit deutlich unterschiedlicher Silhouette und je
  einer Leitfarbe pro Typ/Sektor. Lesbarkeit > Detail: man muss auf einen Blick erkennen, was
  gefährlich ist.
- **Animation trägt die Persönlichkeit:** Idle-Wackeln, Hüpf-Bewegung beim Laufen, übertriebener
  Hit-/Tod-Effekt (Squash, Sterne, kurzer Screen-Shake). Wenig Frames, viel Ausdruck.

---

## 6) Konkrete „Abschau-Liste" für unseren Build (Prioritäten)

1. **Zwei klar getrennte Stimmungen:** Hub/Basis hell & warm-pastell, Run-Sektoren dunkler &
   farbcodiert. Schon allein das hebt die Wertigkeit enorm.
2. **Sektor-Leitfarben konsequent durchziehen** (Boden, Gegner-Akzent, Licht, Partikel) – jeder
   unserer 5 Sektoren = eine eigene Farbwelt.
3. **Boon-Auswahl als großes, schönes Moment** inszenieren: Spiel pausiert, 3 große Karten mit
   Icon + Name + kurzem Effekt, sanfte Pop-/Hover-Animation, klare Farb-Codierung.
4. **HUD radikal entschlacken** und thematisch rahmen (passend zum SKAILE-/Duck-Thema statt
   generischer Browser-UI).
5. **Outlines + flache Soft-Shadows** für den handgezeichneten Cartoon-Look; Glow nur gezielt
   an Projektilen/Pickups/Rituale.
6. **Duck-Markenzeichen** definieren, das in jeder Waffen-/Pose-Variante lesbar bleibt.
7. **Juicy Feedback:** Squash & Stretch, kleiner Screen-Shake, Cartoon-Partikel (Sterne/Tropfen)
   bei Treffer & Tod – billig umzusetzen, riesiger Effekt auf „Feel".
8. **Klare Loop-Lesbarkeit:** Run → Beute → Basis-Upgrade → stärkerer Run, mit sichtbarem
   Fortschritt aufs 5-Sektoren-Ziel.

---

## 7) Was wir NICHT übernehmen / aufpassen

- **Kein 1:1-Klau** von Assets, Maskottchen oder UI-Grafik – nur Prinzipien. Eigene Motive (Duck,
  SKAILE-Thema) statt Schaf/Okkultismus.
- Cult of the Lamb ist **2D (Sprite-basiert)**; wir nutzen teils echte **GLB-Modelle**. Den
  Cartoon-Look kann man aber auch in 3D treffen: flache/toon-artige Materialien, dicke Outlines
  (z.B. Inverted-Hull / Fresnel), wenig Bloom, kräftige Sektor-Farben, weiche Bodenschatten.
- Die okkulte Düsternis ist deren Markenkern – unser Kontrast/Hook sollte **eigenständig** sein
  (z.B. „knuffiger Duck in einer harten Arena"), nicht geliehen.

---

*Erstellt als Übergabe-Briefing. Quelle der Bilder: offizielle Steam-Seite App 1313140
(Cult of the Lamb, Massive Monster / Devolver Digital). Beschreibungen aus Spielkenntnis +
offizieller Store-Beschreibung zusammengetragen.*
