const token = localStorage.getItem('token');
const BASE_URL = 'https://forms-xg9n.onrender.com';
if (!token) window.location.href = 'index.html';
document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.clear(); window.location.href = 'index.html'; });

let globalStudents = [], globalManagedTests = [], globalSubmissions = [];
let statusChartObj = null, scoreChartObj = null;
window.visiblePendingIds = []; 

// Student Management
if (document.getElementById('createStudentForm')) {
    document.getElementById('createStudentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${BASE_URL}/api/admin/students`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: document.getElementById('studentName').value, pin: document.getElementById('studentPin').value }) });
            if (res.ok) { alert("Student Created!"); document.getElementById('studentName').value = ''; document.getElementById('studentPin').value = ''; loadStudents(); }
        } catch (e) { alert("Error"); }
    });
}

// 🔥 BUILD THE ASSIGNMENT UI
function buildAssignUI() {
    const container = document.getElementById('assignToContainer'); if (!container) return;
    let html = `<div class="form-check border-bottom pb-1 mb-1"><input class="form-check-input" type="checkbox" value="ALL" id="cb_ALL" checked onchange="toggleAssignAll()"><label class="form-check-label fw-bold text-primary" for="cb_ALL">Everyone (All Students)</label></div>`;
    globalStudents.forEach(s => { html += `<div class="form-check"><input class="form-check-input student-cb" type="checkbox" value="${s.rollNumber}" id="cb_${s.rollNumber}" onchange="toggleSpecificAssign()"><label class="form-check-label small" for="cb_${s.rollNumber}">[${s.rollNumber}] ${s.name}</label></div>`; });
    container.innerHTML = html;
}
window.toggleAssignAll = function() {
    const isAll = document.getElementById('cb_ALL').checked;
    document.querySelectorAll('.student-cb').forEach(cb => cb.checked = false);
    if (!isAll) document.getElementById('cb_ALL').checked = true; // Prevent unchecking all entirely
}
window.toggleSpecificAssign = function() {
    let anyChecked = false; document.querySelectorAll('.student-cb').forEach(cb => { if(cb.checked) anyChecked = true; });
    document.getElementById('cb_ALL').checked = !anyChecked;
}

async function loadStudents() {
    try { const res = await fetch(`${BASE_URL}/api/admin/students`, { headers: { 'Authorization': `Bearer ${token}` }}); if (res.ok) { globalStudents = await res.json(); renderStudentTable(globalStudents); buildAssignUI(); } } catch (e) {}
}

