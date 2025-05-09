// Import furigana service
import { initializeFuriganaService, processSentence } from './services/furiganaService.js';

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

    if (!searchButton || !searchInput || !resultsContainer) {
        console.error('Could not find required DOM elements:', {
            searchButton: !!searchButton,
            searchInput: !!searchInput,
            resultsContainer: !!resultsContainer
        });
        return;
    }

    console.log('Found all required DOM elements');

    // Function to search for examples
    async function searchExamples(query) {
        console.log('Searching for examples with query:', query);
        try {
            const url = `/api/search/sentences?keyword=${encodeURIComponent(query)}`;
            console.log('Fetching from URL:', url);
            
            const response = await fetch(url);
            console.log('Response status:', response.status);
            
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
        console.log('Displaying results:', data);
        
        if (!data?.data?.length) {
            resultsContainer.innerHTML = '<div class="no-results">No examples found</div>';
            return;
        }

        // Clear previous results
        resultsContainer.innerHTML = '';

        // Process each example
        for (const example of data.data) {
            try {
                console.log('Processing example:', example);
                
                // Create container for this example
                const exampleDiv = document.createElement('div');
                exampleDiv.className = 'example-card';

                // Process the sentence to add furigana
                const processedExample = await processSentence(example);
                console.log('Processed example:', processedExample);

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

    // Define the search handler
    async function handleSearch() {
        console.log('Search handler called');
        const query = searchInput.value.trim();
        if (query) {
            console.log('Processing search for query:', query);
            resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
            const results = await searchExamples(query);
            if (results) {
                await displayResults(results);
            }
        }
    }

    // Add event listeners
    console.log('Adding event listeners');
    searchButton.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Search button clicked');
        handleSearch();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            console.log('Enter key pressed');
            handleSearch();
        }
    });

    console.log('Sentence example search initialized successfully');
}

// Initialize when the DOM is loaded
console.log('Setting up load event listener');
document.addEventListener('DOMContentLoaded', initializeSentenceExampleSearch);

export { initializeSentenceExampleSearch };
