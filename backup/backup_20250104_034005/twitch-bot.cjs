require('dotenv').config();
const express = require('express');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const tmi = require('tmi.js');

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Serve static files from the public directory
app.use(express.static('public'));

// Middleware to parse JSON bodies
app.use(express.json());

// Function to load favorites from file
async function loadFavorites() {
    try {
        // Read the file fresh each time
        const data = await fs.readFile('favorites.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            // If file doesn't exist, create it with empty array
            await fs.writeFile('favorites.json', '[]');
            return [];
        }
        console.error('Error loading favorites:', error);
        return [];
    }
}

// Function to save favorites to file
async function saveFavorites(favorites) {
    await fs.writeFile('favorites.json', JSON.stringify(favorites, null, 2));
}

// Endpoint to search for sentences
app.get('/api/search/sentences', async (req, res) => {
    try {
        const keyword = req.query.keyword;
        if (!keyword) {
            return res.status(400).json({ error: 'Keyword is required' });
        }

        // Fetch the search results page
        const response = await fetch(`https://jisho.org/search/${encodeURIComponent(keyword)}%20%23sentences`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch from Jisho');
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Extract sentences
        const sentences = [];
        $('.sentence_content').each((i, elem) => {
            const japanese = $(elem).find('.japanese_sentence').text().trim();
            const english = $(elem).find('.english_sentence').text().trim();
            
            if (japanese && english) {
                sentences.push({ japanese, english });
            }
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
        if (!word || !reading || !meaning) {
            return res.status(400).json({ error: 'Word, reading, and meaning are required' });
        }

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

// Endpoint to remove a favorite
app.post('/api/favorites/remove', async (req, res) => {
    try {
        console.log('Removing favorite:', req.body.word); // Debug log
        const { word } = req.body;
        if (!word) {
            return res.status(400).json({ error: 'Word is required' });
        }

        const favorites = await loadFavorites();
        console.log('Current favorites:', favorites); // Debug log
        const updatedFavorites = favorites.filter(fav => fav.word !== word);
        console.log('Updated favorites:', updatedFavorites); // Debug log

        await fs.writeFile('favorites.json', JSON.stringify(updatedFavorites, null, 2));
        res.json({ success: true, updatedFavorites });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ error: 'Failed to remove favorite' });
    }
});

// Add this new endpoint to sync favorites
app.post('/api/favorites/sync', async (req, res) => {
    try {
        const { favorites } = req.body;
        if (!Array.isArray(favorites)) {
            return res.status(400).json({ error: 'Favorites must be an array' });
        }

        await fs.writeFile('favorites.json', JSON.stringify(favorites, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Error syncing favorites:', error);
        res.status(500).json({ error: 'Failed to sync favorites' });
    }
});

// Create Twitch client
const client = new tmi.Client({
    options: { debug: true },
    identity: {
        username: 'ramunegaming',
        password: process.env.TWITCH_OAUTH || 'oauth:' // Use environment variable for security
    },
    channels: ['ramunegaming']
});

// Connect to Twitch and handle connection events
client.connect().catch(console.error);

client.on('connected', (addr, port) => {
    console.log(`* Connected to ${addr}:${port}`);
});

client.on('disconnected', (reason) => {
    console.log(`* Disconnected: ${reason}`);
});

// Quiz state management
let currentQuiz = null;

// Function to shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

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

// Handle !japanesetoday command
client.on('message', async (channel, tags, message, self) => {
    if (self) return;

    // Handle different commands
    switch (message.toLowerCase()) {
        case '!japanesetoday':
            try {
                // Always load fresh favorites
                const favorites = await loadFavorites();
                if (favorites.length === 0) {
                    client.say(channel, 'No Japanese words saved yet!');
                    return;
                }

                // Get the last 5 favorites (or all if less than 5)
                const recentFavorites = favorites.slice(-5);
                
                // Process all URLs first
                const processedFavorites = await Promise.all(recentFavorites.map(async fav => {
                    const shortUrl = await shortenJishoUrl(fav.word);
                    const cleanMeaning = fav.meaning.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
                    return {
                        ...fav,
                        shortUrl,
                        cleanMeaning
                    };
                }));

                const wordList = processedFavorites
                    .map(fav => {
                        // Only include reading in parentheses if the word contains kanji
                        const wordDisplay = containsKanji(fav.word) ? 
                            `${fav.word} (${fav.reading})` : 
                            fav.word;
                        return `${wordDisplay} ${fav.cleanMeaning}: ${fav.shortUrl}`;
                    })
                    .join(' || ');

                client.say(channel, `Latest Japanese Words: ${wordList}`);
            } catch (error) {
                console.error('Error handling Twitch command:', error);
                client.say(channel, 'Sorry, something went wrong!');
            }
            break;

        case '!discord':
            // Discord invitation message
            const discordMessage = "🎉 Join Our Community on Discord! 🎮 " +
                "Looking for a place to hang out, share laughs, and catch all the latest updates? " +
                "Come join our awesome community! Chat with fellow viewers, interact with immersive channels, and be part of the action. " +
                "Hop in here: https://discord.gg/RaDBSntRZh";
            client.say(channel, discordMessage);
            break;

        // Handle quiz answers
        default:
            if (currentQuiz && /^[abc]$/.test(message.toLowerCase())) {
                const userAnswer = message.toLowerCase().charCodeAt(0) - 97; // Convert a/b/c to 0/1/2
                const isCorrect = userAnswer === currentQuiz.correctAnswer;
                
                if (isCorrect) {
                    client.say(channel, `@${tags.username} Correct, good job!`);
                } else {
                    client.say(channel, `@${tags.username} Maybe next time!`);
                }
                
                // Clear current quiz after someone answers
                currentQuiz = null;
            }
            break;
    }
});

// Handle !quiz command
client.on('message', async (channel, tags, message, self) => {
    if (self) return;
    if (message.toLowerCase() === '!quiz') {
        try {
            const favorites = await loadFavorites();
            if (favorites.length === 0) {
                client.say(channel, 'No Japanese words available for quiz! Add some words first using the website.');
                return;
            }

            // Select random word from favorites as the question
            const correctWord = favorites[Math.floor(Math.random() * favorites.length)];
            
            // Get wrong options with fallback support
            const wrongOptions = await getWrongOptions(correctWord.meaning);
            
            // Combine with correct answer and shuffle
            const options = shuffleArray([
                { ...correctWord, isCorrect: true },
                ...wrongOptions.map(opt => ({ ...opt, isCorrect: false }))
            ]);
            
            // Store current quiz state
            currentQuiz = {
                word: correctWord.word,
                reading: correctWord.reading,
                correctAnswer: options.findIndex(opt => opt.isCorrect),
                options: options
            };

            // Format quiz message
            const optionsText = options
                .map((opt, index) => `${String.fromCharCode(97 + index)}) ${opt.meaning}`)
                .join(' ');

            client.say(channel, `Quiz Time! Which of the following words means '${correctWord.reading} (${correctWord.word})'? ${optionsText}`);
        } catch (error) {
            console.error('Error generating quiz:', error);
            client.say(channel, 'Sorry, something went wrong with the quiz!');
        }
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Function to read JSON files asynchronously
async function loadJSON(filename) {
    try {
        const data = await fs.readFile(filename, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error reading ${filename}:`, error);
        return [];
    }
}

// Read quotes and facts from JSON files asynchronously
let quotes = [];
let facts = [];

(async () => {
    quotes = await loadJSON('./quotes.json');
    facts = await loadJSON('./facts.json');
})();

// Track the stream start time when it goes live
let streamStartTime = Date.now(); // Set this when the stream actually starts

client.on('message', async (channel, userstate, message, self) => {  // <-- Add async here
    if (self) return; // Ignore the bot's own messages

    lastChatTime = Date.now();

    const command = message.toLowerCase();

    // Handle !uptime command
    if (command === '!uptime') {
        // Calculate uptime based on the stream start time
        const currentTime = Date.now();
        const uptimeInMillis = currentTime - streamStartTime; // Time difference in milliseconds
        const uptimeInMinutes = Math.floor(uptimeInMillis / 60000); // Convert to minutes
        const hours = Math.floor(uptimeInMinutes / 60); // Convert minutes to hours
        const minutes = uptimeInMinutes % 60; // Remaining minutes

        // Respond with actual uptime
        client.say(channel, `The stream has been live for ${hours} hours and ${minutes} minutes!`);
    }

    // if (command === '!quote') {
    //     const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    //     client.say(channel, randomQuote);
    // }

    if (command.startsWith('!addquote')) {
        const newQuote = message.slice(9).trim();
        if (newQuote) {
            quotes.push(newQuote);
            try {
                await fs.writeFile('./quotes.json', JSON.stringify(quotes, null, 2));
                client.say(channel, `New quote added: "${newQuote}"`);
            } catch (error) {
                console.error('Error writing to quotes.json:', error);
                client.say(channel, 'Failed to save the new quote.');
            }
        } else {
            client.say(channel, 'Please provide a quote to add!');
        }
    }

    if (command.startsWith('!hug ')) {
        const target = message.split(' ')[1];
        client.say(channel, `${userstate.username} gives ${target} a big warm hug! 🤗`);
    }

    if (command.startsWith('!shoutout ')) {
        const streamer = message.split(' ')[1];
        client.say(channel, `Go check out @${streamer} at twitch.tv/${streamer} 🚀`);
    }

    // if (command === '!fact') {
    //     const randomFact = facts[Math.floor(Math.random() * facts.length)];
    //     client.say(channel, randomFact);
    // }

    if (command.startsWith('!8ball ')) {
        const responses = [
            'Yes.', 'No.', 'Maybe.', 'Ask again later.', 'Definitely not.',
            'It is certain.', 'Don’t count on it.'
        ];
        const response = responses[Math.floor(Math.random() * responses.length)];
        client.say(channel, `Magic 8-Ball says: ${response}`);
    }
});

client.on('message', (channel, userstate, message, self) => {
    // Check if the message is the !commands command
    if (message.toLowerCase() === '!commands') {
      const commandList = [
        '!uptime - Checks streams uptime',
        '!quote - Retrieves a random quote (inactive)',
        '!hug [username] - Sends a virtual hug',
        '!shoutout [username] - Gives a shoutout to a user',
        '!fact - Returns a random fact (inactive)',
        '!8ball [question] - Answers your question with a random response'
      ];
      
      // Join the commands with pipe separators for readability in chat
      client.say(channel, `Available Commands: ${commandList.join(', ')}`);
    }
  });

// Track recent message timestamps per user
let userMessageCount = {}; 

client.on('messageCreate', (message) => {
    if (message.author.bot) return; // Ignore bot messages

    const username = message.author.username;
    const now = Date.now();

    // Initialize user message tracking if not present
    if (!userMessageCount[username]) {
        userMessageCount[username] = [];
    }

    // Add current timestamp for the user
    userMessageCount[username].push(now);

    // Remove messages older than 15 minutes
    const fifteenMinutesAgo = now - 900000; // 15 minutes in ms
    userMessageCount[username] = userMessageCount[username].filter(timestamp => timestamp > fifteenMinutesAgo);

    // Debug log to verify message tracking
    console.log(`[DEBUG] ${username} has sent ${userMessageCount[username].length} messages in the last 15 minutes.`);
});

// Checks if **any single user** has sent at least 5 messages in the last 15 minutes
function isChatActive() {
    return Object.values(userMessageCount).some(messages => messages.length >= 5);
}

/**
 * Creates a self-rescheduling reminder that checks for chat activity before sending.
 * @param {Object} client - Your bot client.
 * @param {string} channelName - The channel where the reminder should be sent.
 * @param {string} messageText - The reminder message.
 * @param {number} intervalMs - Interval time in milliseconds.
 */
function createReminder(client, channelName, messageText, intervalMs) {
    setTimeout(() => {
        if (isChatActive()) {
            console.log("[DEBUG] Chat activity detected. Posting reminder...");
            client.say(channelName, messageText);
        } else {
            console.log("[DEBUG] Reminder skipped - not enough activity.");
        }
        // Reschedule the reminder
        createReminder(client, channelName, messageText, intervalMs);
    }, intervalMs);
}

// Start all reminder timers when the bot connects
client.on('connected', (address, port) => {
    console.log(`Bot connected at ${address}:${port}`);

    createReminder(client, '#ramunegaming', 'Enjoying the stream? Check out the Discord! https://discord.gg/V5CwPn6mjU', 20 * 60000);
    createReminder(client, '#ramunegaming', 'Like what you see? Hit that follow button! ❤️', 30 * 60000);
    createReminder(client, '#ramunegaming', 'Check out my YouTube content! 🎥 https://www.youtube.com/@RamuneGaming', 45 * 60000);
    createReminder(client, '#ramunegaming', 'Use !commands to see all the fun things you can do in chat!', 25 * 60000);
    createReminder(client, '#ramunegaming', 'Clip epic moments and share the hype! 🎬', 35 * 60000);
});