function renderStudentTable(data) {
    const tbody = document.getElementById('studentTableBody'); if (!tbody) return; tbody.innerHTML = '';
    data.forEach(s => { tbody.innerHTML += `<tr><td><span class="badge bg-secondary">${s.rollNumber}</span></td><td class="small fw-bold text-dark">${s.name}</td><td class="small text-danger font-monospace">${s.pin}</td><td><button class="btn btn-xs btn-outline-primary btn-sm py-0 me-1" onclick="openEditPin('${s.rollNumber}', '${s.pin}')"><i class="fa-solid fa-pen"></i></button><button class="btn btn-xs btn-outline-danger btn-sm py-0" onclick="deleteStudent('${s.rollNumber}')"><i class="fa-solid fa-trash"></i></button></td></tr>`; });
}
if (document.getElementById('searchStudentDir')) document.getElementById('searchStudentDir').addEventListener('input', (e) => renderStudentTable(globalStudents.filter(s => s.name.toLowerCase().includes(e.target.value.toLowerCase()) || s.rollNumber.toLowerCase().includes(e.target.value.toLowerCase()))));
window.openEditPin = function(rollNumber, currentPin) { document.getElementById('editPinRollNumber').value = rollNumber; document.getElementById('newPinInput').value = currentPin; new bootstrap.Modal(document.getElementById('editPinModal')).show(); };
window.saveNewPin = async function() { const rollNumber = document.getElementById('editPinRollNumber').value; const newPin = document.getElementById('newPinInput').value; if (!newPin) return alert("PIN cannot be empty."); await fetch(`${BASE_URL}/api/admin/students/${rollNumber}/pin`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ pin: newPin }) }); bootstrap.Modal.getInstance(document.getElementById('editPinModal')).hide(); loadStudents(); };
window.deleteStudent = async function(id) { if (!confirm(`Delete student record ${id}?`)) return; await fetch(`${BASE_URL}/api/admin/students/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); loadStudents(); };

// Export Engine
window.exportToExcel = function(testId, testTitle) {
    const testSubs = globalSubmissions.filter(sub => sub.testId && sub.testId._id === testId);
    if(testSubs.length === 0) return alert("No submissions found for this test yet!");
    const data = testSubs.map(sub => {
        const end = new Date(sub.submitTime); const start = new Date(end.getTime() - (sub.timeTakenSeconds * 1000));
        return { "Student Name": sub.studentName || "Unknown", "Score": sub.finalScore, "Status": sub.status === 'graded' ? 'Graded' : 'Pending Review', "Start Time": start.toLocaleString(), "End Time": end.toLocaleString(), "Total Time Taken": sub.timeTakenSeconds ? `${Math.floor(sub.timeTakenSeconds / 60)}m ${sub.timeTakenSeconds % 60}s` : 'Unknown Time' };
    });
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Test Results");
    XLSX.writeFile(wb, `${testTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_class_results.xlsx`);
};

// Quiz Builder Logic
let isDraftMode = false;
function addQuestionCard(existingNumbers = "") {
    const container = document.getElementById('questionsContainer'); if (!container) return;
    const card = document.createElement('div'); card.className = 'card border-0 bg-light p-3 my-2 position-relative rounded-3'; card.style.borderLeft = '4px solid #4285f4';
    card.innerHTML = `<button type="button" class="btn btn-sm btn-link text-danger position-absolute top-0 end-0 remove-btn"><i class="fa-solid fa-trash"></i></button><div class="row g-2 mt-1"><div class="col-8"><label class="text-muted small fw-bold">Numbers Stack (Commas)</label><input type="text" class="form-control form-control-sm q-numbers" placeholder="10, -5, 2" value="${existingNumbers}" required></div><div class="col-4"><label class="text-muted small fw-bold">Preview Sum</label><input type="text" class="form-control form-control-sm q-answer text-success fw-bold bg-white" readonly></div></div>`;
    const numInput = card.querySelector('.q-numbers'); const ansInput = card.querySelector('.q-answer');
    numInput.addEventListener('input', (e) => { ansInput.value = e.target.value.split(',').reduce((t, v) => t + (parseInt(v.trim()) || 0), 0); });
    if(existingNumbers) ansInput.value = existingNumbers.split(',').reduce((t, v) => t + (parseInt(v.trim()) || 0), 0);
    card.querySelector('.remove-btn').addEventListener('click', () => card.remove()); container.appendChild(card);
}
if (document.getElementById('addQuestionBtn')) { addQuestionCard(); document.getElementById('addQuestionBtn').addEventListener('click', () => addQuestionCard()); }

// 🔥 CREATE & EDIT TEST SUBMIT LOGIC
if (document.getElementById('createTestForm')) {
    document.getElementById('createTestForm').addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const editId = document.getElementById('editingTestId').value;
        const title = document.getElementById('testTitle').value, timeLimit = document.getElementById('testTime').value;
        
        // Extract DateTime securely
        const dateOpen = document.getElementById('testAvailableFrom').value;
        const dateDue = document.getElementById('testDueDate').value;
        const availableFrom = dateOpen ? new Date(dateOpen).toISOString() : null;
        const dueDate = dateDue ? new Date(dateDue).toISOString() : null;
        
        // Extract Assignments
        const assignedTo = [];
        if (!document.getElementById('cb_ALL').checked) {
            document.querySelectorAll('.student-cb').forEach(cb => { if(cb.checked) assignedTo.push(cb.value); });
        }

        const questionsArray = []; document.querySelectorAll('.q-numbers').forEach(i => { if (i.value.trim()) questionsArray.push({ numbersArray: i.value.split(',').map(n => parseInt(n.trim(), 10)) }); });

        try {
            let res;
            const payload = { title, timeLimitMinutes: parseInt(timeLimit), questions: questionsArray, isActive: !isDraftMode, availableFrom, dueDate, assignedTo };
            if (editId) {
                res = await fetch(`${BASE_URL}/api/admin/tests/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
            } else {
                res = await fetch(`${BASE_URL}/api/admin/tests`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
            }
            if (res.ok) { alert(editId ? "Test Updated!" : "Test Created!"); window.location.reload(); }
        } catch (e) { alert("Error saving test."); }
    });
}

