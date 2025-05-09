document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const resultsContainer = document.getElementById('results');
    const loadingSpinner = document.getElementById('loading-spinner');

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const searchTerm = searchInput.value.trim();
        
        if (!searchTerm) return;

        try {
            // Show loading spinner
            loadingSpinner.classList.remove('hidden');
            resultsContainer.innerHTML = '';

            const response = await fetch(`/api/search/words?keyword=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Hide loading spinner
            loadingSpinner.classList.add('hidden');

            if (!data.data || data.data.length === 0) {
                resultsContainer.innerHTML = '<p class="no-results">No words found. Try searching for a different word.</p>';
                return;
            }

            // Create results HTML
            const resultsHTML = data.data.map((item) => {
                const japanese = item.japanese[0];
                const reading = japanese.reading || '';
                const word = japanese.word || '';
                const meanings = item.senses.map((sense, index) => {
                    const englishDefinitions = sense.english_definitions.join('; ');
                    return `<div class="meaning">${index + 1}. ${englishDefinitions}</div>`;
                }).join('');

                return `
                    <div class="word-item">
                        <div class="japanese-text">
                            <span class="word">${word}</span>
                            <span class="reading">${reading}</span>
                        </div>
                        <div class="meanings">
                            ${meanings}
                        </div>
                        <button class="favorite-btn" data-word="${word}" data-reading="${reading}" data-meaning="${item.senses[0].english_definitions[0]}">
                            Add to Favorites
                        </button>
                    </div>
                `;
            }).join('');

            resultsContainer.innerHTML = resultsHTML;

            // Add event listeners to favorite buttons
            document.querySelectorAll('.favorite-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const wordData = {
                        word: this.dataset.word,
                        reading: this.dataset.reading,
                        meaning: this.dataset.meaning
                    };

                    try {
                        const response = await fetch('/api/favorites', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(wordData)
                        });

                        if (!response.ok) {
                            throw new Error('Failed to add to favorites');
                        }

                        this.textContent = 'Added to Favorites';
                        this.disabled = true;
                    } catch (error) {
                        console.error('Error adding to favorites:', error);
                        alert('Failed to add to favorites. Please try again.');
                    }
                });
            });
        } catch (error) {
            console.error('Error searching for words:', error);
            loadingSpinner.classList.add('hidden');
            resultsContainer.innerHTML = `<p class="error">Error performing search. Please try again.</p>`;
        }
    });
});
