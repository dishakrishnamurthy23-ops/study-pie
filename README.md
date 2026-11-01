# Study Pie

My MERN + GATE DA + GRE study plan as hand-drawn pie wheels.

## Files
| File | What it is |
|---|---|
| `index.html` | The page layout |
| `style.css` | Look and feel |
| `config.js` | **Colours, study times, subject doodles, countdowns. Edit this one for quick changes.** |
| `plan-data.js` | Every study block, day by day (from the Word/Excel plans) |
| `app.js` | How the app works (wheels, ticks, saving) |
| `manifest.webmanifest` | App name and icon, so phones can install it |
| `sw.js` | Lets the app open without internet |

## Changing things
Most changes happen **inside the app**, no code needed:
- ✏️ **Edit block** (inside any block): title, date, times, task text, steps, delete
- **+ Add a study block** on any day
- **Log → Settings**: study times, countdowns, ⏩ I'm behind (push a track forward, with undo), reset to the original plan
- **Log → Checklists / Mistakes / Mocks**: add, rename, tick, delete anything

Bigger changes (new colours, doodles, subjects) go in `config.js`.

## Your data
Your ticks are saved in the browser of each device, not in this repository.
Use **Download backup** / **Load backup** at the bottom of the app to keep a copy or move phones.