// 🔥 EDIT MODE TRIGGERS
window.editTest = function(id) {
    const test = globalManagedTests.find(t => t._id === id); if(!test) return;
    
    document.getElementById('quizBuilderTitle').innerHTML = `<i class="fa-solid fa-pen-to-square me-2 text-warning"></i>Editing Test`;
    document.getElementById('editingTestId').value = test._id;
    document.getElementById('testTitle').value = test.title;
    document.getElementById('testTime').value = test.timeLimitMinutes;
    
    // Fill Dates securely matching local timezone
    const setDate = (elId, dateStr) => { if(dateStr) { const d = new Date(dateStr); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); document.getElementById(elId).value = d.toISOString().slice(0, 16); } else { document.getElementById(elId).value = ''; } };
    setDate('testAvailableFrom', test.availableFrom); setDate('testDueDate', test.dueDate);

    // Fill Checkboxes
    if (!test.assignedTo || test.assignedTo.length === 0) {
        document.getElementById('cb_ALL').checked = true; toggleAssignAll();
    } else {
        document.getElementById('cb_ALL').checked = false;
        document.querySelectorAll('.student-cb').forEach(cb => cb.checked = test.assignedTo.includes(cb.value));
    }

    // Fill Questions
    const container = document.getElementById('questionsContainer'); container.innerHTML = '';
    test.questions.forEach(q => addQuestionCard(q.numbersArray.join(', ')));

    // Update Buttons
    document.getElementById('cancelEditBtn').classList.remove('d-none');
    document.getElementById('btnDraft').innerText = "Update as Draft";
    document.getElementById('btnPublish').innerText = "Update & Publish Live";
    window.scrollTo({ top: document.getElementById('createTestForm').offsetTop - 50, behavior: 'smooth' });
}

window.cancelEditMode = function() {
    document.getElementById('createTestForm').reset();
    document.getElementById('quizBuilderTitle').innerHTML = `<i class="fa-solid fa-file-pen me-2"></i>Quiz Builder`;
    document.getElementById('editingTestId').value = '';
    document.getElementById('questionsContainer').innerHTML = ''; addQuestionCard();
    document.getElementById('cb_ALL').checked = true; toggleAssignAll();
    document.getElementById('cancelEditBtn').classList.add('d-none');
    document.getElementById('btnDraft').innerText = "Save Draft"; document.getElementById('btnPublish').innerText = "Publish Live";
}

