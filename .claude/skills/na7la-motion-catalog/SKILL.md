---
name: na7la-motion-catalog
description: "Catalogue of 26 motion-graphics effects for NA7LA's reels (Orbit, Frame Break, Digital Zoom, Phone Mockup, Headline Wall, Zoom Through, Chart Grow, Green Screen, Paper Cut, Doodle Boil, Vertigo, Glass Type, Cover Story, Pull-back, Checklist, Couch Wall, UI World, Paper Tear, Kinetic Captions, Counter Up, Split Screen, Spotlight, Lower Third, Map Pin, Timeline, Comment Pop): what each does, when to use it, which installed skill builds it, and the effects prompt. Use when NA7LA names an effect, asks «واش من حركة نستعمل هنا», wants an effects reel, or plans the motion of a script."
---

# NA7LA motion catalogue (26 effects)

Effect list and «when to use» ideas inspired by Moath Alherani's public guide (moathalherani.com/ar/claude-motion-graphics); descriptions rewritten. Build every effect on NA7LA's own real footage (no generated avatar), in the account's colours. Pair it with RULE-01 (`content-studio/RULE-01-reel-charah.md`).

| # | Effect | What it does | Use it when | Built by |
|---|---|---|---|---|
| 1 | Digital Orbit | thumbnails circle around the speaker | showing several products / shots | `na7la-motion-fx` orbit · cinematic orbit |
| 2 | Frame Break | the subject steps out of the frame | the action should leave the screen | motion-fx frame_break · cinematic |
| 3 | Digital Zoom | hard punch-in on the detail | focus on one detail | motion-fx digital_zoom |
| 4 | Phone Mockup | the clip plays inside a phone | showing a reel or an app (Tassyir screen) | motion-fx phone_mockup · cinematic |
| 5 | Headline Wall | headlines slap onto a wall behind | talking about news / what people say | motion-fx headline_wall · cinematic |
| 6 | Zoom Through | camera flies from one shot into the next | strong transition | motion-fx zoom_through_cut · cinematic |
| 7 | Chart Grow | a chart rises behind the speaker | numbers and results | motion-fx chart_grow · cinematic |
| 8 | Green Screen | background replaced | changing place | motion-fx green_screen |
| 9 | Paper Cut | speaker cut out like paper | a moment that must grab attention | motion-fx paper_cut · cinematic |
| 10 | Doodle Boil | hand-drawn outline boiling around | pointing at something | motion-fx doodle_boil |
| 11 | Vertigo | background flees, subject stays | shock moment (the interrupt) | cinematic vertigo |
| 12 | Glass Type | glass word in perspective behind | premium title | motion-fx glass_type |
| 13 | Cover Story | giant word rises behind the head | hook / title | motion-fx cover_story · cinematic |
| 14 | Pull-back Reveal | camera pulls back into an editor window | revealing the big picture | motion-fx pull_back_reveal · cinematic |
| 15 | Checklist | steps type in and tick | counting steps | motion-fx checklist · reel-studio `checklist` |
| 16 | Couch Wall | columns of your clips rise behind | talking about your work | motion-fx couch_wall · cinematic |
| 17 | UI World | chat window, clips fly in | talking about a tool / AI | motion-fx ui_world |
| 18 | Paper Tear | page tears open onto the next scene | chapter transition | cinematic paper-tear |
| 19 | Kinetic Captions | each word appears with the voice | any key sentence | reel-studio captions (built in) |
| 20 | Counter Up | number counts up to the result | a big number | reel-studio `countUp` |
| 21 | Split Screen | before / after halves | comparison | reel-studio `versus` (close); full split: to build |
| 22 | Spotlight | screen dims, light on subject | the key moment | to build |
| 23 | Lower Third | name + title bar slides in | introducing yourself / a guest | to build |
| 24 | Map Pin | map with a pin dropping | talking about a place (wilaya) | to build |
| 25 | Timeline | stations along a line | a story or an evolution | reel `boussoula-target` recap timeline |
| 26 | Comment Pop | a comment pops, you answer | replying to a follower | to build |

`cinematic` = `na7la-cinematic-reel` (installed locally only: no licence; needs HyperFrames). `motion-fx` makes 1.8 s cards from a talking clip; combine the cards in reel-studio or ffmpeg.

## Effects prompt (NA7LA version)
```
You are NA7LA's motion editor working in code. Video: [file]. In it I say effect names.
Make a vertical 1080x1920 reel.
1) Transcribe word by word (Whisper turbo, ar), cut silences and retakes, keep shots where I look at the camera.
2) When I say an effect name from na7la-motion-catalog, run it the moment the word ends, no gap.
3) Run each effect on a shot from [folder] (my older real clips), chosen to show what the effect is for:
   Chart Grow on numbers, Phone Mockup on a Tassyir screen, Zoom Through between two shots.
4) Before/after: small card RAW (original), large EDITED (with effect).
5) Under each effect two lines in Algerian Darija: what it does, when to use it.
6) While I talk I am alone and large; during the effect hide me and leave the shot.
7) Keep my face and skin colours, whole face in frame, everything sharp. One Arabic font (Tajawal),
   one Latin font, one accent colour from the account theme. English words in English letters.
8) Sound (Moath SFX pack, RULE-01 §5): voice clean and on top (-14 LUFS); whoosh peak on each transition,
   impact/beat-drop on each effect, everything else under the voice.
9) Show me one still per effect before rendering, then deliver the MP4.
```
