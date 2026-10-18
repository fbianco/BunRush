# BUN RUSH

A burger-stacking arcade game in the spirit of the 1980s classics, played with
your whole body in front of a webcam. Made by Bianco's Labs.

## Play

1. Double-click **start.bat**. A small window opens (the local game server) and
   your browser shows the game at http://localhost:8080. Keep that window open.
2. Click **CLICK TO START** and allow the camera.
3. Stand about 2 m from the webcam so it sees you from head to hips.
4. Raise both hands to start, then stand still in the middle for a second and
   a half (calibration).

| Your body                          | In the game                         |
|------------------------------------|-------------------------------------|
| Left arm stretched out sideways    | walk left                           |
| Right arm stretched out sideways   | walk right                          |
| Both hands up                      | climb up                            |
| Squat                              | climb down                          |
| Both arms on the same side         | throw pepper towards that side      |

With body control a gesture is a command, not something you hold: the chef
keeps walking by himself, tile by tile, until the next ladder (or the end of
the floor), so camera lag never makes him miss a ladder. Stretch the other arm
to turn around at once. Keep the arm out and he walks on after a short stop at
each ladder. Raise your hands anywhere on a floor and he walks to the nearest
ladder going up and climbs one floor; stretch an arm while climbing and he
steps off that way at the next floor.

Keyboard works at any time: arrows to move, Space for pepper, Enter to start,
P pause, C recalibrate, M mute, V hide the camera panel, R retry the camera.

Walk over all four parts of a burger layer to drop it one floor. Get every
layer onto the plates to clear the level. Pepper makes enemies dizzy for a few
seconds; a falling layer squashes them; enemies riding a falling layer give a
big bonus. Every 4 drops a pepper refill appears.

## Troubleshooting

- **Black camera / "Camera blocked"**: allow the camera for localhost in the
  browser's address bar, close other apps using the webcam, then press R.
- **Slow tracking**: open http://localhost:8080/?delegate=CPU to skip the
  graphics card, or close other heavy tabs.
- **Moves when you don't want it to**: keep your arms close to your body when
  you are not giving a command. Thresholds live in `src/config.js`
  (`GESTURE`, plus `LADDER_PAUSE`). Press C to recalibrate the squat.
- **Opening index.html directly does not work**: browsers block the webcam
  and JavaScript modules for files. Always use start.bat.

## Project layout

```
index.html, css/style.css   page + camera side panel
src/main.js                  wiring + fixed-timestep loop
src/config.js                every tuning constant
src/game/                    rules: Level, NavGraph (enemy AI), Player, Enemy, Ingredient, Game, levels
src/input/                   Keyboard, PoseTracker (webcam + MediaPipe), GestureInterpreter, InputManager
src/render/                  Renderer, vector sprites, particles
src/audio/Sound.js           synthesised sound effects and music
vendor/mediapipe/            Google MediaPipe Tasks Vision 0.10.14 (Apache-2.0)
models/                      pose_landmarker_lite.task (Apache-2.0)
tests/                       automated tests (node --test "tests/*.test.mjs")
serve.ps1, start.bat         local web server for Windows, nothing to install
```

## License and third-party sources

Bun Rush's original code is licensed under the GNU General Public License,
version 3 or (at your option) any later version. See [LICENSE](LICENSE).
Third-party components are separate works and remain under their own licenses;
the Bun Rush license does not replace those terms. Sources and license details
are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), with the
applicable Apache-2.0 and SIL OFL-1.1 license texts in `LICENSES/`.

## Tests

With Node.js installed: `npm test`. The tests check the gesture rules with
synthetic skeletons, the ladder-to-ladder movement, validate every level,
and let a bot finish all levels.
