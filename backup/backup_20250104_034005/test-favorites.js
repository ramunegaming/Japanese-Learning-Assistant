const fs = require('fs');

// Test data
const testFavorites = [
    { word: "猫", meaning: "cat" },
    { word: "犬", meaning: "dog" },
    { word: "本", meaning: "book" }
];

// Write to favorites.json
fs.writeFileSync('favorites.json', JSON.stringify(testFavorites, null, 2), 'utf8');
console.log('Test favorites written to file');

// Read back to verify
const readFavorites = JSON.parse(fs.readFileSync('favorites.json', 'utf8'));
console.log('Read favorites from file:', readFavorites);
