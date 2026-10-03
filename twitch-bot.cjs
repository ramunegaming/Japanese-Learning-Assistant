require('dotenv').config();

const express = require('express');
const cheerio = require('cheerio');
const fetch = require('node-fetch').default;
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const tmi = require('tmi.js');

const userMessageCount = {};

const app = express();
const PORT = 3001;
const DATA_FILE = path.join(__dirname, 'favorites.json');
const SCORES_FILE = path.join(__dirname, 'scores.json');

let scores = {};

loadScores().then(() => console.log('Scores loaded'));

// Load scores from JSON file
async function loadScores() {
    try {
        const raw = await fs.readFile(SCORES_FILE, 'utf8');
        scores = JSON.parse(raw);
    } catch (err) {
        if (err.code === 'ENOENT') {
            // File doesn't exist, create it
            await fs.writeFile(SCORES_FILE, JSON.stringify({}));
            scores = {};
        } else {
            console.error('Error loading scores.json:', err);
            scores = {};
        }
    }
}

// Save scores to JSON file
async function saveScores() {
    try {
        await fs.writeFile(SCORES_FILE, JSON.stringify(scores, null, 2));
    } catch (err) {
        console.error('Error saving scores.json:', err);
    }
}

// Enable CORS for all routes
app.use(cors());

// Serve static files from the public directory
app.use(express.static('public'));

// Middleware to parse JSON bodies
app.use(express.json());

// Function to load favorites from file
async function loadFavorites() {
    try {
        const raw = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Create file and treat as "no favorites yet"
            await fs.writeFile(DATA_FILE, '[]');
            return [];
        }

        console.error('Error loading favorites:', error);
        return [];
    }
}

// Function to save favorites
async function saveFavorites(favorites) {
    await fs.writeFile(DATA_FILE, JSON.stringify(favorites, null, 2));
}

