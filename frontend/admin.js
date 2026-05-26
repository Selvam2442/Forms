const token = localStorage.getItem('token');
const BASE_URL = 'https://forms-xg9n.onrender.com';

if (!token) window.location.href = 'index.html';
document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.clear(); window.location.href = 'index.html'; });

let globalStudents = [], globalSubmissions = [];

// === DIRECTORY & TESTS (unchanged core logic) ===
document.getElementById('createStudentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await fetch(`${BASE_URL}/api/admin/students`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: document.getElementById('studentName').value }) });
    if (res.ok) { alert("Student Created!"); document.getElementById('studentName').value = ''; loadStudents(); }
});

async function loadStudents() {
    const res = await fetch(`${BASE_URL}/api/admin/students`, { headers: { 'Authorization': `Bearer ${token}` }});
    if (res.ok) { globalStudents = await res.json(); renderStudentTable(globalStudents); }
}

function renderStudentTable(data) {
    const tbody = document.getElementById('studentTableBody'); tbody.innerHTML = ''; 
    data.forEach(s => {
        tbody.innerHTML += `<tr><td><span class="badge bg-secondary">${s.rollNumber}</span></td><td class="small fw-bold">${s.name}</td><td class="small text-danger">${s.pin}</td><td><button class="btn btn-xs btn-outline-danger btn-sm py-0" onclick="deleteStudent('${s.rollNumber}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    });
}
document.getElementById('searchStudentDir').addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); renderStudentTable(globalStudents.filter(s => s.name.toLowerCase().includes(term) || s.rollNumber.toLowerCase().includes(term))); });
window.deleteStudent = async function(id) { if (!confirm(`Delete ${id}?`)) return; await fetch(`${BASE_URL}/api/admin/students/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); loadStudents(); };

let isDraftMode = false;
function addQuestionCard() {
    const card = document.createElement('div'); card.className = 'card border-0 bg-light p-3 my-2 position-relative rounded-3'; card.style.borderLeft = '4px solid #4285f4';
    card.innerHTML = `<button type="button" class="btn btn-sm btn-link text-danger position-absolute top-0 end-0 remove-btn"><i class="fa-solid fa-trash"></i></button><div class="row g-2 mt-1"><div class="col-8"><label class="text-muted small fw-bold">Numbers (Commas)</label><input type="text" class="form-control form-control-sm q-numbers" required></div><div class="col-4"><label class="text-muted small fw-bold">Preview</label><input type="text" class="form-control form-control-sm q-answer text-success fw-bold bg-white" readonly></div></div>`;
    card.querySelector('.q-numbers').addEventListener('input', (e) => { card.querySelector('.q-answer').value = e.target.value.split(',').reduce((t, v) => t + (parseInt(v.trim()) || 0), 0); });
    card.querySelector('.remove-btn').addEventListener('click', () => card.remove()); document.getElementById('questionsContainer').appendChild(card);
}
addQuestionCard(); document.getElementById('addQuestionBtn').addEventListener('click', addQuestionCard);

document.getElementById('createTestForm').addEventListener('submit', async (e) => {
    e.preventDefault(); const questionsArray = [];
    document.querySelectorAll('.q-numbers').forEach(i => { if (i.value.trim()) questionsArray.push({ numbersArray: i.value.split(',').map(n => parseInt(n.trim(), 10)) }); });
    const res = await fetch(`${BASE_URL}/api/admin/tests`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ title: document.getElementById('testTitle').value, timeLimitMinutes: parseInt(document.getElementById('testTime').value), questions: questionsArray, isActive: !isDraftMode }) });
    if (res.ok) { alert("Test Created!"); window.location.reload(); }
});

