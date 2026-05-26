// 1. Get elements from the screen
const studentSection = document.getElementById('studentSection');
const adminSection = document.getElementById('adminSection');
const showAdminBtn = document.getElementById('showAdminBtn');
const showStudentBtn = document.getElementById('showStudentBtn');

const studentForm = document.getElementById('studentForm');
const adminForm = document.getElementById('adminForm');

// 2. Toggle between Student and Admin screens
showAdminBtn.addEventListener('click', (e) => {
    e.preventDefault();
    studentSection.classList.add('d-none');
    adminSection.classList.remove('d-none');
});

showStudentBtn.addEventListener('click', (e) => {
    e.preventDefault();
    adminSection.classList.add('d-none');
    studentSection.classList.remove('d-none');
});

// 3. Central Login Function to talk to your backend
async function handleLogin(rollNumber, pin, errorBoxElement) {
    try {
        const response = await fetch('https://forms-xg9n.onrender.com/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rollNumber, pin }) // Pin will be undefined for students, which is fine!
        });

        const data = await response.json();

        if (!response.ok) {
            errorBoxElement.textContent = data.error;
            errorBoxElement.classList.remove('d-none');
            return;
        }

        // Save token and redirect
        localStorage.setItem('token', data.token);
        localStorage.setItem('userName', data.user.name);
        
        if (data.user.role === 'admin') {
            window.location.href = 'admin.html'; // We will build this next!
        } else {
            window.location.href = 'student.html'; // We will build this next!
        }

    } catch (error) {
        errorBoxElement.textContent = "Server is offline. Please start the backend.";
        errorBoxElement.classList.remove('d-none');
    }
}

// 4. Handle Student Submit
studentForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rollNumber = document.getElementById('studentRoll').value;
    const errorBox = document.getElementById('studentError');
    errorBox.classList.add('d-none');
    
    // Pass undefined for the PIN
    handleLogin(rollNumber, undefined, errorBox);
});

// 5. Handle Admin Submit
adminForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const adminName = document.getElementById('adminName').value;
    const adminPin = document.getElementById('adminPin').value;
    const errorBox = document.getElementById('adminError');
    errorBox.classList.add('d-none');
    
    handleLogin(adminName, adminPin, errorBox);
});