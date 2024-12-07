// Direct API call to Jisho for sentence examples
export async function searchSentences(query) {
    try {
        // We still use the word search API but extract sentences from it
        const response = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`Jisho API error: ${response.status}`);
        }
        const data = await response.json();
        
        // Extract sentences from the response
        const sentences = [];
        if (data && data.data) {
            data.data.forEach(entry => {
                if (entry.senses) {
                    entry.senses.forEach(sense => {
                        if (sense.sentences) {
                            sense.sentences.forEach(sentence => {
                                sentences.push({
                                    japanese: sentence.japanese,
                                    english: sentence.english
                                });
                            });
                        }
                    });
                }
            });
        }
        return sentences;
    } catch (error) {
        console.error('Sentence search error:', error);
        throw error;
    }
}

export function displaySentenceResults(sentences, container) {
    container.innerHTML = '';
    
    if (!sentences || sentences.length === 0) {
        container.innerHTML = '<p>No sentence examples found.</p>';
        return;
    }

    const sentenceList = document.createElement('ul');
    sentenceList.className = 'sentence-list';

    sentences.forEach(sentence => {
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

    container.appendChild(sentenceList);
}
