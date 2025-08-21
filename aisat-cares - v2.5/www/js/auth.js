let toggleLoginForm = false; 

document.addEventListener("DOMContentLoaded", function() {
  const inputs = document.querySelectorAll('.code-input');

  inputs.forEach((input, index) => {
      input.addEventListener("input", function() {
          if (input.value.length === 1 && index < inputs.length - 1) {
              inputs[index + 1].focus();
          }
      });
  });
});

document.addEventListener("mousedown", function(e) {
  if (e.button === 0 && !toggleLoginForm) {
    toggleLoginForm = true;
    
    const loginForm = document.getElementById("container");
    const logo = document.getElementById("logo");
    const aisat = document.getElementById("aisat");
    
    loginForm.style.display = "block";
    loginForm.classList.add("show"); 
    logo.classList.add("show");
    aisat.classList.add("show");
  }
});  

function toggleLogin() {
  const form = document.getElementById("container");
  form.classList.remove("hide");
  form.classList.add("show");
}

function hideLogin() {
  const form = document.getElementById("container");
  form.classList.remove("show");
  form.classList.add("hide");
}

function toggleRegister() {
  const form = document.getElementById("reg-container");
  form.classList.remove("hide");
  form.classList.add("show");
}

function hideRegister() {
  const form = document.getElementById("reg-container");
  if (form) {
    form.classList.remove("show");
    form.classList.add("hide");
    form.classList.remove("popupactive");
  }
}

function togglePopup() {
  const form = document.getElementById("reset-container");
  form.classList.remove("hidepopup");
  form.classList.add("show");
  form.classList.add("popupactive")
}

function hidePopup() {
  const form = document.getElementById("reset-container");
  form.classList.remove("showpopup");
  form.classList.add("hidepopup");
}

hidePopup();

document.addEventListener("click", function (e) {
    if (e.target.id === "register-link") {
      toggleRegister();
      hideLogin();
    }
  });

document.addEventListener("click", function (e) {
    if (e.target.id === "login-link") {
      toggleLogin();
      hideRegister();
    }
  });
  
document.addEventListener("click", function (e) {
    if (e.target.id === "forgot-link") {
      hideLogin();
      hideRegister();
      togglePopup();   
    }
  });

function showcodeinput(){
  const form = document.getElementById("email-container");
  form.classList.add("hide-email-sent");
  console.log("Email sent");

  const show_code = document.getElementById("code-container");
  show_code.style.display = 'flex';
  show_code.style.opacity = '1';
  show_code.style.visibility = 'visible';
  show_code.style.pointerEvents = 'auto';
  show_code.style.transform = 'scale(1)';
  show_code.classList.add("show");
  show_code.classList.remove("hide-code");
  console.log("Showing code input container with explicit styles");
  
  document.getElementById('digit1').focus();
}

function continueinputcode(){
  const show_code = document.getElementById("code-container");
  show_code.style.display = 'none';
  show_code.style.visibility = 'hidden';
  show_code.style.opacity = '0';
  show_code.classList.remove("show");
  console.log("Hiding code input container");

  const reset_password = document.getElementById("resetpass-con");
  reset_password.style.display = 'flex';
  reset_password.style.visibility = 'visible';
  reset_password.style.opacity = '1';
  reset_password.style.transform = 'scale(1)';
  reset_password.style.pointerEvents = 'auto';
  reset_password.classList.add("show");
  console.log("Showing password reset container with explicit styles");
  
  document.getElementById('new-password').focus();
}


