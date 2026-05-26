const token = localStorage.getItem('token');
const BASE_URL = 'https://forms-xg9n.onrender.com';

if (!token) window.location.href = 'index.html';

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

let globalStudents = [];
let globalSubmissions = [];
let statusChartObj = null;
let scoreChartObj = null;
window.visiblePendingIds = []; // Global tracker for Bulk Approve

// ==========================================
// 1. STUDENT MANAGEMENT & CUSTOM PIN
// ==========================================
const studentForm = document.getElementById('createStudentForm');
if (studentForm) {
    studentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${BASE_URL}/api/admin/students`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    name: document.getElementById('studentName').value,
                    pin: document.getElementById('studentPin').value 
                })
            });
            if (res.ok) {
                alert("Student Created successfully!");
                document.getElementById('studentName').value = '';
                document.getElementById('studentPin').value = '';
                loadStudents();
            }
        } catch (e) { alert("Server Error creating student."); }
    });
}

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
    if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(s => {
        tbody.innerHTML += `
            <tr>
                <td><span class="badge bg-secondary">${s.rollNumber}</span></td>
                <td class="small fw-bold text-dark">${s.name}</td>
                <td class="small text-danger font-monospace">${s.pin}</td>
                <td>
                    <button class="btn btn-xs btn-outline-primary btn-sm py-0 me-1" onclick="openEditPin('${s.rollNumber}', '${s.pin}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-xs btn-outline-danger btn-sm py-0" onclick="deleteStudent('${s.rollNumber}')"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>`;
    });
}

const searchInput = document.getElementById('searchStudentDir');
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        renderStudentTable(globalStudents.filter(s => s.name.toLowerCase().includes(term) || s.rollNumber.toLowerCase().includes(term)));
    });
}

window.openEditPin = function(rollNumber, currentPin) {
    document.getElementById('editPinRollNumber').value = rollNumber;
    document.getElementById('newPinInput').value = currentPin;
    new bootstrap.Modal(document.getElementById('editPinModal')).show();
};

window.saveNewPin = async function() {
    const rollNumber = document.getElementById('editPinRollNumber').value;
    const newPin = document.getElementById('newPinInput').value;
    if (!newPin) return alert("PIN cannot be empty.");
    
    await fetch(`${BASE_URL}/api/admin/students/${rollNumber}/pin`, { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin: newPin })
    });
    bootstrap.Modal.getInstance(document.getElementById('editPinModal')).hide();
    loadStudents();
};

window.deleteStudent = async function(id) {
    if (!confirm(`Permanently delete student record for ${id}?`)) return;
    await fetch(`${BASE_URL}/api/admin/students/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
    loadStudents();
};

// ==========================================
// 2. QUIZ BUILDER & SCHEDULED TESTS
// ==========================================
let isDraftMode = false;

function addQuestionCard() {
    const container = document.getElementById('questionsContainer');
    if (!container) return;
    const card = document.createElement('div');
    card.className = 'card border-0 bg-light p-3 my-2 position-relative rounded-3';
    card.style.borderLeft = '4px solid #4285f4';
    card.innerHTML = `
        <button type="button" class="btn btn-sm btn-link text-danger position-absolute top-0 end-0 remove-btn"><i class="fa-solid fa-trash"></i></button>
        <div class="row g-2 mt-1">
            <div class="col-8"><label class="text-muted small fw-bold">Numbers Stack (Commas)</label><input type="text" class="form-control form-control-sm q-numbers" placeholder="10, -5, 2" required></div>
            <div class="col-4"><label class="text-muted small fw-bold">Preview Sum</label><input type="text" class="form-control form-control-sm q-answer text-success fw-bold bg-white" readonly></div>
        </div>
    `;
    card.querySelector('.q-numbers').addEventListener('input', (e) => {
        card.querySelector('.q-answer').value = e.target.value.split(',').reduce((t, v) => t + (parseInt(v.trim()) || 0), 0);
    });
    card.querySelector('.remove-btn').addEventListener('click', () => card.remove());
    container.appendChild(card);
}

