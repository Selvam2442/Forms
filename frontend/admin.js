const token = localStorage.getItem('token');
const BASE_URL = 'https://forms-xg9n.onrender.com';

if (!token) window.location.href = 'index.html';

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

let statusChartObj = null, scoreChartObj = null;
let globalStudents = [], globalSubmissions = [];

// === STUDENT DIRECTORY & SEARCH ===
document.getElementById('createStudentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const res = await fetch(`${BASE_URL}/api/admin/students`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: document.getElementById('studentName').value })
        });
        if (res.ok) {
            alert("Student Created!"); document.getElementById('studentName').value = ''; loadStudents();
        }
    } catch (e) { alert("Error"); }
});

async function loadStudents() {
    try {
        const res = await fetch(`${BASE_URL}/api/admin/students`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (res.ok) {
            globalStudents = await res.json();
            renderStudentTable(globalStudents);
        }
    } catch (e) {}
}

function renderStudentTable(data) {
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = ''; 
    data.forEach(student => {
        tbody.innerHTML += `
            <tr>
                <td><span class="badge bg-secondary">${student.rollNumber}</span></td>
                <td class="small fw-bold text-dark">${student.name}</td>
                <td class="small text-danger font-monospace">${student.pin}</td>
                <td><button class="btn btn-xs btn-outline-danger btn-sm py-0" onclick="deleteStudent('${student.rollNumber}')"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
    });
}

document.getElementById('searchStudentDir').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = globalStudents.filter(s => s.name.toLowerCase().includes(term) || s.rollNumber.toLowerCase().includes(term));
    renderStudentTable(filtered);
});

window.deleteStudent = async function(rollNumber) {
    if (!confirm(`Wipe user record for ${rollNumber}?`)) return;
    await fetch(`${BASE_URL}/api/admin/students/${rollNumber}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
    loadStudents();
};

// === TEST MANAGEMENT & DELETION ===
let isDraftMode = false;
function addQuestionCard() {
    const card = document.createElement('div');
    card.className = 'card border-0 bg-light p-3 my-2 position-relative rounded-3';
    card.style.borderLeft = '4px solid #4285f4';
    card.innerHTML = `
        <button type="button" class="btn btn-sm btn-link text-danger position-absolute top-0 end-0 remove-btn"><i class="fa-solid fa-trash"></i></button>
        <div class="row g-2 mt-1">
            <div class="col-8"><label class="text-muted small fw-bold">Vertical Stack (Commas)</label><input type="text" class="form-control form-control-sm q-numbers" required></div>
            <div class="col-4"><label class="text-muted small fw-bold">Preview</label><input type="text" class="form-control form-control-sm q-answer text-success fw-bold bg-white" readonly></div>
        </div>`;
    card.querySelector('.q-numbers').addEventListener('input', (e) => {
        card.querySelector('.q-answer').value = e.target.value.split(',').reduce((t, v) => t + (parseInt(v.trim()) || 0), 0);
    });
    card.querySelector('.remove-btn').addEventListener('click', () => card.remove());
    document.getElementById('questionsContainer').appendChild(card);
}
addQuestionCard();
document.getElementById('addQuestionBtn').addEventListener('click', addQuestionCard);

document.getElementById('createTestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const questionsArray = [];
    document.querySelectorAll('.q-numbers').forEach(i => { if (i.value.trim()) questionsArray.push({ numbersArray: i.value.split(',').map(n => parseInt(n.trim(), 10)) }); });
    try {
        const res = await fetch(`${BASE_URL}/api/admin/tests`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title: document.getElementById('testTitle').value, timeLimitMinutes: parseInt(document.getElementById('testTime').value), questions: questionsArray, isActive: !isDraftMode })
        });
        if (res.ok) { alert("Test Created!"); window.location.reload(); }
    } catch (e) { alert("Error"); }
});

