# SanD Hacks 2026 submission checklist

Devpost: https://sand-hacks-26.devpost.com

## Hard rules (break one = disqualified or zero)
- [ ] **Commits only Sat Nov 14 10:30 AM to Sun Nov 15 12:00 PM (Pacific).** No commits before
      or after, on any branch that ends up in the repo. Enable the guard: `git config core.hooksPath .githooks`
- [ ] Team of 1 to 4. Everyone on Slack with display name "Full Name + School".
- [ ] Everyone present at check-in, judging and awards (in person).
- [ ] **Every team member at the table during judging** (Sun 12:30 to 2:30 PM, Qualcomm Room), or the team scores zero.

## Deadlines (Sunday Nov 15)
| Time | What |
|---|---|
| 11:00 AM | Initial Devpost submission (placeholder is fine) |
| 12:00 PM | **Final submission + last commit.** Nothing changes after this |
| 12:30 to 2:30 PM | Science-fair judging: 3 min pitch + 2 min Q&A |
| 4:00 PM | Closing ceremony, WLH 2005 (deck also says "event concludes 3:00 PM"; confirm on Slack) |

Hacking space closes Sat 9 PM, reopens Sun 7 AM.

## Devpost fields
- [ ] **GitHub repo link** (must be public): create repo, `git remote add origin ...`, `git push -u origin main`
- [ ] **3-minute demo video**, public YouTube or Google Drive link (check it opens in a logged-out window)
- [ ] **Short write-up** (draft below)
- [ ] Live demo link (optional; camera + mic need HTTPS)
- [ ] Opt into every prize track you qualify for

## Judging criteria (Best Overall Hack)
Design · Functionality · Innovation · Presentation. Pitch should hit all four in 3 minutes.

## 3-minute demo / pitch outline
1. (0:00 to 0:20) Problem: learning a new STEM subject means hopping between textbooks, videos and static diagrams.
2. (0:20 to 1:00) Type "organic chemistry": timeline, topic map, worked problems appear.
3. (1:00 to 2:15) Interactive model: rotate a molecule by pinching, zoom with two hands, say "top view", swipe to switch tabs. Then a calculus surface.
4. (2:15 to 2:45) How it works: Claude generates a typed lesson spec; one command bus routes mouse, gesture and voice to every 3D scene.
5. (2:45 to 3:00) What's next.

## Write-up draft
**LessonLab** turns any subject into an explorable lesson: a history timeline of key figures and
discoveries, a topic map of the whole field, worked problems including edge cases, and a 3D
interactive model you control with hand gestures and voice. Chemistry gets molecules,
multivariable calculus gets surfaces, physics gets force diagrams.

*How we built it:* React + Vite + TypeScript, three.js via react-three-fiber, MediaPipe hand
tracking, the Web Speech API, a Hono API server, and the Claude API for structured lesson generation.

*Challenges / what we learned / what's next:* fill in on Sunday morning.

## Prize tracks that could fit (decide early; each needs real use, not a mention)
| Track | Fit | What it would take |
|---|---|---|
| ElevenLabs | Strong | Narrate timeline entries / problem walkthroughs with ElevenLabs TTS; voice already central |
| Neon (database / agent backend) | Good | Postgres cache of generated lessons keyed by (subject, level, kind); share links |
| Gemini API | Possible | Gemini as a second generation provider (must actually call the API) |
| GoDaddy Registry domain | Easy | Register a domain for the live demo |
| SpaceXSI (Cursor + Grok Bot) | Only if used | Must use both and describe how in the submission |
| DEV writing challenge | Easy | Publish one post about the project |
