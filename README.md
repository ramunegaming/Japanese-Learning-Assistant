# Japanese Learning Assistant

A Twitch-integrated study platform for learning Japanese — word and sentence lookups, a persistent favourites system, and a full quiz/scoring game built to turn passive lookups into an ongoing multiplayer learning loop for stream viewers.

**Status:** Built and used during live streams
**Stack:** Node.js/Express backend, vanilla JS frontend, `tmi.js` for Twitch chat integration

## What it does

- **Word and sentence lookup**, with readings, definitions, and example sentences
- **Favourites system** — words looked up during a stream get saved and reused across quizzes and reviews
- **Four quiz engines** run directly in Twitch chat: reading, meaning, word, and fill-in-the-blank (built from real example sentences)
- **Live scoreboard** with tie handling, tracked per-viewer across the stream
- **"Revenge quiz"** mechanic — gives the last correct answerer a follow-up challenge, with streak bonuses for repeat correct answers
- **Personal word lists** (`!add`, `!remove`, `!mylist`) so viewers can build their own study list in chat
- **Auto-quiz timer** that fires periodically during active chat, keeping the game running without manual triggering

## Why I built it

I wanted studying Japanese on stream to be something viewers could take part in, not just watch — rather than looking a word up and moving on, saved words become part of a recurring quiz loop the whole chat can play along with.

## Tech overview

- Express backend handling word/sentence lookups and favourites persistence
- `tmi.js`-based Twitch bot handling commands, quiz state, and scoring
- JSON-file persistence for favourites and scores
- Frontend web app for browsing/searching words and managing favourites outside of chat