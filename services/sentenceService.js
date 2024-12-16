// Service for handling sentence searches
export async function searchSentences(keyword) {
    try {
        const response = await fetch(`/api/search/sentences?keyword=${encodeURIComponent(keyword)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error searching for sentences:', error);
        throw error;
    }
}

// Function to display sentence examples
export function displaySentenceResults(data, resultsContainer) {
    resultsContainer.innerHTML = '';
    
    if (!data || !data.data || data.data.length === 0) {
        resultsContainer.innerHTML = '<p>No sentence examples found.</p>';
        return;
    }

    const sentenceList = document.createElement('ul');
    sentenceList.className = 'sentence-list';

    data.data.forEach(sentence => {
        const sentenceItem = document.createElement('li');
        sentenceItem.className = 'sentence-item';

        const japaneseText = document.createElement('p');
        japaneseText.className = 'japanese-text';
        japaneseText.textContent = sentence.japanese;

        const englishText = document.createElement('p');
        englishText.className = 'english-text';
        englishText.textContent = sentence.english;

        sentenceItem.appendChild(japaneseText);
        sentenceItem.appendChild(englishText);
        sentenceList.appendChild(sentenceItem);
    });

    resultsContainer.appendChild(sentenceList);
}
