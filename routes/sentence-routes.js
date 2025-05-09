import express from 'express';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import kuromoji from 'kuromoji';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let tokenizerInstance = null;

// Special compound dictionary
const specialCompounds = {
  '体中': 'からだじゅう',
  '一員同様': 'いちいんどうよう',
  '精一杯': 'せいいっぱい',
  '朝寝坊': 'あさねぼう',
  '一員': 'いちいん',
  '同様': 'どうよう',
  // Add more as needed
};

function isLatin(text) {
  return /^[A-Za-z\s]+$/.test(text);
}

function getTokenizer() {
  return new Promise((resolve, reject) => {
    if (tokenizerInstance) return resolve(tokenizerInstance);
    const dicPath = path.join(__dirname, '../node_modules/kuromoji/dict');
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err) return reject(err);
      tokenizerInstance = tokenizer;
      resolve(tokenizerInstance);
    });
  });
}

// Process compounds first to ensure they are treated as a single unit
function processCompounds(text) {
  let result = text;
  
  // Sort compounds by length (longest first) to ensure proper replacement
  const compounds = Object.keys(specialCompounds).sort((a, b) => b.length - a.length);
  
  for (const compound of compounds) {
    if (text.includes(compound)) {
      const reading = specialCompounds[compound];
      // Use a single ruby tag for the entire compound
      const ruby = `<ruby>${compound}<rt>${reading}</rt></ruby>`;
      // Use regex with word boundaries if possible to avoid partial matches
      result = result.replace(new RegExp(compound, 'g'), ruby);
    }
  }
  return result;
}

async function tokenizeWithFurigana(text) {
  const tokenizer = await getTokenizer();
  
  // First pass: Process special compounds as whole units with single ruby tags
  let processedText = processCompounds(text);
  
  // Extract parts already processed into ruby tags
  const rubyParts = [];
  const plainText = processedText.replace(/<ruby>(.*?)<rt>(.*?)<\/rt><\/ruby>/g, (match, p1) => {
    rubyParts.push(match);
    // Replace with a placeholder
    return `__RUBY_PART_${rubyParts.length - 1}__`;
  });
  
  // Tokenize the remaining plain text
  const tokens = tokenizer.tokenize(plainText);
  
  // Create a mapping of tokens to their positions in the text
  const tokenPositions = [];
  let position = 0;
  
  for (const token of tokens) {
    tokenPositions.push({
      token,
      start: position,
      end: position + token.surface_form.length
    });
    position += token.surface_form.length;
  }
  
  // Process remaining text with normal tokenization
  let result = '';
  let currentPos = 0;
  
  for (let i = 0; i < plainText.length; i++) {
    // Check if we're at a placeholder
    const placeholderMatch = plainText.substring(i).match(/^__RUBY_PART_(\d+)__/);
    if (placeholderMatch) {
      // Insert the original ruby markup
      result += rubyParts[parseInt(placeholderMatch[1])];
      // Skip ahead
      i += placeholderMatch[0].length - 1;
      continue;
    }
    
    const char = plainText[i];
    
    if (/[\u4E00-\u9FFF]/.test(char)) {
      // It's a kanji, try to find its reading
      
      // Find the token that contains this position
      const relevantToken = tokenPositions.find(tp => 
        i >= tp.start && i < tp.end
      );
      
      if (relevantToken && relevantToken.token.reading) {
        const token = relevantToken.token;
        
        // Convert katakana to hiragana
        const hiragana = token.reading.replace(/[\u30A1-\u30F6]/g, ch =>
          String.fromCharCode(ch.charCodeAt(0) - 0x60)
        );
        
        // Get position of this character within the token
        const charPosInToken = i - relevantToken.start;
        
        // If multi-character token, try to map reading specifically
        if (token.surface_form.length > 1) {
          // Approximate reading for this specific kanji
          const readingPerChar = Math.ceil(hiragana.length / token.surface_form.length);
          const startPos = charPosInToken * readingPerChar;
          const endPos = Math.min(startPos + readingPerChar, hiragana.length);
          const charReading = hiragana.substring(startPos, endPos);
          
          result += `<ruby>${char}<rt>${charReading}</rt></ruby>`;
        } else {
          result += `<ruby>${char}<rt>${hiragana}</rt></ruby>`;
        }
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }

  return { raw: text, cleaned: result };
}

router.get('/search/sentences', async (req, res) => {
  try {
    const query = (req.query.keyword || '').trim();
    if (!query) {
      return res.status(400).json({ error: 'No keyword provided' });
    }

    let searchTerm = query;

    if (isLatin(query)) {
      try {
        const apiRes = await fetch(
          `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(query)}`
        );
        if (apiRes.ok) {
          const { data } = await apiRes.json();
          const entry = data[0]?.japanese?.[0];
          if (entry) {
            searchTerm = entry.word || entry.reading || searchTerm;
          }
        }
      } catch (e) {
        console.warn('Words API failed:', e);
      }
    }

    if (isLatin(searchTerm)) {
      const pageRes = await fetch(`https://jisho.org/search/${encodeURIComponent(query)}`);
      const pageHtml = await pageRes.text();
      const $w = cheerio.load(pageHtml);
      const entry = $w('.concept_light').first();
      const headword = entry.find('.concept_light-representation span.text').first().text().trim();
      if (headword) searchTerm = headword;
    }

    const url = `https://jisho.org/search/${encodeURIComponent(searchTerm)}%20%23sentences`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!resp.ok) throw new Error(`Sentences page HTTP ${resp.status}`);

    const html = await resp.text();
    const $ = cheerio.load(html);
    const sentences = [];

    for (const el of $('.sentence').toArray()) {
      const japHtml = $(el).find('.japanese_sentence').text().trim();
      const engText = $(el).find('.english').text().trim();
      if (japHtml && engText) {
        // Process with tokenizer and handle compounds
        const processed = await tokenizeWithFurigana(japHtml);
        sentences.push({
          japanese: processed,
          english: engText
        });
      }
    }

    return res.json({ data: sentences });
  } catch (err) {
    console.error('Error in /search/sentences:', err);
    return res.status(500).json({ error: 'Failed to fetch sentence examples' });
  }
});

export default router;