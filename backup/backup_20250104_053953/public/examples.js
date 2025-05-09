import { convertToFurigana } from '../services/furiganaService.js';

// Sentence Examples functionality
async function handleExampleSearch() {
    const query = document.getElementById('example-search-input').value.trim();
    console.log('Searching for examples with query:', query);
    if (!query) return;

    try {
        const resultsContainer = document.getElementById('example-results');
        resultsContainer.innerHTML = '<p>Searching for examples...</p>';
        resultsContainer.style.display = 'block';

        // Log the URL we're fetching from
        const url = `/api/search/sentences?keyword=${encodeURIComponent(query)}`;
        console.log('Fetching from URL:', url);

        const response = await fetch(url);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Received example data:', data);
        
        // Check the structure of the data
        if (!data || !data.data) {
            console.error('Invalid data structure received:', data);
            throw new Error('Invalid data structure received from server');
        }
        
        await displayExampleResults(data.data);
    } catch (error) {
        console.error('Example search error:', error);
        const resultsContainer = document.getElementById('example-results');
        resultsContainer.innerHTML = '<p>Error searching for examples. Please try again.</p>';
        resultsContainer.style.display = 'block';
    }
}

async function displayExampleResults(examples) {
    console.log('Displaying results:', examples);
    const container = document.getElementById('example-results');
    container.innerHTML = '';
    container.style.display = 'block';
    
    if (!examples || !examples.length) {
        console.log('No examples found');
        container.innerHTML = '<p>No examples found. Try searching for a different word.</p>';
        return;
    }

    for (const example of examples) {
        console.log('\nProcessing example:', example);
        const exampleDiv = document.createElement('div');
        exampleDiv.className = 'example-card';

        try {
            // Validate example structure
            if (!example?.japanese || !example.english) {
                throw new Error('Invalid example structure');
            }

            // Process the sentence to add furigana
            const withFurigana = await convertToFurigana(example.japanese);
            console.log('Processed example:', withFurigana);

            // Japanese sentence with furigana
            const jpSentence = document.createElement('div');
            jpSentence.className = 'japanese-text';
            jpSentence.innerHTML = withFurigana;
            exampleDiv.appendChild(jpSentence);

            // English translation
            const enSentence = document.createElement('div');
            enSentence.className = 'english-text';
            enSentence.textContent = example.english;
            exampleDiv.appendChild(enSentence);

            // Debug info (hidden by default)
            const debugInfo = document.createElement('div');
            debugInfo.className = 'debug-info';  // Remove 'hidden' class for debugging
            debugInfo.innerHTML = `
                <details>
                    <summary>Debug Info</summary>
                    <p><strong>Original:</strong> ${example.japanese}</p>
                    <p><strong>With Furigana:</strong> ${withFurigana}</p>
                </details>
            `;
            exampleDiv.appendChild(debugInfo);

            container.appendChild(exampleDiv);
        } catch (error) {
            console.error('Error processing example:', error);
            // Fallback to displaying without furigana
            const jpSentence = document.createElement('div');
            jpSentence.className = 'japanese-text';
            jpSentence.textContent = example.japanese || 'Error displaying sentence';
            exampleDiv.appendChild(jpSentence);

            const enSentence = document.createElement('div');
            enSentence.className = 'english-text';
            enSentence.textContent = example.english || 'Translation not available';
            exampleDiv.appendChild(enSentence);

            // Add error info for debugging
            const errorInfo = document.createElement('div');
            errorInfo.className = 'debug-info';
            errorInfo.innerHTML = `
                <details>
                    <summary>Error Info</summary>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>Raw Data:</strong> ${JSON.stringify(example, null, 2)}</p>
                </details>
            `;
            exampleDiv.appendChild(errorInfo);

            container.appendChild(exampleDiv);
        }
    }
}

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('example-search-form');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleExampleSearch();
        });
    }
}); 