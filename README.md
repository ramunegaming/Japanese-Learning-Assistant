# Japanese Learning Assistant

A Twitch-integrated study platform for learning Japanese — word and sentence lookups, a persistent favourites system, flashcards, Kakugo-style prep tests, and a study-activity heatmap, built to turn passive lookups into an ongoing learning loop on stream.

**Status:** Actively used during "Japanese Weekends" study streams
**Stack:** Node.js/Express backend, vanilla JS frontend, `tmi.js` for Twitch chat integration

## What it does

### Study website (OBS-captured during streams)
- **Word and sentence lookup**, with readings, definitions, and example sentences with furigana
- **Favourites system** — organised by day with a date carousel; unlimited on the site, while Twitch chat only ever sees today's recent 5 to avoid spam
- **Flashcards** — flip cards (Japanese front, readings/meaning/tags back), built from any mix of days, with full kun/on readings for single kanji
- **Prep tests (P.T)** — Kakugo-style 4-option quizzes (kanji↔reading, kanji↔meaning) with Maybe/Certain confidence tracking and spaced-repetition weighting, plus scored 20-question exams with review lists and example sentences for misses
- **Kanji pools** — your favourites, fully custom checklist, or official JLPT N5–N1 sets
- **Word info tags** — parts of speech, common-word flag, JLPT level, and real JPDB corpus frequency ranks
- **Study Tracker** — Anki-style activity heatmap with streaks, daily averages, per-day breakdowns, and idle detection
- **Weak list** — most-missed kanji with one-click drills
- **Sentence mining** — bookmark example sentences for later review
- **Grammar notes** — personal pattern/meaning/example notebook with search
- **Audio** — Japanese text-to-speech on words, sentences, and flashcards

### Twitch bot (chat side, separate)
- **Four quiz engines** run directly in Twitch chat: reading, meaning, word, and fill-in-the-blank (built from real example sentences)
- **Live scoreboard** with tie handling, tracked per-viewer across the stream
- **"Revenge quiz"** mechanic — gives the last correct answerer a follow-up challenge, with streak bonuses for repeat correct answers
- **Personal word lists** (`!add`, `!remove`, `!mylist`) so viewers can build their own study list in chat
- **Auto-quiz timer** that fires periodically during active chat, keeping the game running without manual triggering

## Why I built it

I wanted studying Japanese on stream to be something viewers could take part in, not just watch — rather than looking a word up and moving on, saved words become part of flashcards, quizzes, and tests the whole chat can play along with.

## Tech overview

- Express backend handling word/sentence lookups and JSON-file persistence
- `tmi.js`-based Twitch bot handling commands, quiz state, and scoring
- Jisho API for dictionary data, kanjiapi.dev for kanji readings/JLPT sets, JPDB corpus data for word frequency ranks
- JSON-file persistence for favourites, study stats, mined sentences, and notes (all git-ignored; only code is committed)
- Vanilla JS frontend — no framework, no build step
