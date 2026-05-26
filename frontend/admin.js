const token = localStorage.getItem('token');
const BASE_URL = 'https://forms-xg9n.onrender.com';

if (!token) window.location.href = 'index.html';

document.getElementById('logoutBtn').addEventListener('click', () => { 
    localStorage.clear(); 
    window.location.href = 'index.html'; 
});

let globalStudents = [];
let globalManagedTests = [];
let globalSubmissions = [];
let statusChartObj = null;
let scoreChartObj = null;
window.visiblePendingIds = []; 

// ==========================================
// STUDENT MANAGEMENT
// ==========================================
if (document.getElementById('createStudentForm')) {
    document.getElementById('createStudentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${BASE_URL}/api/admin/students`, { 
                method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                body: JSON.stringify({ name: document.getElementById('studentName').value, pin: document.getElementById('studentPin').value }) 
            });
            if (res.ok) { alert("Student Created successfully!"); document.getElementById('studentName').value = ''; document.getElementById('studentPin').value = ''; loadStudents(); }
        } catch (e) { alert("Error creating student."); }
    });
}

function buildAssignUI() {
    const container = document.getElementById('assignToContainer'); if (!container) return;
    let html = `<div class="form-check border-bottom pb-1 mb-2"><input class="form-check-input" type="checkbox" value="ALL" id="cb_ALL" checked onchange="toggleAssignAll()"><label class="form-check-label fw-bold text-primary" for="cb_ALL">Everyone (All Students)</label></div>`;
    globalStudents.forEach(s => { html += `<div class="form-check mb-1"><input class="form-check-input student-cb" type="checkbox" value="${s.rollNumber}" id="cb_${s.rollNumber}" onchange="toggleSpecificAssign()"><label class="form-check-label small" for="cb_${s.rollNumber}">[${s.rollNumber}] ${s.name}</label></div>`; });
    container.innerHTML = html;
}

window.toggleAssignAll = function() {
    const isAll = document.getElementById('cb_ALL').checked;
    document.querySelectorAll('.student-cb').forEach(cb => cb.checked = false);
    if (!isAll) document.getElementById('cb_ALL').checked = true; 
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
    data.forEach(s => { tbody.innerHTML += `<tr><td><span class="badge bg-secondary">${s.rollNumber}</span></td><td class="small fw-bold">${s.name}</td><td class="small text-danger font-monospace">${s.pin}</td><td class="text-nowrap"><button class="btn btn-outline-primary btn-sm py-0 px-2 me-1" onclick="openEditPin('${s.rollNumber}', '${s.pin}')"><i class="fa-solid fa-pen"></i></button><button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteStudent('${s.rollNumber}')"><i class="fa-solid fa-trash"></i></button></td></tr>`; });
}

