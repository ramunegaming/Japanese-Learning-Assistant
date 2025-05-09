// Import Kuroshiro from CDN
const kuroshiro = window.Kuroshiro.default;
const analyzer = window.KuromojiAnalyzer;

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
    return `<ruby>${kanji}<rt>${reading}</rt></ruby>`;
}

// Process a sentence for display
export async function processSentence(sentence) {
    try {
        if (!sentence?.japanese?.cleaned || !Array.isArray(sentence.japanese.readings)) {
            console.error('Invalid sentence structure:', sentence);
            return sentence;
        }

        let displayText = sentence.japanese.cleaned;
        
        // Sort readings by position in reverse order (to avoid affecting earlier positions)
        const sortedReadings = [...sentence.japanese.readings].sort((a, b) => b.position - a.position);
        
        // Replace each kanji with its ruby markup
        for (const {kanji, reading} of sortedReadings) {
            const rubyMarkup = createRubyMarkup(kanji, reading);
            displayText = displayText.replace(kanji, rubyMarkup);
        }

        return {
            japanese: displayText,
            english: sentence.english
        };
    } catch (error) {
        console.error('Error processing sentence:', error);
        // Return original sentence if processing fails
        return sentence;
    }
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

        // Convert the text using Kuroshiro
        const result = await kuroshiroInstance.convert(text, {
            mode: 'furigana',
            to: 'hiragana',
            // Ensure we're using HTML ruby tags
            romajiSystem: null
        });
        
        console.log('Conversion result:', result);
        return result;
    } catch (error) {
        console.error('Error converting to furigana:', error);
        console.error('Stack trace:', error.stack);
        throw error; // Propagate the error instead of returning invalid text
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
        
        // Convert the text using Kuroshiro
        const result = await kuroshiroInstance.convert(text, {
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