async function loadTests() {
    const res = await fetch(`${BASE_URL}/api/admin/tests`, { headers: { 'Authorization': `Bearer ${token}` }});
    if (res.ok) {
        const tests = await res.json(); const tbody = document.getElementById('testTableBody'); const testFilter = document.getElementById('filterTestName');
        tbody.innerHTML = ''; testFilter.innerHTML = '<option value="all">All Tests</option>';
        tests.forEach(t => {
            testFilter.innerHTML += `<option value="${t.title}">${t.title}</option>`;
            tbody.innerHTML += `<tr><td class="small fw-bold">${t.title}</td><td class="small text-muted">${t.questions.length}Q | ${t.timeLimitMinutes}m</td><td>${t.isActive ? `<span class="badge bg-success">Live</span>` : `<span class="badge bg-secondary">Draft</span>`}</td><td><button class="btn btn-xs btn-light btn-sm py-0 me-1" onclick="toggleTest('${t._id}')"><i class="fa-solid fa-power-off"></i></button><button class="btn btn-xs btn-outline-danger btn-sm py-0" onclick="deleteTest('${t._id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`;
        });
    }
}
window.toggleTest = async function(id) { await fetch(`${BASE_URL}/api/admin/tests/${id}/toggle`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }}); loadTests(); };
window.deleteTest = async function(id) { if (!confirm("Delete test and ALL submissions?")) return; await fetch(`${BASE_URL}/api/admin/tests/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); loadTests(); renderReviewEcosystem(); };

// === SUBMISSIONS & MODAL REVIEW ===
async function renderReviewEcosystem() {
    const res = await fetch(`${BASE_URL}/api/admin/submissions`, { headers: { 'Authorization': `Bearer ${token}` }});
    if (res.ok) { globalSubmissions = await res.json(); applyFilters(); }
}

function applyFilters() {
    const sName = document.getElementById('filterStudentName').value.toLowerCase(), sStatus = document.getElementById('filterStatus').value, sTest = document.getElementById('filterTestName').value;
    const filtered = globalSubmissions.filter(sub => sub.studentName.toLowerCase().includes(sName) && (sStatus === 'all' || sub.status === sStatus) && (sTest === 'all' || (sub.testId && sub.testId.title === sTest)));
    
    const container = document.getElementById('submissionsContainer'); container.innerHTML = '';
    filtered.forEach(sub => {
        let stat = `<span class="badge bg-success">Approved</span>`, act = `<div class="bg-light p-2 rounded small mt-2 fw-bold text-muted">Notes: ${sub.adminFeedback}</div>`;
        if (sub.status === 'pending_review') { stat = `<span class="badge bg-warning text-dark">Awaiting</span>`; act = `<button class="btn btn-primary btn-sm w-100 fw-bold mt-2" onclick="processApproval('${sub._id}')">Approve</button>`; } 
        else if (sub.status === 'retake_requested') { stat = `<span class="badge bg-info text-dark">Retake Req</span>`; act = `<button class="btn btn-info btn-sm w-100 text-white fw-bold mt-2" onclick="forceResetRetake('${sub._id}')">Grant Retake</button>`; }
        
        // 🔥 THE NEW REVIEW BUTTON
        const reviewBtn = `<button class="btn btn-outline-dark btn-sm w-100 mt-2 fw-bold" onclick="viewDetails('${sub._id}')"><i class="fa-solid fa-magnifying-glass me-1"></i>View Answers</button>`;
        
        container.innerHTML += `<div class="col"><div class="card shadow-sm border-0 h-100 p-3 bg-white"><div class="d-flex justify-content-between mb-1"><span class="fw-bold text-dark small">${sub.studentName}</span>${stat}</div><div class="small text-muted mb-1">${sub.testId ? sub.testId.title : 'Deleted'}</div><div class="fw-bold text-primary">Score: ${sub.finalScore}</div>${act}${reviewBtn}<button class="btn btn-link text-danger btn-sm w-100 mt-1" onclick="forceResetRetake('${sub._id}')" style="text-decoration:none;"><i class="fa-solid fa-eraser me-1"></i>Reset</button></div></div>`;
    });
}
document.getElementById('filterStudentName').addEventListener('input', applyFilters); document.getElementById('filterStatus').addEventListener('change', applyFilters); document.getElementById('filterTestName').addEventListener('change', applyFilters);

window.processApproval = async function(id) { const note = prompt("Enter notes:", "Excellent!"); if(note===null) return; await fetch(`${BASE_URL}/api/admin/submissions/${id}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ feedback: note })}); renderReviewEcosystem(); };
window.forceResetRetake = async function(id) { if(!confirm("Reset test?")) return; await fetch(`${BASE_URL}/api/admin/submissions/${id}/reset`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); renderReviewEcosystem(); };

// 🔥 NEW: Populates the Modal with exact wrong/right answers
window.viewDetails = function(subId) {
    const sub = globalSubmissions.find(s => s._id === subId);
    if (!sub) return;
    document.getElementById('reviewStudentName').innerText = sub.studentName;
    document.getElementById('reviewTestName').innerText = sub.testId ? sub.testId.title : 'Unknown Test';
    
    const tbody = document.getElementById('reviewTableBody'); tbody.innerHTML = '';
    sub.answers.forEach((ans, index) => {
        const isCorr = ans.isCorrect;
        const badge = isCorr ? '<i class="fa-solid fa-circle-check text-success fs-5"></i>' : '<i class="fa-solid fa-circle-xmark text-danger fs-5"></i>';
        const rowClass = isCorr ? '' : 'table-danger';
        tbody.innerHTML += `<tr class="${rowClass}"><td class="fw-bold text-muted">${index + 1}</td><td class="small">${ans.numbersArray ? ans.numbersArray.join(', ') : 'N/A'}</td><td class="fw-bold fs-5 text-${isCorr ? 'success' : 'danger'}">${ans.studentAnswer}</td><td class="fw-bold fs-5 text-dark">${ans.correctAnswer}</td><td>${badge}</td></tr>`;
    });
    new bootstrap.Modal(document.getElementById('reviewModal')).show();
}

loadStudents(); loadTests(); renderReviewEcosystem();