import express from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const router = express.Router();

// Define exceptions that should not be removed
const exceptions = {
    // Particles (助詞)
    particles: [
        'が', 'を', 'に', 'は', 'の', 'で', 'へ', 'と', 'も', 'など', 'まで', 'から',
        'より', 'において', 'について', 'によって', 'として', 'ながら', 'ばかり', 'だけ',
        'しか', 'くらい', 'ほど', 'のに', 'のだ', 'のです', 'かも', 'けど', 'けれど',
        'だの', 'やら', 'こそ', 'さえ', 'しも', 'すら', 'って', 'でも', 'どころ',
        'なり', 'なんて', 'なんと', 'ほか', 'まで', 'もの'
    ],
    
    // Verb and adjective endings (送り仮名)
    verbEndings: [
        'て', 'で', 'た', 'だ', 'ない', 'ます', 'です', 'している', 'していた',
        'られる', 'れる', 'させる', 'たい', 'そう', 'らしい', 'める', 'られ',
        'せる', 'れば', 'らば', 'なら', 'るな', 'んだ', 'のだ', 'のです',
        'ください', 'なさい', 'たら', 'だら', 'えば', 'いる', 'ある', 'くる',
        'いく', 'しまう', 'おく', 'みる', 'しまった', 'ちゃう', 'じゃう',
        'ながら', 'つつ', 'たり', 'だり'
    ]
};

// Helper function to escape regex special characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to clean Japanese text
function cleanJapaneseText(text) {
    console.log('\nCleaning text:', text);
    
    // Step 1: Remove readings in parentheses
    let cleaned = text.replace(/\([^)]+\)/g, '');
    console.log('After removing parentheses:', cleaned);
    
    // Create a regex pattern for exceptions
    const exceptionPattern = [...exceptions.particles, ...exceptions.verbEndings]
        .sort((a, b) => b.length - a.length) // Sort by length descending to match longer patterns first
        .map(escapeRegExp)
        .join('|');
    
    // Step 2: Temporarily mark exceptions with a special marker
    const marker = '###';
    const markedText = cleaned.replace(new RegExp(`(${exceptionPattern})`, 'g'), `${marker}$1${marker}`);
    console.log('After marking exceptions:', markedText);
    
    // Step 3: Remove hiragana before kanji, but preserve marked exceptions
    const cleanedText = markedText.replace(/([ぁ-んー]+)([一-龯々])(?!${marker})/g, '$2');
    console.log('After removing non-exception hiragana:', cleanedText);
    
    // Step 4: Remove markers
    const finalText = cleanedText.replace(new RegExp(marker, 'g'), '');
    console.log('Final cleaned text:', finalText);
    
    return finalText.trim();
}

// Proxy endpoint for Jisho sentences search
router.get('/search/sentences', async (req, res) => {
    try {
        const query = req.query.keyword;
        console.log('Received sentence search request for:', query);

        if (!query) {
            console.error('Missing keyword parameter');
            return res.status(400).json({ error: 'Missing keyword parameter' });
        }

        // Use Jisho's sentence search page
        const url = `https://jisho.org/search/${encodeURIComponent(query)}%20%23sentences`;
        console.log('Fetching from Jisho:', url);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Jisho error:', response.status, errorText);
            return res.status(response.status).json({ error: `Jisho error: ${errorText}` });
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        
        // Extract sentences from the HTML
        const sentences = [];
        
        // Find all sentence pairs
        const sentenceElements = $('.sentence_content');
        console.log('Found sentence elements:', sentenceElements.length);
        
        sentenceElements.each((i, elem) => {
            // Get the raw Japanese text
            const rawJapanese = $(elem).find('.japanese_sentence').text().trim();
            const english = $(elem).find('.english_sentence').text().trim();
            
            console.log(`\nProcessing sentence ${i + 1}:`);
            console.log('Raw Japanese:', rawJapanese);
            
            // Clean the Japanese text
            const cleanedJapanese = cleanJapaneseText(rawJapanese);
            console.log('Cleaned Japanese:', cleanedJapanese);
            console.log('English:', english);
            
            if (cleanedJapanese && english) {
                sentences.push({
                    japanese: cleanedJapanese,
                    english: english
                });
            } else {
                console.warn(`Skipping sentence ${i + 1} due to missing translation`);
            }
        });

        if (sentences.length === 0) {
            console.warn('No sentences found in the response');
            const isSearchPage = $('#main_results').length > 0;
            if (!isSearchPage) {
                console.error('Response does not appear to be a Jisho search page');
            }
        }

        console.log('Successfully extracted sentences:', sentences.length);
        res.json({ data: sentences });
    } catch (error) {
        console.error('Error in sentence search endpoint:', error);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error', 
            details: error.message,
            stack: error.stack 
        });
    }
});

export default router;
