// Navigation handling
export function initializeNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', handleNavClick);
    });
}

function handleNavClick(e) {
    e.preventDefault();
    let target = e.target;
    
    // If clicked on the span inside the nav-item, get the parent nav-item
    if (target.tagName.toLowerCase() === 'span') {
        target = target.parentElement;
    }
    
    const pageId = target.dataset.page;
    if (pageId) {
        showPage(pageId);
    }
}

export function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active', 'fade-in');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const selectedPage = document.getElementById(`${pageId}-page`);
    const selectedNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    
    if (selectedPage && selectedNav) {
        selectedPage.offsetHeight;
        selectedPage.classList.add('active');
        selectedNav.classList.add('active');
        requestAnimationFrame(() => {
            selectedPage.classList.add('fade-in');
        });
    }
}
