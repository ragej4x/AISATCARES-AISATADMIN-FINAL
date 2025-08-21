// Theme handling for AISAT Admin
document.addEventListener('DOMContentLoaded', () => {
    // Apply saved theme
    applyTheme();
    
    // Set up admin online status tracking
    setupAdminOnlineStatus();
});

// Check if user has a preferred theme stored
let theme = localStorage.getItem('theme');

// If no theme is stored, check for system preference
if (!theme) {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        theme = 'dark';
    } else {
        theme = 'light';
    }
}

// Apply the theme
document.documentElement.setAttribute('data-theme', theme);

// Function to toggle between light and dark themes
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Add event listener if theme toggle is present
document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
});

// Function to apply theme from localStorage
function applyTheme() {
    // Get theme from localStorage (default to light if not set)
    const theme = localStorage.getItem('adminTheme') || 'light';
    
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    
    console.log(`Applied theme: ${theme}`);
}

// Apply theme when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    applyTheme();
    
    // Listen for theme changes in localStorage
    window.addEventListener('storage', function(e) {
        if (e.key === 'adminTheme') {
            applyTheme();
        }
    });
});

// Apply theme immediately in case script loads after DOM is ready
applyTheme();

function setupAdminOnlineStatus() {
    // Check if user is logged in as admin
    const token = localStorage.getItem('userToken');
    if (!token) return;
    
    // Function to update admin's online status
    function updateOnlineStatus() {
        const baseUrl = "https://jimboyaczon.pythonanywhere.com";
        fetch(`${baseUrl}/api/admin/update-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'online' })
        })
        .then(response => {
            if (!response.ok) {
                console.error('Failed to update online status');
            }
        })
        .catch(error => {
            console.error('Error updating online status:', error);
        });
    }
    
    // Update status immediately
    updateOnlineStatus();
    
    // Then update every minute
    setInterval(updateOnlineStatus, 60000);
    
    // Also update when user interacts with the page
    const events = ['click', 'keypress', 'scroll', 'mousemove'];
    let lastActivity = Date.now();
    
    events.forEach(event => {
        document.addEventListener(event, () => {
            // Only update if it's been at least 1 minute since last activity
            if (Date.now() - lastActivity > 60000) {
                updateOnlineStatus();
                lastActivity = Date.now();
            }
        });
    });
} 