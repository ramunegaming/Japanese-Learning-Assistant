// Import Kuroshiro from CDN
const kuroshiro = window.Kuroshiro.default;
const analyzer = window.KuromojiAnalyzer;

// Initialize Kuroshiro instance
let kuroshiroInstance = null;

// Initialize the service
export async function init() {
    if (!kuroshiroInstance) {
        console.log('Initializing Furigana Service...');
        try {
            kuroshiroInstance = new kuroshiro();
            await kuroshiroInstance.init(new analyzer());
            console.log('Kuroshiro initialized successfully');
            
            // Test initialization with a sample sentence
            const testSentence = '猫が体中を丁寧に舐めて毛づくろいをしている。';
            try {
                const result = await convertToFurigana(testSentence);
                console.log('Initialization test result:', result);
            } catch (error) {
                console.error('Initialization test failed:', error);
            }
        } catch (error) {
            console.error('Error initializing Kuroshiro:', error);
            console.error('Stack trace:', error.stack);
            kuroshiroInstance = null;
            throw error;
        }
    }
    return kuroshiroInstance;
}

// Convert text to furigana HTML
export async function convertToFurigana(text) {
    try {
        if (!kuroshiroInstance) {
            console.log('Kuroshiro not initialized, initializing now...');
            await init();
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

// Process a sentence for display
export async function processSentence(sentence) {
    try {
        console.log('\nProcessing sentence for display:');
        console.log('Input sentence:', sentence);
        
        // Validate sentence structure
        if (!sentence?.japanese?.cleaned) {
            console.error('Invalid sentence structure:', sentence);
            throw new Error('Invalid sentence structure');
        }
        
        // Get the cleaned Japanese text
        const cleanedText = sentence.japanese.cleaned;
        console.log('Cleaned text to process:', cleanedText);
        
        // Convert the cleaned Japanese text to include furigana
        const processedJapanese = await convertToFurigana(cleanedText);
        
        return {
            japanese: {
                raw: sentence.japanese.raw,
                cleaned: cleanedText,
                withFurigana: processedJapanese
            },
            english: sentence.english
        };
    } catch (error) {
        console.error('Error processing sentence:', error);
        console.error('Stack trace:', error.stack);
        // Return a fallback structure with the cleaned text
        return {
            japanese: {
                raw: sentence.japanese.raw,
                cleaned: sentence.japanese.cleaned,
                withFurigana: sentence.japanese.cleaned // Fallback to cleaned text
            },
            english: sentence.english
        };
    }
}

// Convert text to hiragana
export async function convertToHiragana(text) {
    try {
        if (!kuroshiroInstance) {
            console.log('Kuroshiro not initialized, initializing now...');
            await init();
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