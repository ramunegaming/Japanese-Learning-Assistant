// Theme functionality
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-lightbulb';
    }
}

// Main app functionality
let searchHistory = [];
let favorites = [];
let lastSearchResults = null;

// Word Search functionality
async function handleSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) return;

    try {
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = '<p>Searching...</p>';
        resultsContainer.style.display = 'block';

        const response = await fetch(`http://localhost:3001/api/search/words?keyword=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        lastSearchResults = data;
        displayResults(data);
        addToHistory(query);
    } catch (error) {
        console.error('Search error:', error);
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = '<p>Error performing search. Please try again.</p>';
        resultsContainer.style.display = 'block';
    }
}

function displayResults(data) {
    lastSearchResults = data;  // Store the results
    const container = document.getElementById('search-results');
    container.innerHTML = '';
    container.style.display = 'block';
    
    if (!data.data || data.data.length === 0) {
        container.innerHTML = '<p>No results found.</p>';
        return;
    }

    // Get fresh favorites from localStorage
    favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

    data.data.forEach(entry => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'word-card';

        // Japanese word and reading
        const wordHeader = document.createElement('h3');
        const word = entry.japanese[0].word || entry.japanese[0].reading;
        const reading = entry.japanese[0].reading;
        wordHeader.textContent = word;
        if (reading && word !== reading) {
            wordHeader.textContent += ` (${reading})`;
        }
        wordDiv.appendChild(wordHeader);

        // English definitions
        const definitionsList = document.createElement('ul');
        entry.senses.forEach(sense => {
            const defItem = document.createElement('li');
            defItem.textContent = sense.english_definitions.join(', ');
            definitionsList.appendChild(defItem);
        });
        wordDiv.appendChild(definitionsList);

        // Favorite button
        const favoriteButton = document.createElement('button');
        favoriteButton.className = 'favorite-button';
        const isFavorite = favorites.some(f => f.word === word);
        favoriteButton.textContent = isFavorite ? '★' : '☆';
        favoriteButton.addEventListener('click', () => toggleFavorite(word, reading, entry.senses[0].english_definitions.join(', ')));
        wordDiv.appendChild(favoriteButton);

        container.appendChild(wordDiv);
    });
}

// History functionality
function addToHistory(query) {
    searchHistory.unshift(query);
    if (searchHistory.length > 10) {
        searchHistory.pop();
    }
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    historyList.style.display = 'block';

    if (searchHistory.length === 0) {
        historyList.innerHTML = '<p>No search history</p>';
        return;
    }

    searchHistory.forEach(query => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const queryText = document.createElement('span');
        queryText.textContent = query;
        historyItem.appendChild(queryText);
        
        const searchButton = document.createElement('button');
        searchButton.textContent = 'Search';
        searchButton.addEventListener('click', () => {
            document.getElementById('search-input').value = query;
            handleSearch();
            showPage('search');
        });
        historyItem.appendChild(searchButton);
        
        historyList.appendChild(historyItem);
    });
}

// Favorites functionality
function cleanMeaning(meaning) {
    return meaning.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

async function toggleFavorite(word, reading, meaning) {
    // Get current favorites from localStorage
    favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    
    // Check if word is already in favorites
    const index = favorites.findIndex(f => f.word === word);
    
    if (index !== -1) {
        // Remove from favorites
        favorites.splice(index, 1);
        
        // Also remove from server/chatbot
        try {
            const response = await fetch('http://localhost:3001/api/favorites/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ favorites: favorites })
            });
            
            if (!response.ok) {
                console.error('Failed to sync favorites with server');
            }
        } catch (error) {
            console.error('Error syncing favorites with server:', error);
        }
    } else {
        // Add to favorites if not at limit
        if (favorites.length >= 5) {
            alert('Maximum of 5 favorites allowed. Please remove some before adding more.');
            return;
        }
        
        // Clean the meaning before adding
        const cleanedMeaning = cleanMeaning(meaning);
        favorites.push({ word, reading, meaning: cleanedMeaning });

        // Sync with server after adding
        try {
            const response = await fetch('http://localhost:3001/api/favorites/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ favorites: favorites })
            });
            
            if (!response.ok) {
                console.error('Failed to sync favorites with server');
            }
        } catch (error) {
            console.error('Error syncing favorites with server:', error);
        }
    }
    
    // Update localStorage
    localStorage.setItem('favorites', JSON.stringify(favorites));
    
    // Update displays
    updateFavoritesDisplay();
    
    // Update the star button that was clicked
    if (lastSearchResults) {
        displayResults(lastSearchResults);
    }
}

function updateFavoritesDisplay() {
    const favoritesList = document.getElementById('favorites-list');
    favoritesList.innerHTML = ''; // Clear existing favorites

    // Get favorites from localStorage
    const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

    favorites.forEach(favorite => {
        const li = document.createElement('li');
        li.className = 'favorite-item';
        li.style.textAlign = 'left';  // Ensure left alignment

        // Create the word display container
        const wordContainer = document.createElement('span');
        wordContainer.className = 'word-container';

        // Only show reading in parentheses if the word contains kanji
        const wordDisplay = containsKanji(favorite.word) ? 
            `${favorite.word} (${favorite.reading}): ` : 
            `${favorite.word}: `;

        // Create text node for word display
        const wordText = document.createTextNode(wordDisplay);
        wordContainer.appendChild(wordText);

        // Create meaning span
        const meaningSpan = document.createElement('span');
        meaningSpan.className = 'meaning';
        meaningSpan.textContent = favorite.meaning;

        // Create remove button
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-favorite';
        removeButton.innerHTML = '<i class="fas fa-heart"></i>';
        removeButton.onclick = () => toggleFavorite(favorite.word, favorite.reading, favorite.meaning);

        // Append elements in order
        li.appendChild(wordContainer);
        li.appendChild(meaningSpan);
        li.appendChild(removeButton);
        favoritesList.appendChild(li);
    });

    // Update the counter
    const counter = document.getElementById('favorites-counter');
    if (counter) {
        counter.textContent = `${favorites.length}/5`;
    }
}

// Function to check if a string contains kanji
function containsKanji(str) {
    // Kanji Unicode ranges
    return /[\u4E00-\u9FAF]/.test(str);
}

// Navigation functionality
function showPage(pageId) {
    // Remove active class from all pages and nav items
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    // Add active class to selected page and nav item
    document.getElementById(`${pageId}-page`).classList.add('active');
    document.querySelector(`.nav-item[data-page="${pageId}"]`).classList.add('active');
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initTheme();
    
    // Load search history
    searchHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    updateHistoryDisplay();
    
    // Load favorites
    favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
    updateFavoritesDisplay();
    
    // Add event listeners
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('search-button').addEventListener('click', handleSearch);
    document.getElementById('search-input').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSearch();
        }
    });
    
    // Navigation event listeners
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (event) => {
            event.preventDefault();
            const pageId = item.getAttribute('data-page');
            showPage(pageId);
        });
    });
});
