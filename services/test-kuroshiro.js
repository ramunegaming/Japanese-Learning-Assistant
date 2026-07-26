const kuroshiro = require('kuroshiro').default;
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');

// Test cases
const testCases = [
    {
        text: '猫は魚が好きです。',
        description: 'Simple sentence with kanji'
    },
    {
        text: '私は日本語を勉強しています。',
        description: 'Sentence with multiple kanji'
    },
    {
        text: 'こんにちは、世界！',
        description: 'Mixed hiragana and kanji'
    },
    {
        text: 'これはテストです。',
        description: 'Only hiragana'
    }
];

// Test function
async function testKuroshiro() {
    try {
        console.log('Creating Kuroshiro instance...');
        const kuroshiroInstance = new kuroshiro();
        
        console.log('Initializing Kuroshiro...');
        await kuroshiroInstance.init(new KuromojiAnalyzer());
        console.log('Kuroshiro initialized successfully');
        
        console.log('\nStarting Kuroshiro tests...\n');
        
        for (const test of testCases) {
            try {
                console.log(`Test: ${test.description}`);
                console.log(`Input: ${test.text}`);
                
                // Test different conversion modes
                console.log('Testing different conversion modes:');
                
                // 1. Convert to hiragana
                const hiragana = await kuroshiroInstance.convert(test.text, {
                    to: 'hiragana'
                });
                console.log(`Hiragana: ${hiragana}`);
                
                // 2. Convert to furigana HTML
                const furigana = await kuroshiroInstance.convert(test.text, {
                    mode: 'furigana',
                    to: 'hiragana'
                });
                console.log(`Furigana HTML: ${furigana}\n`);
                
            } catch (error) {
                console.error(`Error in test "${test.description}":`, error);
                console.log('');
            }
        }
    } catch (error) {
        console.error('Failed to initialize Kuroshiro:', error);
    }
}

// Run tests
testKuroshiro().then(() => {
    console.log('Tests completed.');
}).catch(error => {
    console.error('Test suite failed:', error);
}); 