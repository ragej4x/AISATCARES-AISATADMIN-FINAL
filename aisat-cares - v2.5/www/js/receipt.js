/**
 * Receipt functionality for AISAT Admin
 * Handles appointment submission and receipt generation
 */

// Base URL for API calls
const apiBaseUrl = "https://jimboyaczon.pythonanywhere.com";

// Receipt generation functionality
const receiptModule = {
    // Store the current request data
    currentRequest: null,

    // Initialize the receipt module
    init: function() {
        console.log('Receipt module initialized');
        this.attachEventListeners();
    },

    // Attach event listeners to payment buttons
    attachEventListeners: function() {
        // Replace the original payment button handlers
        const fullPaymentBtn = document.getElementById('full-payment-btn');
        const installmentBtn = document.getElementById('installment-btn');
        
        if (fullPaymentBtn) {
            fullPaymentBtn.addEventListener('click', () => {
                window.selectedPayment = 'Full Payment';
                this.handlePaymentSelection('full');
            });
        }
        
        if (installmentBtn) {
            installmentBtn.addEventListener('click', () => {
                window.selectedPayment = 'Installment';
                this.handlePaymentSelection('installment');
            });
        }

        // Add event listeners for receipt modal buttons using event delegation
        document.addEventListener('click', (e) => {
            // Close X button in top right
            if (e.target.id === 'receipt-close-x') {
                this.hideReceipt();
            }
            
            // Done button
            if (e.target.id === 'receipt-done-btn' || e.target.closest('#receipt-done-btn')) {
                // Submit the request and hide receipt
                this.submitRequestAndClose();
            }
            
            // Print link
            if (e.target.id === 'receipt-print-link') {
                e.preventDefault();
                this.printReceipt();
            }
        });
    },
    
    // Submit request and close receipt
    submitRequestAndClose: function() {
        console.log('Request confirmed and submitted');
        
        // Submit the current request data if available
        if (this.currentRequest) {
            // Check if this is an existing request (has status field)
            if (this.currentRequest.status) {
                console.log('This is an existing request, skipping submission');
                
                // Just close the receipt and return to appropriate screen
                this.hideReceipt();
                
                return;
            }
            
            // Show loading indicator
            this.showLoading();
            
            // Get user token
            const token = localStorage.getItem('userToken');
            if (!token) {
                console.log('No token found, redirecting to login page');
                window.location.href = 'auth.html';
                return;
            }
            
            // Make the actual API call to the server
            cordovaFetch(`${apiBaseUrl}/api/appointments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(this.currentRequest)
            })
            .then(res => {
                if (!res.ok) {
                    return res.json().then(data => {
                        throw new Error(data.error || `Server responded with ${res.status}`);
                    });
                }
                return res.json();
            })
            .then(data => {
                console.log('Request submitted successfully:', data);
                
                // Store in localStorage for reference
                this.saveRequestToLocalStorage(this.currentRequest, data.id || Date.now());
                
                // Hide loading indicator
                this.hideLoading();
                
                // Close the receipt
                this.hideReceipt();
                
                // If this was a Queue Now request, return to Home page
                if (this.currentRequest && this.currentRequest.type === 'express') {
                    console.log('Queue Now request completed, returning to Home page');
                    window.location.href = 'index.html';
                }
            })
            .catch(err => {
                console.error('Request submission error:', err);
                
                // Hide loading indicator
                this.hideLoading();
                
                // Show error message inside receipt
                const errorDiv = document.createElement('div');
                errorDiv.className = 'receipt-error';
                errorDiv.textContent = `Error: ${err.message || 'Failed to submit request'}`;
                errorDiv.style.cssText = 'color: #d9534f; background-color: #f8d7da; padding: 10px; margin: 10px 0; border-radius: 5px; text-align: center;';
                
                const receiptBody = document.querySelector('.receipt-body');
                if (receiptBody) {
                    receiptBody.appendChild(errorDiv);
                }
                
                // Still store in localStorage for reference (as pending)
                this.saveRequestToLocalStorage(this.currentRequest, Date.now());
            });
        } else {
            // No request data available
            this.hideReceipt();
        }
    },

    // Handle payment selection
    handlePaymentSelection: function(paymentMethod) {
        // Generate request data
        const requestData = this.generateRequestData(paymentMethod);
        
        // Submit the request
        this.submitRequest(requestData);
    },

    // Generate request data from global variables
    generateRequestData: function(paymentMethod) {
        // Generate a unique request ID
        const paymentType = window.selectedType?.toLowerCase() || 'regular';
        const firstLetter = paymentType.charAt(0).toUpperCase();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const requestId = `${firstLetter}-${randomNum}`;

        // Get the selected level or default to College
        let level = window.selectedLevel;
        if (level !== 'College' && level !== 'SHS') {
            level = 'College';
        }

        // Get user's course/strand information from localStorage if available
        const userProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        const userCourse = userProfile.course || '';
        const userStrand = userProfile.strand || '';

        // Create the request payload
        return {
            request_id: requestId,
            date: window.selectedDate,
            time: window.selectedTime,
            level: level,
            type: window.selectedType?.toLowerCase() || 'regular',
            payment: window.selectedType?.toLowerCase() || 'regular',
            method: paymentMethod,
            timestamp: new Date().toISOString(),
            // Include the user's original course/strand information
            course: userCourse,
            strand: userStrand,
            // Flag to tell the server not to overwrite course/strand with payment type
            preserve_course_strand: true
        };
    },

    // Submit the request to the server
    submitRequest: function(requestData) {
        console.log('Preparing request:', requestData);
        
        // Store the current request for receipt generation
        this.currentRequest = requestData;
        
        // Get user token
        const token = localStorage.getItem('userToken');
        if (!token) {
            // Redirect to login page without alert
            console.log('No token found, redirecting to login page');
            window.location.href = 'auth.html';
            return;
        }

        // Fetch user profile data first to ensure we have the latest course/strand info
        this.fetchUserProfile(token)
            .then(() => {
                // Generate and show receipt preview
                this.generateReceipt(requestData);
            })
            .catch(error => {
                console.error('Error fetching user profile:', error);
                // Continue with receipt generation even if profile fetch fails
                this.generateReceipt(requestData);
            });
    },

    // Fetch user profile data from API
    fetchUserProfile: function(token) {
        return cordovaFetch(`${apiBaseUrl}/api/user_profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(data => {
                    throw new Error(data.error || `Server responded with ${res.status}`);
                });
            }
            return res.json();
        })
        .then(userData => {
            // Store user profile in localStorage
            localStorage.setItem('userProfile', JSON.stringify(userData));
            console.log('User profile updated in localStorage:', userData);
            return userData;
        });
    },

    // Save request to localStorage
    saveRequestToLocalStorage: function(requestData, serverId) {
        const userRequests = JSON.parse(localStorage.getItem('userRequests') || '[]');
        userRequests.push({
            id: serverId || Date.now(),
            request_id: requestData.request_id,
            status: 'pending',
            date: requestData.date,
            time: requestData.time,
            level: requestData.level,
            payment: requestData.payment,
            method: requestData.method
        });
        localStorage.setItem('userRequests', JSON.stringify(userRequests));
    },

    // Show loading indicator
    showLoading: function() {
        // Create loading overlay if it doesn't exist
        if (!document.getElementById('loading-overlay')) {
            const loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'loading-overlay';
            loadingOverlay.innerHTML = '<div class="loading-spinner"></div><div>Processing your request...</div>';
            loadingOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                color: white;
                font-weight: bold;
            `;
            
            const spinner = document.createElement('style');
            spinner.textContent = `
                .loading-spinner {
                    border: 5px solid rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    border-top: 5px solid #fff;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin-bottom: 15px;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(spinner);
            document.body.appendChild(loadingOverlay);
        } else {
            document.getElementById('loading-overlay').style.display = 'flex';
        }
    },

    // Hide loading indicator
    hideLoading: function() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    },

    // Generate receipt HTML
    generateReceipt: function(requestData) {
        // Hide loading indicator
        this.hideLoading();
        
        // Format date and time for display
        const formattedDate = this.formatDate(requestData.date);
        const formattedTime = this.formatTime(requestData.time);
        
        // Create receipt container if it doesn't exist
        if (!document.getElementById('receipt-container')) {
            const receiptContainer = document.createElement('div');
            receiptContainer.id = 'receipt-container';
            receiptContainer.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            `;
            document.body.appendChild(receiptContainer);
        }
        
        // Get payment type display text
        const paymentTypeDisplay = requestData.payment.toUpperCase();
        const paymentMethodDisplay = requestData.method === 'full' ? 'Full Payment' : 'Installment';
        
        // Determine button text based on whether this is an existing request
        const buttonText = requestData.status ? 'Close' : 'Done';
        const buttonIcon = requestData.status ? 'fa-times' : 'fa-check';
        
        // Create receipt content
        document.getElementById('receipt-container').innerHTML = `
            <div class="receipt-modal">
                <div class="receipt-header">
                    <img src="img/aisat.png" alt="AISAT College" class="receipt-logo">
                    <div class="receipt-title">E-Receipt</div>
                    <div class="receipt-close-x" id="receipt-close-x">×</div>
                </div>
                <div class="receipt-body">
                    <div class="receipt-item">
                        <span class="receipt-label">Request ID:</span>
                        <span class="receipt-value request-id">${requestData.request_id}</span>
                    </div>
                    <div class="receipt-item">
                        <span class="receipt-label">Date:</span>
                        <span class="receipt-value">${formattedDate}</span>
                    </div>
                    <div class="receipt-item">
                        <span class="receipt-label">Time:</span>
                        <span class="receipt-value">${formattedTime}</span>
                    </div>
                    <div class="receipt-item">
                        <span class="receipt-label">Level:</span>
                        <span class="receipt-value">${requestData.level}</span>
                    </div>
                    <div class="receipt-item">
                        <span class="receipt-label">Type:</span>
                        <span class="receipt-value">${paymentTypeDisplay}</span>
                    </div>
                    <div class="receipt-item">
                        <span class="receipt-label">Payment:</span>
                        <span class="receipt-value">${paymentMethodDisplay}</span>
                    </div>
                    ${requestData.status ? `
                    <div class="receipt-item">
                        <span class="receipt-label">Status:</span>
                        <span class="receipt-value">${requestData.status === 'pending' ? 'Pending' : 'On Call'}</span>
                    </div>
                    ` : ''}
                    <div class="receipt-timestamp">
                        Generated on: ${new Date().toLocaleString()}
                    </div>
                </div>
                <div class="receipt-footer">
                    <div class="receipt-message">
                        Thank you for your appointment. Please arrive 15 minutes before your scheduled time.
                    </div>
                    <div class="receipt-buttons">
                        <button id="receipt-done-btn" class="btn">
                            <i class="fas ${buttonIcon}"></i> ${buttonText}
                        </button>
                    </div>
                    <div class="receipt-print-link">
                        <a href="#" id="receipt-print-link">Print this receipt</a>
                    </div>
                </div>
            </div>
        `;
        
        // Add receipt styles
        if (!document.getElementById('receipt-styles')) {
            const receiptStyles = document.createElement('style');
            receiptStyles.id = 'receipt-styles';
            receiptStyles.textContent = `
                .receipt-modal {
                    background-color: white;
                    width: 90%;
                    max-width: 400px;
                    border-radius: 10px;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                    overflow: hidden;
                    animation: fadeIn 0.3s ease-out;
                }
                
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
                
                .receipt-header {
                    background-color: #f8f8f8;
                    padding: 15px;
                    text-align: center;
                    border-bottom: 1px solid #eee;
                    position: relative;
                }
                
                .receipt-close-x {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    font-size: 24px;
                    font-weight: bold;
                    color: #666;
                    cursor: pointer;
                    line-height: 1;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: all 0.2s;
                }
                
                .receipt-close-x:hover {
                    background-color: rgba(0, 0, 0, 0.1);
                    color: #333;
                }
                
                .receipt-logo {
                    max-width: 100%;
                    height: auto;
                    max-height: 80px;
                    margin-bottom: 10px;
                }
                
                .receipt-title {
                    font-size: 18px;
                    font-weight: bold;
                    color: #333;
                }
                
                .receipt-body {
                    padding: 20px;
                }
                
                .receipt-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    padding-bottom: 5px;
                    border-bottom: 1px dashed #eee;
                }
                
                .receipt-label {
                    font-weight: 500;
                    color: #666;
                }
                
                .receipt-value {
                    font-weight: 600;
                    color: #333;
                }
                
                .request-id {
                    font-family: monospace;
                    font-weight: bold;
                    color: #0033cc;
                }
                
                .receipt-timestamp {
                    margin-top: 15px;
                    font-size: 12px;
                    color: #999;
                    text-align: center;
                }
                
                .receipt-footer {
                    padding: 15px;
                    background-color: #f8f8f8;
                    border-top: 1px solid #eee;
                }
                
                .receipt-message {
                    text-align: center;
                    margin-bottom: 15px;
                    font-size: 14px;
                    color: #666;
                }
                
                .receipt-buttons {
                    display: flex;
                    justify-content: center;
                }
                
                .receipt-buttons .btn {
                    width: 80%;
                    padding: 12px;
                    background-color: #0033cc;
                    color: white;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: background-color 0.2s;
                }
                
                .receipt-buttons .btn:hover {
                    background-color: #002299;
                }
                
                .receipt-print-link {
                    text-align: center;
                    margin-top: 15px;
                    font-size: 14px;
                }
                
                .receipt-print-link a {
                    color: #0033cc;
                    text-decoration: none;
                    display: inline-block;
                    padding: 5px;
                }
                
                .receipt-print-link a:hover {
                    text-decoration: underline;
                }
            `;
            document.head.appendChild(receiptStyles);
        }
        
        // Show receipt container
        document.getElementById('receipt-container').style.display = 'flex';
    },

    // Hide receipt
    hideReceipt: function() {
        const receiptContainer = document.getElementById('receipt-container');
        if (receiptContainer) {
            receiptContainer.style.display = 'none';
        }
        
        // Check if this was an existing request shown from the Queue Now button
        if (this.currentRequest && this.currentRequest.status && this.currentRequest.fromQueueNow) {
            // Return to queue now container (initial screen)
            const queueNowContainer = document.getElementById('queue-now-container');
            if (queueNowContainer) {
                queueNowContainer.classList.remove('hidden');
            }
            
            // Make sure main-options is hidden
            const mainOptions = document.getElementById('main-options');
            if (mainOptions) {
                mainOptions.classList.add('hidden');
            }
        } else {
            // Return to main options using the showSection function
            if (typeof window.showSection === 'function') {
                window.showSection('main-options');
            } else {
                // Fallback if showSection is not available
                const mainOptions = document.getElementById('main-options');
                if (mainOptions) {
                    mainOptions.classList.remove('hidden');
                }
            }
        }
    },

    // Print receipt
    printReceipt: function() {
        const receiptHTML = document.querySelector('.receipt-modal').cloneNode(true);
        
        // Remove buttons and print link for printing
        const buttons = receiptHTML.querySelector('.receipt-buttons');
        if (buttons) {
            buttons.remove();
        }
        
        // Remove print link
        const printLink = receiptHTML.querySelector('.receipt-print-link');
        if (printLink) {
            printLink.remove();
        }
        
        // Remove close X button
        const closeX = receiptHTML.querySelector('.receipt-close-x');
        if (closeX) {
            closeX.remove();
        }
        
        // Create print window
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>AISAT Appointment Receipt</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                    }
                    .receipt-modal {
                        width: 100%;
                        max-width: 400px;
                        margin: 0 auto;
                        border: 1px solid #ddd;
                    }
                    .receipt-header {
                        background-color: #f8f8f8;
                        padding: 15px;
                        text-align: center;
                        border-bottom: 1px solid #eee;
                    }
                    .receipt-logo {
                        max-width: 100%;
                        height: auto;
                        max-height: 80px;
                        margin-bottom: 10px;
                    }
                    .receipt-title {
                        font-size: 18px;
                        font-weight: bold;
                        color: #333;
                    }
                    .receipt-body {
                        padding: 20px;
                    }
                    .receipt-item {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 10px;
                        padding-bottom: 5px;
                        border-bottom: 1px dashed #eee;
                    }
                    .receipt-label {
                        font-weight: 500;
                        color: #666;
                    }
                    .receipt-value {
                        font-weight: 600;
                        color: #333;
                    }
                    .request-id {
                        font-family: monospace;
                        font-weight: bold;
                        color: #0033cc;
                    }
                    .receipt-timestamp {
                        margin-top: 15px;
                        font-size: 12px;
                        color: #999;
                        text-align: center;
                    }
                    .receipt-footer {
                        padding: 15px;
                        background-color: #f8f8f8;
                        border-top: 1px solid #eee;
                    }
                    .receipt-message {
                        text-align: center;
                        margin-bottom: 15px;
                        font-size: 14px;
                        color: #666;
                    }
                    @media print {
                        body {
                            padding: 0;
                        }
                        .receipt-modal {
                            border: none;
                        }
                    }
                </style>
            </head>
            <body>
                ${receiptHTML.outerHTML}
                <script>
                    // Fix image path for printing
                    document.querySelector('.receipt-logo').src = '${window.location.origin}/mobile/img/aisat.png';
                    // Auto print
                    setTimeout(() => {
                        window.print();
                        setTimeout(() => window.close(), 500);
                    }, 500);
                </script>
            </body>
            </html>
        `);
    },

    // Format date for display
    formatDate: function(dateString) {
        if (!dateString) return '-';
        
        try {
            const dateObj = new Date(dateString);
            if (!isNaN(dateObj)) {
                const options = { year: 'numeric', month: 'long', day: 'numeric' };
                return dateObj.toLocaleDateString(undefined, options);
            }
            return dateString;
        } catch (error) {
            console.error('Error formatting date:', error);
            return dateString || '-';
        }
    },

    // Format time for display
    formatTime: function(timeString) {
        if (!timeString) return '-';
        
        try {
            const timeParts = timeString.split(':');
            if (timeParts.length >= 2) {
                let hour = parseInt(timeParts[0]);
                const minutes = timeParts[1];
                const ampm = hour >= 12 ? 'PM' : 'AM';
                hour = hour % 12;
                if (hour === 0) hour = 12;
                return `${hour}:${minutes} ${ampm}`;
            }
            return timeString;
        } catch (error) {
            console.error('Error formatting time:', error);
            return timeString || '-';
        }
    }
};

// Initialize the receipt module when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    receiptModule.init();
});
