# HibAI Motions

**16 short-form video motion effects made from your own clips, by Claude.**
By Hiba ([@hibssssi](https://www.instagram.com/hibssssi/)).

Give Claude a talking-to-camera clip and it builds 1.8-second vertical effect cards: your face and voice stay real, everything around you is drawn in code, frame by frame. No stock images, no editing app.

| | | | |
|---|---|---|---|
| Orbit | Couch wall | UI world | Frame break |
| Digital zoom | Phone mockup | Checklist | Headline wall |
| Zoom-through cut | Chart grow | Pull-back reveal | Green screen |
| Paper cut | Doodle boil | Cover story | Glass type |

Every effect uses **your** brand: your name, colours, fonts, handle and avatar (set in `motions.json`). Without them it uses a neutral look (soft lime, Inter + Almarai, generic labels).

## Install

1. Copy this folder to your Claude Code skills folder:
   - Windows: `C:\Users\<you>\.claude\skills\hibai-motions`
   - Mac/Linux: `~/.claude/skills/hibai-motions`
2. Install the tools (once):
   ```bash
   pip install "rembg[cpu]" pillow
   ```
   ```bash
   npm i
   ```
   (run `npm i` inside the skill folder). You also need [ffmpeg](https://ffmpeg.org/), Python 3, Node and Google Chrome.
3. In Claude Code, say: *"make me the orbit and glass type effects from this clip"* and attach your video.

## How it works

- `scripts/prepare.py` cuts each 1.8 s moment from your clip and makes the person cut-out (with [rembg](https://github.com/danielgatis/rembg)).
- `assets/effects.html` draws the 16 effects on a canvas.
- `scripts/render.js` renders each card to an MP4 with headless Chrome.

Full instructions for Claude are in [`SKILL.md`](SKILL.md).

## License

MIT, see [LICENSE](LICENSE). Use it, change it, share it; keep the copyright line.