const addBtn = document.getElementById('addQuestionBtn');
if (addBtn) { addQuestionCard(); addBtn.addEventListener('click', addQuestionCard); }

const testForm = document.getElementById('createTestForm');
if (testForm) {
    testForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('testTitle').value;
        const timeLimit = document.getElementById('testTime').value;
        const rawSchedule = document.getElementById('testSchedule').value;
        const scheduledFor = rawSchedule ? new Date(rawSchedule).toISOString() : null;
        
        const questionsArray = [];
        document.querySelectorAll('.q-numbers').forEach(input => {
            if (input.value.trim()) questionsArray.push({ numbersArray: input.value.split(',').map(n => parseInt(n.trim(), 10)) });
        });

        try {
            const res = await fetch(`${BASE_URL}/api/admin/tests`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ title, timeLimitMinutes: parseInt(timeLimit), questions: questionsArray, isActive: !isDraftMode, scheduledFor })
            });
            if (res.ok) { alert("Test Created!"); window.location.reload(); }
        } catch (e) { alert("Server Error creating test."); }
    });
}

async function loadTests() {
    try {
        const res = await fetch(`${BASE_URL}/api/admin/tests`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (res.ok) {
            const tests = await res.json();
            const tbody = document.getElementById('testTableBody');
            const testFilter = document.getElementById('filterTestName');
            
            if (tbody) tbody.innerHTML = '';
            if (testFilter) testFilter.innerHTML = '<option value="all">All Tests</option>';
            
            tests.forEach(test => {
                if (testFilter) testFilter.innerHTML += `<option value="${test.title}">${test.title}</option>`;
                const badge = test.isActive ? `<span class="badge bg-success">Live</span>` : `<span class="badge bg-secondary">Draft</span>`;
                const scheduleDisplay = new Date(test.scheduledFor).toLocaleDateString('en-US', {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'});
                
                if (tbody) {
                    tbody.innerHTML += `
                        <tr>
                            <td class="small fw-bold">${test.title}</td>
                            <td class="small text-muted">${test.questions.length}Q | ${test.timeLimitMinutes}m</td>
                            <td class="small text-muted">${scheduleDisplay}</td>
                            <td>${badge}</td>
                            <td>
                                <button class="btn btn-xs btn-light btn-sm py-0 me-1" onclick="toggleTest('${test._id}')"><i class="fa-solid fa-power-off"></i></button>
                                <button class="btn btn-xs btn-outline-danger btn-sm py-0" onclick="deleteTest('${test._id}')"><i class="fa-solid fa-trash"></i></button>
                            </td>
                        </tr>`;
                }
            });
        }
    } catch (e) {}
}

window.toggleTest = async function(id) { await fetch(`${BASE_URL}/api/admin/tests/${id}/toggle`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }}); loadTests(); };
window.deleteTest = async function(id) { if (!confirm("Delete this test AND all submissions?")) return; await fetch(`${BASE_URL}/api/admin/tests/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); loadTests(); renderReviewEcosystem(); };

// ==========================================
// 3. SUBMISSIONS, BULK APPROVE, & ANALYTICS
// ==========================================
async function renderReviewEcosystem() {
    try {
        const res = await fetch(`${BASE_URL}/api/admin/submissions`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (res.ok) { globalSubmissions = await res.json(); applyFilters(); renderCharts(globalSubmissions); }

        const leadRes = await fetch(`${BASE_URL}/api/admin/leaderboard`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (leadRes.ok) {
            const groupedLeaders = await leadRes.json();
            const container = document.getElementById('adminLeaderboardContainer');
            if (container) {
                container.innerHTML = '';
                for (const [testName, leaders] of Object.entries(groupedLeaders)) {
                    let html = `<div class="mb-3 card border-0 shadow-sm"><div class="card-header bg-primary text-white fw-bold small">${testName}</div><ul class="list-group list-group-flush">`;
                    leaders.forEach((entry, idx) => {
                        let color = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? '#cd7f32' : 'gray';
                        html += `<li class="list-group-item d-flex justify-content-between align-items-center p-2 small"><span class="fw-bold"><i class="fa-solid fa-medal me-2" style="color:${color};"></i>${entry.studentName || "Unknown"}</span><span class="badge bg-dark">${entry.finalScore} Pts</span></li>`;
                    });
                    container.innerHTML += html + `</ul></div>`;
                }
            }
        }
    } catch (e) {}
}

function applyFilters() {
    const fName = document.getElementById('filterStudentName');
    const fStatus = document.getElementById('filterStatus');
    const fTest = document.getElementById('filterTestName');

    if (!fName || !fStatus || !fTest) return;

    const sName = fName.value.toLowerCase();
    const sStatus = fStatus.value;
    const sTest = fTest.value;

    const filtered = globalSubmissions.filter(sub => {
        const safeName = (sub.studentName || "Unknown Student").toLowerCase();
        return safeName.includes(sName) && (sStatus === 'all' || sub.status === sStatus) && (sTest === 'all' || (sub.testId && sub.testId.title === sTest));
    });

    const container = document.getElementById('submissionsContainer');
    if (!container) return;
    container.innerHTML = '';
    
    window.visiblePendingIds = []; // Reset Bulk Approve tracker

    filtered.forEach(sub => {
        let stat = `<span class="badge bg-success">Approved</span>`;
        let act = `<div class="bg-light p-2 rounded small mt-2 fw-bold text-muted">Notes: ${sub.adminFeedback || ''}</div>`;
        
        if (sub.status === 'pending_review') {
            window.visiblePendingIds.push(sub._id); // Track for bulk approve
            stat = `<span class="badge bg-warning text-dark">Awaiting</span>`;
            act = `<button class="btn btn-primary btn-sm w-100 fw-bold mt-2" onclick="processApproval('${sub._id}')">Approve</button>`;
        } else if (sub.status === 'retake_requested') {
            stat = `<span class="badge bg-info text-dark">Retake Req</span>`;
            act = `<button class="btn btn-info btn-sm w-100 text-white fw-bold mt-2" onclick="forceResetRetake('${sub._id}')">Grant Retake</button>`;
        }

        const reviewBtn = `<button class="btn btn-outline-dark btn-sm w-100 mt-2 fw-bold" onclick="viewDetails('${sub._id}')"><i class="fa-solid fa-magnifying-glass me-1"></i>View Answers</button>`;
        const displayName = sub.studentName || "Unknown Student";

        container.innerHTML += `<div class="col"><div class="card shadow-sm border-0 h-100 p-3 bg-white"><div class="d-flex justify-content-between mb-1"><span class="fw-bold text-dark small">${displayName}</span>${stat}</div><div class="small text-muted mb-1">${sub.testId ? sub.testId.title : 'Deleted Test'}</div><div class="fw-bold text-primary">Score: ${sub.finalScore}</div>${act}${reviewBtn}<button class="btn btn-link text-danger btn-sm w-100 mt-1" onclick="forceResetRetake('${sub._id}')" style="text-decoration:none;"><i class="fa-solid fa-eraser me-1"></i>Reset</button></div></div>`;
    });
}

if (document.getElementById('filterStudentName')) document.getElementById('filterStudentName').addEventListener('input', applyFilters);
if (document.getElementById('filterStatus')) document.getElementById('filterStatus').addEventListener('change', applyFilters);
if (document.getElementById('filterTestName')) document.getElementById('filterTestName').addEventListener('change', applyFilters);

// 🔥 NEW: Bulk Approve Button Logic
const bulkBtn = document.getElementById('bulkApproveBtn');
if (bulkBtn) {
    bulkBtn.addEventListener('click', async () => {
        if (!window.visiblePendingIds || window.visiblePendingIds.length === 0) return alert("No pending submissions in current view to approve.");
        if (!confirm(`Approve all ${window.visiblePendingIds.length} visible submissions?`)) return;
        
        await fetch(`${BASE_URL}/api/admin/submissions/approve-bulk`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ submissionIds: window.visiblePendingIds })
        });
        renderReviewEcosystem();
    });
}

window.processApproval = async function(id) {
    const note = prompt("Enter grading notes:", "Excellent work!");
    if (note === null) return;
    await fetch(`${BASE_URL}/api/admin/submissions/${id}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ feedback: note })});
    renderReviewEcosystem();
};

