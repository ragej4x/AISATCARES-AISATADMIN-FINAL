// Tutorial module for AISAT CARES
// Handles the tutorial video for new users

// Define baseUrl for API calls if not already defined
if (typeof baseUrl === 'undefined') {
    const baseUrl = "https://jimboyaczon.pythonanywhere.com";
}

// Default video URL - direct link to raw video file
const DEFAULT_VIDEO_URL = "https://dl.dropboxusercontent.com/scl/fi/sdt61gaapvvyfye28mlvv/lv_0_20250710173441.mp4?rlkey=784ig3tux9nigan6sw4zcpr23&e=1&st=qqj9zz3p&dl=0";

// Initialize the tutorial system
function initTutorial() {
    // Set up event listeners for tutorial modal
    const doneBtn = document.getElementById('tutorial-done-btn');
    const tutorialModal = document.getElementById('tutorial-modal');
    
    if (doneBtn) {
        doneBtn.addEventListener('click', function() {
            updateNewUserStatus();
            hideTutorialModal();
        });
    }
    
    // Set the video source directly
    setTutorialVideoUrl(DEFAULT_VIDEO_URL);
    
    // Add mobile-specific optimizations
    optimizeForMobile();
}

// Mobile-specific optimizations
function optimizeForMobile() {
    const video = document.getElementById('tutorial-video');
    if (!video) return;
    
    // Add event listeners for better mobile experience
    video.addEventListener('loadedmetadata', function() {
        // Adjust video quality based on screen size
        if (window.innerWidth <= 768) {
            // For mobile devices, use lower resolution if available
            if (video.videoWidth > 640) {
                console.log('Optimizing video for mobile playback');
                // Modern browsers will automatically adjust streaming quality
            }
        }
    });
    
    // Handle fullscreen properly
    video.addEventListener('fullscreenchange', handleFullscreenChange);
    video.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    // Handle orientation changes
    window.addEventListener('orientationchange', function() {
        // Give the browser a moment to adjust
        setTimeout(function() {
            // If in fullscreen, adjust video display
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                video.style.width = '100%';
                video.style.height = '100%';
            }
        }, 300);
    });
    
    // Improve modal styling for mobile
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        if (window.innerWidth <= 480) {
            modalContent.style.width = '95%';
            modalContent.style.maxWidth = '95%';
        }
    }
}

// Handle fullscreen changes
function handleFullscreenChange() {
    const video = document.getElementById('tutorial-video');
    if (!video) return;
    
    if (document.fullscreenElement || document.webkitFullscreenElement) {
        // Entered fullscreen
        video.setAttribute('controls', 'controls');
        
        // Force landscape if possible (not supported on all browsers/devices)
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function(error) {
                console.log('Orientation lock failed: ', error);
            });
        }
    } else {
        // Exited fullscreen
        if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
        }
    }
}

// Show the tutorial modal
function showTutorialModal() {
    const tutorialModal = document.getElementById('tutorial-modal');
    if (tutorialModal) {
        tutorialModal.classList.add('visible');
        
        // Start playing the video
        const video = document.getElementById('tutorial-video');
        if (video) {
            // Try to play the video (might be blocked by browser autoplay policies)
            try {
                // Add a slight delay to ensure modal is visible first
                setTimeout(() => {
                    video.play().catch(e => {
                        console.log('Autoplay prevented by browser:', e);
                        // Show play button or instructions if autoplay is blocked
                        showPlayInstructions();
                    });
                }, 300);
            } catch (err) {
                console.error('Error playing video:', err);
                showPlayInstructions();
            }
        }
    }
}

// Show play instructions if autoplay is blocked
function showPlayInstructions() {
    const videoContainer = document.querySelector('.video-container');
    if (!videoContainer) return;
    
    // Check if instructions already exist
    if (document.querySelector('.play-instructions')) return;
    
    const instructions = document.createElement('div');
    instructions.className = 'play-instructions';
    instructions.innerHTML = '<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; text-align: center; z-index: 2;"><div><i class="fas fa-play-circle" style="font-size: 40px; margin-bottom: 10px;"></i><br>Tap to play video</div></div>';
    
    videoContainer.appendChild(instructions);
    
    // Remove instructions on click
    instructions.addEventListener('click', function() {
        const video = document.getElementById('tutorial-video');
        if (video) {
            video.play().catch(e => console.error('Play error:', e));
        }
        instructions.remove();
    });
}

// Hide the tutorial modal
function hideTutorialModal() {
    const tutorialModal = document.getElementById('tutorial-modal');
    if (tutorialModal) {
        // Pause the video when hiding the modal
        const video = document.getElementById('tutorial-video');
        if (video) {
            video.pause();
        }
        
        tutorialModal.classList.remove('visible');
    }
}

// Set the tutorial video URL
function setTutorialVideoUrl(url) {
    const video = document.getElementById('tutorial-video');
    if (video) {
        const source = video.querySelector('source');
        if (source) {
            source.src = url;
            // Reload the video element to apply the new source
            video.load();
        }
    }
}

// Update the user's new_user status to 'no'
function updateNewUserStatus() {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    
    cordovaFetch(`${baseUrl}/api/update_new_user_status`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ new_user: 'no' })
    })
    .then(res => res.json())
    .then(data => {
        console.log('User status updated:', data);
    })
    .catch(err => {
        console.error('Error updating new user status:', err);
    });
}

// Check if the user is new and show tutorial if needed
function checkIfUserIsNew() {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    
    cordovaFetch(`${baseUrl}/api/check_new_user`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.is_new_user === 'yes') {
            // Show tutorial modal
            showTutorialModal();
        }
    })
    .catch(err => {
        console.error('Error checking if user is new:', err);
    });
}

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    initTutorial();
    
    // Check if user is new
    checkIfUserIsNew();
});

// Export functions for use in other scripts
window.tutorialModule = {
    initTutorial,
    showTutorialModal,
    hideTutorialModal,
    updateNewUserStatus,
    checkIfUserIsNew,
    setTutorialVideoUrl
};
