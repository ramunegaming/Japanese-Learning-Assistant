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
<<<<<<< HEAD
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
=======
>>>>>>> origin/main

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
<<<<<<< HEAD
        // Create file and treat as "no favorites yet"
        await fs.writeFile(DATA_FILE, '[]');
        return [];
=======
        // Create file and treat as “no favorites yet”
        await fs.writeFile(DATA_FILE, '[]');
        return [];                // ← bail out early for ENOENT
>>>>>>> origin/main
      }
      console.error('Error loading favorites:', error);
      return [];
    }
  }

// Function to save favorites to file
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

<<<<<<< HEAD
        const response = await fetch(`https://jisho.org/search/${encodeURIComponent(keyword)}%20%23sentences`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!response.ok) throw new Error('Failed to fetch from Jisho');
=======
        // Fetch the search results page
        const response = await fetch(`https://jisho.org/search/${encodeURIComponent(keyword)}%20%23sentences`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch from Jisho');
        }
>>>>>>> origin/main

        const html = await response.text();
        const $ = cheerio.load(html);

<<<<<<< HEAD
=======
        // Extract sentences
>>>>>>> origin/main
        const sentences = [];
        $('.sentence_content').each((i, elem) => {
            const japanese = $(elem).find('.japanese_sentence').text().trim();
            const english = $(elem).find('.english_sentence').text().trim();
<<<<<<< HEAD
            if (japanese && english) sentences.push({ japanese, english });
=======
            
            if (japanese && english) {
                sentences.push({ japanese, english });
            }
>>>>>>> origin/main
        });

        res.json({ data: sentences });
    } catch (error) {
        console.error('Error searching sentences:', error);
        res.status(500).json({ error: 'Failed to search for sentences' });
    }
});

// Endpoint to search for words
app.get('/api/search/words', async (req, res) => {
    try {
        const keyword = req.query.keyword;
<<<<<<< HEAD
        if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

        const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!response.ok) throw new Error('Failed to fetch from Jisho API');
=======
        if (!keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }

        const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch from Jisho API');
        }
>>>>>>> origin/main

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error searching words:', error);
        res.status(500).json({ error: 'Failed to search for words' });
    }
});

// Endpoint to get favorites
app.get('/api/favorites', async (req, res) => {
    try {
        const favorites = await loadFavorites();
        res.json(favorites);
    } catch (error) {
        console.error('Error loading favorites:', error);
        res.status(500).json({ error: 'Failed to load favorites' });
    }
});

// Endpoint to add a favorite
app.post('/api/favorites', async (req, res) => {
    try {
        const { word, reading, meaning } = req.body;
<<<<<<< HEAD
        if (!word || !reading || !meaning) return res.status(400).json({ error: 'Word, reading, and meaning are required' });
=======
        if (!word || !reading || !meaning) {
            return res.status(400).json({ error: 'Word, reading, and meaning are required' });
        }
>>>>>>> origin/main

        const favorites = await loadFavorites();
        favorites.push({ word, reading, meaning });
        await saveFavorites(favorites);
        res.json({ message: 'Favorite added successfully' });
    } catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({ error: 'Failed to add favorite' });
    }
});

