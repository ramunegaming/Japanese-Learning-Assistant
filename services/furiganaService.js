// Import Kuroshiro from CDN
const kuroshiro = window.Kuroshiro.default;
const analyzer = window.KuromojiAnalyzer;

// Special compound dictionary for words Kuroshiro doesn't handle correctly
const specialCompounds = {
  '体中': 'からだじゅう',
  '一員同様': 'いちいんどうよう',
  '精一杯': 'せいいっぱい',
  '朝寝坊': 'あさねぼう',
  '同様': 'どうよう',
  '一員': 'いちいん',
  // Add more problematic compounds as you encounter them
};

// Initialize Kuroshiro instance
let kuroshiroInstance = null;

// Initialize the service
export async function initializeFuriganaService() {
    if (!kuroshiroInstance) {
        console.log('Initializing Furigana Service...');
        try {
            kuroshiroInstance = new kuroshiro();
            await kuroshiroInstance.init(new analyzer());
            console.log('Kuroshiro initialized successfully');
            return true;
        } catch (error) {
            console.error('Error initializing Kuroshiro:', error);
            kuroshiroInstance = null;
            return false;
        }
    }
    return true;
}

// Function to create ruby HTML from kanji and reading
function createRubyMarkup(kanji, reading) {
    // Calculate the relative length ratio considering Japanese character widths
    const kanjiWidth = kanji.length * 1.5; // Japanese characters are typically 1.5x wider
    const readingWidth = reading.length;
    const ratio = readingWidth / kanjiWidth;
    
    // Determine the appropriate class based on length ratio
    let rtClass = '';
    if (ratio > 2.5) {
        rtClass = 'too-long'; // Hide if reading is more than 2.5x longer
    } else if (ratio > 1.5) {
        rtClass = 'long-reading'; // Scale down if reading is 1.5-2.5x longer
    }
    
    // Create the ruby markup with proper alignment
    return `<ruby>${kanji}<rt class="${rtClass}">${reading}</rt></ruby>`;
}

// Pre-process special compounds before any other text handling
function preProcessSpecialCompounds(text) {
    let processedText = text;
    
    // Sort compounds by length (longest first) to avoid partial replacements
    const compounds = Object.keys(specialCompounds).sort((a, b) => b.length - a.length);
    
    for (const compound of compounds) {
        // Use word boundaries when possible to avoid partial matches
        // We need to handle the case where compound might be part of a larger string
        if (text.includes(compound)) {
            const reading = specialCompounds[compound];
            // Single ruby tag for the entire compound
            const rubyMarkup = createRubyMarkup(compound, reading);
            
            // Use regex to replace all occurrences
            // We're using a more precise replacement pattern here
            processedText = processedText.replace(new RegExp(compound, 'g'), rubyMarkup);
        }
    }
    
    return processedText;
}

// Process a sentence for display
export async function processSentence(sentence) {
    try {
        // If we're using backend-processed sentences
        if (sentence?.japanese?.cleaned) {
            // Check for special compounds in the raw text
            let processedText = sentence.japanese.cleaned;
            const rawText = sentence.japanese.raw || 
                            processedText.replace(/<\/?[^>]+(>|$)/g, "");
            
            // First extract existing ruby tags to avoid processing them again
            const existingRubyTags = [];
            let textWithoutRuby = processedText.replace(/<ruby>(.*?)<rt.*?>(.*?)<\/rt><\/ruby>/g, (match) => {
                existingRubyTags.push(match);
                return `__RUBY_TAG_${existingRubyTags.length - 1}__`;
            });
            
            // Process the text for special compounds
            textWithoutRuby = preProcessSpecialCompounds(textWithoutRuby);
            
            // Restore original ruby tags
            let finalProcessed = textWithoutRuby.replace(/__RUBY_TAG_(\d+)__/g, (match, index) => {
                return existingRubyTags[parseInt(index)];
            });
            
            return {
                japanese: finalProcessed,
                english: sentence.english
            };
        } 
        
        // If we have raw text without processing, do full processing
        const rawText = typeof sentence.japanese === 'string' 
                        ? sentence.japanese 
                        : sentence.japanese?.raw;
                        
        if (rawText) {
            const processed = await convertFullTextWithSpecialCases(rawText);
            return {
                japanese: processed,
                english: sentence.english
            };
        }

        console.error('Invalid sentence structure:', sentence);
        return sentence;
    } catch (error) {
        console.error('Error processing sentence:', error);
        return sentence;
    }
}

// Handle full text conversion with special cases
async function convertFullTextWithSpecialCases(text) {
    // First handle special compounds
    let processedText = preProcessSpecialCompounds(text);
    
    // Extract parts that have already been processed
    const processedParts = [];
    let plainText = processedText.replace(/<ruby>(.*?)<rt.*?>(.*?)<\/rt><\/ruby>/g, (match) => {
        processedParts.push(match);
        return `__PROCESSED_PART_${processedParts.length - 1}__`;
    });
    
    // Process remaining text with Kuroshiro
    let kuroshiroResult = '';
    if (plainText.trim() && kuroshiroInstance) {
        try {
            kuroshiroResult = await kuroshiroInstance.convert(plainText, {
                mode: 'furigana',
                to: 'hiragana'
            });
        } catch (err) {
            console.error('Kuroshiro conversion error:', err);
            kuroshiroResult = plainText; // Fallback to plain text
        }
    } else {
        kuroshiroResult = plainText;
    }
    
    // Restore processed parts
    let finalResult = kuroshiroResult.replace(/__PROCESSED_PART_(\d+)__/g, (match, index) => {
        return processedParts[parseInt(index)];
    });
    
    return finalResult;
}

// Convert text to furigana HTML
export async function convertToFurigana(text) {
    try {
        if (!kuroshiroInstance) {
            console.log('Kuroshiro not initialized, initializing now...');
            await initializeFuriganaService();
        }
        
        console.log('\nConverting text to furigana:');
        console.log('Input text:', text);
        
        // Validate input
        if (!text || typeof text !== 'string') {
            console.error('Invalid input text:', text);
            throw new Error('Invalid input: text must be a string');
        }

        // Use our improved function to handle special cases
        const result = await convertFullTextWithSpecialCases(text);
        
        console.log('Conversion result:', result);
        return result;
    } catch (error) {
        console.error('Error converting to furigana:', error);
        console.error('Stack trace:', error.stack);
        throw error;
    }
}

// Convert text to hiragana
export async function convertToHiragana(text) {
    try {
        if (!kuroshiroInstance) {
            console.log('Kuroshiro not initialized, initializing now...');
            await initializeFuriganaService();
        }
        
        console.log('Converting text to hiragana:', text);
        
        // Validate input
        if (!text || typeof text !== 'string') {
            console.error('Invalid input text:', text);
            return text;
        }
        
        // Pre-process special compounds first
        let processedText = text;
        for (const compound in specialCompounds) {
            if (text.includes(compound)) {
                processedText = processedText.replace(
                    new RegExp(compound, 'g'), 
                    specialCompounds[compound]
                );
            }
        }
        
        // Convert the text using Kuroshiro
        const result = await kuroshiroInstance.convert(processedText, {
            mode: 'normal',
            to: 'hiragana'
        });
        
        console.log('Conversion result:', result);
        return result;
    } catch (error) {
        console.error('Error converting to hiragana:', error);
        console.error('Error details:', error.stack);
        // Return original text if conversion fails
        return text;
    }
}