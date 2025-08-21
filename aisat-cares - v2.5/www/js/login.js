// DOM Elements
let loginForm;
let messageBox; // Will create this dynamically
let loadingIndicator; // Will create this dynamically

// Create message and loading elements
function createUIElements() {
    // Get login form
    loginForm = document.getElementById('loginForm');
    if (!loginForm) {
        console.error('Login form not found');
        return;
    }

    // Create message box if it doesn't exist
    if (!document.getElementById('messageBox')) {
        messageBox = document.createElement('div');
        messageBox.id = 'messageBox';
        messageBox.className = 'message';
        const formContainer = document.querySelector('.form-container');
        formContainer.insertBefore(messageBox, loginForm);
    } else {
        messageBox = document.getElementById('messageBox');
    }

    // Create loading indicator if it doesn't exist
    if (!document.getElementById('loadingIndicator')) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loadingIndicator';
        loadingIndicator.className = 'loading';
        loadingIndicator.innerHTML = '<div class="spinner"></div> Loading...';
        const formContainer = document.querySelector('.form-container');
        formContainer.insertBefore(loadingIndicator, loginForm);
    } else {
        loadingIndicator = document.getElementById('loadingIndicator');
    }

    // Add styles for these elements
    const style = document.createElement('style');
    style.textContent = `
        .message {
            text-align: center;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            display: none;
        }
        .error {
            background-color: #FADBD8;
            color: #C0392B;
        }
        .success {
            background-color: #D5F5E3;
            color: #27AE60;
        }
        .loading {
            display: none;
            text-align: center;
            margin: 10px 0;
        }
        .spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border-left-color: #3498DB;
            animation: spin 1s linear infinite;
            display: inline-block;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

// Check if user is already logged in
function checkSession() {
    // Show loading indicator
    showLoading(true);
    
    // Get token from localStorage
    const token = localStorage.getItem('userToken');
    
    if (!token) {
        showLoading(false);
        return; // No token found, user needs to log in
    }
    
    // Verify token with server
    cordovaFetch(`${baseUrl}/api/auth/verify`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Session expired');
        }
        return response.json();
    })
    .then(data => {
        console.log('User already logged in, redirecting to index.html');
        // Token is valid, redirect to index page
        window.location.href = 'index.html';
    })
    .catch(error => {
        // Token is invalid or expired, clear it
        localStorage.removeItem('userToken');
        showLoading(false);
        showMessage('Session expired. Please login again.', true);
    });
}

// Function to handle login form submission
function handleLogin(event) {
    event.preventDefault();
    
    // Show loading indicator
    showLoading(true);
    
    // Get form data
    const idno = document.getElementById('idno').value;
    const password = document.getElementById('password').value;
    
    // Check for empty fields
    if (!idno || !password) {
        showLoading(false);
        showMessage('ID number and password are required', true);
        return;
    }
    
    // Log the request for debugging
    console.log('Sending login request with ID:', idno);
    
    // Send login request to server
    cordovaFetch(`${baseUrl}/api/auth/user_login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idno, password })
    })
    .then(response => {
        console.log('Login response status:', response.status);
        if (!response.ok) {
            return response.json()
                .then(data => {
                    console.log('Error response:', data);
                    throw new Error(data.error || 'Invalid credentials');
                })
                .catch(err => {
                    if (err.name === 'SyntaxError') {
                        throw new Error('Invalid response format from server');
                    }
                    throw err;
                });
        }
        return response.json();
    })
    .then(data => {
        console.log('Login successful:', data);
        
        // Store token and all user info in localStorage
        localStorage.setItem('userToken', data.token);
        localStorage.setItem('userData', JSON.stringify({
            id: data.id,
            name: data.name,
            idno: data.idno,
            email: data.email,
            level: data.level,
            course: data.course,
            strand: data.strand
        }));
        
        // Show success message
        showMessage('Login successful! Redirecting...', false);
        
        // Redirect to the user dashboard
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);
    })
    .catch(error => {
        showLoading(false);
        console.error('Login error:', error);
        showMessage(error.message || 'Invalid ID number or password. Please try again.', true);
    });
}

// Function to show/hide loading indicator
function showLoading(isLoading) {
    if (loadingIndicator) {
        loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }
}

// Function to show message
function showMessage(message, isError) {
    if (messageBox) {
        messageBox.textContent = message;
        messageBox.className = `message ${isError ? 'error' : 'success'}`;
        messageBox.style.display = 'block';
        
        // Auto-hide message after 5 seconds
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 5000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a short time to ensure auth.js has run its initialization
    setTimeout(() => {
        createUIElements();
        checkSession();
        
        // Handle form submission
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }
    }, 100);
}); 