// Endpoint to search for sentences
app.get('/api/search/sentences', async (req, res) => {
    try {
        const keyword = req.query.keyword;

        if (!keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }

        const response = await fetch(
            `https://jisho.org/search/${encodeURIComponent(keyword)}%20%23sentences`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch from Jisho');
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const sentences = [];

        $('.sentence_content').each((i, elem) => {
            const japanese = $(elem)
                .find('.japanese_sentence')
                .text()
                .trim();

            const english = $(elem)
                .find('.english_sentence')
                .text()
                .trim();

            if (japanese && english) {
                sentences.push({
                    japanese,
                    english
                });
            }
        });

        res.json({ data: sentences });
    } catch (error) {
        console.error('Error searching sentences:', error);
        res.status(500).json({
            error: 'Failed to search for sentences'
        });
    }
});

// Endpoint to search for words
app.get('/api/search/words', async (req, res) => {
    try {
        const keyword = req.query.keyword;

        if (!keyword) {
            return res.status(400).json({
                error: 'Keyword is required'
            });
        }

        const response = await fetch(
            `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch from Jisho API');
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error searching words:', error);
        res.status(500).json({
            error: 'Failed to search for words'
        });
    }
});

// Endpoint to get favorites
app.get('/api/favorites', async (req, res) => {
    try {
        const favorites = await loadFavorites();
        res.json(favorites);
    } catch (error) {
        console.error('Error loading favorites:', error);
        res.status(500).json({
            error: 'Failed to load favorites'
        });
    }
});

// Endpoint to add a favorite
app.post('/api/favorites', async (req, res) => {
    try {
        const { word, reading, meaning } = req.body;

        if (!word || !reading || !meaning) {
            return res.status(400).json({
                error: 'Word, reading, and meaning are required'
            });
        }

        const favorites = await loadFavorites();

        favorites.push({
            word,
            reading,
            meaning
        });

        await saveFavorites(favorites);

        res.json({
            message: 'Favorite added successfully'
        });
    } catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({
            error: 'Failed to add favorite'
        });
    }
});

// Endpoint to remove a favorite
app.delete('/api/favorites/:word', async (req, res) => {
    try {
        const wordToRemove = req.params.word;
        const favorites = await loadFavorites();

        const updatedFavorites = favorites.filter(
            fav => fav.word !== wordToRemove
        );

        await saveFavorites(updatedFavorites);

        res.json({
            message: 'Favorite removed successfully'
        });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({
            error: 'Failed to remove favorite'
        });
    }
});

// Endpoint to sync favorites
app.post('/api/favorites/sync', async (req, res) => {
    try {
        const { favorites } = req.body;

        if (!Array.isArray(favorites)) {
            return res.status(400).json({
                error: 'Favorites must be an array'
            });
        }

        await fs.writeFile(
            DATA_FILE,
            JSON.stringify(favorites, null, 2)
        );

        res.json({
            success: true
        });
    } catch (error) {
        console.error('Error syncing favorites:', error);
        res.status(500).json({
            error: 'Failed to sync favorites'
        });
    }
});

// Twitch client
const client = new tmi.Client({
    options: {
        debug: true
    },
    identity: {
        username: 'ramunebot',
        password: process.env.TWITCH_OAUTH
    },
    channels: ['#ramunegaming']
});

// --- !followage helpers (paste only, don't edit anything else) ---
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_TOKEN = (process.env.TWITCH_OAUTH || '').replace(/^oauth:/i, '');

async function getTwitchUserId(login) {
  const clean = login.replace(/^@/, '').toLowerCase();
  const res = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(clean)}`, {
    headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${TWITCH_TOKEN}` }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `users lookup failed: ${res.status}`);
  return data.data?.[0] || null;
}

async function getFollowAt(broadcasterId, userId) {
  const res = await fetch(
    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&user_id=${userId}`,
    { headers: { 'Client-ID': TWITCH_CLIENT_ID, 'Authorization': `Bearer ${TWITCH_TOKEN}` } }
  );
  if (res.status === 401 || res.status === 403) {
    const err = new Error('auth'); err.code = res.status; throw err;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `followers lookup failed: ${res.status}`);
  return data.data?.[0]?.followed_at || null;
}

function formatFollowAge(followedAt) {
  const start = new Date(followedAt);
  let diff = Date.now() - start.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const d = (days % 365) % 30;
  const h = hours % 24;
  const m = mins % 60;
  const parts = [];
  if (years) parts.push(`${years} year${years > 1 ? 's' : ''}`);
  if (months) parts.push(`${months} month${months > 1 ? 's' : ''}`);
  if (d) parts.push(`${d} day${d > 1 ? 's' : ''}`);
  if (h) parts.push(`${h} hour${h > 1 ? 's' : ''}`);
  if (!parts.length) parts.push(`${Math.max(m, 1)} minute${m === 1 ? '' : 's'}`);
  return parts.join(' ');
}

async function handleFollowageCommand(channel, tags, args) {
  const currentChannelName = channel.replace(/^#/, '');
  let targetUserName = tags.username;
  let targetChannelName = currentChannelName;
  if (args.length >= 1 && args[0]) targetUserName = args[0].replace(/^@/, '');
  if (args.length >= 2 && args[1]) targetChannelName = args[1].replace(/^@/, '').replace(/^#/, '');
  try {
    const [user, broadcaster] = await Promise.all([
      getTwitchUserId(targetUserName),
      getTwitchUserId(targetChannelName)
    ]);
    if (!user) { client.say(channel, `@${tags.username}, Could not find Twitch user "${targetUserName}"`); return; }
    if (!broadcaster) { client.say(channel, `@${tags.username}, Could not find Twitch channel "${targetChannelName}"`); return; }
    const followedAt = await getFollowAt(broadcaster.id, user.id);
    if (!followedAt) { client.say(channel, `@${tags.username}, ${user.display_name} is not following ${broadcaster.display_name}.`); return; }
    const age = formatFollowAge(followedAt);
    const followDate = new Date(followedAt).toDateString();
    client.say(channel, `@${tags.username}, ${user.display_name} has been following ${broadcaster.display_name} for ${age} (since ${followDate}).`);
  } catch (err) {
    console.error('!followage error:', err);
    if (err.code === 401 || err.code === 403) {
      client.say(channel, `@${tags.username}, I can't check followage - my token needs moderator:read:followers and I need to be mod in ${targetChannelName}.`);
    } else {
      client.say(channel, `@${tags.username}, Sorry, couldn't check followage right now.`);
    }
  }
}

// Command handlers
const handleJishoCommand = async (channel, tags, message) => {
    try {
        const args = message.slice(7).trim();

        if (!args) {
            client.say(
                channel,
                "Please provide a word to search! Usage: !jisho [word]"
            );
            return;
        }

        const response = await fetch(
            `http://localhost:3001/api/search/words?keyword=${encodeURIComponent(args)}`
        );

        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const result = data.data[0];

            const reading =
                result.japanese[0].reading ||
                result.japanese[0].word ||
                'N/A';

            const meaning =
                result.senses[0].english_definitions.join(', ');

            client.say(
                channel,
                `${args}: ${reading} - ${meaning}`
            );
        } else {
            client.say(
                channel,
                `No results found for "${args}"`
            );
        }
    } catch (error) {
        console.error('Error in !jisho command:', error);

        client.say(
            channel,
            "Sorry, there was an error processing your request."
        );
    }
};

const handleJapaneseReviewCommand = async (channel) => {
    try {
        const favorites = await loadFavorites();

        if (favorites.length === 0) {
            client.say(
                channel,
                'No Japanese words saved yet!'
            );
            return;
        }

        const recentFavorites = favorites.slice(-5);

        const processedFavorites = recentFavorites.map(fav => {
            const cleanMeaning = fav.meaning
                .replace(/\s\*\*\(([^)]*)\)\*\*/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            return {
                ...fav,
                cleanMeaning
            };
        });

        const wordList = processedFavorites
            .map(fav => {
                const wordDisplay = containsKanji(fav.word)
                    ? `${fav.word} (${fav.reading})`
                    : fav.word;

                return `${wordDisplay} ${fav.cleanMeaning}`;
            })
            .join(' || ');

        client.say(
            channel,
            `Latest Japanese Words: ${wordList}`
        );
    } catch (error) {
        console.error(
            'Error in japanesereview command:',
            error
        );

        client.say(
            channel,
            'Sorry, something went wrong!'
        );
    }
};

const handleQuizCommand = async (
    channel,
    givesPoints = true,
    forcedWord = null
) => {
    try {
        if (currentQuiz) {
            client.say(
                channel,
                "⚠️ A quiz is already active!"
            );
            return;
        }

        const favorites = await loadFavorites();

        if (!favorites.length) {
            client.say(
                channel,
                "No words available for quiz yet!"
            );
            return;
        }

        const recent = favorites.slice(-5);

        const correct =
            forcedWord ||
            recent[Math.floor(Math.random() * recent.length)];

        const others = favorites.filter(
            f => f.word !== correct.word
        );

        if (others.length < 3) {
            client.say(
                channel,
                "Not enough words for quiz yet!"
            );
            return;
        }

        const uniqueReadings = [
            ...new Set(
                others
                    .map(f => f.reading)
                    .filter(Boolean)
            )
        ];

        if (uniqueReadings.length < 3) {
            client.say(
                channel,
                'Not enough unique readings for this quiz!'
            );
            return;
        }

        const wrongAnswers =
            shuffleArray(uniqueReadings).slice(0, 3);

        const options = shuffleArray([
            correct.reading,
            ...wrongAnswers
        ]);

        const correctIndex =
            options.indexOf(correct.reading);

        currentQuiz = {
            correctAnswer: correctIndex,
            answerText: correct.reading,
            word: correct.word,
            givesPoints,
            type: 'reading',
            favorite: correct
        };

        answeredUsers.clear();

        const label = givesPoints
            ? "🏆 Quiz!"
            : "📘 Practice Quiz!";

        // timeout (2 mins)
        quizTimeout = setTimeout(() => {
            if (currentQuiz) {
                client.say(
                    channel,
                    `⏱️ Time's up! The answer was "${currentQuiz.answerText}"`
                );

                currentQuiz = null;
                currentRevengeUser = null;
                quizTimeout = null;
            }
        }, 120000);

        client.say(
            channel,
            `${label} What is the reading of "${correct.word}"?\na) ${options[0]} | b) ${options[1]} | c) ${options[2]} | d) ${options[3]}`
        );
    } catch (error) {
        console.error('Quiz error:', error);

        client.say(
            channel,
            "Something went wrong with the quiz!"
        );
    }
};

const handleMeaningQuiz = async (
    channel,
    givesPoints = true,
    forcedWord = null
) => {
    try {
        if (currentQuiz) return;

        const favorites = await loadFavorites();

        if (favorites.length < 4) return;

        const correct =
            forcedWord ||
            favorites[Math.floor(Math.random() * favorites.length)];

        const others = favorites.filter(
            f => f.word !== correct.word
        );

        const uniqueMeanings = [
            ...new Set(
                others
                    .map(f => f.meaning)
                    .filter(Boolean)
            )
        ];

        if (uniqueMeanings.length < 3) {
            client.say(channel, "Not enough unique meanings for this quiz!");
            return;
        }

        const wrongAnswers = shuffleArray(uniqueMeanings).slice(0, 3);

        const options = shuffleArray([
            correct.meaning,
            ...wrongAnswers
        ]);

        const correctIndex =
            options.indexOf(correct.meaning);

        currentQuiz = {
            correctAnswer: correctIndex,
            answerText: correct.meaning,
            word: correct.word,
            givesPoints,
            type: 'meaning',
            favorite: correct
        };

        answeredUsers.clear();

        const label = givesPoints
            ? "🏆 Quiz!"
            : "📘 Practice Quiz!";

        quizTimeout = setTimeout(() => {
            if (currentQuiz) {
                client.say(
                    channel,
                    `⏱️ Time's up! The answer was ${currentQuiz.answerText}`
                );

                currentQuiz = null;
                currentRevengeUser = null;
            }
        }, 120000);

        client.say(
            channel,
            `${label} What does "${correct.word}" mean?\na) ${options[0]} | b) ${options[1]} | c) ${options[2]} | d) ${options[3]}`
        );
    } catch (err) {
        console.error(
            'Meaning quiz error:',
            err
        );
    }
};

const handleWordQuiz = async (
    channel,
    givesPoints = true,
    forcedWord = null
) => {
    try {
        if (currentQuiz) return;

        const favorites = await loadFavorites();

        if (favorites.length < 4) return;

        const correct =
            forcedWord ||
            favorites[Math.floor(Math.random() * favorites.length)];

        const others = favorites.filter(
            f => f.word !== correct.word
        );

        const uniqueWords = [
            ...new Set(
                others
                    .map(f => f.word)
                    .filter(Boolean)
            )
        ];

        if (uniqueWords.length < 3) {
            client.say(channel, "Not enough unique words for this quiz!");
            return;
        }

        const wrong = shuffleArray(uniqueWords).slice(0, 3);

        const options = shuffleArray([
            correct.word,
            ...wrong
        ]);

        const correctIndex =
            options.indexOf(correct.word);

        currentQuiz = {
            correctAnswer: correctIndex,
            answerText: correct.word,
            word: correct.word,
            givesPoints,
            type: 'word',
            favorite: correct
        };

        answeredUsers.clear();

        const label = givesPoints
            ? "🏆 Quiz!"
            : "📘 Practice Quiz!";

        quizTimeout = setTimeout(() => {
            if (currentQuiz) {
                client.say(
                    channel,
                    `⏱️ Time's up! The answer was ${currentQuiz.answerText}`
                );

                currentQuiz = null;
                currentRevengeUser = null;
            }
        }, 120000);

        client.say(
            channel,
            `${label} Which word means "${correct.meaning}"?\na) ${options[0]} | b) ${options[1]} | c) ${options[2]} | d) ${options[3]}`
        );
    } catch (err) {
        console.error(
            'Word quiz error:',
            err
        );
    }
};

// --- Fill-in-the-Blank Quiz ---
const handleFillBlankQuiz = async (
    channel,
    givesPoints = true,
    forcedWord = null
) => {
    try {
        if (currentQuiz) return;

        const favorites = await loadFavorites();

        if (favorites.length < 4) return;

        let quizWord = forcedWord || null;
        let sentence = null;

        // If not forced, try to find a word with a short sentence
        if (!quizWord) {
            const shuffledFavorites =
                shuffleArray([...favorites]);

            for (const wordItem of shuffledFavorites) {
                const response = await fetch(
                    `http://localhost:3001/api/search/sentences?keyword=${encodeURIComponent(wordItem.word)}`
                );

                const data = await response.json();

                let sentences = data.data || [];

                // Filter short sentences (max 20 chars)
                sentences = sentences.filter(
                    s =>
                        s.japanese.length <= 20 &&
                        s.japanese.includes(wordItem.word)
                );

                if (sentences.length) {
                    sentence =
                        sentences[
                            Math.floor(
                                Math.random() * sentences.length
                            )
                        ];

                    quizWord = wordItem;
                    break;
                }
            }

            if (!quizWord) return;
        }

        // If forcedWord was passed, fetch its sentence
        if (forcedWord && !sentence) {
            const response = await fetch(
                `http://localhost:3001/api/search/sentences?keyword=${encodeURIComponent(quizWord.word)}`
            );

            const data = await response.json();

            const sentences =
                (data.data || []).filter(
                    s =>
                        s.japanese.length <= 20 &&
                        s.japanese.includes(quizWord.word)
                );

            if (!sentences.length) return;

            sentence =
                sentences[
                    Math.floor(
                        Math.random() * sentences.length
                    )
                ];
        }

        const quizSentence =
            sentence.japanese.replace(
                quizWord.word,
                '___'
            );

        // Prepare wrong options
        const others = favorites.filter(
            f => f.word !== quizWord.word
        );

        const wrongAnswers = [];

        while (wrongAnswers.length < 3 && others.length) {
            const rand = others[Math.floor(Math.random() * others.length)];

            if (!wrongAnswers.includes(rand.word)) {
                wrongAnswers.push(rand.word);
            }
        }

        const options = shuffleArray([
            quizWord.word,
            ...wrongAnswers
        ]);

        const correctIndex =
            options.indexOf(quizWord.word);

        currentQuiz = {
            correctAnswer: correctIndex,
            answerText: quizWord.word,
            word: quizWord.word,
            givesPoints,
            type: 'fillblank',
            favorite: quizWord
        };

        answeredUsers.clear();

        const label = givesPoints
            ? "🏆 Fill-in-the-Blank Quiz!"
            : "📘 Practice Fill-in-the-Blank Quiz!";

        // 2-minute timeout
        quizTimeout = setTimeout(() => {
            if (currentQuiz) {
                client.say(
                    channel,
                    `⏱️ Time's up! The answer was "${currentQuiz.answerText}"`
                );

                currentQuiz = null;
                currentRevengeUser = null;
            }
        }, 120000);

        client.say(
            channel,
            `${label} ${quizSentence}\na) ${options[0]} | b) ${options[1]} | c) ${options[2]} | d) ${options[3]}`
        );
    } catch (err) {
        console.error(
            'Fill-in-the-Blank quiz error:',
            err
        );
    }
};

const handleHelpCommand = (channel) => {
    client.say(
        channel,
        '📖 Commands: !jisho [word] - look up a word | !japanesereview - see the latest 5 words | !scoreboard - view the leaderboard | !discord - Discord link | !japanesemode - toggle auto quizzes | !mylist - view your word list | !add [word] - add a Japanese word | !remove [word] - remove a word from your list | 🔒 Follow the channel to receive private results and notes via Twitch whispers!'
    );
};

// Revenge quiz trigger
async function triggerRevengeQuiz(channel, triggeredBy, revengeWord) {
    if (!revengeWord || currentQuiz) return;

    const types = [
        'reading',
        'meaning',
        'word'
    ];

    const available = types.filter(
        t => t !== revengeWord.type
    );

    const nextType =
        available[
            Math.floor(
                Math.random() * available.length
            )
        ];

    client.say(
        channel,
        `⚔️ Revenge Quiz! This one is for @${triggeredBy}, but everyone can answer and play along!`
    );

    switch (nextType) {
        case 'reading':
            await handleQuizCommand(
                channel,
                false,
                revengeWord
            );
            break;

        case 'meaning':
            await handleMeaningQuiz(
                channel,
                false,
                revengeWord
            );
            break;

        case 'word':
            await handleWordQuiz(
                channel,
                false,
                revengeWord
            );
            break;
    }

    if (currentQuiz) {
        currentRevengeUser = triggeredBy;
    }
}

async function safeWhisper(username, message) {
    if (username === 'ramunebot') return;

    try {
        // Get the bot's user ID from its access token
        const botRes = await fetch(
            'https://id.twitch.tv/oauth2/validate',
            {
                headers: {
                    'Authorization': `Bearer ${process.env.TWITCH_OAUTH}`
                }
            }
        );

        const botData = await botRes.json();

        if (!botRes.ok) {
            throw new Error(
                `Token validation failed: ${botData.message}`
            );
        }

        const botUserId = botData.user_id;

        // Get the recipient's Twitch user ID
        const userRes = await fetch(
            `https://api.twitch.tv/helix/users?login=${encodeURIComponent(username)}`,
            {
                headers: {
                    'Client-ID': process.env.TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${process.env.TWITCH_OAUTH}`
                }
            }
        );

        const userData = await userRes.json();

        if (
            !userRes.ok ||
            !userData.data?.length
        ) {
            throw new Error(
                `Could not find Twitch user: ${username}`
            );
        }

        const targetUserId =
            userData.data[0].id;

        // Send the whisper
        const whisperRes = await fetch(
            `https://api.twitch.tv/helix/whispers?from_user_id=${botUserId}&to_user_id=${targetUserId}`,
            {
                method: 'POST',
                headers: {
                    'Client-ID': process.env.TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${process.env.TWITCH_OAUTH}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: message
                })
            }
        );

        if (!whisperRes.ok) {
            const errorData =
                await whisperRes.text();

            throw new Error(
                `Whisper failed (${whisperRes.status}): ${errorData}`
            );
        }

        console.log(
            `Whisper sent: ${botData.login} → ${username}`
        );
    } catch (err) {
        console.error(
            `Failed to whisper ${username}:`,
            err
        );
    }
}

// Message event
client.on(
    'message',
    async (channel, tags, message, self) => {
if (self) return;

if (message.toLowerCase() === '!followage' || message.toLowerCase().startsWith('!followage ')) {
  const args = message.trim().split(/\s+/).slice(1);
  await handleFollowageCommand(channel, tags, args);
  return;
}

        lastMessageTime = Date.now();

        const username = tags.username;
        const now = Date.now();

        userMessageCount[username] =
            (userMessageCount[username] || [])
                .concat(now)
                .filter(
                    ts =>
                        ts >
                        now -
                        15 *
                        60 *
                        1000
                );

        const lower =
            message.toLowerCase();

        if (
            currentQuiz &&
            /^[abcd]$/.test(lower)
        ) {
            if (
                answeredUsers.has(
                    tags.username
                )
            ) {
                return;
            }

            answeredUsers.add(
                tags.username
            );

            const userAnswer =
                lower.charCodeAt(0) - 97;

            const isCorrect =
                userAnswer ===
                currentQuiz.correctAnswer;

            if (isCorrect) {
                if (currentRevengeUser) {
                    // Everyone can answer the revenge quiz,
                    // but only the target user gets points.
                    if (
                        tags.username !==
                        currentRevengeUser
                    ) {
                        if (
                            tags.username !==
                            'ramunebot'
                        ) {
                            safeWhisper(
                                tags.username,
                                `⚔️ This revenge quiz is just for @${currentRevengeUser}, but you got it right! 🎉`
                            );
                        }

                        return;
                    }

                    // Target user got it correct
                    revengeQuizCount[
                        tags.username
                    ] =
                        (
                            revengeQuizCount[
                                tags.username
                            ] || 0
                        ) + 1;

                    const oldScore =
                        scores[
                            tags.username
                        ] || 0;

                    // Get their current rank before awarding the bonus point
                    const getRank =
                        (username) => {
                            const entries =
                                Object.entries(
                                    scores
                                ).sort(
                                    (a, b) =>
                                        b[1] - a[1]
                                );

                            const userScore =
                                scores[
                                    username
                                ] || 0;

                            return (
                                entries.filter(
                                    ([user, score]) =>
                                        score >
                                        userScore
                                ).length + 1
                            );
                        };

                    const oldRank =
                        getRank(
                            tags.username
                        );

                    if (
                        revengeQuizCount[
                            tags.username
                        ] %
                            2 ===
                        0
                    ) {
                        scores[
                            tags.username
                        ] =
                            oldScore + 1;

                        await saveScores();

                        safeWhisper(
                            tags.username,
                            `⚔️ This revenge quiz is just for you! 🎉 Correct! Streak bonus! +1 extra point!`
                        );
                    } else {
                        safeWhisper(
                            tags.username,
                            `⚔️ This revenge quiz is just for you! ✅ Correct! (1/2 towards bonus point)`
                        );
                    }

                    // Get their rank after awarding the point
                    const newEntries =
                        Object.entries(
                            scores
                        ).sort(
                            (a, b) =>
                                b[1] - a[1]
                        );

                    const newRank =
                        getRank(
                            tags.username
                        );

                    const newScore =
                        scores[
                            tags.username
                        ];

                    // Only announce publicly if their rank changed
                    if (
                        newRank !==
                        oldRank
                    ) {
                        const passedUsers =
                            newEntries
                                .slice(
                                    0,
                                    newRank - 1
                                )
                                .filter(
                                    ([user, score]) =>
                                        user !==
                                            tags.username &&
                                        score <
                                            newScore
                                )
                                .map(
                                    ([user]) =>
                                        user
                                );

                        if (
                            passedUsers.length >
                            0
                        ) {
                            client.say(
                                channel,
                                `🏆 @${tags.username} answered the revenge quiz correctly and moved up to ${newRank}${getRankSuffix(newRank)} place, passing @${passedUsers.join(' and @')}!`
                            );
                        } else {
                            client.say(
                                channel,
                                `🏆 @${tags.username} answered the revenge quiz correctly and moved up to ${newRank}${getRankSuffix(newRank)} place!`
                            );
                        }
                    } else {
                        // Rank didn't change, so tell them privately
                        safeWhisper(
                            tags.username,
                            `⚔️ Revenge quiz complete! You're currently ${newRank}${getRankSuffix(newRank)} place with ${newScore} point${newScore === 1 ? '' : 's'}.`
                        );
                    }

                    currentRevengeUser =
                        null;
                } else {
                    if (
                        currentQuiz.givesPoints
                    ) {
                        scores[
                            tags.username
                        ] =
                            (
                                scores[
                                    tags.username
                                ] || 0
                            ) + 1;

                        await saveScores();

                        safeWhisper(
                            tags.username,
                            `✅ Correct! (+1 point)`
                        );
                    } else {
                        safeWhisper(
                            tags.username,
                            `✅ Correct! (practice mode)`
                        );
                    }
                }

                lastCorrect = {
                    ...currentQuiz.favorite,
                    type: currentQuiz.type
                };

                if (quizTimeout) {
                    clearTimeout(
                        quizTimeout
                    );

                    quizTimeout = null;
                }

                currentQuiz = null;
                currentRevengeUser = null;

                // 20% chance for revenge quiz
                if (
                    lastCorrect &&
                    Math.random() < 0.2
                ) {
                    const revengeUser = tags.username;
                    const revengeWord = { ...lastCorrect };

                    setTimeout(() => {
                        triggerRevengeQuiz(
                            channel,
                            revengeUser,
                            revengeWord
                        );
                    }, 25 * 60 * 1000);
                }
            } else {
                client.say(
                    channel,
                    `@${tags.username} ❌ Wrong! Try again next time.`
                );
            }

            return;
        }

        if (
            lower.startsWith('!add ')
        ) {
            const word =
                message.slice(5).trim();

            if (!word) {
                client.say(
                    channel,
                    "Usage: !add [word]"
                );
                return;
            }

            try {
                const res =
                    await fetch(
                        `http://localhost:3001/api/search/words?keyword=${encodeURIComponent(word)}`
                    );

                const data =
                    await res.json();

                if (
                    !data.data ||
                    !data.data.length
                ) {
                    safeWhisper(
                        tags.username,
                        `❌ Could not find "${word}" on Jisho.`
                    );
                    return;
                }

                const result =
                    data.data[0];

                const japaneseEntry =
                    result.japanese &&
                    result.japanese[0];

                const displayWord =
                    japaneseEntry?.word ||
                    word;

                const reading =
                    japaneseEntry?.reading ||
                    displayWord;

                const meaning =
                    result.senses?.[0]
                        ?.english_definitions
                        ?.join(', ') ||
                    'No definition found';

                userLists[
                    tags.username
                ] =
                    userLists[
                        tags.username
                    ] || [];

                const alreadyExists =
                    userLists[
                        tags.username
                    ].some(item =>
                        (
                            typeof item ===
                            'string'
                                ? item
                                : item.word
                        )
                            .toLowerCase() ===
                        displayWord.toLowerCase()
                    );

                if (alreadyExists) {
                    safeWhisper(
                        tags.username,
                        `⚠️ "${displayWord}" is already in your list!`
                    );
                    return;
                }

                userLists[
                    tags.username
                ].push({
                    word: displayWord,
                    reading: reading,
                    meaning: meaning
                });

                // Keep personal lists limited to 10 words
                if (
                    userLists[
                        tags.username
                    ].length > 10
                ) {
                    userLists[
                        tags.username
                    ].shift();

                    safeWhisper(
                        tags.username,
                        `📚 Your list is full, so your oldest word was removed. "${displayWord}" was added!`
                    );
                } else {
                    safeWhisper(
                        tags.username,
                        `Added "${displayWord}" to your list!`
                    );
                }
            } catch (err) {
                console.error(
                    'Error adding word:',
                    err
                );

                safeWhisper(
                    tags.username,
                    `❌ Couldn't look up that word on Jisho.`
                );
            }

            return;
        }

        // !remove command
        if (
            lower.startsWith('!remove ')
        ) {
            const word =
                message.slice(8).trim();

            if (!word) {
                safeWhisper(
                    tags.username,
                    'Usage: !remove [word]'
                );
                return;
            }

            const list =
                userLists[
                    tags.username
                ] || [];

            const index =
                list.findIndex(item =>
                    (
                        typeof item ===
                        'string'
                            ? item
                            : item.word
                    )
                        .toLowerCase() ===
                    word.toLowerCase()
                );

            if (index === -1) {
                safeWhisper(
                    tags.username,
                    `❌ "${word}" is not in your list.`
                );
                return;
            }

            const removed =
                list.splice(index, 1)[0];

            const removedWord =
                typeof removed ===
                'string'
                    ? removed
                    : removed.word;

            safeWhisper(
                tags.username,
                `🗑️ Removed "${removedWord}" from your list!`
            );

            return;
        }

        // !streamer command
        if (
            lower.startsWith('!streamer ')
        ) {
            const streamer =
                message
                    .split(' ')[1]
                    ?.replace('@', '')
                    .trim()
                    .toLowerCase();

            if (!streamer) {
                client.say(
                    channel,
                    'Usage: !streamer username'
                );
                return;
            }

            try {
                const userRes =
                    await fetch(
                        `https://api.twitch.tv/helix/users?login=${encodeURIComponent(streamer)}`,
                        {
                            method: 'GET',
                            headers: {
                                'Client-ID':
                                    process.env
                                        .TWITCH_CLIENT_ID,
                                'Authorization':
                                    `Bearer ${process.env.TWITCH_OAUTH}`
                            }
                        }
                    );

                const userData =
                    await userRes.json();

                if (!userRes.ok) {
                    console.error(
                        `❌ Twitch API error (${userRes.status}): ${userData.message || 'Unknown error'}`
                    );

                    client.say(
                        channel,
                        `Twitch API error (${userRes.status}): ${userData.message || 'Unknown error'}`
                    );

                    return;
                }

                if (
                    !userData.data ||
                    !userData.data.length
                ) {
                    console.log(
                        `❌ Streamer not found: ${streamer}`
                    );

                    client.say(
                        channel,
                        `Could not find Twitch user "${streamer}"`
                    );

                    return;
                }

                const user =
                    userData.data[0];

                console.log(
                    `🔎 Found streamer: ${user.display_name} (@${user.login})`
                );

                // Get most recent archived stream
                const videosRes =
                    await fetch(
                        `https://api.twitch.tv/helix/videos?user_id=${user.id}&type=archive&first=1`,
                        {
                            method: 'GET',
                            headers: {
                                'Client-ID':
                                    process.env
                                        .TWITCH_CLIENT_ID,
                                'Authorization':
                                    `Bearer ${process.env.TWITCH_OAUTH}`
                            }
                        }
                    );

                const videosData =
                    await videosRes.json();

                let latestGame =
                    null;

                // Try to get game from VOD
                if (
                    videosData.data &&
                    videosData.data.length >
                        0
                ) {
                    const latestVideo =
                        videosData.data[0];

                    console.log(
                        `📺 Found latest VOD: ${latestVideo.title}`
                    );

                    // Twitch sometimes returns this directly
                    if (
                        latestVideo.game_name &&
                        latestVideo.game_name.trim() !==
                            ''
                    ) {
                        latestGame =
                            latestVideo.game_name;
                    }

                    // fallback using game_id lookup
                    else if (
                        latestVideo.game_id &&
                        latestVideo.game_id.trim() !==
                            ''
                    ) {
                        const gameRes =
                            await fetch(
                                `https://api.twitch.tv/helix/games?id=${latestVideo.game_id}`,
                                {
                                    method: 'GET',
                                    headers: {
                                        'Client-ID':
                                            process.env
                                                .TWITCH_CLIENT_ID,
                                        'Authorization':
                                            `Bearer ${process.env.TWITCH_OAUTH}`
                                    }
                                }
                            );

                        const gameData =
                            await gameRes.json();

                        if (
                            gameData.data &&
                            gameData.data.length >
                                0
                        ) {
                            latestGame =
                                gameData.data[0]
                                    .name;
                        }
                    }
                }

                // Fallback to channel category
                if (
                    !latestGame ||
                    latestGame.trim() ===
                        ''
                ) {
                    const channelRes =
                        await fetch(
                            `https://api.twitch.tv/helix/channels?broadcaster_id=${user.id}`,
                            {
                                method: 'GET',
                                headers: {
                                    'Client-ID':
                                        process.env
                                            .TWITCH_CLIENT_ID,
                                    'Authorization':
                                        `Bearer ${process.env.TWITCH_OAUTH}`
                                }
                            }
                        );

                    const channelData =
                        await channelRes.json();

                    if (
                        channelData.data &&
                        channelData.data.length >
                            0
                    ) {
                        latestGame =
                            channelData.data[0]
                                .game_name;
                    }
                }

                // Final safety
                if (
                    !latestGame ||
                    latestGame.trim() ===
                        ''
                ) {
                    latestGame =
                        'Unknown Game';
                }

                console.log(
                    `🎮 Game: ${latestGame}`
                );

                // Send chat message
                const shoutoutMessage =
                    `Check out @${user.display_name} ` +
                    `at https://twitch.tv/${user.login}! ` +
                    `Last streamed game: ${latestGame}`;

                console.log(
                    `📢 Sending shoutout: ${shoutoutMessage}`
                );

                client.say(
                    channel,
                    shoutoutMessage
                );
            } catch (err) {
                console.error(
                    '❌ !streamer error:',
                    err
                );

                client.say(
                    channel,
                    'Error fetching Twitch streamer info.'
                );
            }

            return;
        }

        if (
            lower.startsWith('!jisho ')
        ) {
            await handleJishoCommand(
                channel,
                tags,
                message
            );
        } else {
            switch (lower) {
                case '!help':
                    handleHelpCommand(
                        channel
                    );
                    break;

                case '!japanesereview':
                    await handleJapaneseReviewCommand(
                        channel
                    );
                    break;

                case '!quiz':
                    if (
                        tags.username !==
                        'ramunegaming'
                    ) {
                        client.say(
                            channel,
                            `@${tags.username} ❌ Only the streamer can start quizzes!`
                        );
                        return;
                    }

                    if (currentQuiz) {
                        currentQuiz =
                            null;

                        currentRevengeUser =
                            null;

                        if (quizTimeout) {
                            clearTimeout(
                                quizTimeout
                            );

                            quizTimeout =
                                null;
                        }
                    }

                    await handleQuizCommand(
                        channel,
                        false
                    );
                    break;

                case '!resetscore':
                    if (
                        tags.username !==
                        'ramunegaming'
                    ) {
                        client.say(
                            channel,
                            `@${tags.username} ❌ Only the streamer can reset the scores!`
                        );
                        return;
                    }

                    scores = {};

                    await saveScores();

                    client.say(
                        channel,
                        '🗑️ Scoreboard has been reset!'
                    );

                    console.log(
                        '🏆 Scoreboard reset by ramunegaming'
                    );

                    break;

                case '!scoreboard': {
                    const username =
                        tags.username;

                    const entries =
                        Object.entries(
                            scores
                        );

                    if (!entries.length) {
                        client.say(
                            channel,
                            "No scores yet!"
                        );
                        break;
                    }

                    // Sort descending by score
                    entries.sort(
                        (a, b) =>
                            b[1] - a[1]
                    );

                    // Build rank list with tie handling
                    const rankList = [];

                    let lastScore =
                        null;

                    for (
                        let i = 0;
                        i < entries.length;
                        i++
                    ) {
                        const [
                            user,
                            score
                        ] = entries[i];

                        if (
                            score ===
                            lastScore
                        ) {
                            rankList[
                                rankList.length -
                                    1
                            ].users.push(
                                user
                            );
                        } else {
                            rankList.push({
                                rank: i + 1,
                                users: [
                                    user
                                ],
                                score
                            });
                        }

                        lastScore =
                            score;
                    }

                    // Build message string
                    const messages = [];

                    let userRankMsg =
                        null;

                    for (
                        let i = 0;
                        i < rankList.length;
                        i++
                    ) {
                        const r =
                            rankList[i];

                        const usersStr =
                            r.users.join(
                                ' & '
                            );

                        const prefix =
                            r.users.length >
                            1
                                ? `Tied ${r.rank}.`
                                : `${r.rank}.`;

                        const msgLine =
                            `${prefix} ${usersStr} - ${r.score}`;

                        if (i < 3) {
                            messages.push(
                                msgLine
                            );
                        }

                        if (
                            r.users.includes(
                                username
                            )
                        ) {
                            userRankMsg =
                                msgLine;
                        }
                    }

                    // Only show requester's position if outside top 3
                    if (
                        userRankMsg &&
                        !messages.includes(
                            userRankMsg
                        )
                    ) {
                        messages.push(
                            userRankMsg
                        );
                    }

                    client.say(
                        channel,
                        `🏆 Leaderboard: ${messages.join(' | ')}`
                    );

                    break;
                }

                case '!discord':
                    client.say(
                        channel,
                        "🎉 Join us on Discord: https://discord.gg/RaDBSntRZh"
                    );
                    break;

                case '!japanesemode':
                    if (
                        tags.username !==
                        'ramunegaming'
                    ) {
                        client.say(
                            channel,
                            `@${tags.username} ❌ Only the streamer can toggle Japanese mode!`
                        );
                        return;
                    }

                    japaneseMode =
                        !japaneseMode;

                    client.say(
                        channel,
                        `Japanese mode ${japaneseMode ? 'ENABLED 🇯🇵' : 'DISABLED ❌'}`
                    );

                    break;

                case '!mylist': {
                    const list =
                        userLists[
                            tags.username
                        ] || [];

                    if (!list.length) {
                        safeWhisper(
                            tags.username,
                            "Your list is empty!"
                        );
                        break;
                    }

                    const formattedItems =
                        list.map(item => {
                            if (
                                typeof item ===
                                'string'
                            ) {
                                return item;
                            }

                            return `${item.word}: ${item.reading} - ${item.meaning}`;
                        });

                    // Keep each whisper comfortably below Twitch's message limit
                    let currentMessage =
                        '';

                    for (
                        const item of formattedItems
                    ) {
                        const separator =
                            currentMessage
                                ? ' | '
                                : '';

                        if (
                            (
                                currentMessage +
                                separator +
                                item
                            ).length >
                            450
                        ) {
                            safeWhisper(
                                tags.username,
                                currentMessage
                            );

                            currentMessage =
                                item;
                        } else {
                            currentMessage +=
                                separator +
                                item;
                        }
                    }

                    if (
                        currentMessage
                    ) {
                        safeWhisper(
                            tags.username,
                            currentMessage
                        );
                    }

                    break;
                }
            }
        }
    }
);

// Connect to Twitch
console.log(
    '→ connecting to Twitch as',
    client.getOptions().identity.username
);

client.connect()
    .catch(err => {
        console.error(
            '❌ Failed to connect to Twitch:',
            err
        );
    });

// Quiz state
let currentQuiz = null;
let quizTimeout = null;
let answeredUsers = new Set();
let japaneseMode = false;
let lastMessageTime = 0;
let lastCorrect = null;
let currentRevengeUser = null;

const revengeQuizCount = {};

// personal lists (memory only)
const userLists = {};

// Shuffle function
function shuffleArray(array) {
    for (
        let i = array.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [array[i], array[j]] =
            [array[j], array[i]];
    }

    return array;
}

// Other helper functions
function containsKanji(str) {
    return /[\u4E00-\u9FAF]/.test(str);
}

function getRankSuffix(rank) {
    if (
        rank % 100 >= 11 &&
        rank % 100 <= 13
    ) {
        return 'th';
    }

    switch (rank % 10) {
        case 1:
            return 'st';

        case 2:
            return 'nd';

        case 3:
            return 'rd';

        default:
            return 'th';
    }
}

// --- TIMER SECTION ---
const timerMessages = [
    'Enjoying the stream? Check out the Discord! https://discord.gg/RaDBSntRZh',
    'Like what you see? Hit that follow button! ❤️',
    'Check out my YouTube content! 🎥 https://www.youtube.com/@RamuneGaming',
    'Use !help to see all the fun things you can do in chat!',
    'Clip epic moments and share the hype! 🎬',
    "I'm working on a mystery puzzle styled game check out the site: https://ramunesoft.com"
];

let lastMessageIndex = -1;

function sendRandomMessage(
    client,
    channel,
    messages
) {
    if (!messages.length) return;

    let index;

    do {
        index =
            Math.floor(
                Math.random() *
                messages.length
            );
    } while (
        index === lastMessageIndex &&
        messages.length > 1
    );

    lastMessageIndex = index;

    const msg =
        messages[index];

    try {
        client.say(
            channel,
            msg
        );
    } catch (err) {
        console.error(
            'Failed to send timer message:',
            err
        );
    }
}

// --- QUIZ TYPE DISPATCHER ---
async function triggerRandomQuiz(channel) {
    const quizTypes = [
        handleQuizCommand,
        handleMeaningQuiz,
        handleWordQuiz,
        handleFillBlankQuiz
    ];

    const randomQuiz =
        quizTypes[
            Math.floor(
                Math.random() *
                quizTypes.length
            )
        ];

    await randomQuiz(
        channel,
        true
    );
}

let promoInterval = null;
let quizInterval = null;
let quizStartTimeout = null;

client.on(
    'connected',
    (addr, port) => {
        console.log(
            `✅ Connected to Twitch: ${addr}:${port}`
        );

        // Prevent duplicate timers if Twitch reconnects
        if (promoInterval) {
            clearInterval(
                promoInterval
            );
        }

        if (quizInterval) {
            clearInterval(
                quizInterval
            );
        }

        if (quizStartTimeout) {
            clearTimeout(
                quizStartTimeout
            );
        }

        // Promo messages
        promoInterval =
            setInterval(() => {
                sendRandomMessage(
                    client,
                    '#ramunegaming',
                    timerMessages
                );
            }, 20 * 60_000);

        // Quiz starts 10 minutes after connection
        quizStartTimeout =
            setTimeout(() => {
                quizInterval =
                    setInterval(
                        async () => {
                            try {
                                if (
                                    !japaneseMode
                                ) {
                                    return;
                                }

                                if (
                                    currentQuiz
                                ) {
                                    return;
                                }

                                if (
                                    Date.now() -
                                        lastMessageTime >
                                    15 *
                                        60 *
                                        1000
                                ) {
                                    return;
                                }

                                await triggerRandomQuiz(
                                    '#ramunegaming'
                                );
                            } catch (err) {
                                console.error(
                                    'Auto quiz error:',
                                    err
                                );
                            }
                        },
                        20 * 60_000
                    );
            }, 10 * 60_000);
    }
);