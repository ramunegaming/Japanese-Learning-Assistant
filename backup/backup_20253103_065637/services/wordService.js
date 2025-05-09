// Service for handling word searches
export async function searchWord(keyword) {
    try {
        const response = await fetch(`/api/search/words?keyword=${encodeURIComponent(keyword)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error searching for word:', error);
        throw error;
    }
}

// Function to display word search results
export function displayWordResults(data, resultsContainer) {
    resultsContainer.innerHTML = '';
    
    if (!data || !data.data || data.data.length === 0) {
        resultsContainer.innerHTML = '<p>No results found.</p>';
        return;
    }

    data.data.forEach(entry => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'word-entry';

        // Japanese word and reading
        const wordHeader = document.createElement('h3');
        wordHeader.textContent = entry.japanese[0].word || entry.japanese[0].reading;
        if (entry.japanese[0].word && entry.japanese[0].reading) {
            wordHeader.textContent += ` (${entry.japanese[0].reading})`;
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

        resultsContainer.appendChild(wordDiv);
    });
}
