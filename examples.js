// Import furigana service
import { initializeFuriganaService, processSentence } from './services/furiganaService.js';

// Grab WanaKana from the global scope
const wanakana = window.wanakana;

async function initializeSentenceExampleSearch() {
  // Initialize the furigana service
  const furiganaInitialized = await initializeFuriganaService();
  if (!furiganaInitialized) {
    console.error('Failed to initialize furigana service');
    return;
  }

  // Get DOM elements
  const searchInput      = document.getElementById('example-search-input');
  const searchButton     = document.getElementById('example-search-button');
  const resultsContainer = document.getElementById('example-results');

  if (!searchButton || !searchInput || !resultsContainer) {
    console.error('Missing required DOM elements');
    return;
  }

  // Function to search for examples
  async function searchExamples(query) {
    const url = `/api/search/sentences?keyword=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return response.json();
  }

  // Function to display results
  async function displayResults(data) {
    if (!data?.data?.length) {
      resultsContainer.innerHTML = '<div class="no-results">No examples found</div>';
      return;
    }
    resultsContainer.innerHTML = '';
    for (const example of data.data) {
      const exampleDiv = document.createElement('div');
      exampleDiv.className = 'example-card';

      const processed = await processSentence(example);

      // Plain text for audio + mining (furigana HTML untouched for display)
      const rawJp = (example.japanese && example.japanese.raw)
        || String(processed.japanese).replace(/<[^>]*>/g, '');
      const plainEn = processed.english;

      const icons = document.createElement('div');
      icons.className = 'example-icons';
      const speakBtn = document.createElement('button');
      speakBtn.className = 'icon-btn';
      speakBtn.setAttribute('aria-label', 'Play audio');
      speakBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
      speakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.speakJapanese) window.speakJapanese(rawJp);
      });
      const mineBtn = document.createElement('button');
      mineBtn.className = 'icon-btn' + (window.isMined && window.isMined(rawJp, plainEn) ? ' saved' : '');
      mineBtn.setAttribute('aria-label', 'Mine sentence');
      mineBtn.title = 'Mine sentence';
      mineBtn.innerHTML = '<i class="fas fa-bookmark"></i>';
      mineBtn.addEventListener('click', () => {
        if (!window.toggleMine) return;
        const saved = window.toggleMine(rawJp, plainEn);
        mineBtn.classList.toggle('saved', saved);
      });
      icons.appendChild(speakBtn);
      icons.appendChild(mineBtn);
      exampleDiv.appendChild(icons);

      const jp = document.createElement('div');
      jp.className = 'japanese-text';
      jp.innerHTML = processed.japanese;

      const en = document.createElement('div');
      en.className = 'english-text';
      en.textContent = processed.english;

      const attr = document.createElement('div');
      attr.className = 'attribution';
      attr.textContent = '— Jreibun';

      exampleDiv.append(jp, en, attr);
      resultsContainer.appendChild(exampleDiv);
    }
  }

  // The search handler
  async function handleSearch() {
    let query = searchInput.value.trim();
    if (!query) return;

    // Only transliterate pure-ASCII (romaji/English) queries
    if (/^[A-Za-z\s]+$/.test(query)) {
      query = wanakana.toHiragana(query);
    }

    resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
    try {
      const results = await searchExamples(query);
      await displayResults(results);
      if (window.logStudy) window.logStudy('sentences');
    } catch (err) {
      console.error('Search failed:', err);
      resultsContainer.innerHTML = '<div class="no-results">Error fetching examples</div>';
    }
  }

  // Wire up events *inside* the init function
  searchButton.addEventListener('click', e => {
    e.preventDefault();
    handleSearch();
  });

  searchInput.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  });
}

// Kick it all off
document.addEventListener('DOMContentLoaded', initializeSentenceExampleSearch);
