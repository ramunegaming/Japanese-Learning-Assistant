// Theme handling
export function initializeTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) {
        console.error('Theme toggle button not found');
        return;
    }

    const htmlElement = document.documentElement;
    
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    htmlElement.setAttribute('data-theme', savedTheme);
    updateLightbulbIcon(savedTheme);

    // Theme toggle event listener
    themeToggle.addEventListener('click', handleThemeToggle);
}

function handleThemeToggle() {
    const htmlElement = document.documentElement;
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateLightbulbIcon(newTheme);
}

function updateLightbulbIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (!icon) {
        console.error('Theme toggle icon not found');
        return;
    }

    if (theme === 'dark') {
        icon.classList.remove('fa-lightbulb');
        icon.classList.add('fa-moon');
    } else {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-lightbulb');
    }
}
