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
        const url = `http://localhost:3001/api/search/sentences?keyword=${encodeURIComponent(query)}`;
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
        
        displayExampleResults(data.data);
    } catch (error) {
        console.error('Example search error:', error);
        const resultsContainer = document.getElementById('example-results');
        resultsContainer.innerHTML = '<p>Error searching for examples. Please try again.</p>';
        resultsContainer.style.display = 'block';
    }
}

function displayExampleResults(examples) {
    console.log('Displaying results:', examples);
    const container = document.getElementById('example-results');
    container.innerHTML = '';
    container.style.display = 'block';
    
    if (!examples || !examples.length) {
        console.log('No examples found');
        container.innerHTML = '<p>No examples found. Try searching for a different word.</p>';
        return;
    }

    examples.forEach((example, index) => {
        console.log(`Processing example ${index}:`, example);
        const exampleDiv = document.createElement('div');
        exampleDiv.className = 'example-card';

        // Japanese sentence
        const jpSentence = document.createElement('p');
        jpSentence.className = 'japanese-text';
        jpSentence.textContent = example.japanese;
        exampleDiv.appendChild(jpSentence);

        // English translation
        const enSentence = document.createElement('p');
        enSentence.className = 'english-text';
        enSentence.textContent = example.english;
        exampleDiv.appendChild(enSentence);

        container.appendChild(exampleDiv);
    });
}

// Initialize example search functionality
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing sentence example search...');
    const searchButton = document.getElementById('example-search-button');
    const searchInput = document.getElementById('example-search-input');
    
    if (!searchButton || !searchInput) {
        console.error('Could not find search button or input!');
        return;
    }
    
    // Add event listeners for example search
    searchButton.addEventListener('click', () => {
        console.log('Search button clicked');
        handleExampleSearch();
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            console.log('Enter key pressed in search input');
            handleExampleSearch();
        }
    });
    
    console.log('Sentence example search initialized');
});
