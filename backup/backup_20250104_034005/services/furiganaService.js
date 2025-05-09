const kuroshiro = require('kuroshiro').default;
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');

// Initialize Kuroshiro instance
let kuroshiroInstance = null;

// Initialize the service
async function init() {
    if (!kuroshiroInstance) {
        console.log('Initializing Furigana Service...');
        kuroshiroInstance = new kuroshiro();
        await kuroshiroInstance.init(new KuromojiAnalyzer());
        console.log('Furigana Service initialized successfully');
    }
    return kuroshiroInstance;
}

// Convert text to furigana HTML
async function convertToFurigana(text) {
    try {
        if (!kuroshiroInstance) {
            await init();
        }
        
        // Convert to furigana HTML
        const furigana = await kuroshiroInstance.convert(text, {
            mode: 'furigana',
            to: 'hiragana'
        });
        
        return furigana;
    } catch (error) {
        console.error('Error converting to furigana:', error);
        // Return original text if conversion fails
        return text;
    }
}

// Convert text to hiragana
async function convertToHiragana(text) {
    try {
        if (!kuroshiroInstance) {
            await init();
        }
        
        // Convert to hiragana
        const hiragana = await kuroshiroInstance.convert(text, {
            to: 'hiragana'
        });
        
        return hiragana;
    } catch (error) {
        console.error('Error converting to hiragana:', error);
        // Return original text if conversion fails
        return text;
    }
}

module.exports = {
    init,
    convertToFurigana,
    convertToHiragana
}; 