async function loadTests() {
    try {
        const res = await fetch(`${BASE_URL}/api/admin/tests`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (res.ok) {
            const tests = await res.json();
            const tbody = document.getElementById('testTableBody');
            const testFilter = document.getElementById('filterTestName');
            tbody.innerHTML = ''; testFilter.innerHTML = '<option value="all">All Tests</option>';
            
            tests.forEach(test => {
                testFilter.innerHTML += `<option value="${test.title}">${test.title}</option>`;
                tbody.innerHTML += `
                    <tr>
                        <td class="small fw-bold">${test.title}</td>
                        <td class="small text-muted">${test.questions.length}Q | ${test.timeLimitMinutes}m</td>
                        <td>${test.isActive ? `<span class="badge bg-success">Live</span>` : `<span class="badge bg-secondary">Draft</span>`}</td>
                        <td>
                            <button class="btn btn-xs btn-light btn-sm py-0 me-1" onclick="toggleTest('${test._id}')"><i class="fa-solid fa-power-off"></i></button>
                            <button class="btn btn-xs btn-outline-danger btn-sm py-0" onclick="deleteTest('${test._id}')"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
        }
    } catch (e) {}
}

window.toggleTest = async function(id) { await fetch(`${BASE_URL}/api/admin/tests/${id}/toggle`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }}); loadTests(); };

// NEW: Delete Test Function
window.deleteTest = async function(id) {
    if (!confirm("Are you sure? This will delete the test and ALL student submissions for it!")) return;
    await fetch(`${BASE_URL}/api/admin/tests/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
    loadTests(); renderReviewEcosystem(); // Refresh tables
};

// === ADVANCED SUBMISSION FILTERS & ANALYTICS ===
async function renderReviewEcosystem() {
    try {
        const res = await fetch(`${BASE_URL}/api/admin/submissions`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (res.ok) {
            globalSubmissions = await res.json();
            applyFilters(); // This draws the UI
            renderCharts(globalSubmissions);
        }
        // Load Leaderboard
        const leadRes = await fetch(`${BASE_URL}/api/admin/leaderboard`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (leadRes.ok) {
            const groupedLeaders = await leadRes.json();
            const container = document.getElementById('adminLeaderboardContainer'); container.innerHTML = '';
            for (const [testName, leaders] of Object.entries(groupedLeaders)) {
                let html = `<div class="mb-3 card border-0 shadow-sm"><div class="card-header bg-primary text-white fw-bold small">${testName}</div><ul class="list-group list-group-flush">`;
                leaders.forEach((entry, idx) => {
                    let color = idx===0?'gold':idx===1?'silver':idx===2?'#cd7f32':'gray';
                    html += `<li class="list-group-item d-flex justify-content-between p-2 small"><span class="fw-bold"><i class="fa-solid fa-medal me-2" style="color:${color};"></i>${entry.studentName}</span><span class="badge bg-dark">${entry.finalScore} Pts</span></li>`;
                });
                container.innerHTML += html + `</ul></div>`;
            }
        }
    } catch (e) {}
}

// FILTER LOGIC
function applyFilters() {
    const sName = document.getElementById('filterStudentName').value.toLowerCase();
    const sStatus = document.getElementById('filterStatus').value;
    const sTest = document.getElementById('filterTestName').value;

    const filtered = globalSubmissions.filter(sub => {
        const matchName = sub.studentName.toLowerCase().includes(sName);
        const matchStatus = sStatus === 'all' || sub.status === sStatus;
        const matchTest = sTest === 'all' || (sub.testId && sub.testId.title === sTest);
        return matchName && matchStatus && matchTest;
    });

    const container = document.getElementById('submissionsContainer'); container.innerHTML = '';
    filtered.forEach(sub => {
        let stat = `<span class="badge bg-success"><i class="fa-solid fa-check me-1"></i>Approved</span>`, act = `<div class="bg-light p-2 rounded small mt-2 fw-bold text-muted">Notes: ${sub.adminFeedback}</div>`;
        if (sub.status === 'pending_review') {
            stat = `<span class="badge bg-warning text-dark"><i class="fa-solid fa-clock me-1"></i>Awaiting</span>`; act = `<button class="btn btn-primary btn-sm w-100 fw-bold mt-2" onclick="processApproval('${sub._id}')">Approve</button>`;
        } else if (sub.status === 'retake_requested') {
            stat = `<span class="badge bg-info text-dark"><i class="fa-solid fa-rotate-right"></i>Req</span>`; act = `<button class="btn btn-info btn-sm w-100 text-white fw-bold mt-2" onclick="forceResetRetake('${sub._id}')">Grant Retake</button>`;
        }
        container.innerHTML += `<div class="col"><div class="card shadow-sm border-0 h-100 p-3 bg-white"><div class="d-flex justify-content-between mb-1"><span class="fw-bold text-dark small">${sub.studentName}</span>${stat}</div><div class="small text-muted mb-1">${sub.testId ? sub.testId.title : 'Deleted'}</div><div class="fw-bold text-primary">Score: ${sub.finalScore}</div>${act}<button class="btn btn-link text-danger btn-sm w-100 mt-1" onclick="forceResetRetake('${sub._id}')" style="text-decoration:none;"><i class="fa-solid fa-eraser me-1"></i>Reset</button></div></div>`;
    });
}

document.getElementById('filterStudentName').addEventListener('input', applyFilters);
document.getElementById('filterStatus').addEventListener('change', applyFilters);
document.getElementById('filterTestName').addEventListener('change', applyFilters);

// ACTIONS
window.processApproval = async function(id) {
    const note = prompt("Enter notes:", "Excellent!"); if(note===null) return;
    await fetch(`${BASE_URL}/api/admin/submissions/${id}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ feedback: note })}); renderReviewEcosystem();
};
window.forceResetRetake = async function(id) {
    if(!confirm("Reset this test?")) return;
    await fetch(`${BASE_URL}/api/admin/submissions/${id}/reset`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); renderReviewEcosystem();
};

function renderCharts(submissions) {
    let pending = 0, graded = 0; const scoresByTest = {};
    submissions.forEach(sub => {
        if (sub.status === 'pending_review' || sub.status === 'retake_requested') pending++; else graded++;
        const testName = sub.testId ? sub.testId.title : 'Unknown';
        if (!scoresByTest[testName]) scoresByTest[testName] = { total: 0, count: 0 };
        scoresByTest[testName].total += sub.finalScore; scoresByTest[testName].count += 1;
    });
    if(statusChartObj) statusChartObj.destroy(); if(scoreChartObj) scoreChartObj.destroy();
    statusChartObj = new Chart(document.getElementById('statusChart'), { type: 'doughnut', data: { labels: ['Review', 'Graded'], datasets: [{ data: [pending, graded], backgroundColor: ['#ffc107', '#198754'] }] }, options: { plugins: { title: { display: true, text: 'Status' } } }});
    const testLabels = Object.keys(scoresByTest), avgScores = testLabels.map(t => scoresByTest[t].total / scoresByTest[t].count);
    scoreChartObj = new Chart(document.getElementById('scoreChart'), { type: 'bar', data: { labels: testLabels, datasets: [{ label: 'Avg Score', data: avgScores, backgroundColor: '#0d6efd' }] }, options: { plugins: { title: { display: true, text: 'Average Scores' } } }});
}

loadStudents(); loadTests(); renderReviewEcosystem();