import { initializeFuriganaService, processSentence } from '/services/furiganaService.js';

// Function to initialize the sentence example search functionality
async function initializeSentenceExampleSearch() {
    console.log('Initializing sentence example search...');
    
    // Initialize the furigana service
    const furiganaInitialized = await initializeFuriganaService();
    if (!furiganaInitialized) {
        console.error('Failed to initialize furigana service');
        return;
    }

    // Get DOM elements
    const searchInput = document.getElementById('example-search-input');
    const searchButton = document.getElementById('example-search-button');
    const resultsContainer = document.getElementById('example-results');

    // Function to search for examples
    async function searchExamples(query) {
        try {
            const url = `/api/search/sentences?keyword=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received examples:', data);
            return data;
        } catch (error) {
            console.error('Error fetching examples:', error);
            return null;
        }
    }

    // Function to display results
    async function displayResults(data) {
        if (!data?.data?.length) {
            resultsContainer.innerHTML = '<div class="no-results">No examples found</div>';
            return;
        }

        // Clear previous results
        resultsContainer.innerHTML = '';

        // Process each example
        for (const example of data.data) {
            try {
                // Process the sentence to add furigana
                const processedExample = await processSentence(example);
                
                // Create container for this example
                const exampleDiv = document.createElement('div');
                exampleDiv.className = 'example-card';

                // Create and style Japanese sentence element
                const jpSentence = document.createElement('div');
                jpSentence.className = 'japanese-text';
                jpSentence.innerHTML = processedExample.japanese;

                // Create and style English translation element
                const enSentence = document.createElement('div');
                enSentence.className = 'english-text';
                enSentence.textContent = processedExample.english;

                // Add source attribution
                const attribution = document.createElement('div');
                attribution.className = 'attribution';
                attribution.textContent = '— Jreibun';

                // Assemble the example
                exampleDiv.appendChild(jpSentence);
                exampleDiv.appendChild(enSentence);
                exampleDiv.appendChild(attribution);

                // Add to results container
                resultsContainer.appendChild(exampleDiv);
            } catch (error) {
                console.error('Error processing example:', error);
            }
        }
    }

    // Make search function available globally
    window.handleExampleSearch = async () => {
        const query = searchInput.value.trim();
        if (query) {
            resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
            const results = await searchExamples(query);
            if (results) {
                await displayResults(results);
            }
        }
    };

    // Event handler for search button click
    searchButton.addEventListener('click', window.handleExampleSearch);

    // Event handler for Enter key in search input
    searchInput.addEventListener('keypress', async (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            await window.handleExampleSearch();
        }
    });

    console.log('Sentence example search initialized');
}

// Initialize when the module loads
window.addEventListener('load', initializeSentenceExampleSearch);

export { initializeSentenceExampleSearch }; 