window.forceResetRetake = async function(id) {
    if (!confirm("Wipe this submission and allow the student to retake?")) return;
    await fetch(`${BASE_URL}/api/admin/submissions/${id}/reset`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
    renderReviewEcosystem();
};

window.viewDetails = function(subId) {
    const sub = globalSubmissions.find(s => s._id === subId);
    if (!sub) return;
    document.getElementById('reviewStudentName').innerText = sub.studentName || 'Unknown Student';
    document.getElementById('reviewTestName').innerText = sub.testId ? sub.testId.title : 'Unknown Test';
    const tbody = document.getElementById('reviewTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (sub.answers) {
        sub.answers.forEach((ans, index) => {
            const isCorr = ans.isCorrect;
            const badge = isCorr ? '<i class="fa-solid fa-circle-check text-success fs-5"></i>' : '<i class="fa-solid fa-circle-xmark text-danger fs-5"></i>';
            const rowClass = isCorr ? '' : 'table-danger';
            tbody.innerHTML += `<tr class="${rowClass}"><td class="fw-bold text-muted">${index + 1}</td><td class="small">${ans.numbersArray ? ans.numbersArray.join(', ') : 'N/A'}</td><td class="fw-bold fs-5 text-${isCorr ? 'success' : 'danger'}">${ans.studentAnswer}</td><td class="fw-bold fs-5 text-dark">${ans.correctAnswer}</td><td>${badge}</td></tr>`;
        });
    }
    new bootstrap.Modal(document.getElementById('reviewModal')).show();
}

function renderCharts(submissions) {
    if (!document.getElementById('statusChart') || !document.getElementById('scoreChart')) return; 
    let pending = 0, graded = 0; const scoresByTest = {};
    submissions.forEach(sub => {
        if (sub.status === 'pending_review' || sub.status === 'retake_requested') pending++; else graded++;
        const testName = sub.testId ? sub.testId.title : 'Unknown';
        if (!scoresByTest[testName]) scoresByTest[testName] = { total: 0, count: 0 };
        scoresByTest[testName].total += sub.finalScore; scoresByTest[testName].count += 1;
    });
    if(statusChartObj) statusChartObj.destroy(); if(scoreChartObj) scoreChartObj.destroy();
    statusChartObj = new Chart(document.getElementById('statusChart'), { type: 'doughnut', data: { labels: ['Needs Review', 'Graded'], datasets: [{ data: [pending, graded], backgroundColor: ['#ffc107', '#198754'] }] }, options: { plugins: { title: { display: true, text: 'Submission Status' } } }});
    const testLabels = Object.keys(scoresByTest); const avgScores = testLabels.map(t => scoresByTest[t].total / scoresByTest[t].count);
    scoreChartObj = new Chart(document.getElementById('scoreChart'), { type: 'bar', data: { labels: testLabels, datasets: [{ label: 'Avg Score', data: avgScores, backgroundColor: '#0d6efd' }] }, options: { plugins: { title: { display: true, text: 'Average Scores by Test' } } }});
}

// BOOT UP
loadStudents();
loadTests();
renderReviewEcosystem();