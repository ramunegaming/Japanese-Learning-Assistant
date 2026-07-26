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

        const response = await fetch(`https://jisho.org/search/${encodeURIComponent(keyword)}%20%23sentences`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!response.ok) throw new Error('Failed to fetch from Jisho');

        const html = await response.text();
        const $ = cheerio.load(html);

        const sentences = [];
        $('.sentence_content').each((i, elem) => {
            const japanese = $(elem).find('.japanese_sentence').text().trim();
            const english = $(elem).find('.english_sentence').text().trim();
            if (japanese && english) sentences.push({ japanese, english });
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
        if (!keyword) return res.status(400).json({ error: 'Keyword is required' });

        const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        if (!response.ok) throw new Error('Failed to fetch from Jisho API');

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
        if (!word || !reading || !meaning) return res.status(400).json({ error: 'Word, reading, and meaning are required' });

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

// Endpoint to sync favorites
app.post('/api/favorites/sync', async (req, res) => {
    try {
        const { favorites } = req.body;
        if (!Array.isArray(favorites)) return res.status(400).json({ error: 'Favorites must be an array' });

        await fs.writeFile(DATA_FILE, JSON.stringify(favorites, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error syncing favorites:', error);
        res.status(500).json({ error: 'Failed to sync favorites' });
    }
});

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
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const result = data.data[0];
            const reading = result.japanese[0].reading || result.japanese[0].word || 'N/A';
            const meaning = result.senses[0].english_definitions.join(', ');
            client.say(channel, `${args}: ${reading} - ${meaning}`);
        } else client.say(channel, `No results found for "${args}"`);
    } catch (error) {
        console.error('Error in !jisho command:', error);
        client.say(channel, "Sorry, there was an error processing your request.");
    }
};

const handleJapaneseReviewCommand = async (channel) => {
    try {
        const favorites = await loadFavorites();
        if (favorites.length === 0) { client.say(channel, 'No Japanese words saved yet!'); return; }

        const recentFavorites = favorites.slice(-5);
        const processedFavorites = await Promise.all(recentFavorites.map(async fav => {
            const shortUrl = await shortenJishoUrl(fav.word);
            const cleanMeaning = fav.meaning.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
            return { ...fav, shortUrl, cleanMeaning };
        }));

        const wordList = processedFavorites.map(fav => {
            const wordDisplay = containsKanji(fav.word) ? `${fav.word} (${fav.reading})` : fav.word;
            return `${wordDisplay} ${fav.cleanMeaning}: ${fav.shortUrl}`;
        }).join(' || ');

        client.say(channel, `Latest Japanese Words: ${wordList}`);
    } catch (error) {
        console.error('Error in japanesereview command:', error);
        client.say(channel, 'Sorry, something went wrong!');
    }
};

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
    }
};

const handleHelpCommand = (channel) => {
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

// Connect to Twitch
console.log('→ connecting to Twitch as', client.getOptions().identity.username);
client.connect()
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
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

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