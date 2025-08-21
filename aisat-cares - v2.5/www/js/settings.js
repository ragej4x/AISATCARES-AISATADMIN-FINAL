// Initialize settings functionality
function initSettings() {
    // Settings icon functionality
    const settingsIcon = document.getElementById('settings-icon');
    if (settingsIcon) {
        settingsIcon.addEventListener('click', function() {
            // Toggle the settings expanded state
            document.body.classList.add('wave-expanded');
            // Disable scrolling
            document.body.style.overflow = 'hidden';
            
            // Load user profile data
            loadUserProfile();
        });
    }
    
    // Close settings panel (from the modal)
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', function() {
            // Close the settings expanded state
            document.body.classList.remove('wave-expanded');
            // Re-enable scrolling
            document.body.style.overflow = '';
        });
    }
    
    // Close wave profile button (from the wave form)
    const waveCloseBtn = document.getElementById('wave-close-profile-btn');
    if (waveCloseBtn) {
        waveCloseBtn.addEventListener('click', function() {
            // Close the wave expanded state
            document.body.classList.remove('wave-expanded');
            // Re-enable scrolling
            document.body.style.overflow = '';
        });
    }
    
    // Save profile button functionality
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', function() {
            saveUserProfile();
        });
    }
    
    // Logout button functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            logout();
        });
    }
    
    // Wave save profile button
    const waveSaveProfileBtn = document.getElementById('wave-save-profile-btn');
    if (waveSaveProfileBtn) {
        waveSaveProfileBtn.addEventListener('click', function() {
            // This is handled by the form submit event in the HTML
        });
    }
    
    // Wave logout button
    const waveLogoutBtn = document.getElementById('wave-logout-btn');
    if (waveLogoutBtn) {
        waveLogoutBtn.addEventListener('click', function() {
            logout();
        });
    }
}

// Function to load user profile data
function loadUserProfile() {
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    // Populate standard form fields with user data (if they exist)
    const nameInput = document.getElementById('profile-name');
    const idnoInput = document.getElementById('profile-idno');
    const levelInput = document.getElementById('profile-level');
    
    if (nameInput) nameInput.value = userData.name || '';
    if (idnoInput) idnoInput.value = userData.idno || '';
    if (levelInput) levelInput.value = userData.level || '';
    
    // Populate wave profile form fields
    // Split the name into components if needed
    let firstName = userData.firstname || '';
    let lastName = userData.lastname || '';
    let middleInitial = userData.middleinitial || '';
    let suffix = userData.suffix || '';
    
    // If we don't have separate name parts but have a full name, try to split it
    if ((!firstName || !lastName) && userData.name) {
        const nameParts = userData.name.trim().split(' ');
        if (nameParts.length >= 2) {
            firstName = nameParts[0] || '';
            lastName = nameParts[nameParts.length - 1] || '';
            
            // If there are more than 2 parts, the middle could be a middle initial or part of the last name
            if (nameParts.length > 2) {
                // Check if it looks like an initial (1-2 chars with a period)
                const middlePart = nameParts[1];
                if (middlePart.length <= 2 || middlePart.endsWith('.')) {
                    middleInitial = middlePart.replace('.', '');
                }
            }
        } else {
            // Only one name part, set as first name
            firstName = userData.name;
        }
    }
    
    // Set wave form fields
    const waveFirstName = document.getElementById('wave-firstname');
    const waveLastName = document.getElementById('wave-lastname');
    const waveMiddleInitial = document.getElementById('wave-middleinitial');
    const waveSuffix = document.getElementById('wave-suffix');
    const waveEmail = document.getElementById('wave-email');
    const waveCell = document.getElementById('wave-cell');
    const wavePassword = document.getElementById('wave-password');
    const waveConfirmPassword = document.getElementById('wave-confirm-password');
    
    // Set values if elements exist
    if (waveFirstName) waveFirstName.value = firstName;
    if (waveLastName) waveLastName.value = lastName;
    if (waveMiddleInitial) waveMiddleInitial.value = middleInitial;
    if (waveSuffix && suffix) {
        // Check if the suffix is a valid option
        const suffixExists = Array.from(waveSuffix.options).some(option => option.value === suffix);
        if (suffixExists) {
            waveSuffix.value = suffix;
        }
    }
    
    if (waveEmail) waveEmail.value = userData.email || '';
    if (waveCell) waveCell.value = userData.cell || '';
    
    // Set password fields (usually you wouldn't prefill these, but for demo purposes)
    if (wavePassword) wavePassword.value = userData.password || '';
    if (waveConfirmPassword) waveConfirmPassword.value = userData.password || '';
    
    // Update the read-only display fields
    const waveIdnoDisplay = document.getElementById('wave-idno-display');
    const waveLevelDisplay = document.getElementById('wave-level-display');
    const waveCourseDisplay = document.getElementById('wave-course-display');
    
    if (waveIdnoDisplay) waveIdnoDisplay.textContent = userData.idno || '-';
    if (waveLevelDisplay) waveLevelDisplay.textContent = userData.level || '-';
    
    // Show course or strand based on level
    let courseStrand = '-';
    if (userData.level === 'College') {
        courseStrand = userData.course || '-';
    } else if (userData.level === 'SHS') {
        courseStrand = userData.strand || '-';
    }
    if (waveCourseDisplay) waveCourseDisplay.textContent = courseStrand;
}

// Function to save user profile data
function saveUserProfile() {
    const token = localStorage.getItem('userToken');
    if (!token) {
        showProfileMessage('Authentication required. Please log in again.', 'error');
        return;
    }
    
    // Get form values
    const name = document.getElementById('profile-name').value.trim();
    const idno = document.getElementById('profile-idno').value.trim();
    const level = document.getElementById('profile-level').value.trim();
    
    // Validate inputs
    if (!name || !idno || !level) {
        showProfileMessage('Please fill in all fields.', 'error');
        return;
    }
    
    // Show loading state
    const saveBtn = document.getElementById('save-profile-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;
    
    // Get existing user data
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    
    // Prepare updated data
    const updatedData = {
        name,
        idno,
        level
    };
    
    // Send update request to server
    cordovaFetch(`${baseUrl}/api/user/update_profile`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        // Update local storage with new user data
        const updatedUserData = { ...userData, ...updatedData };
        localStorage.setItem('userData', JSON.stringify(updatedUserData));
        
        // Show success message
        showProfileMessage('Profile updated successfully!', 'success');
    })
    .catch(error => {
        console.error('Error updating profile:', error);
        showProfileMessage('Failed to update profile. Please try again.', 'error');
    })
    .finally(() => {
        // Reset button state
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    });
}

// Function to show profile message
function showProfileMessage(message, type = 'info') {
    const messageContainer = document.getElementById('profile-message');
    if (!messageContainer) return;
    
    messageContainer.textContent = message;
    messageContainer.className = `message ${type}`;
    messageContainer.style.display = 'block';
    
    // Hide message after 3 seconds
    setTimeout(() => {
        messageContainer.style.display = 'none';
    }, 3000);
}

// Function to handle logout
function logout() {
    // Clear local storage
    localStorage.removeItem('userToken');
    localStorage.removeItem('userData');
    
    // Redirect to login page
    window.location.href = 'auth.html';
}

// Call this function when the DOM is loaded
document.addEventListener('DOMContentLoaded', initSettings);
