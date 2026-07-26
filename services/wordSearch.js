// Direct API call to Jisho for word search
export async function searchWord(query) {
    try {
        const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`Jisho API error: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Word search error:', error);
        throw error;
    }
}

export function displayWordResults(data, container) {
    container.innerHTML = '';
    
    if (!data || !data.data || data.data.length === 0) {
        container.innerHTML = '<p>No results found.</p>';
        return;
    }

    data.data.forEach(entry => {
        const wordDiv = document.createElement('div');
        wordDiv.className = 'word-entry';

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

        // Add favorite button
        const favoriteButton = document.createElement('button');
        favoriteButton.className = 'favorite-button';
        favoriteButton.innerHTML = '⭐';
        favoriteButton.onclick = () => {
            const event = new CustomEvent('toggleFavorite', { 
                detail: { 
                    word: word,
                    reading: reading,
                    meanings: entry.senses[0].english_definitions
                } 
            });
            document.dispatchEvent(event);
        };
        wordDiv.appendChild(favoriteButton);

        container.appendChild(wordDiv);
    });
}
