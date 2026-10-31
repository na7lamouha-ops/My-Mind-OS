---
name: cinematic-sfx
description: Cinematic sound design and realistic object replacement for short vertical videos. Use when the user wants war / action / power sound effects (gunshot, bullet whiz, explosion, lightning, thunder, war drums), wants an existing sound replaced, or wants a flat/cartoon bullet in a video replaced by a realistic engraved one. Everything is synthesized locally with numpy/scipy + ffmpeg (no paid API, no sound library).
---

# cinematic-sfx

Proven on the ecommanita 1-November teaser (realistic bullet engraved "ECOMMANITA", war bed, rifle shot, lightning on the rays, war drums on each word).

## Workflow

1. **Look and listen first.** Make a proof sheet (`render-qc/proof-sheet`) and a spectrogram of the section:
   `ffmpeg -ss A -to B -i in.mp4 -lavfi showspectrumpic=s=1200x300:legend=1 spec.png`
   Find the exact times of each visual event (bullet appears, impact, each word) from frame brightness jumps.
2. **Sound:** copy `scripts/war_sfx.py`, edit the timeline constants at the top of each block to the new video's times, then:
   ```bash
   ffmpeg -i in.mp4 -vn -ac 2 -ar 48000 -f f32le orig.raw
   python3 scripts/war_sfx.py orig.raw new.wav 2.0      # last arg = makeup gain dB
   ```
   It mutes the original where it is replaced (`g[...]` envelope at the bottom), mixes the SFX, and runs a true-peak limiter at -2 dBTP. Tune the makeup gain until `ebur128` reads about -14 LUFS. If the script prints gain reduction above ~6 dB, lower the loud SFX gains instead of the makeup.
3. **Realistic bullet (optional):**
   ```bash
   python3 scripts/bullet_sprite.py bullet.png "ECOMMANITA"
   ```
   Then track the old object per frame (rim x, centre y, height) into `track.json` and run `scripts/replace_object.py` (its `pose()` holds the per-phase motion of the teaser; adapt it to the new video).
4. **Mux + QC:**
   ```bash
   ffmpeg -i video.mp4 -i new.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest out.mp4
   ```
   Then run `render-qc/verify-render`. A dark, stylised video will always fail `black-ratio`; that is style, not a bug.

## Rules

- Never touch the original file; write to a new file.
- Sync every hit to a frame (30 fps = 33 ms). Keep the short silence before a big impact; it makes the hit land.
- Background war sounds (artillery, machine guns) stay distant and quiet under the dialogue/typewriter.
- Tell the user you cannot hear the result: you checked it by measurement and spectrogram only.
