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

            const response = await fetch(`/api/search/sentences?keyword=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Hide loading spinner
            loadingSpinner.classList.add('hidden');

            if (!data.data || data.data.length === 0) {
                resultsContainer.innerHTML = '<p class="no-results">No examples found. Try searching for a different word.</p>';
                return;
            }

            // Create results HTML
            const resultsHTML = data.data.map((item, index) => `
                <div class="example-item">
                    <div class="japanese-text">${item.japanese}</div>
                    <div class="english-text">${item.english}</div>
                </div>
            `).join('');

            resultsContainer.innerHTML = resultsHTML;
        } catch (error) {
            console.error('Error searching for examples:', error);
            loadingSpinner.classList.add('hidden');
            resultsContainer.innerHTML = `<p class="error">Error performing search. Please try again.</p>`;
        }
    });
});