// Endpoint to remove a favorite
app.delete('/api/favorites/:word', async (req, res) => {
    try {
        const wordToRemove = req.params.word;
        const favorites = await loadFavorites();
        const updatedFavorites = favorites.filter(fav => fav.word !== wordToRemove);
        await saveFavorites(updatedFavorites);
        res.json({ message: 'Favorite removed successfully' });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
});

<<<<<<< HEAD
// Endpoint to sync favorites
app.post('/api/favorites/sync', async (req, res) => {
    try {
        const { favorites } = req.body;
        if (!Array.isArray(favorites)) return res.status(400).json({ error: 'Favorites must be an array' });
=======
// Add this new endpoint to sync favorites
app.post('/api/favorites/sync', async (req, res) => {
    try {
        const { favorites } = req.body;
        if (!Array.isArray(favorites)) {
            return res.status(400).json({ error: 'Favorites must be an array' });
        }
>>>>>>> origin/main

        await fs.writeFile(DATA_FILE, JSON.stringify(favorites, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error syncing favorites:', error);
        res.status(500).json({ error: 'Failed to sync favorites' });
    }
});

<<<<<<< HEAD
// Twitch client
const client = new tmi.Client({
    options: { debug: true },
    identity: { username: 'ramunebot', password: process.env.TWITCH_OAUTH },
    channels: ['#ramunegaming']
});

// Command handlers
const handleJishoCommand = async (channel, tags, message) => {
    try {
        const args = message.slice(7).trim();
        if (!args) { client.say(channel, "Please provide a word to search! Usage: !jisho [word]"); return; }

        const response = await fetch(`http://localhost:3001/api/search/words?keyword=${encodeURIComponent(args)}`);
=======
// Create Twitch client
const client = new tmi.Client({
    options: { debug: true },
    identity: {
        username: 'ramunebot',
        password: process.env.TWITCH_OAUTH
    },
    channels: ['#ramunegaming']
});

// Bot command handlers
const handleJishoCommand = async (channel, tags, message) => {
    try {
        const args = message.slice(7).trim(); // Remove "!jisho " from message
        if (!args) {
            client.say(channel, "Please provide a word to search! Usage: !jisho [word]");
            return;
        }

        // Search for the word using the Jisho API
        const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(args)}`);
>>>>>>> origin/main
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const result = data.data[0];
            const reading = result.japanese[0].reading || result.japanese[0].word || 'N/A';
            const meaning = result.senses[0].english_definitions.join(', ');
            client.say(channel, `${args}: ${reading} - ${meaning}`);
<<<<<<< HEAD
        } else client.say(channel, `No results found for "${args}"`);
=======
        } else {
            client.say(channel, `No results found for "${args}"`);
        }
>>>>>>> origin/main
    } catch (error) {
        console.error('Error in !jisho command:', error);
        client.say(channel, "Sorry, there was an error processing your request.");
    }
};

<<<<<<< HEAD
const handleJapaneseReviewCommand = async (channel) => {
    try {
        const favorites = await loadFavorites();
        if (favorites.length === 0) { client.say(channel, 'No Japanese words saved yet!'); return; }
=======
const handleJapaneseTodayCommand = async (channel) => {
    try {
        const favorites = await loadFavorites();
        if (favorites.length === 0) {
            client.say(channel, 'No Japanese words saved yet!');
            return;
        }
>>>>>>> origin/main

        const recentFavorites = favorites.slice(-5);
        const processedFavorites = await Promise.all(recentFavorites.map(async fav => {
            const shortUrl = await shortenJishoUrl(fav.word);
            const cleanMeaning = fav.meaning.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
            return { ...fav, shortUrl, cleanMeaning };
        }));

<<<<<<< HEAD
        const wordList = processedFavorites.map(fav => {
            const wordDisplay = containsKanji(fav.word) ? `${fav.word} (${fav.reading})` : fav.word;
            return `${wordDisplay} ${fav.cleanMeaning}: ${fav.shortUrl}`;
        }).join(' || ');

        client.say(channel, `Latest Japanese Words: ${wordList}`);
    } catch (error) {
        console.error('Error in japanesereview command:', error);
=======
        const wordList = processedFavorites
            .map(fav => {
                const wordDisplay = containsKanji(fav.word) ? 
                    `${fav.word} (${fav.reading})` : 
                    fav.word;
                return `${wordDisplay} ${fav.cleanMeaning}: ${fav.shortUrl}`;
            })
            .join(' || ');

        client.say(channel, `Latest Japanese Words: ${wordList}`);
    } catch (error) {
        console.error('Error in japanesetoday command:', error);
>>>>>>> origin/main
        client.say(channel, 'Sorry, something went wrong!');
    }
};

<<<<<<< HEAD
const handleQuizCommand = async (channel, givesPoints = true, forcedWord = null) => {
    try {
        if (currentQuiz) {
            client.say(channel, "⚠️ A quiz is already active!");
            return;
        }

        const favorites = await loadFavorites();

        if (!favorites.length) {
            client.say(channel, "No words available for quiz yet!");
            return;
        }

        const recent = favorites.slice(-5);
        const correct = forcedWord || recent[Math.floor(Math.random() * recent.length)];
        const others = favorites.filter(f => f.word !== correct.word);

        if (others.length < 3) {
            client.say(channel, "Not enough words for quiz yet!");
            return;
        }

        const wrongAnswers = [];
        while (wrongAnswers.length < 3) {
            const rand = others[Math.floor(Math.random() * others.length)];
            if (!wrongAnswers.includes(rand.reading)) {
                wrongAnswers.push(rand.reading);
            }
        }

        const options = shuffleArray([correct.reading, ...wrongAnswers]);
        const correctIndex = options.indexOf(correct.reading);

        currentQuiz = {
            correctAnswer: correctIndex,
            answerText: correct.reading,
            word: correct.word,
            givesPoints,
            type: 'reading',
            favorite: correct
        };

        answeredUsers.clear();

        const label = givesPoints ? "🏆 Quiz!" : "📘 Practice Quiz!";

// ⏱️ timeout (2 mins)
quizTimeout = setTimeout(() => {
    if (currentQuiz) {
        client.say(channel, `⏱️ Time's up! The answer was "${currentQuiz.answerText}"`);
        currentQuiz = null;
        quizTimeout = null;
    }
}, 120000);

        client.say(
            channel,
            `${label} What is the reading of "${correct.word}"?\na) ${options[0]} | b) ${options[1]} | c) ${options[2]} | d) ${options[3]}`
        );

    } catch (error) {
        console.error('Quiz error:', error);
        client.say(channel, "Something went wrong with the quiz!");
    }
};

const handleMeaningQuiz = async (channel, givesPoints = true, forcedWord = null) => {
    try {
        if (currentQuiz) return;

        const favorites = await loadFavorites();
        if (favorites.length < 4) return;

        const correct = forcedWord || favorites[Math.floor(Math.random() * favorites.length)];
        const others = favorites.filter(f => f.word !== correct.word);

        const wrong = [];
        while (wrong.length < 3) {
            const rand = others[Math.floor(Math.random() * others.length)];
            if (!wrong.includes(rand.meaning)) {
                wrong.push(rand.meaning);
            }
        }

        const options = shuffleArray([correct.meaning, ...wrong]);
        const correctIndex = options.indexOf(correct.meaning);

        currentQuiz = {
            correctAnswer: correctIndex,
            answerText: correct.meaning,
            word: correct.word,
            givesPoints,
            type: 'meaning',
            favorite: correct
        };

        answeredUsers.clear();

        const label = givesPoints ? "🏆 Quiz!" : "📘 Practice Quiz!";

        quizTimeout = setTimeout(() => {
            if (currentQuiz) {
                client.say(channel, `⏱️ Time's up! The answer was ${currentQuiz.answerText}`);
                currentQuiz = null;
            }
        }, 120000);

        client.say(
            channel,
            `${label} What does "${correct.word}" mean?\na) ${options[0]} | b) ${options[1]} | c) ${options[2]} | d) ${options[3]}`
        );

    } catch (err) {
        console.error('Meaning quiz error:', err);
    }
};

const handleWordQuiz = async (channel, givesPoints = true, forcedWord = null) => {
    try {
        if (currentQuiz) return;

        const favorites = await loadFavorites();
        if (favorites.length < 4) return;

        const correct = forcedWord || favorites[Math.floor(Math.random() * favorites.length)];
        const others = favorites.filter(f => f.word !== correct.word);

        const wrong = [];
        while (wrong.length < 3) {
            const rand = others[Math.floor(Math.random() * others.length)];
            if (!wrong.includes(rand.word)) {
                wrong.push(rand.word);
            }
        }

        const options = shuffleArray([correct.word, ...wrong]);
        const correctIndex = options.indexOf(correct.word);

        currentQuiz = {
            correctAnswer: correctIndex,
            answerText: correct.word,
            word: correct.word,
            givesPoints,
            type: 'word',
            favorite: correct
        };

        answeredUsers.clear();

        const label = givesPoints ? "🏆 Quiz!" : "📘 Practice Quiz!";

        quizTimeout = setTimeout(() => {
            if (currentQuiz) {
                client.say(channel, `⏱️ Time's up! The answer was ${currentQuiz.answerText}`);
                currentQuiz = null;
            }
        }, 120000);

        client.say(
            channel,
            `${label} Which word means "${correct.meaning}"?\na) ${options[0]} | b) ${options[1]} | c) ${options[2]} | d) ${options[3]}`
        );

    } catch (err) {
        console.error('Word quiz error:', err);
    }
};

// --- Fill-in-the-Blank Quiz ---
const handleFillBlankQuiz = async (channel, givesPoints = true, forcedWord = null) => {
    try {
        if (currentQuiz) return; // Only one quiz at a time

        const favorites = await loadFavorites();
        if (favorites.length < 4) return; // Need enough words

        let quizWord = forcedWord || null;
        let sentence = null;

        // If not forced, try to find a word with a short sentence
        if (!quizWord) {
            const shuffledFavorites = shuffleArray([...favorites]);
            for (const wordItem of shuffledFavorites) {
                const response = await fetch(`http://localhost:3001/api/search/sentences?keyword=${encodeURIComponent(wordItem.word)}`);
                const data = await response.json();
                let sentences = data.data || [];

                // Filter short sentences (max 20 chars)
                sentences = sentences.filter(s => s.japanese.length <= 20 && s.japanese.includes(wordItem.word));

                if (sentences.length) {
                    sentence = sentences[Math.floor(Math.random() * sentences.length)];
                    quizWord = wordItem;
                    break; // Stop at first word with valid short sentence
                }
            }

            // If no word has a short sentence, don't fire
            if (!quizWord) return;
        }

        // If forcedWord was passed, fetch its sentence
        if (forcedWord && !sentence) {
            const response = await fetch(`http://localhost:3001/api/search/sentences?keyword=${encodeURIComponent(quizWord.word)}`);
            const data = await response.json();
            const sentences = (data.data || []).filter(s => s.japanese.length <= 20 && s.japanese.includes(quizWord.word));
            if (!sentences.length) return; // If forcedWord has no short sentence, stop
            sentence = sentences[Math.floor(Math.random() * sentences.length)];
        }

        const quizSentence = sentence.japanese.replace(quizWord.word, '___');

        // Prepare wrong options
        const others = favorites.filter(f => f.word !== quizWord.word);
        const wrongAnswers = [];
        while (wrongAnswers.length < 3 && others.length) {
            const rand = others[Math.floor(Math.random() * others.length)];
            if (!wrongAnswers.includes(rand.word)) wrongAnswers.push(rand.word);
        }

        const options = shuffleArray([quizWord.word, ...wrongAnswers]);
        const correctIndex = options.indexOf(quizWord.word);

        currentQuiz = {
            correctAnswer: correctIndex,
            answerText: quizWord.word,
            word: quizWord.word,
            givesPoints,
            type: 'fillblank',
            favorite: quizWord
        };

        answeredUsers.clear();

        const label = givesPoints ? "🏆 Fill-in-the-Blank Quiz!" : "📘 Practice Fill-in-the-Blank Quiz!";

        // 2-minute timeout
        quizTimeout = setTimeout(() => {
            if (currentQuiz) {
                client.say(channel, `⏱️ Time's up! The answer was "${currentQuiz.answerText}"`);
                currentQuiz = null;
            }
        }, 120000);

        client.say(
            channel,
            `${label} ${quizSentence}\na) ${options[0]} | b) ${options[1]} | c) ${options[2]} | d) ${options[3]}`
        );

    } catch (err) {
        console.error('Fill-in-the-Blank quiz error:', err);
=======
const handleQuizCommand = async (channel) => {
    try {
        const favorites = await loadFavorites();
        if (favorites.length === 0) {
            client.say(channel, 'No Japanese words available for quiz! Add some words first using the website.');
            return;
        }

        const correctWord = favorites[Math.floor(Math.random() * favorites.length)];
        const wrongOptions = await getWrongOptions(correctWord.meaning);
        const options = shuffleArray([
            { ...correctWord, isCorrect: true },
            ...wrongOptions.map(opt => ({ ...opt, isCorrect: false }))
        ]);

        currentQuiz = {
            word: correctWord.word,
            reading: correctWord.reading,
            correctAnswer: options.findIndex(opt => opt.isCorrect),
            options: options
        };

        const optionsText = options
            .map((opt, index) => `${String.fromCharCode(97 + index)}) ${opt.meaning}`)
            .join(' ');

        client.say(channel, `Quiz Time! Which of the following words means '${correctWord.reading} (${correctWord.word})'? ${optionsText}`);
    } catch (error) {
        console.error('Error in quiz command:', error);
        client.say(channel, 'Sorry, something went wrong with the quiz!');
>>>>>>> origin/main
    }
};

const handleHelpCommand = (channel) => {
<<<<<<< HEAD
    client.say(channel, '📖 Commands: !jisho [word] - look up a word | !japanesereview - see all words learned today | !scoreboard - view the leaderboard | !discord - Discord link | !japanesemode - toggle auto quizzes | !mylist - view your word list | !add [word] - add a Japanese word | !remove [word] - remove a word from your list');
};

// Revenge quiz trigger
async function triggerRevengeQuiz(channel, triggeredBy) {
    if (!lastCorrect) return;

    const types = ['reading', 'meaning', 'word'];
    const available = types.filter(t => t !== lastCorrect.type);
    const nextType = available[Math.floor(Math.random() * available.length)];

    client.say(channel, `⚔️ Revenge Quiz! Only @${triggeredBy} can answer this one!`);

    // Store who triggered the revenge quiz
    currentRevengeUser = triggeredBy;

    switch (nextType) {
        case 'reading':
            await handleQuizCommand(channel, false, lastCorrect);
            break;
        case 'meaning':
            await handleMeaningQuiz(channel, false, lastCorrect);
            break;
        case 'word':
            await handleWordQuiz(channel, false, lastCorrect);
            break;
    }
}

// Message event
client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    lastMessageTime = Date.now();

    const username = tags.username;
    const now = Date.now();
    userMessageCount[username] = (userMessageCount[username] || []).concat(now).filter(ts => ts > now - 15*60*1000);

    const lower = message.toLowerCase();

    if (currentQuiz && /^[abcd]$/.test(lower)) {

    if (answeredUsers.has(tags.username)) return;
    answeredUsers.add(tags.username);

    const userAnswer = lower.charCodeAt(0) - 97;
    const isCorrect = userAnswer === currentQuiz.correctAnswer;

    if (isCorrect) {
    // Check if this is a revenge quiz and if the right person answered
    if (currentRevengeUser) {
        if (tags.username !== currentRevengeUser) {
            client.say(channel, `@${tags.username} ❌ Only @${currentRevengeUser} can answer this revenge quiz!`);
            answeredUsers.delete(tags.username); // let them try again if needed
            return;
        }

        // Track revenge quiz correct answers
        revengeQuizCount[tags.username] = (revengeQuizCount[tags.username] || 0) + 1;

        if (revengeQuizCount[tags.username] % 2 === 0) {
            // Every 2 revenge quiz correct answers = bonus point
            scores[tags.username] = (scores[tags.username] || 0) + 1;
            await saveScores();
            client.say(channel, `@${tags.username} ⚔️ Revenge quiz correct! 🎉 Streak bonus! +1 extra point!`);
        } else {
            client.say(channel, `@${tags.username} ⚔️ Revenge quiz correct! (1/2 towards bonus point)`);
        }

        currentRevengeUser = null;
    } else {
        // Normal quiz scoring
        scores[tags.username] = (scores[tags.username] || 0) + 1;
        await saveScores();

        if (currentQuiz.givesPoints) {
            client.say(channel, `@${tags.username} ✅ Correct! (+1 point)`);
        } else {
            client.say(channel, `@${tags.username} ✅ Correct! (practice mode)`);
        }
    }

    lastCorrect = {
        ...currentQuiz.favorite,
        type: currentQuiz.type
    };

    if (quizTimeout) {
        clearTimeout(quizTimeout);
        quizTimeout = null;
    }
    currentQuiz = null;

    // 20% chance for revenge quiz
    if (lastCorrect && Math.random() < 0.2) {
    const revengeUser = tags.username;
    setTimeout(() => {
        triggerRevengeQuiz(channel, revengeUser);
    }, 25 * 60 * 1000);
}
} else {
    client.say(channel, `@${tags.username} ❌ Wrong! Try again next time.`);
}

    return;
}
    if (lower.startsWith('!add ')) {
    const word = message.slice(5).trim();
    if (!word) {
        client.say(channel, "Usage: !add [word]");
        return;
    }

    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(word);

    if (!hasJapanese) {
        // Check if it's a valid Japanese romaji word via Jisho
        try {
            const res = await fetch(`http://localhost:3001/api/search/words?keyword=${encodeURIComponent(word)}`);
            const data = await res.json();
            const hasResults = data.data && data.data.length > 0;
            const isJapanese = hasResults && data.data[0].senses.some(s => 
                !s.parts_of_speech.includes('Wikipedia definition')
            );

            if (!isJapanese) {
                client.say(channel, `@${tags.username} ❌ Only Japanese words allowed! Try hiragana, katakana, kanji, or romaji.`);
                return;
            }
        } catch (err) {
            client.say(channel, `@${tags.username} ❌ Couldn't verify that Japanese word. Try again!`);
            return;
        }
    }

    userLists[tags.username] = userLists[tags.username] || [];
    userLists[tags.username].push(word);
    client.say(channel, `@${tags.username} added "${word}" to their list!`);
    return;
}
    if (lower.startsWith('!remove ')) {
    const word = message.slice(8).trim();

    if (!userLists[tags.username]) return;

    userLists[tags.username] = userLists[tags.username].filter(w => w !== word);

    client.say(channel, `@${tags.username} removed "${word}"`);
    return;
}

// !streamer command
if (lower.startsWith('!streamer ')) {

    const streamer = message
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

        // ====================================
        // GET USER INFO
        // ====================================
        const userRes = await fetch(
            `https://api.twitch.tv/helix/users?login=${encodeURIComponent(streamer)}`,
            {
                method: 'GET',
                headers: {
                    'Client-ID': process.env.TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
                }
            }
        );

        const userData = await userRes.json();

        console.log(
            'USER DATA:',
            JSON.stringify(userData, null, 2)
        );

        if (
            !userData.data ||
            !userData.data.length
        ) {

            client.say(
                channel,
                `Could not find Twitch user "${streamer}"`
            );

            return;
        }

        const user = userData.data[0];

        // ====================================
        // GET MOST RECENT ARCHIVED STREAM
        // ====================================
        const videosRes = await fetch(
            `https://api.twitch.tv/helix/videos?user_id=${user.id}&type=archive&first=1`,
            {
                method: 'GET',
                headers: {
                    'Client-ID': process.env.TWITCH_CLIENT_ID,
                    'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
                }
            }
        );

        const videosData = await videosRes.json();

        console.log(
            'VIDEOS DATA:',
            JSON.stringify(videosData, null, 2)
        );

        let latestGame = null;

        // ====================================
        // TRY TO GET GAME FROM VOD
        // ====================================
        if (
            videosData.data &&
            videosData.data.length > 0
        ) {

            const latestVideo = videosData.data[0];

            console.log(
                'LATEST VIDEO:',
                JSON.stringify(latestVideo, null, 2)
            );

            // Twitch sometimes returns this directly
            if (
                latestVideo.game_name &&
                latestVideo.game_name.trim() !== ''
            ) {

                latestGame = latestVideo.game_name;

                console.log(
                    'FOUND GAME NAME:',
                    latestGame
                );
            }

            // fallback using game_id lookup
            else if (
                latestVideo.game_id &&
                latestVideo.game_id.trim() !== ''
            ) {

                console.log(
                    'LOOKING UP GAME ID:',
                    latestVideo.game_id
                );

                const gameRes = await fetch(
                    `https://api.twitch.tv/helix/games?id=${latestVideo.game_id}`,
                    {
                        method: 'GET',
                        headers: {
                            'Client-ID': process.env.TWITCH_CLIENT_ID,
                            'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
                        }
                    }
                );

                const gameData = await gameRes.json();

                console.log(
                    'GAME DATA:',
                    JSON.stringify(gameData, null, 2)
                );

                if (
                    gameData.data &&
                    gameData.data.length > 0
                ) {

                    latestGame = gameData.data[0].name;

                    console.log(
                        'FOUND GAME FROM GAME ID:',
                        latestGame
                    );
                }
            }
        }

        // ====================================
        // FALLBACK TO CHANNEL CATEGORY
        // ====================================
        if (
            !latestGame ||
            latestGame.trim() === ''
        ) {

            console.log(
                'FALLING BACK TO CHANNEL INFO'
            );

            const channelRes = await fetch(
                `https://api.twitch.tv/helix/channels?broadcaster_id=${user.id}`,
                {
                    method: 'GET',
                    headers: {
                        'Client-ID': process.env.TWITCH_CLIENT_ID,
                        'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`
                    }
                }
            );

            const channelData = await channelRes.json();

            console.log(
                'CHANNEL DATA:',
                JSON.stringify(channelData, null, 2)
            );

            if (
                channelData.data &&
                channelData.data.length > 0
            ) {

                latestGame =
                    channelData.data[0].game_name;
            }
        }

        // ====================================
        // FINAL SAFETY
        // ====================================
        if (
            !latestGame ||
            latestGame.trim() === ''
        ) {

            latestGame = 'Unknown Game';
        }

        // ====================================
        // SEND CHAT MESSAGE
        // ====================================
        const shoutoutMessage =
            `Check out @${user.display_name} ` +
            `at https://twitch.tv/${user.login}! ` +
            `Last streamed game: ${latestGame}`;

        console.log(
            'FINAL MESSAGE:',
            shoutoutMessage
        );

        client.say(
            channel,
            shoutoutMessage
        );

    } catch (err) {

        console.error(
            '!streamer error:',
            err
        );

        client.say(
            channel,
            'Error fetching Twitch streamer info.'
        );
    }

    return;
}
    if (lower.startsWith('!jisho ')) await handleJishoCommand(channel, tags, message);
    else {
        switch (lower) {
            case '!help': handleHelpCommand(channel); break;
            case '!japanesereview': await handleJapaneseReviewCommand(channel); break;
            case '!quiz':
    if (tags.username !== 'ramunegaming') {
        client.say(channel, `@${tags.username} ❌ Only the streamer can start quizzes!`);
        return;
    }
    if (currentQuiz) {
        currentQuiz = null;
        if (quizTimeout) {
            clearTimeout(quizTimeout);
            quizTimeout = null;
        }
    }
    await handleQuizCommand(channel, false);
    break;

                case '!scoreboard': {
    const username = tags.username;
    const entries = Object.entries(scores); // [ [username, score], ... ]
    if (!entries.length) {
        client.say(channel, "No scores yet!");
        break;
    }

    // Sort descending by score
    entries.sort((a, b) => b[1] - a[1]);

    // Build rank list with tie handling
    const rankList = [];
    let currentRank = 1;
    let lastScore = null;

    for (let i = 0; i < entries.length; i++) {
        const [user, score] = entries[i];

        if (score === lastScore) {
            rankList[rankList.length - 1].users.push(user);
        } else {
            rankList.push({ rank: currentRank, users: [user], score });
        }

        lastScore = score;
        currentRank += rankList[rankList.length - 1].users.length;
    }

    // Build message string
    const messages = [];
    let userRankMsg = null;
    for (let i = 0; i < rankList.length; i++) {
        const r = rankList[i];
        const usersStr = r.users.join(' & ');
        const prefix = r.users.length > 1 ? `Tied ${r.rank}.` : `${r.rank}.`;
        const msgLine = `${prefix} ${usersStr} - ${r.score}`;
        if (i < 3) messages.push(msgLine); // top 3

        if (r.users.includes(username)) userRankMsg = msgLine;
    }

    // Only show requester's position if outside top 3
    if (userRankMsg && !messages.includes(userRankMsg)) messages.push(userRankMsg);

    client.say(channel, `🏆 Leaderboard: ${messages.join(' | ')}`);
    break;
}

            case '!discord': client.say(channel, "🎉 Join us on Discord: https://discord.gg/RaDBSntRZh"); break;
            case '!japanesemode':
                japaneseMode = !japaneseMode;

    client.say(channel, `Japanese mode ${japaneseMode ? 'ENABLED 🇯🇵' : 'DISABLED ❌'}`);
    break;
            case '!mylist':
                const list = userLists[tags.username] || [];
                client.say(channel, list.length ? `@${tags.username} your list: ${list.join(', ')}` : "Your list is empty!");
                break;
            case '!japanesereview': {
    const favs = await loadFavorites();
    if (!favs.length) {
        client.say(channel, "No words saved today!");
        break;
    }

    const words = favs.map(f => {
        const display = containsKanji(f.word) ? `${f.word} (${f.reading})` : f.word;
        return `${display}: ${f.meaning}`;
    }).join(' | ');

    client.say(channel, `🧠 Words learned today: ${words}`);
    break;
}
        }
    }
});
=======
    const commands = [
        '!jisho [word] - Search for Japanese word meanings',
        '!japanesetoday - Show recent Japanese words',
        '!quiz - Start a Japanese word quiz',
        '!discord - Get Discord server link',
        '!help - Show this help message'
    ];
    client.say(channel, `Available commands: ${commands.join(' | ')}`);
};

// Single message event handler for all commands
client.on('message', async (channel, tags, message, self) => {
    if (self) return;
  
    // --- Activity tracking (migrate your messageCreate code here) ---
    const username = tags.username;
    const now = Date.now();
    userMessageCount[username] = (userMessageCount[username] || [])
      .concat(now)
      .filter(ts => ts > now - 15 * 60 * 1000);
  
    // --- Command handling ---
    const lower = message.toLowerCase();
  
    if (currentQuiz && /^[abc]$/.test(lower)) {
      const userAnswer = lower.charCodeAt(0) - 97;
      const isCorrect = userAnswer === currentQuiz.correctAnswer;
      client.say(channel, `@${tags.username} ${isCorrect ? 'Correct!' : 'Try again next time!'}`);
      currentQuiz = null;
      return;
    }
  
    if (lower.startsWith('!jisho ')) {
      await handleJishoCommand(channel, tags, message);
    } else {
      switch (lower) {
        case '!help':
          handleHelpCommand(channel);
          break;
        case '!japanesetoday':
          await handleJapaneseTodayCommand(channel);
          break;
        case '!quiz':
          await handleQuizCommand(channel);
          break;
        case '!discord':
          client.say(channel, "🎉 Join us on Discord: https://discord.gg/RaDBSntRZh");
          break;
      }
    }
  });
>>>>>>> origin/main

// Connect to Twitch
console.log('→ connecting to Twitch as', client.getOptions().identity.username);
client.connect()
<<<<<<< HEAD
.then(() => { console.log('✅ Twitch client connected as', client.getOptions().identity.username); })
.catch(err => { console.error('❌ Failed to connect to Twitch:', err); });

// Quiz state
let currentQuiz = null;
let quizTimeout = null;
let answeredUsers = new Set();
let japaneseMode = false;
let lastMessageTime = 0;
let lastCorrect = null;
let currentRevengeUser = null;
const revengeQuizCount = {}; // tracks revenge quiz correct answers per user per session

// personal lists (memory only)
const userLists = {};

// Shuffle function
=======
.then(() => {
    console.log('✅ Twitch client connected as', client.getOptions().identity.username);
  })
  .catch(err => {
    console.error('❌ Failed to connect to Twitch:', err);
  });

// Quiz state management
let currentQuiz = null;

// Function to shuffle array
>>>>>>> origin/main
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

<<<<<<< HEAD
// Other helper functions: getRandomJishoWord, getWrongOptions, hiraganaToRomajiConverter, shortenJishoUrl, containsKanji
// (same as your original code)

function containsKanji(str) {
    return /[\u4E00-\u9FAF]/.test(str);
}

// --- TIMER SECTION ---
const timerMessages = [
  'Enjoying the stream? Check out the Discord! https://discord.gg/RaDBSntRZh',
  'Like what you see? Hit that follow button! ❤️',
  'Check out my YouTube content! 🎥 https://www.youtube.com/@RamuneGaming',
  'Use !commands to see all the fun things you can do in chat!',
  'Clip epic moments and share the hype! 🎬',
  "I'm working on a mystery puzzle styled game check out the site: https://ramunesoft.com"
];

let lastMessageIndex = -1;

function sendRandomMessage(client, channel, messages) {
  if (!messages.length) return;

  let index;
  do {
    index = Math.floor(Math.random() * messages.length);
  } while (index === lastMessageIndex && messages.length > 1);

  lastMessageIndex = index;
  const msg = messages[index];

  try { client.say(channel, msg); } 
  catch (err) { console.error('Failed to send timer message:', err); }
}

// --- QUIZ TYPE DISPATCHER ---
async function triggerRandomQuiz(channel) {
  const quizTypes = [
    handleQuizCommand,
    handleMeaningQuiz,
    handleWordQuiz,
    handleFillBlankQuiz 
  ];

  const randomQuiz = quizTypes[Math.floor(Math.random() * quizTypes.length)];
  await randomQuiz(channel, true); // timer quizzes always give points
}

client.on('connected', (addr, port) => {
  console.log(`Connected as ${client.getOptions().identity.username} to ${addr}:${port}`);

  // promo
  setInterval(() => {
    sendRandomMessage(client, '#ramunegaming', timerMessages);
  }, 20 * 60_000);

  // quiz (offset by 10 minutes)
  setTimeout(() => {
    setInterval(async () => {
      try {
        if (!japaneseMode) return;
        if (currentQuiz) return;
        if (Date.now() - lastMessageTime > 15 * 60 * 1000) return;

        await triggerRandomQuiz('#ramunegaming');

      } catch (err) {
        console.error('Auto quiz error:', err);
      }
    }, 20 * 60_000);
  }, 10 * 60_000);
});
=======
// Function to get a random word from Jisho
async function getRandomJishoWord() {
    try {
        // List of common JLPT N5 words to use as search seeds
        const searchSeeds = ['人', '日', '月', '火', '水', '木', '金', '土', '山', '川', '田', '目', '口', '手', '足', '耳', '空'];
        const randomSeed = searchSeeds[Math.floor(Math.random() * searchSeeds.length)];
        
        const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=*${randomSeed}*`);
        if (!response.ok) {
            console.error('Jisho API response not ok:', response.status);
            return null;
        }

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse Jisho API response:', e);
            return null;
        }
        
        // Filter for words that have kanji, reading, and english meaning
        const validWords = data.data.filter(word => 
            word.japanese?.[0]?.word && 
            word.japanese?.[0]?.reading &&
            word.senses?.[0]?.english_definitions?.[0] &&
            // Ensure the meaning is a simple word or short phrase
            word.senses[0].english_definitions[0].length < 20
        );

        if (validWords.length === 0) {
            return null;
        }

        const randomWord = validWords[Math.floor(Math.random() * validWords.length)];
        return {
            word: randomWord.japanese[0].word,
            reading: randomWord.japanese[0].reading,
            meaning: randomWord.senses[0].english_definitions[0]
        };
    } catch (error) {
        console.error('Error fetching random Jisho word:', error);
        return null;
    }
}

// Function to get random wrong answers (with fallback options)
async function getWrongOptions(correctMeaning) {
    const wrongOptions = [];
    const maxAttempts = 3;
    
    // Default fallback options in case API fails
    const fallbackOptions = [
        { word: '犬', reading: 'いぬ', meaning: 'dog' },
        { word: '魚', reading: 'さかな', meaning: 'fish' },
        { word: '鳥', reading: 'とり', meaning: 'bird' },
        { word: '本', reading: 'ほん', meaning: 'book' },
        { word: '車', reading: 'くるま', meaning: 'car' },
        { word: '水', reading: 'みず', meaning: 'water' },
        { word: '空', reading: 'そら', meaning: 'sky' },
        { word: '山', reading: 'やま', meaning: 'mountain' },
        { word: '川', reading: 'かわ', meaning: 'river' },
        { word: '木', reading: 'き', meaning: 'tree' }
    ];

    // Try to get words from Jisho API first
    for (let i = 0; i < 2; i++) {
        let attempts = 0;
        let randomWord = null;
        
        while (attempts < maxAttempts && (!randomWord || 
               randomWord.meaning === correctMeaning ||
               wrongOptions.some(opt => opt.meaning === randomWord.meaning))) {
            randomWord = await getRandomJishoWord();
            attempts++;
        }
        
        // If we couldn't get a valid word from Jisho, use a fallback
        if (!randomWord) {
            do {
                randomWord = fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
            } while (randomWord.meaning === correctMeaning ||
                    wrongOptions.some(opt => opt.meaning === randomWord.meaning));
        }
        
        wrongOptions.push(randomWord);
    }
    
    return wrongOptions;
}

// Hiragana to romaji mapping
const hiraganaToRomaji = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'を': 'wo', 'ん': 'n',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'きょ': 'kyo', 'きゅ': 'kyu', 'きゃ': 'kya',
    'しょ': 'sho', 'しゅ': 'shu', 'しゃ': 'sha',
    'ちょ': 'cho', 'ちゅ': 'chu', 'ちゃ': 'cha',
    'にょ': 'nyo', 'にゅ': 'nyu', 'にゃ': 'nya',
    'ひょ': 'hyo', 'ひゅ': 'hyu', 'ひゃ': 'hya',
    'みょ': 'myo', 'みゅ': 'myu', 'みゃ': 'mya',
    'りょ': 'ryo', 'りゅ': 'ryu', 'りゃ': 'rya',
    'ぎょ': 'gyo', 'ぎゅ': 'gyu', 'ぎゃ': 'gya',
    'じょ': 'jo', 'じゅ': 'ju', 'じゃ': 'ja',
    'びょ': 'byo', 'びゅ': 'byu', 'びゃ': 'bya',
    'ぴょ': 'pyo', 'ぴゅ': 'pyu', 'ぴゃ': 'pya',
    'っ': '' // Small tsu doubles the following consonant
};

// Function to convert hiragana to romaji
function hiraganaToRomajiConverter(hiragana) {
    let romaji = '';
    let i = 0;
    
    while (i < hiragana.length) {
        // Check for small tsu (っ)
        if (hiragana[i] === 'っ') {
            // If っ is followed by another character, double the consonant
            if (i + 1 < hiragana.length) {
                const nextChar = hiraganaToRomaji[hiragana[i + 1]];
                if (nextChar) {
                    romaji += nextChar[0]; // Add the first consonant
                }
            }
            i++;
            continue;
        }

        // Check for two-character combinations (like きょ)
        if (i + 1 < hiragana.length) {
            const combination = hiragana[i] + hiragana[i + 1];
            if (hiraganaToRomaji[combination]) {
                romaji += hiraganaToRomaji[combination];
                i += 2;
                continue;
            }
        }

        // Single character conversion
        if (hiraganaToRomaji[hiragana[i]]) {
            romaji += hiraganaToRomaji[hiragana[i]];
        } else {
            romaji += hiragana[i]; // Keep unknown characters as-is
        }
        i++;
    }
    
    return romaji;
}

// Function to shorten Jisho URL
async function shortenJishoUrl(word) {
    try {
        const longUrl = `https://jisho.org/word/${encodeURIComponent(word)}`;
        // Using TinyURL's API (no key required)
        const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        if (!response.ok) {
            throw new Error('Failed to shorten URL');
        }
        const shortUrl = await response.text();
        return shortUrl;
    } catch (error) {
        console.error('Error shortening URL:', error);
        // Fallback to search URL if shortening fails
        return `https://jisho.org/search/${encodeURIComponent(word)}`;
    }
}

// Function to check if a string contains kanji
function containsKanji(str) {
    // Kanji Unicode ranges
    return /[\u4E00-\u9FAF]/.test(str);
}

// define your messages in one array:
const timerMessages = [
    'Enjoying the stream? Check out the Discord! https://discord.gg/RaDBSntRZh',
    'Like what you see? Hit that follow button! ❤️',
    'Check out my YouTube content! 🎥 https://www.youtube.com/@RamuneGaming',
    'Use !commands to see all the fun things you can do in chat!',
    'Clip epic moments and share the hype! 🎬'
  ];
  
  /**
   * One self-rescheduling timer that picks a random message every interval.
   */
  function createRandomReminder(client, channel, messages, intervalMs) {
    setTimeout(async () => {
      try {
        const res  = await fetch(`https://tmi.twitch.tv/group/user/ramunegaming/chatters`);
        const data = await res.json();
        const allChatters = Object.values(data.chatters).flat();
        if (allChatters.length >= 3) {
          const msg = messages[Math.floor(Math.random() * messages.length)];
          client.say(channel, msg);
        }
      } catch (err) {
        console.error('Error in reminder:', err);
      }
      // schedule next
      createRandomReminder(client, channel, messages, intervalMs);
    }, intervalMs);
  }
  
  // *** Single connected listener ***
  client.on('connected', (addr, port) => {
    console.log(`Connected as ramunebot to ${addr}:${port}`);
    // start the 20-minute looping reminder:
    createRandomReminder(client, '#ramunegaming', timerMessages, 20 * 60_000);
  });
>>>>>>> origin/main