async function loadTests() {
    try {
        const res = await fetch(`${BASE_URL}/api/admin/tests`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (res.ok) {
            globalManagedTests = await res.json();
            const tbody = document.getElementById('testTableBody'); const testFilter = document.getElementById('filterTestName');
            if (tbody) tbody.innerHTML = ''; if (testFilter) testFilter.innerHTML = '<option value="all">All Tests</option>';
            globalManagedTests.forEach(test => {
                if (testFilter) testFilter.innerHTML += `<option value="${test.title}">${test.title}</option>`;
                const badge = test.isActive ? `<span class="badge bg-success">Live</span>` : `<span class="badge bg-secondary">Draft</span>`;
                const target = (!test.assignedTo || test.assignedTo.length === 0) ? 'Everyone' : `${test.assignedTo.length} Student(s)`;
                const safeTitleStr = test.title.replace(/'/g, "\\'");
                if (tbody) tbody.innerHTML += `<tr><td class="small fw-bold">${test.title}</td><td class="small text-muted">${test.questions.length}Q | ${test.timeLimitMinutes}m</td><td class="small text-muted"><i class="fa-solid fa-users text-primary me-1"></i>${target}</td><td>${badge}</td><td>
                    <button class="btn btn-xs btn-outline-success btn-sm py-0 me-1" onclick="exportToExcel('${test._id}', '${safeTitleStr}')" title="Export"><i class="fa-solid fa-file-excel"></i></button>
                    <button class="btn btn-xs btn-outline-primary btn-sm py-0 me-1" onclick="editTest('${test._id}')" title="Edit Test"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-xs btn-light btn-sm py-0 me-1" onclick="toggleTest('${test._id}')"><i class="fa-solid fa-power-off"></i></button>
                    <button class="btn btn-xs btn-outline-danger btn-sm py-0" onclick="deleteTest('${test._id}')"><i class="fa-solid fa-trash"></i></button>
                </td></tr>`;
            });
        }
    } catch (e) {}
}
window.toggleTest = async function(id) { await fetch(`${BASE_URL}/api/admin/tests/${id}/toggle`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }}); loadTests(); };
window.deleteTest = async function(id) { if (!confirm("Delete test and ALL submissions?")) return; await fetch(`${BASE_URL}/api/admin/tests/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); loadTests(); renderReviewEcosystem(); };

// Submission Queue & Charts
async function renderReviewEcosystem() {
    try {
        const res = await fetch(`${BASE_URL}/api/admin/submissions`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (res.ok) { globalSubmissions = await res.json(); applyFilters(); renderCharts(globalSubmissions); }
        const leadRes = await fetch(`${BASE_URL}/api/admin/leaderboard`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (leadRes.ok) {
            const groupedLeaders = await leadRes.json(); const container = document.getElementById('adminLeaderboardContainer');
            if (container) {
                container.innerHTML = '';
                for (const [testName, leaders] of Object.entries(groupedLeaders)) {
                    let html = `<div class="mb-3 card border-0 shadow-sm"><div class="card-header bg-primary text-white fw-bold small">${testName}</div><ul class="list-group list-group-flush">`;
                    leaders.forEach((entry, idx) => { html += `<li class="list-group-item d-flex justify-content-between align-items-center p-2 small"><span class="fw-bold"><i class="fa-solid fa-medal me-2" style="color:${idx===0?'gold':idx===1?'silver':idx===2?'#cd7f32':'gray'};"></i>${entry.studentName || "Unknown"}</span><span class="badge bg-dark">${entry.finalScore} Pts</span></li>`; });
                    container.innerHTML += html + `</ul></div>`;
                }
            }
        }
    } catch (e) {}
}

function applyFilters() {
    const fName = document.getElementById('filterStudentName'), fStatus = document.getElementById('filterStatus'), fTest = document.getElementById('filterTestName');
    if (!fName || !fStatus || !fTest) return;
    const filtered = globalSubmissions.filter(sub => (sub.studentName||"Unknown").toLowerCase().includes(fName.value.toLowerCase()) && (fStatus.value === 'all' || sub.status === fStatus.value) && (fTest.value === 'all' || (sub.testId && sub.testId.title === fTest.value)));
    const container = document.getElementById('submissionsContainer'); if (!container) return;
    container.innerHTML = ''; window.visiblePendingIds = []; 
    filtered.forEach(sub => {
        let stat = `<span class="badge bg-success">Approved</span>`, act = `<div class="bg-light p-2 rounded small mt-2 fw-bold text-muted">Notes: ${sub.adminFeedback || ''}</div>`;
        if (sub.status === 'pending_review') { window.visiblePendingIds.push(sub._id); stat = `<span class="badge bg-warning text-dark">Awaiting</span>`; act = `<button class="btn btn-primary btn-sm w-100 fw-bold mt-2" onclick="processApproval('${sub._id}')">Approve</button>`; } else if (sub.status === 'retake_requested') { stat = `<span class="badge bg-info text-dark">Retake Req</span>`; act = `<button class="btn btn-info btn-sm w-100 text-white fw-bold mt-2" onclick="forceResetRetake('${sub._id}')">Grant Retake</button>`; }
        const timeTaken = sub.timeTakenSeconds ? `${Math.floor(sub.timeTakenSeconds / 60)}m ${sub.timeTakenSeconds % 60}s` : 'Unknown Time';
        container.innerHTML += `<div class="col"><div class="card shadow-sm border-0 h-100 p-3 bg-white"><div class="d-flex justify-content-between mb-1"><span class="fw-bold text-dark small">${sub.studentName||"Unknown"}</span>${stat}</div><div class="small text-muted mb-1">${sub.testId ? sub.testId.title : 'Deleted Test'} <span class="ms-2 badge bg-light text-dark border"><i class="fa-solid fa-stopwatch me-1"></i>${timeTaken}</span></div><div class="fw-bold text-primary">Score: ${sub.finalScore}</div>${act}<button class="btn btn-outline-dark btn-sm w-100 mt-2 fw-bold" onclick="viewDetails('${sub._id}')"><i class="fa-solid fa-magnifying-glass me-1"></i>View Answers</button><button class="btn btn-link text-danger btn-sm w-100 mt-1" onclick="forceResetRetake('${sub._id}')" style="text-decoration:none;"><i class="fa-solid fa-eraser me-1"></i>Reset</button></div></div>`;
    });
}

if (document.getElementById('filterStudentName')) document.getElementById('filterStudentName').addEventListener('input', applyFilters); if (document.getElementById('filterStatus')) document.getElementById('filterStatus').addEventListener('change', applyFilters); if (document.getElementById('filterTestName')) document.getElementById('filterTestName').addEventListener('change', applyFilters);
if (document.getElementById('bulkApproveBtn')) { document.getElementById('bulkApproveBtn').addEventListener('click', async () => { if (!window.visiblePendingIds.length) return alert("No pending submissions to approve."); if (!confirm(`Approve all ${window.visiblePendingIds.length} visible submissions?`)) return; await fetch(`${BASE_URL}/api/admin/submissions/approve-bulk`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ submissionIds: window.visiblePendingIds }) }); renderReviewEcosystem(); }); }

window.processApproval = async function(id) { const note = prompt("Enter grading notes:", "Excellent work!"); if (note === null) return; await fetch(`${BASE_URL}/api/admin/submissions/${id}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ feedback: note })}); renderReviewEcosystem(); };
window.forceResetRetake = async function(id) { if (!confirm("Wipe this submission and allow retake?")) return; await fetch(`${BASE_URL}/api/admin/submissions/${id}/reset`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); renderReviewEcosystem(); };
window.viewDetails = function(subId) {
    const sub = globalSubmissions.find(s => s._id === subId); if (!sub) return;
    document.getElementById('reviewStudentName').innerText = sub.studentName || 'Unknown Student'; document.getElementById('reviewTestName').innerText = sub.testId ? sub.testId.title : 'Unknown Test';
    const tbody = document.getElementById('reviewTableBody'); if (!tbody) return; tbody.innerHTML = '';
    if (sub.answers) { sub.answers.forEach((ans, index) => { tbody.innerHTML += `<tr class="${ans.isCorrect ? '' : 'table-danger'}"><td class="fw-bold text-muted">${index + 1}</td><td class="small">${ans.numbersArray ? ans.numbersArray.join(', ') : 'N/A'}</td><td class="fw-bold fs-5 text-${ans.isCorrect ? 'success' : 'danger'}">${ans.studentAnswer}</td><td class="fw-bold fs-5 text-dark">${ans.correctAnswer}</td><td>${ans.isCorrect ? '<i class="fa-solid fa-circle-check text-success fs-5"></i>' : '<i class="fa-solid fa-circle-xmark text-danger fs-5"></i>'}</td></tr>`; }); }
    new bootstrap.Modal(document.getElementById('reviewModal')).show();
}

