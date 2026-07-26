const furiganaService = require('./furiganaService');

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
async function testFuriganaService() {
    try {
        console.log('Starting Furigana Service tests...\n');
        
        for (const test of testCases) {
            try {
                console.log(`Test: ${test.description}`);
                console.log(`Input: ${test.text}`);
                
                // Test furigana conversion
                const furigana = await furiganaService.convertToFurigana(test.text);
                console.log(`Furigana HTML: ${furigana}`);
                
                // Test hiragana conversion
                const hiragana = await furiganaService.convertToHiragana(test.text);
                console.log(`Hiragana: ${hiragana}\n`);
                
            } catch (error) {
                console.error(`Error in test "${test.description}":`, error);
                console.log('');
            }
        }
    } catch (error) {
        console.error('Test suite failed:', error);
    }
}

// Run tests
testFuriganaService().then(() => {
    console.log('Tests completed.');
}).catch(error => {
    console.error('Test suite failed:', error);
}); 