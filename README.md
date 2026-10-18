# Rekall

Rekall is a local-first study app. You build decks of multiple choice, true/false and flashcard questions,
then drill them in a short, game-like quiz with streaks, points and a review of your mistakes.

Everything runs in the browser, with no server and no account. Decks live in the browser's IndexedDB, and
the app works offline once you've installed or opened it.

## Quick start

You need [Node.js](https://nodejs.org/) **20.19+ or 22.12+** (`node -v` to check).

```bash
npm install
npm run dev
```

Open the address it prints (usually http://localhost:5173). In the empty library, **starter decks** adds
any of the 22 built-in decks, with about 1,100 questions across science, history, places, sports, stories,
games, food and words. Four mixed trivia decks range from Easy to Expert.

| Command                | What it does                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run dev`          | Development server with instant reload                               |
| `npm run dev:host`     | Same, but reachable from other devices on your network               |
| `npm test`             | Runs the unit tests once (`npm run test:watch` to keep them running) |
| `npm run typecheck`    | TypeScript checks only                                               |
| `npm run build`        | Type-checks and builds the production app into `dist/`               |
| `npm run preview`      | Serves `dist/` locally, with offline support switched on             |
| `npm run preview:host` | Same, reachable from other devices                                   |

## Using it on your phone

On the same Wi-Fi, run `npm run dev:host` and open the `Network:` address it prints (for example
`http://192.168.1.20:5173`) on your phone. Windows may ask whether Node.js can use the network; allow it on
private networks. Everything works this way except offline use and installing, because browsers only allow
those on `https://` or `localhost` addresses.

To install it and use it offline, it has to be on an `https://` address. The easiest way is GitHub Pages:
push the project to a GitHub repository, then under **Settings > Pages** set **Source** to
**GitHub Actions**. The included workflow (`.github/workflows/deploy.yml`) tests, builds and publishes it on
every push to `main`, at an address like `https://you.github.io/rekall/`. Pages is free for public
repositories; a private one needs a paid GitHub plan, or use Netlify or Cloudflare Pages instead.

Any static host works the same way: run `npm run build` and upload the `dist/` folder, at the site root or in
any sub-folder. On your phone, open it and choose **Add to Home Screen** (iPhone) or **Install app**
(Android). After that first visit it opens without a connection, and picks up new versions when you're
online.

The starter decks are built in, so a new device can add them straight from the library.

Each device keeps its own decks. To move a deck between laptop and phone, **export** it on one and
**import** the file on the other. Importing a newer export of a deck you already have offers to replace it.
To bring over a folder of decks, select several files in the import picker (Ctrl+click, or Ctrl+A for all of
them). Rekall asks "replace or keep both" for each deck you already have, skips broken files without
stopping the rest, and ends with one summary of what it skipped and why.

## Using Rekall

Every screen lists its actions in the bar at the bottom. On a laptop each one shows its keyboard shortcut;
on a phone they are big buttons for your thumb.

| Screen  | Keys                                                                                                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Library | `N` new deck, `I` import, `C` switch colour palette, `Q` quick play (10 random questions from all decks)                   |
| Deck    | `S` start quiz, `A` add question, `Esc` back to the library                                                                |
| Editor  | `Ctrl+Enter` save. **save + add another** keeps the type, difficulty and tags for the next question                        |
| Quiz    | `1`–`4` (or `A`–`D`) to answer, `T`/`F` for true/false, `Space` to flip a flashcard then `Y`/`N`, `Enter` next, `Esc` quit |
| Results | `N` new quiz, `R` retry as is, `M` retry your mistakes, `Esc` exit to the deck or library                                  |

- Before a quiz you choose its length (5, 10, 20 or all), a timer (off, 10, 20 or 30 seconds), which
  question types and difficulties to include, and whether to shuffle the questions and the answer options.
- Each correct answer scores 100 points, plus 10 for every answer in a row after the first (up to +50).
- With the timer on, a correct answer also earns up to +50 for speed, in proportion to the time left.
  Running out of time counts as wrong. A flashcard has to be revealed before time runs out; rating it
  afterwards takes as long as you like. The clock can't be paused, and a reload doesn't reset it.
  Quick play is always untimed.
- A quiz in progress survives a page reload, and the title bar offers **resume quiz** if you wander off.
- On the results screen, **new quiz** draws from the same deck, or all decks for quick play, with the
  same settings and any edits you've saved. **Retry as is** repeats the exact questions and answer order.
- Deck management (edit, duplicate, export, delete) is on the deck screen and behind **more** in the library.
- **browse starter decks**, under the deck list, adds any built-in deck you don't have yet.
- Search titles and descriptions or choose a category in the library and starter-deck picker. **Start here**
  contains a curated selection, with no popularity tracking. Choose individual decks or **select shown**;
  the add button always shows the total selected, including choices kept while changing filters.
- Questions can be Easy, Medium, Hard or Expert. There is no fixed question-count cap on a deck;
  imported files can be up to 5 MB. Short explanations add context after an answer.
- `C` cycles through three colour palettes: classic blue, sycamore (green) and a light one, cloud. Each
  device remembers its choice.

## Deck files

Exports are plain JSON, so you can also write decks by hand (or have an AI draft one) and import them:

```json
{
  "format": "rekall-deck",
  "version": 1,
  "deck": { "name": "AWS Basics", "description": "Core services" },
  "questions": [
    {
      "type": "multiple_choice",
      "prompt": "Which service stores objects?",
      "choices": ["EC2", "S3", "RDS", "Lambda"],
      "correctIndex": 1,
      "explanation": "S3 is object storage; EC2 is virtual machines.",
      "difficulty": "easy",
      "tags": ["storage"]
    },
    { "type": "true_false", "prompt": "Lambda functions run without servers to manage.", "answer": true },
    { "type": "flashcard", "prompt": "What does IAM stand for?", "answer": "Identity and Access Management" }
  ]
}
```

- Every question needs `type` and `prompt`. Multiple choice also needs `choices` (2–4) and `correctIndex`
  (counting from 0). True/false and flashcards need `answer` (`true`/`false`, or the answer text).
- `explanation`, `difficulty` (`easy`, `medium`, `hard`, `expert`) and `tags` are optional.
- Hand-written files can leave out `format`, `version` and the deck `id`. They can also put `name` and
  `description` at the top level instead of inside `deck`, and give a multiple choice answer as text
  (`"answer": "S3"`) instead of `correctIndex`.
- A file with any invalid question is rejected as a whole, with a list of what to fix. When you import
  several files at once, the summary shows the first problem in each rejected file; import that file on
  its own to see the full list.
- The starter decks in `src/starter-decks/` are complete examples, and those files import like any other.
  A deck file added to that folder becomes a starter deck in the next build.

## Project structure

```text
src/
  models/      Deck and question types, plus the validation shared by the editor, store and import
  db/          DataStore interface and its IndexedDB implementation (schema in idb.ts)
  quiz/        Quiz engine: picking questions, scoring, streaks, results (pure functions)
  io/          Deck file format, importing one or many files, starter decks, browser file helpers
  starter-decks/  The built-in decks, as ordinary deck files
  app/         Hash router, quiz state and the status line
  components/  Reusable UI: screen frame, key bar, dialogs, form fields, meters
  views/       The five screens: Library, Deck, Question editor, Quiz, Results
  hooks/       useAsync (loading data) and useHotkeys (keyboard shortcuts)
  pwa/         Service worker registration
  styles.css   The whole look, driven by colour variables (one block per palette)
public/
  sw.js        Service worker that caches the app for offline use
  manifest.webmanifest, icons/
tests/         Vitest unit tests (the store tests run against fake-indexeddb)
.github/       Workflow that publishes the app to GitHub Pages
```

## How it fits together

- **Views never touch IndexedDB directly.** They call the `DataStore` interface in `src/db/DataStore.ts`.
  `src/db/index.ts` picks the implementation, so adding a backend later means writing one class that
  talks to your API and swapping it in there.
- **The data model is two collections.** `decks`, and `questions` linked by `deckId`. That maps directly
  onto two PostgreSQL tables if you add a server.
- **To change the database schema,** bump `DB_VERSION` in `src/db/idb.ts` and add an
  `if (event.oldVersion < N)` block for the new version. Existing installs upgrade automatically.
- **The quiz engine is plain functions** in `src/quiz/engine.ts`. A quiz session is data, and each action
  returns a new session, which keeps it easy to test and to extend.
- **Adding a question type** touches `models/types.ts` (its shape), `models/validation.ts` (its rules), the
  editor form, and one answer component in `views/QuizView.tsx`. TypeScript points at every `switch`
  that needs a new case.
- **Offline support** only runs in production builds, so it never serves you a stale page while developing.

## Your data

Decks live in this browser's storage for this site, separately on each device and browser. Clearing the
site's data, or uninstalling the app, deletes them, so export decks you care about now and then. On iPhone,
add Rekall to the Home Screen. Safari may clear storage for websites you haven't opened in a week, but not
for installed apps.
