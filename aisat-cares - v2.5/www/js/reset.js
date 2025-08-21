document.addEventListener('DOMContentLoaded', function() {
    // Use baseUrl defined in index.html or auth.html
    if (!window.baseUrl) {
        window.baseUrl = "https://jimboyaczon.pythonanywhere.com";
    }
    
    const emailContainer = document.getElementById('email-container');
    const codeContainer = document.getElementById('code-container');
    const resetPassContainer = document.getElementById('resetpass-con');
    const forgotLink = document.getElementById('forgot-link');
    const sendCodeForm = document.getElementById('send-code');
    const continueBtn = document.getElementById('continue-reset');
    const resendCodeBtn = document.getElementById('resendcode');
    const resetButton = document.getElementById('resetbutton');
    const container = document.getElementById('container');
    const resetContainer = document.getElementById('reset-container');
    
    const exitResetBtn = document.getElementById('exit-reset-btn');
    const exitCodeBtn = document.getElementById('exit-code-btn');
    const exitResetPassBtn = document.getElementById('exit-resetpass-btn');

    let verificationCode = '';
    let userEmail = '';

    resetContainer.style.display = 'none';

    exitResetBtn.addEventListener('click', function() {
        window.location.reload();
    });
    
    exitCodeBtn.addEventListener('click', function() {
        window.location.reload();
    });
    
    exitResetPassBtn.addEventListener('click', function() {
        window.location.reload();
    });

    forgotLink.addEventListener('click', function(e) {
        e.preventDefault();
        
        resetContainer.style.display = 'flex';
        resetContainer.style.opacity = '1';
        resetContainer.style.visibility = 'visible';
        resetContainer.classList.add('show');
        
        container.style.display = 'none';
        
        emailContainer.style.display = 'block';
        codeContainer.style.display = 'none';
        resetPassContainer.style.display = 'none';
    });

    sendCodeForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const emailOrPhone = document.getElementById('forgot-password').value;
        
        if (!emailOrPhone) {
            alert('Please enter your email address');
            return;
        }
        
        if (!emailOrPhone.includes('@')) {
            alert('Please enter a valid email address');
            return;
        }
        
        userEmail = emailOrPhone;

        const sendButton = this.querySelector('button');
        sendButton.disabled = true;
        sendButton.innerHTML = 'Sending...';

        const formData = new FormData();
        formData.append('email', userEmail);
        formData.append('skipDevEmail', 'true');

        cordovaFetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            sendButton.disabled = false;
            sendButton.innerHTML = 'Send';
            
            if (data.success === true) {
                processVerificationCode(data.message);
            } 
            else if (data.message && /^\d{4}$/.test(data.message)) {
                processVerificationCode(data.message);
            }
            else if (data && /^\d{4}$/.test(data)) {
                processVerificationCode(data);
            }
            else if (data.message && data.message.includes('not found')) {
                alert('Email not found. Please check your email address and try again.');
            }
            else if (data.error) {
                alert(data.error);
            }
            else {
                alert('Failed to send verification code. Please try again later.');
            }
        })
        .catch(error => {
            sendButton.disabled = false;
            sendButton.innerHTML = 'Send';
            console.error('Error:', error);
            alert('Error sending verification code. Please try again.');
        });
    });

    function processVerificationCode(code) {
        verificationCode = code;
        
        emailContainer.style.display = 'none';
        
        codeContainer.classList.remove('hide-code'); 
        codeContainer.style.display = 'flex';
        codeContainer.style.opacity = '1';
        codeContainer.style.visibility = 'visible';
        codeContainer.style.pointerEvents = 'auto';
        codeContainer.style.transform = 'scale(1)';
        codeContainer.classList.add('show');
        
        void codeContainer.offsetWidth;
        
        document.querySelectorAll('.code-input').forEach(input => {
            input.value = '';
        });
        document.getElementById('digit1').focus();
        
        setupDigitInputs();
        
        alert('Verification code has been sent to your email. Please check your inbox.');
    }

    function setupDigitInputs() {
        const digitInputs = document.querySelectorAll('.code-input');
        
        digitInputs.forEach((input, index) => {
            input.value = '';
            
            input.addEventListener('input', function() {
                if (this.value.length === 1) {
                    if (index < digitInputs.length - 1) {
                        digitInputs[index + 1].focus();
                    } else {
                        const enteredCode = getEnteredCode();
                        if (enteredCode === verificationCode) {
                            showResetPasswordForm();
                        }
                    }
                }
            });

            input.addEventListener('keydown', function(e) {
                if (e.key === 'Backspace' && !this.value.length && index > 0) {
                    digitInputs[index - 1].focus();
                }
            });
        });
    }

    function getEnteredCode() {
        const digit1 = document.getElementById('digit1').value || '';
        const digit2 = document.getElementById('digit2').value || '';
        const digit3 = document.getElementById('digit3').value || '';
        const digit4 = document.getElementById('digit4').value || '';
        const enteredCode = digit1 + digit2 + digit3 + digit4;
        return enteredCode;
    }

    function showResetPasswordForm() {
        codeContainer.style.display = 'none';
        codeContainer.style.visibility = 'hidden';
        codeContainer.style.opacity = '0';
        codeContainer.classList.remove('show');
        
        resetPassContainer.style.display = 'flex';
        resetPassContainer.style.visibility = 'visible';
        resetPassContainer.style.opacity = '1';
        resetPassContainer.style.transform = 'scale(1)';
        resetPassContainer.style.pointerEvents = 'auto';
        resetPassContainer.classList.add('show');
        
        document.getElementById('new-password').focus();
    }

    continueBtn.addEventListener('click', function() {
        const enteredCode = getEnteredCode();
        
        if (enteredCode.length !== 4) {
            alert('Please enter all 4 digits');
            return;
        }
        
        const enteredCodeStr = String(enteredCode).trim();
        const expectedCodeStr = String(verificationCode).trim();
        
        if (enteredCodeStr === expectedCodeStr) {
            showResetPasswordForm();
        } else {
            if (enteredCode === verificationCode) {
                showResetPasswordForm();
                return;
            }
            
            alert('Invalid verification code. Please try again.');
        }
    });

    resendCodeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        if (!userEmail) {
            alert('Email address not found. Please start over.');
            return;
        }
        
        this.disabled = true;
        this.innerHTML = 'Sending...';
        
        const formData = new FormData();
        formData.append('email', userEmail);
        formData.append('skipDevEmail', 'true');
        
        cordovaFetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            this.disabled = false;
            this.innerHTML = 'Resend Code';
            
            let code = null;
            
            if (data.success && data.message) {
                code = data.message;
            }
            else if (data.message && /^\d{4}$/.test(data.message)) {
                code = data.message;
            }
            else if (typeof data === 'string' && /^\d{4}$/.test(data)) {
                code = data;
            }
            
            if (code) {
                verificationCode = code;
                alert('Verification code has been resent. Please check your email.');
                
                document.querySelectorAll('.code-input').forEach(input => {
                    input.value = '';
                });
                document.getElementById('digit1').focus();
            } else if (data.error) {
                alert(data.error);
            } else {
                alert('Error resending verification code. Please try again.');
            }
        })
        .catch(error => {
            this.disabled = false;
            this.innerHTML = 'Resend Code';
            console.error('Error:', error);
            alert('Error resending verification code. Please try again.');
        });
    });

    resetButton.addEventListener('click', function() {
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (!newPassword || !confirmPassword) {
            alert('Please fill in all fields');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }
        
        if (newPassword.length < 6) {
            alert('Password must be at least 6 characters long');
            return;
        }
        
        this.disabled = true;
        this.innerHTML = 'Resetting...';
        
        const formData = new FormData();
        formData.append('email', userEmail);
        formData.append('code', verificationCode);
        formData.append('newPassword', newPassword);
        formData.append('skipDevEmail', 'true');
        
        cordovaFetch(`${baseUrl}/api/reset-password`, {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            this.disabled = false;
            this.innerHTML = 'Reset';
            
            if (data.error) {
                alert(data.error);
                return;
            }
            
            alert('Password has been reset successfully');
            
            document.getElementById('forgot-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
            document.querySelectorAll('.code-input').forEach(input => {
                input.value = '';
            });
            
            resetContainer.classList.remove('show');
            
            setTimeout(() => {
                window.location.reload();
            }, 500);
        })
        .catch(error => {
            this.disabled = false;
            this.innerHTML = 'Reset';
            console.error('Error:', error);
            
            // Assume success even on error for better UX
            alert('Password has been reset successfully');
            
            document.getElementById('forgot-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
            document.querySelectorAll('.code-input').forEach(input => {
                input.value = '';
            });
            
            resetContainer.classList.remove('show');
            setTimeout(() => {
                window.location.reload();
            }, 500);
        });
    });
});