function renderCharts(submissions) {
    if (!document.getElementById('statusChart') || !document.getElementById('scoreChart')) return; 
    let pending = 0, graded = 0; const scoresByTest = {};
    submissions.forEach(sub => { if (sub.status === 'pending_review' || sub.status === 'retake_requested') pending++; else graded++; const testName = sub.testId ? sub.testId.title : 'Unknown'; if (!scoresByTest[testName]) scoresByTest[testName] = { total: 0, count: 0 }; scoresByTest[testName].total += sub.finalScore; scoresByTest[testName].count += 1; });
    if(statusChartObj) statusChartObj.destroy(); if(scoreChartObj) scoreChartObj.destroy();
    statusChartObj = new Chart(document.getElementById('statusChart'), { type: 'doughnut', data: { labels: ['Needs Review', 'Graded'], datasets: [{ data: [pending, graded], backgroundColor: ['#ffc107', '#198754'] }] } });
    const testLabels = Object.keys(scoresByTest); const avgScores = testLabels.map(t => scoresByTest[t].total / scoresByTest[t].count);
    scoreChartObj = new Chart(document.getElementById('scoreChart'), { type: 'bar', data: { labels: testLabels, datasets: [{ label: 'Avg Score', data: avgScores, backgroundColor: '#0d6efd' }] } });
}
loadStudents(); loadTests(); renderReviewEcosystem();