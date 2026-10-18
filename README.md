# Rekall

**A simple, local-first app for making flashcards and playing quick quizzes.**

[Open Rekall](https://adidoppalapudi.github.io/rekall/) · No account needed.

## Get started

1. Open Rekall and choose **browse starter decks** to find a deck, or create your own.
2. Open a deck and choose the question types, difficulty, quiz length, and timer.
3. Answer questions, see your score, and retry the ones you missed.

There are **29 starter decks with about 2,200 questions**, covering science, history, places, sports, stories, games, and words. Four mixed trivia decks range from Easy to Expert.

## Your decks stay yours

Decks are saved in this browser on this device. Rekall needs no account or server, and works offline after you have opened it once. To move decks between devices, export a deck to a file, then import that file on the other device.

## Make or import a deck

Create decks and questions in the app, or import one or more Rekall `.json` deck files. You can also write a deck file yourself or have an AI draft one. Each imported file can be up to 5 MB.

Rekall supports multiple-choice, true/false, and flashcard questions. Multiple-choice questions have 2–4 choices and a zero-based `correctIndex`; true/false and flashcards use an `answer` field.

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
      "tags": ["storage"],
      "explanation": "S3 is object storage."
    },
    { "type": "true_false", "prompt": "S3 stores objects.", "answer": true },
    { "type": "flashcard", "prompt": "What does IAM stand for?", "answer": "Identity and Access Management" }
  ]
}
```

For multiple choice, `correctIndex` is the position of the right choice, starting at 0. Deck files in [`src/starter-decks/`](src/starter-decks/) are ready-to-use examples.

## Run Rekall on your computer

Install [Node.js 20.19+ or 22.12+](https://nodejs.org/), then:

```bash
npm install
npm run dev
```

To build and check the app:

```bash
npm test
npm run build
```

## More

- On a phone, use **Add to Home Screen** (iPhone) or **Install app** (Android) from the live site.
- On a computer, the bottom action bar shows keyboard shortcuts; on a phone, it shows touch buttons.
- See [`src/`](src/) for the app and [`tests/`](tests/) for its tests.
- Rekall is licensed under the [MIT License](LICENSE).
