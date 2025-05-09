import express from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const router = express.Router();

// Function to extract readings and clean text
function processJapaneseSentence(rawText) {
    console.log('\nProcessing sentence:', rawText);
    
    const result = {
        raw: rawText,
        cleaned: rawText,
        readings: []
    };

    // Match patterns where hiragana appears directly before kanji
    // This regex captures: (hiragana sequence)(kanji sequence)
    const pattern = /([ぁ-んー]+)([一-龯々]+)/g;
    let match;
    let lastIndex = 0;
    let cleanedText = rawText;

    // Find all matches and store them
    while ((match = pattern.exec(rawText)) !== null) {
        const [fullMatch, reading, kanji] = match;
        const position = match.index;
        
        // Store the reading and its corresponding kanji
        result.readings.push({
            reading: reading,
            kanji: kanji,
            position: position
        });
        
        console.log(`Found reading: "${reading}" for kanji: "${kanji}"`);
    }

    // Remove all readings that appear before their kanji
    result.cleaned = result.readings.reduce((text, pair) => {
        return text.replace(pair.reading + pair.kanji, pair.kanji);
    }, rawText);

    console.log('Processed result:', result);
    return result;
}

router.get('/search/sentences', async (req, res) => {
    try {
        const query = req.query.keyword;
        if (!query) {
            return res.status(400).json({ error: 'No keyword provided' });
        }

        console.log('Searching for sentences with keyword:', query);

        // Fetch sentences from Jisho
        const url = `https://jisho.org/search/${encodeURIComponent(query)}%20%23sentences`;
        console.log('Fetching from URL:', url);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();
        
        // Parse HTML
        const $ = cheerio.load(html);
        const sentences = [];

        // Find all sentence pairs
        $('.sentence').each((i, elem) => {
            const japanese = $(elem).find('.japanese').text().trim();
            const english = $(elem).find('.english').text().trim();
            
            console.log('\nFound sentence pair:');
            console.log('Japanese:', japanese);
            console.log('English:', english);
            
            if (japanese && english) {
                // Process the Japanese sentence to extract readings and clean text
                const processed = processJapaneseSentence(japanese);
                
                sentences.push({
                    japanese: processed,
                    english: english
                });
            }
        });

        console.log('\nTotal sentences found:', sentences.length);
        return res.json({ data: sentences });

    } catch (error) {
        console.error('Error fetching sentences:', error);
        return res.status(500).json({ error: 'Failed to fetch sentences' });
    }
});

export default router;