if (document.getElementById('searchStudentDir')) document.getElementById('searchStudentDir').addEventListener('input', (e) => renderStudentTable(globalStudents.filter(s => s.name.toLowerCase().includes(e.target.value.toLowerCase()) || s.rollNumber.toLowerCase().includes(e.target.value.toLowerCase()))));
window.openEditPin = function(rollNumber, currentPin) { document.getElementById('editPinRollNumber').value = rollNumber; document.getElementById('newPinInput').value = currentPin; new bootstrap.Modal(document.getElementById('editPinModal')).show(); };
window.saveNewPin = async function() { const rollNumber = document.getElementById('editPinRollNumber').value; const newPin = document.getElementById('newPinInput').value; if (!newPin) return alert("PIN cannot be empty."); await fetch(`${BASE_URL}/api/admin/students/${rollNumber}/pin`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ pin: newPin }) }); bootstrap.Modal.getInstance(document.getElementById('editPinModal')).hide(); loadStudents(); };
window.deleteStudent = async function(id) { if (!confirm(`Are you sure you want to delete student record ${id}?`)) return; await fetch(`${BASE_URL}/api/admin/students/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); loadStudents(); };

// ==========================================
// EXCEL EXPORT
// ==========================================
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

// ==========================================
// QUIZ BUILDER & TESTS (WITH SKELETON LOADERS)
// ==========================================
let isDraftMode = false;

function addQuestionCard(existingNumbers = "") {
    const container = document.getElementById('questionsContainer'); if (!container) return;
    const card = document.createElement('div'); card.className = 'card border-0 bg-body-secondary p-3 my-2 position-relative rounded-3 shadow-sm'; card.style.borderLeft = '4px solid #4285f4';
    card.innerHTML = `<button type="button" class="btn btn-sm btn-link text-danger position-absolute top-0 end-0 remove-btn"><i class="fa-solid fa-trash"></i></button><div class="row g-2 mt-1"><div class="col-12 col-md-8"><label class="text-muted small fw-bold">Numbers Stack (Commas)</label><input type="text" class="form-control q-numbers bg-body" placeholder="10, -5, 2" value="${existingNumbers}" required></div><div class="col-12 col-md-4"><label class="text-muted small fw-bold">Preview Sum</label><input type="text" class="form-control q-answer text-success fw-bold bg-body" readonly></div></div>`;
    const numInput = card.querySelector('.q-numbers'); const ansInput = card.querySelector('.q-answer');
    numInput.addEventListener('input', (e) => { ansInput.value = e.target.value.split(',').reduce((t, v) => t + (parseInt(v.trim()) || 0), 0); });
    if(existingNumbers) ansInput.value = existingNumbers.split(',').reduce((t, v) => t + (parseInt(v.trim()) || 0), 0);
    card.querySelector('.remove-btn').addEventListener('click', () => card.remove()); container.appendChild(card);
}
if (document.getElementById('addQuestionBtn')) { addQuestionCard(); document.getElementById('addQuestionBtn').addEventListener('click', () => addQuestionCard()); }

if (document.getElementById('createTestForm')) {
    document.getElementById('createTestForm').addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const editId = document.getElementById('editingTestId').value; const title = document.getElementById('testTitle').value; const timeLimit = document.getElementById('testTime').value;
        const availableFrom = document.getElementById('testAvailableFrom').value ? new Date(document.getElementById('testAvailableFrom').value).toISOString() : null; 
        const dueDate = document.getElementById('testDueDate').value ? new Date(document.getElementById('testDueDate').value).toISOString() : null;
        const assignedTo = []; if (!document.getElementById('cb_ALL').checked) { document.querySelectorAll('.student-cb').forEach(cb => { if(cb.checked) assignedTo.push(cb.value); }); }
        const questionsArray = []; document.querySelectorAll('.q-numbers').forEach(i => { if (i.value.trim()) questionsArray.push({ numbersArray: i.value.split(',').map(n => parseInt(n.trim(), 10)) }); });

        try {
            let res; const payload = { title, timeLimitMinutes: parseInt(timeLimit), questions: questionsArray, isActive: !isDraftMode, availableFrom, dueDate, assignedTo };
            if (editId) res = await fetch(`${BASE_URL}/api/admin/tests/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
            else res = await fetch(`${BASE_URL}/api/admin/tests`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(payload) });
            if (res.ok) { alert(editId ? "Test Updated successfully!" : "Test Created successfully!"); window.location.reload(); }
        } catch (e) { alert("Error saving test."); }
    });
}

