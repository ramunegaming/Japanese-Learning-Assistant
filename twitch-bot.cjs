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
        // Create file and treat as “no favorites yet”
        await fs.writeFile(DATA_FILE, '[]');
        return [];                // ← bail out early for ENOENT
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

// Add this new endpoint to sync favorites
app.post('/api/favorites/sync', async (req, res) => {
    try {
        const { favorites } = req.body;
        if (!Array.isArray(favorites)) {
            return res.status(400).json({ error: 'Favorites must be an array' });
        }

        await fs.writeFile(DATA_FILE, JSON.stringify(favorites, null, 2));
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
        const data = await response.json();

        if (data.data && data.data.length > 0) {
            const result = data.data[0];
            const reading = result.japanese[0].reading || result.japanese[0].word || 'N/A';
            const meaning = result.senses[0].english_definitions.join(', ');
            client.say(channel, `${args}: ${reading} - ${meaning}`);
        } else {
            client.say(channel, `No results found for "${args}"`);
        }
    } catch (error) {
        console.error('Error in !jisho command:', error);
        client.say(channel, "Sorry, there was an error processing your request.");
    }
};

const handleJapaneseTodayCommand = async (channel) => {
    try {
        const favorites = await loadFavorites();
        if (favorites.length === 0) {
            client.say(channel, 'No Japanese words saved yet!');
            return;
        }

        const recentFavorites = favorites.slice(-5);
        const processedFavorites = await Promise.all(recentFavorites.map(async fav => {
            const shortUrl = await shortenJishoUrl(fav.word);
            const cleanMeaning = fav.meaning.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
            return { ...fav, shortUrl, cleanMeaning };
        }));

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
        client.say(channel, 'Sorry, something went wrong!');
    }
};

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
    }
};

const handleHelpCommand = (channel) => {
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

// Connect to Twitch
console.log('→ connecting to Twitch as', client.getOptions().identity.username);
client.connect()
.then(() => {
    console.log('✅ Twitch client connected as', client.getOptions().identity.username);
  })
  .catch(err => {
    console.error('❌ Failed to connect to Twitch:', err);
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