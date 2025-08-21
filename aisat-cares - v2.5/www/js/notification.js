// Use baseUrl defined in index.html

// Polyfill for cordovaFetch when running in browser
if (typeof cordovaFetch === 'undefined') {
    window.cordovaFetch = function(url, options) {
        console.log('Using polyfill fetch for:', url);
        return fetch(url, options);
    };
}

// Global function to update notification badge count
function updateNotificationBadge(count) {
    const badge = document.querySelector('.notification-badge');
    if (!badge) return; // Safety check
    
    if (count > 0) {
        badge.textContent = count > 9 ? '9+' : count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

// Function to fetch notifications (pending and on-call requests)
function fetchNotifications() {
    const token = localStorage.getItem('userToken');
    if (!token) {
        showEmptyMessage('waiting-list', 'Authentication required');
        showEmptyMessage('oncall-list', 'Authentication required');
        return;
    }
    
    // Show loading state
    showEmptyMessage('waiting-list', 'Loading requests...');
    showEmptyMessage('oncall-list', 'Loading requests...');
    
    // Use the new combined endpoint that returns both own request and all requests
    cordovaFetch(`${baseUrl}/api/user/notifications`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Fetched notifications data:', data);
        
        // Process the user's own request if it exists
        if (data.has_own_request && data.own_request) {
            // Store the user's own request in localStorage for other components to use
            localStorage.setItem('userCurrentRequest', JSON.stringify(data.own_request));
            
            // Dispatch an event to notify other components that the user has a request
            const event = new CustomEvent('userRequestUpdated', { 
                detail: { request: data.own_request } 
            });
            document.dispatchEvent(event);
        } else {
            // Clear any stored request
            localStorage.removeItem('userCurrentRequest');
        }
        
        // Process all requests for the notification panel
        processAllNotifications(data.all_requests, data.own_request);
    })
    .catch(error => {
        console.error('Error fetching notifications:', error);
        // Fall back to the legacy methods
        fetchNotificationsLegacy();
    });
}

// Legacy method for fetching notifications
function fetchNotificationsLegacy() {
    console.log('Using legacy method to fetch notifications');
    const token = localStorage.getItem('userToken');
    if (!token) {
        return;
    }
    
    // Get user data from localStorage
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userIdNo = userData.idno;
    
    if (!userIdNo) {
        console.log('No user ID found in localStorage');
        showEmptyMessage('waiting-list', 'User profile not found');
        showEmptyMessage('oncall-list', 'User profile not found');
        return;
    }
    
    // First check for own request
    cordovaFetch(`${baseUrl}/api/user/check_own_request`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        return response.json();
    })
    .then(ownRequest => {
        // Store the user's own request if it exists
        if (ownRequest.has_request) {
            localStorage.setItem('userCurrentRequest', JSON.stringify(ownRequest));
            
            // Dispatch an event to notify other components
            const event = new CustomEvent('userRequestUpdated', { 
                detail: { request: ownRequest } 
            });
            document.dispatchEvent(event);
        } else {
            localStorage.removeItem('userCurrentRequest');
        }
        
        // Then fetch all requests for the notification panel
        return cordovaFetch(`${baseUrl}/api/pending_requests`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}`);
            }
            return response.json();
        })
        .then(allRequests => {
            processAllNotifications(allRequests, ownRequest.has_request ? ownRequest : null);
        });
    })
    .catch(error => {
        console.error('Error in legacy notification fetch:', error);
        showEmptyMessage('waiting-list', 'Error loading requests');
        showEmptyMessage('oncall-list', 'Error loading requests');
        
        // Try the very old method as a last resort
        fetchVeryLegacyNotifications();
    });
}

// Very legacy method as last resort
function fetchVeryLegacyNotifications() {
    console.log('Using very legacy method to fetch notifications');
    const token = localStorage.getItem('userToken');
    if (!token) {
        return;
    }
    
    // Get user data from localStorage
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userIdNo = userData.idno;
    
    // Fetch requests using the original endpoint
    cordovaFetch(`${baseUrl}/api/user/requests`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Got very legacy notification data:', data);
        
        // Find the user's own requests
        const userRequests = data.filter(req => 
            req.is_current_user === true || 
            (req.idno && req.idno === userIdNo)
        );
        
        if (userRequests.length > 0) {
            // Store the first user request
            localStorage.setItem('userCurrentRequest', JSON.stringify(userRequests[0]));
            
            // Dispatch an event
            const event = new CustomEvent('userRequestUpdated', { 
                detail: { request: userRequests[0] } 
            });
            document.dispatchEvent(event);
        }
        
        // Process all requests for the notification panel
        processAllNotifications(data, userRequests[0] || null);
    })
    .catch(error => {
        console.error('Error in very legacy notification fetch:', error);
        showEmptyMessage('waiting-list', 'Error loading requests');
        showEmptyMessage('oncall-list', 'Error loading requests');
    });
}

// Process all notifications
function processAllNotifications(allRequests, ownRequest) {
    // Get user data
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userIdNo = userData.idno;
    const userId = userData.id;
    
    // Instead of filtering for only user requests, use all requests
    // Note: We still need to ensure allRequests is an array
    const requests = Array.isArray(allRequests) ? allRequests : [];
    
    // If we have the user's own request but it's not in the list, add it
    if (ownRequest && !requests.some(req => req.id === ownRequest.id)) {
        requests.push(ownRequest);
    }
    
    console.log('All requests:', requests);
    
    // Split the data into pending and on-call
    const pendingRequests = requests.filter(req => req.status === 'pending');
    const oncallRequests = requests.filter(req => req.status === 'oncall');
        
        // Sort requests by schedule time
        const sortByTime = (a, b) => {
            const timeA = a.schedule ? new Date(a.schedule).getTime() : 0;
            const timeB = b.schedule ? new Date(b.schedule).getTime() : 0;
            return timeA - timeB;
        };
        
        pendingRequests.sort(sortByTime);
        oncallRequests.sort(sortByTime);
        
        // Update notification badge count to show total number of requests
        updateNotificationBadge(pendingRequests.length + oncallRequests.length);
        
        // Render the requests
        renderNotificationList('waiting-list', pendingRequests);
        renderNotificationList('oncall-list', oncallRequests);
}

// Function to render notification list
function renderNotificationList(containerId, requests) {
    const container = document.getElementById(containerId);
    
    if (requests.length === 0) {
        if (containerId === 'waiting-list') {
            showEmptyMessage(containerId, 'No pending requests at this time');
        } else {
            showEmptyMessage(containerId, 'No on-call requests at this time');
        }
        return;
    }
    
    // Get current user data
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const userIdNo = userData.idno;
    const userId = userData.id;
    
    let html = '';
    requests.forEach(request => {
        // Format the schedule time
        const scheduleDate = request.schedule ? new Date(request.schedule) : new Date();
        const scheduleTime = scheduleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Format the date for display
        const scheduleDay = scheduleDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
        
        // Check if this request belongs to current user
        const isCurrentUser = 
            request.is_current_user === true || 
            (request.idno && request.idno === userIdNo) ||
            (request.id && (request.id === userId || request.id === userIdNo));
            
        const currentUserClass = isCurrentUser ? 'current-user' : '';
        
        // Add countdown timer if status is oncall and counter exists
        let timerHtml = '';
        if (request.status === 'oncall' && request.counter) {
            // Add warning class if less than 3 minutes remain
            const warningClass = request.counter <= 3 ? 'warning' : '';
            timerHtml = `<span class="timer ${warningClass}">${request.counter}m left</span>`;
        }
        
        // Create a more structured notification item
        html += `
            <div class="notification-item ${currentUserClass}" data-id="${request.id}">
                ${timerHtml}
                <div class="name">${request.name || (isCurrentUser ? userData.name : 'Unknown')}</div>
                <div class="details">
                    <span class="request-id-text">${request.request_id || ''}</span>
                    <span>${scheduleDay} at ${scheduleTime}</span>
                </div>
                <div class="info-display" style="margin-top: 5px; padding-top: 5px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <span class="info-label">Status:</span>
                    <span class="info-value status ${request.status === 'pending' ? 'waiting' : ''}">${request.status === 'pending' ? 'Waiting' : 'On Call'}</span>
                    ${isCurrentUser ? '' : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Helper function to show empty message
function showEmptyMessage(containerId, message) {
    document.getElementById(containerId).innerHTML = `
        <div class="empty-message">
            <i class="fas ${message.includes('Error') ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <p>${message}</p>
        </div>
    `;
}

// Initialize notification functionality
function initNotifications() {
    // Close notification panel
    document.getElementById('close-notification-btn').addEventListener('click', function() {
        // Close the notifications expanded state
        document.body.classList.remove('notifications-expanded');
        // Re-enable scrolling
        document.body.style.overflow = '';
    });
    
    // Tab switching functionality
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
            // Show the selected tab content
            const tabName = this.getAttribute('data-tab');
            document.getElementById(tabName + '-tab').classList.remove('hidden');
        });
    });
    
    // Notification icon functionality
    document.getElementById('notification-icon').addEventListener('click', function() {
        try {
            // Toggle the notifications expanded state
            document.body.classList.add('notifications-expanded');
            // Disable scrolling
            document.body.style.overflow = 'hidden';
            
            // Fetch pending and on-call requests
            fetchNotifications();
        } catch (error) {
            console.error('Error opening notification panel:', error);
            
            // Show a generic error message
            showEmptyMessage('waiting-list', 'Error loading notifications');
            showEmptyMessage('oncall-list', 'Error loading notifications');
        }
    });
    
    // Check for notifications periodically
    setInterval(() => {
        if (document.body.classList.contains('notifications-expanded')) {
            fetchNotifications();
        }
    }, 10000);
    
    // Check for notifications on page load
    setTimeout(fetchNotifications, 1000);
}

// Call this function when the DOM is loaded
document.addEventListener('DOMContentLoaded', initNotifications);