window.editTest = function(id) {
    const triggerEl = document.querySelector('#tests-tab'); if (triggerEl) bootstrap.Tab.getOrCreateInstance(triggerEl).show();
    const test = globalManagedTests.find(t => t._id === id); if(!test) return;
    
    document.getElementById('quizBuilderTitle').innerHTML = `<i class="fa-solid fa-pen-to-square me-2 text-warning"></i>Editing Test`;
    document.getElementById('editingTestId').value = test._id; document.getElementById('testTitle').value = test.title; document.getElementById('testTime').value = test.timeLimitMinutes;
    const setDate = (elId, dateStr) => { if(dateStr) { const d = new Date(dateStr); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); document.getElementById(elId).value = d.toISOString().slice(0, 16); } else { document.getElementById(elId).value = ''; } };
    setDate('testAvailableFrom', test.availableFrom); setDate('testDueDate', test.dueDate);

    if (!test.assignedTo || test.assignedTo.length === 0) { document.getElementById('cb_ALL').checked = true; toggleAssignAll(); } 
    else { document.getElementById('cb_ALL').checked = false; document.querySelectorAll('.student-cb').forEach(cb => cb.checked = test.assignedTo.includes(cb.value)); }

    const container = document.getElementById('questionsContainer'); container.innerHTML = '';
    test.questions.forEach(q => addQuestionCard(q.numbersArray.join(', ')));

    document.getElementById('cancelEditBtn').classList.remove('d-none'); document.getElementById('btnDraft').innerText = "Update as Draft"; document.getElementById('btnPublish').innerText = "Update Live";
    window.scrollTo({ top: document.getElementById('quizBuilderTitle').offsetTop - 20, behavior: 'smooth' });
}

window.cancelEditMode = function() {
    document.getElementById('createTestForm').reset(); document.getElementById('quizBuilderTitle').innerHTML = `<i class="fa-solid fa-file-pen me-2"></i>Quiz Builder`; document.getElementById('editingTestId').value = '';
    document.getElementById('questionsContainer').innerHTML = ''; addQuestionCard(); document.getElementById('cb_ALL').checked = true; toggleAssignAll();
    document.getElementById('cancelEditBtn').classList.add('d-none'); document.getElementById('btnDraft').innerText = "Save Draft"; document.getElementById('btnPublish').innerText = "Publish Live";
}

