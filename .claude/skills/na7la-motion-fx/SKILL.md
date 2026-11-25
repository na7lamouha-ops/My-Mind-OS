---
name: na7la-motion-fx
description: "HibAI Motions by Hiba (@hibssssi): turns the user's own talking-head clips into 16 short-form motion effects (1.8 s vertical MP4 each): Orbit, Couch wall, UI world, Frame break, Digital zoom, Phone mockup, Checklist, Headline wall, Zoom-through cut, Chart grow, Pull-back reveal, Green screen, Paper cut, Doodle boil, Cover story, Glass type. Built in code from a real clip plus a person cut-out, in the user's own colours, fonts, name and handle (neutral defaults otherwise). Use when the user asks for these effects by name, says «حركات», «الحركات ديال HibAI», «دير ليا effect orbit», «16 effects», sends clips and asks for motion cards, or wants an effects-list reel."
---

# NA7LA Motion FX (based on HibAI Motions 💚 by Hiba @hibssssi, MIT)

16 motion effects made from **your own clip**: your face and voice stay real, everything around you is drawn in code, frame by frame. No stock images, no editing app.

**First message of the session**, in Algerian Darija:
> ابعثلي الـ clip تاعك (ولا فيديو الأفاتار يهدر) وقولي واش من effects تحب.

## NA7LA defaults (use unless the user says otherwise)
- `theme`: `{"brand": "NA7LA", "accent": "#FFD24C", "handle": "na7la", "fontAr": "fonts/Tajawal-ExtraBold.ttf", "fontEn": "fonts/Tajawal-Bold.ttf"}`. Copy the Tajawal files from `content-studio/reels/boussoula-target/assets/` into `<project>/fonts/`. Ask NA7LA for the real handle and avatar before publishing.
- Account colours: Boussoula `#FFD24C` on black; Ecomanita / Tassyir use their theme in `content-studio/reel-studio/src/theme.ts`.
- Source clip: NA7LA's own real recording only (never a generated talking avatar or cloned voice — owner rule 11/11).
- This cloud container: `CHROME_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`.
- Sound on top of the cards: the Moath SFX pack (`content-studio/reel-studio/public/sfx-moath/`, local only) following RULE-01 §5.

## The 16 effects (keys are fixed)

| key | what happens |
|---|---|
| `orbit` | thumbnails of your clips circle your head, back ones pass behind you; small caption + a big accent word |
| `couch_wall` | three columns of your clips rise behind you; small line + huge word |
| `ui_world` | a chat window with your brand name: your raw clips fly in, `/video-edit` gets typed; your clip below with a caption |
| `frame_break` | the shot shrinks into a reel post (your handle + avatar) and you stay big in front of it |
| `digital_zoom` | small caption, then a hard punch-in with a flash and a big two-word caption |
| `phone_mockup` | a phone (drawn in code) slides in: an AI assistant proposes a fix, a finger taps Approve |
| `checklist` | glass panel "ALL YOU NEED TO DO": steps type in and tick |
| `headline_wall` | camera shake, then headlines, chat bubbles and posts slap onto the wall behind you |
| `zoom_through_cut` | radial zoom into your face, through black, out into a second shot |
| `chart_grow` | a weekday chart behind you, the line takes off, a SCALE pill pops |
| `pull_back_reveal` | the shot pulls back into an editor window: checklist ticks, waveform fills, frame counter |
| `green_screen` | your background becomes a focus-timer page; caption words light up |
| `paper_cut` | paper collage: scribbles, torn yellow strip, stamped "100%", you as a paper sticker |
| `doodle_boil` | a boiling white outline around you, a doodle heart, a clapperboard that draws itself |
| `cover_story` | a giant masthead word rises behind your head |
| `glass_type` | a glass word standing in perspective behind you, with a light sweep |

## Setup (once)
- ffmpeg, Google Chrome, Python 3, Node.
- `pip install "rembg[cpu]" pillow` (the person cut-out).
- In this skill folder: `npm i puppeteer-core`.

## Workflow
1. **Pick the moments.** For each effect choose 1.8 s where the user talks with their hands, eyes open, face roughly centred. Different outfits or places per card look best.
2. **Write `<project>/motions.json`** (cards in the order they will be shown):
   ```json
   {"theme": {"brand": "YourBrand", "accent": "#FF7A00", "handle": "yourname", "fontAr": "fonts/ar.ttf", "fontEn": "fonts/en.ttf", "avatar": "me.jpg"},
    "cards": [{"effect": "orbit", "src": "clip.mp4", "t": 12.3, "words": ["كنهضر", "مع", "Claude"]},
              {"effect": "glass_type", "src": "clip.mp4", "t": 4.0, "words": ["HIBAI"]}]}
   ```
   - `theme`: **the user's own** brand name, accent colour, handle, avatar and fonts (paths relative to the project). Always ask for them.
     Never reuse another creator's brand (colours, fonts, handle) as a default. Missing values fall back to the neutral look:
     soft lime `#E6F07C`, Inter (Latin) + Almarai (Arabic) from Google Fonts, generic labels ("AI assistant", "Studio", "made with AI").
   - `words`: what they say in that moment (transcribe the 1.8 s with whisper). Captions show 1 to 3 of them. `cover_story` and `glass_type` use `words[0]` as the big word (defaults: EDIT, STUDIO).
   - `zoom_through_cut` cuts into the next card's clip, or set `"second": <card index>`.
3. **Prepare:** `python scripts/prepare.py <project>` → frames, cut-outs, 12 thumbnails from their clips.
4. **Preview:** `node scripts/render.js <project> preview` → 3 stills per card in `<project>/prev/`. Check: face covered? caption over the mouth? cut-out edges? Fix before rendering.
5. **Render:** `node scripts/render.js <project> all` → `<project>/fx/01.mp4 …` (1.8 s each, silent). Add `orbit glass_type …` to render only some.

## Rules
- Their face, voice and clips only. Interfaces in the effects are drawn in code and carry the user's brand name (or neutral labels), no third-party logos or stock images.
- Captions in the speaker's own words, 1 to 3 words on screen, no boxes behind caption words.
- To combine cards into one reel (prompt → result, side by side, list reel), build it on top of these MP4s (for example with a video-editing skill).

Made by HibAI (Hiba, @hibssssi). Original code.