// 🔥 SKELETON LOADER INJECTED HERE
async function loadTests() {
    const tbody = document.getElementById('testTableBody'); 
    
    if (tbody) {
        tbody.innerHTML = `
            <tr><td colspan="5"><p class="placeholder-glow mb-1"><span class="placeholder col-8 bg-secondary rounded"></span></p><p class="placeholder-glow mb-0"><span class="placeholder col-4 bg-secondary rounded"></span></p></td></tr>
            <tr><td colspan="5"><p class="placeholder-glow mb-1"><span class="placeholder col-6 bg-secondary rounded"></span></p><p class="placeholder-glow mb-0"><span class="placeholder col-3 bg-secondary rounded"></span></p></td></tr>
            <tr><td colspan="5"><p class="placeholder-glow mb-0"><span class="placeholder col-7 bg-secondary rounded"></span></p></td></tr>`;
    }

    try {
        const res = await fetch(`${BASE_URL}/api/admin/tests`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (res.ok) {
            globalManagedTests = await res.json();
            const testFilter = document.getElementById('filterTestName');
            if (tbody) tbody.innerHTML = ''; 
            if (testFilter) testFilter.innerHTML = '<option value="all">All Tests</option>';
            
            globalManagedTests.forEach(test => {
                if (testFilter) testFilter.innerHTML += `<option value="${test.title}">${test.title}</option>`;
                const badge = test.isActive ? `<span class="badge bg-success">Live</span>` : `<span class="badge bg-secondary">Draft</span>`;
                const target = (!test.assignedTo || test.assignedTo.length === 0) ? 'Everyone' : `<span class="badge bg-primary rounded-pill">${test.assignedTo.length} Student(s)</span>`;
                const safeTitleStr = test.title.replace(/'/g, "\\'"); 
                
                if (tbody) tbody.innerHTML += `
                    <tr>
                        <td class="small fw-bold"><div class="mb-1">${test.title}</div><div class="small text-muted fw-normal">${test.questions.length}Q | ${test.timeLimitMinutes}m | ${target}</div></td>
                        <td>${badge}</td>
                        <td class="text-nowrap">
                            <button class="btn btn-outline-success btn-sm py-0 px-2 me-1" onclick="exportToExcel('${test._id}', '${safeTitleStr}')" title="Export Excel"><i class="fa-solid fa-file-excel"></i></button>
                            <button class="btn btn-outline-primary btn-sm py-0 px-2 me-1" onclick="editTest('${test._id}')" title="Edit Test"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-light btn-sm py-0 px-2 me-1 border bg-body" onclick="toggleTest('${test._id}')" title="Toggle Live/Draft"><i class="fa-solid fa-power-off"></i></button>
                            <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteTest('${test._id}')"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
        }
    } catch (e) { if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Failed to load tests.</td></tr>`; }
}
window.toggleTest = async function(id) { await fetch(`${BASE_URL}/api/admin/tests/${id}/toggle`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }}); loadTests(); };
window.deleteTest = async function(id) { if (!confirm("Delete test and ALL submissions forever?")) return; await fetch(`${BASE_URL}/api/admin/tests/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); loadTests(); renderReviewEcosystem(); };

// ==========================================
// SUBMISSIONS & CHARTS
// ==========================================
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
                    leaders.forEach((entry, idx) => { html += `<li class="list-group-item d-flex justify-content-between align-items-center p-2 small bg-body"><span class="fw-bold"><i class="fa-solid fa-medal me-2" style="color:${idx===0?'gold':idx===1?'silver':idx===2?'#cd7f32':'gray'};"></i>${entry.studentName || "Unknown"}</span><span class="badge bg-dark">${entry.finalScore} Pts</span></li>`; });
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
        let stat = `<span class="badge bg-success">Approved</span>`, act = `<div class="bg-body-secondary p-2 rounded small mt-2 fw-bold text-muted">Notes: ${sub.adminFeedback || ''}</div>`;
        if (sub.status === 'pending_review') { window.visiblePendingIds.push(sub._id); stat = `<span class="badge bg-warning text-dark">Awaiting</span>`; act = `<button class="btn btn-primary btn-sm w-100 fw-bold mt-2" onclick="processApproval('${sub._id}')">Approve</button>`; } else if (sub.status === 'retake_requested') { stat = `<span class="badge bg-info text-dark">Retake Req</span>`; act = `<button class="btn btn-info btn-sm w-100 text-white fw-bold mt-2" onclick="forceResetRetake('${sub._id}')">Grant Retake</button>`; }
        const timeTaken = sub.timeTakenSeconds ? `${Math.floor(sub.timeTakenSeconds / 60)}m ${sub.timeTakenSeconds % 60}s` : 'Unknown Time';
        container.innerHTML += `<div class="col"><div class="card shadow-sm border-0 h-100 p-3 bg-body"><div class="d-flex justify-content-between mb-1"><span class="fw-bold small">${sub.studentName||"Unknown"}</span>${stat}</div><div class="small text-muted mb-1">${sub.testId ? sub.testId.title : 'Deleted Test'} <span class="ms-2 badge bg-body-secondary text-body border"><i class="fa-solid fa-stopwatch me-1"></i>${timeTaken}</span></div><div class="fw-bold text-primary mb-2">Score: ${sub.finalScore}</div>${act}<div class="d-flex gap-2 mt-2"><button class="btn btn-outline-dark btn-sm w-100 fw-bold" onclick="viewDetails('${sub._id}')"><i class="fa-solid fa-magnifying-glass me-1"></i>Review</button><button class="btn btn-outline-danger btn-sm w-100 fw-bold" onclick="forceResetRetake('${sub._id}')"><i class="fa-solid fa-eraser me-1"></i>Reset</button></div></div></div>`;
    });
}

if (document.getElementById('filterStudentName')) document.getElementById('filterStudentName').addEventListener('input', applyFilters); if (document.getElementById('filterStatus')) document.getElementById('filterStatus').addEventListener('change', applyFilters); if (document.getElementById('filterTestName')) document.getElementById('filterTestName').addEventListener('change', applyFilters);
if (document.getElementById('bulkApproveBtn')) { document.getElementById('bulkApproveBtn').addEventListener('click', async () => { if (!window.visiblePendingIds.length) return alert("No pending submissions in the current view to approve."); if (!confirm(`Approve all ${window.visiblePendingIds.length} visible submissions?`)) return; await fetch(`${BASE_URL}/api/admin/submissions/approve-bulk`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ submissionIds: window.visiblePendingIds }) }); renderReviewEcosystem(); }); }

window.processApproval = async function(id) { const note = prompt("Enter grading notes (optional):", "Excellent work!"); if (note === null) return; await fetch(`${BASE_URL}/api/admin/submissions/${id}/approve`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ feedback: note })}); renderReviewEcosystem(); };
window.forceResetRetake = async function(id) { if (!confirm("Wipe this submission and allow retake?")) return; await fetch(`${BASE_URL}/api/admin/submissions/${id}/reset`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); renderReviewEcosystem(); };
window.viewDetails = function(subId) {
    const sub = globalSubmissions.find(s => s._id === subId); if (!sub) return;
    document.getElementById('reviewStudentName').innerText = sub.studentName || 'Unknown Student'; document.getElementById('reviewTestName').innerText = sub.testId ? sub.testId.title : 'Unknown Test';
    const tbody = document.getElementById('reviewTableBody'); if (!tbody) return; tbody.innerHTML = '';
    if (sub.answers) { sub.answers.forEach((ans, index) => { tbody.innerHTML += `<tr class="${ans.isCorrect ? '' : 'table-danger'}"><td class="fw-bold text-muted">${index + 1}</td><td class="small">${ans.numbersArray ? ans.numbersArray.join(', ') : 'N/A'}</td><td class="fw-bold fs-5 text-${ans.isCorrect ? 'success' : 'danger'}">${ans.studentAnswer}</td><td class="fw-bold fs-5">${ans.correctAnswer}</td><td>${ans.isCorrect ? '<i class="fa-solid fa-circle-check text-success fs-5"></i>' : '<i class="fa-solid fa-circle-xmark text-danger fs-5"></i>'}</td></tr>`; }); }
    new bootstrap.Modal(document.getElementById('reviewModal')).show();
}

function renderCharts(submissions) {
    if (!document.getElementById('statusChart') || !document.getElementById('scoreChart')) return; 
    let pending = 0, graded = 0; const scoresByTest = {};
    submissions.forEach(sub => { if (sub.status === 'pending_review' || sub.status === 'retake_requested') pending++; else graded++; const testName = sub.testId ? sub.testId.title : 'Deleted Tests'; if (!scoresByTest[testName]) scoresByTest[testName] = { total: 0, count: 0 }; scoresByTest[testName].total += sub.finalScore; scoresByTest[testName].count += 1; });
    if(statusChartObj) statusChartObj.destroy(); if(scoreChartObj) scoreChartObj.destroy();
    
    // Fix chart label color for dark mode
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    Chart.defaults.color = isDark ? '#adb5bd' : '#6c757d';

    statusChartObj = new Chart(document.getElementById('statusChart'), { type: 'doughnut', data: { labels: ['Needs Review', 'Graded'], datasets: [{ data: [pending, graded], backgroundColor: ['#ffc107', '#198754'] }] }, options: { responsive: true, maintainAspectRatio: false } });
    const testLabels = Object.keys(scoresByTest); const avgScores = testLabels.map(t => scoresByTest[t].total / scoresByTest[t].count);
    scoreChartObj = new Chart(document.getElementById('scoreChart'), { type: 'bar', data: { labels: testLabels, datasets: [{ label: 'Average Score', data: avgScores, backgroundColor: '#0d6efd' }] }, options: { responsive: true, maintainAspectRatio: false } });
}

const dashboardTab = document.getElementById('dashboard-tab');
if (dashboardTab) dashboardTab.addEventListener('shown.bs.tab', function () { renderCharts(globalSubmissions); });

async function initializeAdminDashboard() {
    try { await Promise.all([loadStudents(), loadTests(), renderReviewEcosystem()]); } 
    catch (e) { console.error("Error loading admin data", e); } 
    finally { const loader = document.getElementById('globalLoader'); if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.classList.add('d-none'), 500); } }
}

initializeAdminDashboard();