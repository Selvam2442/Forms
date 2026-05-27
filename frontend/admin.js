const token = localStorage.getItem('token');
const BASE_URL = 'https://forms-xg9n.onrender.com';
if (!token) window.location.href = 'index.html';
document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.clear(); window.location.href = 'index.html'; });

let globalStudents = [], globalManagedTests = [], globalSubmissions = [];
let statusChartObj = null, scoreChartObj = null;
window.visiblePendingIds = []; 

// STUDENT MANAGEMENT (Unchanged)
if (document.getElementById('createStudentForm')) {
    document.getElementById('createStudentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${BASE_URL}/api/admin/students`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ name: document.getElementById('studentName').value, pin: document.getElementById('studentPin').value }) });
            if (res.ok) { alert("Student Created!"); document.getElementById('studentName').value = ''; document.getElementById('studentPin').value = ''; loadStudents(); }
        } catch (e) { alert("Error creating student."); }
    });
}
function buildAssignUI() {
    const container = document.getElementById('assignToContainer'); if (!container) return;
    let html = `<div class="form-check border-bottom pb-1 mb-2"><input class="form-check-input" type="checkbox" value="ALL" id="cb_ALL" checked onchange="toggleAssignAll()"><label class="form-check-label fw-bold text-primary" for="cb_ALL">Everyone (All Students)</label></div>`;
    globalStudents.forEach(s => { html += `<div class="form-check mb-1"><input class="form-check-input student-cb" type="checkbox" value="${s.rollNumber}" id="cb_${s.rollNumber}" onchange="toggleSpecificAssign()"><label class="form-check-label small" for="cb_${s.rollNumber}">[${s.rollNumber}] ${s.name}</label></div>`; });
    container.innerHTML = html;
}
window.toggleAssignAll = function() { const isAll = document.getElementById('cb_ALL').checked; document.querySelectorAll('.student-cb').forEach(cb => cb.checked = false); if (!isAll) document.getElementById('cb_ALL').checked = true; }
window.toggleSpecificAssign = function() { let anyChecked = false; document.querySelectorAll('.student-cb').forEach(cb => { if(cb.checked) anyChecked = true; }); document.getElementById('cb_ALL').checked = !anyChecked; }
async function loadStudents() { try { const res = await fetch(`${BASE_URL}/api/admin/students`, { headers: { 'Authorization': `Bearer ${token}` }}); if (res.ok) { globalStudents = await res.json(); renderStudentTable(globalStudents); buildAssignUI(); } } catch (e) {} }
function renderStudentTable(data) {
    const tbody = document.getElementById('studentTableBody'); if (!tbody) return; tbody.innerHTML = '';
    data.forEach(s => { tbody.innerHTML += `<tr><td><span class="badge bg-secondary">${s.rollNumber}</span></td><td class="small fw-bold">${s.name}</td><td class="small text-danger font-monospace">${s.pin}</td><td class="text-nowrap"><button class="btn btn-outline-primary btn-sm py-0 px-2 me-1" onclick="openEditPin('${s.rollNumber}', '${s.pin}')"><i class="fa-solid fa-pen"></i></button><button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteStudent('${s.rollNumber}')"><i class="fa-solid fa-trash"></i></button></td></tr>`; });
}
if (document.getElementById('searchStudentDir')) document.getElementById('searchStudentDir').addEventListener('input', (e) => renderStudentTable(globalStudents.filter(s => s.name.toLowerCase().includes(e.target.value.toLowerCase()) || s.rollNumber.toLowerCase().includes(e.target.value.toLowerCase()))));
window.openEditPin = function(rollNumber, currentPin) { document.getElementById('editPinRollNumber').value = rollNumber; document.getElementById('newPinInput').value = currentPin; new bootstrap.Modal(document.getElementById('editPinModal')).show(); };
window.saveNewPin = async function() { const rollNumber = document.getElementById('editPinRollNumber').value; const newPin = document.getElementById('newPinInput').value; if (!newPin) return alert("PIN cannot be empty."); await fetch(`${BASE_URL}/api/admin/students/${rollNumber}/pin`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ pin: newPin }) }); bootstrap.Modal.getInstance(document.getElementById('editPinModal')).hide(); loadStudents(); };
window.deleteStudent = async function(id) { if (!confirm(`Delete student record ${id}?`)) return; await fetch(`${BASE_URL}/api/admin/students/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); loadStudents(); };

// EXPORTS
window.exportToExcel = function(testId, testTitle) {
    const testSubs = globalSubmissions.filter(sub => sub.testId && sub.testId._id === testId);
    if(testSubs.length === 0) return alert("No submissions found for this test yet!");
    const data = testSubs.map(sub => { const end = new Date(sub.submitTime); const start = new Date(end.getTime() - (sub.timeTakenSeconds * 1000)); return { "Student Name": sub.studentName || "Unknown", "Score": sub.finalScore, "Status": sub.status === 'graded' ? 'Graded' : 'Pending Review', "Start Time": start.toLocaleString(), "End Time": end.toLocaleString(), "Total Time Taken": sub.timeTakenSeconds ? `${Math.floor(sub.timeTakenSeconds / 60)}m ${sub.timeTakenSeconds % 60}s` : 'Unknown Time' }; });
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Test Results");
    XLSX.writeFile(wb, `${testTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_class_results.xlsx`);
};
window.shareTestToWhatsApp = function(testTitle) {
    const text = `*AABFC Abacus Center*\n\n📢 *New Test Available!*\n\nTitle: *${testTitle}*\n\nPlease log in to your student portal to complete your assignment now.\n🔗 ${window.location.origin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
};

// ==========================================
// 🔥 NEW QUIZ BUILDER LOGIC (MUL/DIV)
// ==========================================
let isDraftMode = false;
function setMinDateLimits() {
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const currentDateTime = now.toISOString().slice(0, 16); 
    const fromInput = document.getElementById('testAvailableFrom'); const dueInput = document.getElementById('testDueDate');
    if (fromInput) fromInput.min = currentDateTime; if (dueInput) dueInput.min = currentDateTime;
}

// Re-render questions if test type changes
document.getElementById('testTypeSelect')?.addEventListener('change', () => {
    document.getElementById('questionsContainer').innerHTML = ''; addQuestionCard();
});

function addQuestionCard(existingNumbers = []) {
    const container = document.getElementById('questionsContainer'); if (!container) return;
    const testType = document.getElementById('testTypeSelect').value;
    const card = document.createElement('div'); card.className = 'card border-0 bg-body-secondary p-3 my-2 position-relative rounded-3 shadow-sm'; card.style.borderLeft = '4px solid #4285f4';
    
    let inputHtml = '';
    if (testType === 'addition') {
        inputHtml = `<div class="col-12 col-md-8"><label class="text-muted small fw-bold">Numbers Stack (Commas)</label><input type="text" class="form-control q-numbers bg-body" placeholder="10, -5, 2" value="${existingNumbers.join(', ')}" required></div>`;
    } else {
        const sign = testType === 'multiplication' ? '✖️' : '➗';
        const v1 = existingNumbers[0] !== undefined ? existingNumbers[0] : '';
        const v2 = existingNumbers[1] !== undefined ? existingNumbers[1] : '';
        inputHtml = `<div class="col-12 col-md-8"><label class="text-muted small fw-bold">Equation</label><div class="d-flex align-items-center"><input type="number" class="form-control q-num1 bg-body text-center fs-5 fw-bold" value="${v1}" placeholder="12" required><span class="mx-3 fs-5">${sign}</span><input type="number" class="form-control q-num2 bg-body text-center fs-5 fw-bold" value="${v2}" placeholder="8" required></div></div>`;
    }

    card.innerHTML = `<button type="button" class="btn btn-sm btn-link text-danger position-absolute top-0 end-0 remove-btn"><i class="fa-solid fa-trash"></i></button><div class="row g-2 mt-1">${inputHtml}<div class="col-12 col-md-4"><label class="text-muted small fw-bold">Preview Result</label><input type="text" class="form-control q-answer text-success fw-bold bg-body" readonly></div></div>`;
    
    const ansInput = card.querySelector('.q-answer');
    
    if (testType === 'addition') {
        const numInput = card.querySelector('.q-numbers');
        numInput.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/[^0-9,\- ]/g, ''); ansInput.value = e.target.value.split(',').reduce((t, v) => t + (parseInt(v.trim()) || 0), 0); });
        if(existingNumbers.length > 0) ansInput.value = existingNumbers.reduce((t, v) => t + (parseInt(v) || 0), 0);
    } else {
        const num1Input = card.querySelector('.q-num1'); const num2Input = card.querySelector('.q-num2');
        const calc = () => {
            const n1 = parseInt(num1Input.value) || 0; const n2 = parseInt(num2Input.value) || 0;
            if(testType === 'multiplication') ansInput.value = n1 * n2; else ansInput.value = n2 !== 0 ? (n1 / n2).toFixed(2) : 'Error';
        };
        num1Input.addEventListener('input', calc); num2Input.addEventListener('input', calc);
        if(existingNumbers.length > 0) calc();
    }
    
    card.querySelector('.remove-btn').addEventListener('click', () => card.remove()); container.appendChild(card);
}
if (document.getElementById('addQuestionBtn')) { addQuestionCard(); document.getElementById('addQuestionBtn').addEventListener('click', () => addQuestionCard()); }

if (document.getElementById('createTestForm')) {
    document.getElementById('createTestForm').addEventListener('submit', async (e) => {
        e.preventDefault(); 
        const editId = document.getElementById('editingTestId').value; const title = document.getElementById('testTitle').value; const timeLimit = document.getElementById('testTime').value;
        const testType = document.getElementById('testTypeSelect').value;
        const availableFrom = document.getElementById('testAvailableFrom').value ? new Date(document.getElementById('testAvailableFrom').value).toISOString() : null; 
        const dueDate = document.getElementById('testDueDate').value ? new Date(document.getElementById('testDueDate').value).toISOString() : null;
        const assignedTo = []; if (!document.getElementById('cb_ALL').checked) { document.querySelectorAll('.student-cb').forEach(cb => { if(cb.checked) assignedTo.push(cb.value); }); }
        
        const questionsArray = []; 
        if (testType === 'addition') {
            document.querySelectorAll('.q-numbers').forEach(i => { if (i.value.trim()) questionsArray.push({ numbersArray: i.value.split(',').map(n => parseInt(n.trim(), 10)) }); });
        } else {
            const num1s = document.querySelectorAll('.q-num1'); const num2s = document.querySelectorAll('.q-num2');
            num1s.forEach((n1, idx) => { if(n1.value && num2s[idx].value) questionsArray.push({ numbersArray: [parseInt(n1.value), parseInt(num2s[idx].value)] }); });
        }

        try {
            let res; const payload = { title, testType, timeLimitMinutes: parseInt(timeLimit), questions: questionsArray, isActive: !isDraftMode, availableFrom, dueDate, assignedTo };
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
    document.getElementById('testTypeSelect').value = test.testType || 'addition';
    
    const setDate = (elId, dateStr) => { if(dateStr) { const d = new Date(dateStr); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); document.getElementById(elId).value = d.toISOString().slice(0, 16); } else { document.getElementById(elId).value = ''; } };
    setDate('testAvailableFrom', test.availableFrom); setDate('testDueDate', test.dueDate);

    if (!test.assignedTo || test.assignedTo.length === 0) { document.getElementById('cb_ALL').checked = true; toggleAssignAll(); } 
    else { document.getElementById('cb_ALL').checked = false; document.querySelectorAll('.student-cb').forEach(cb => cb.checked = test.assignedTo.includes(cb.value)); }

    document.getElementById('questionsContainer').innerHTML = '';
    test.questions.forEach(q => addQuestionCard(q.numbersArray));

    document.getElementById('cancelEditBtn').classList.remove('d-none'); document.getElementById('btnDraft').innerText = "Update as Draft"; document.getElementById('btnPublish').innerText = "Update Live";
    window.scrollTo({ top: document.getElementById('quizBuilderTitle').offsetTop - 20, behavior: 'smooth' });
}

window.cancelEditMode = function() {
    document.getElementById('createTestForm').reset(); document.getElementById('quizBuilderTitle').innerHTML = `<i class="fa-solid fa-file-pen me-2"></i>Quiz Builder`; document.getElementById('editingTestId').value = '';
    document.getElementById('questionsContainer').innerHTML = ''; addQuestionCard(); document.getElementById('cb_ALL').checked = true; toggleAssignAll();
    document.getElementById('cancelEditBtn').classList.add('d-none'); document.getElementById('btnDraft').innerText = "Save Draft"; document.getElementById('btnPublish').innerText = "Publish Live";
}

// 🔥 NEW: PREVIEW TEST FUNCTION
window.previewTest = function(id) {
    const test = globalManagedTests.find(t => t._id === id); if(!test) return;
    const body = document.getElementById('previewModalBody');
    const q = test.questions[0]; // Just show the first question
    let formatHtml = '';
    
    if(!test.testType || test.testType === 'addition') {
        const formattedNumbers = q.numbersArray.map((n) => n >= 0 ? `+${n}` : n).join('<br>');
        formatHtml = `<div class="text-end px-4 border-bottom border-dark border-3 pb-2 d-inline-block"><h1 class="abacus-numbers fw-bold text-dark display-4 mb-0" style="letter-spacing: 4px; line-height: 1.6;">${formattedNumbers}</h1></div>`;
    } else {
        const sign = test.testType === 'multiplication' ? '×' : '÷';
        formatHtml = `<h1 class="fw-bold text-dark display-3 mb-0">${q.numbersArray[0]} <span class="text-primary">${sign}</span> ${q.numbersArray[1]}</h1>`;
    }

    body.innerHTML = `
        <div class="badge bg-danger fs-6 shadow-sm mb-4"><i class="fa-solid fa-clock me-1"></i>${test.timeLimitMinutes}:00</div>
        <div class="card bg-body-secondary border-0 p-4 rounded-4 shadow-sm mb-4 d-flex flex-column align-items-center">
            ${formatHtml}
        </div>
        <div class="row justify-content-center">
            <div class="col-12 text-start">
                <label class="form-check custom-radio mb-3 p-3 border rounded-3 bg-white shadow-sm d-flex align-items-center"><input class="form-check-input fs-4 m-0" type="radio" checked><span class="fs-4 fw-bold text-dark ms-3">Option 1</span></label>
                <label class="form-check custom-radio mb-3 p-3 border rounded-3 bg-white shadow-sm d-flex align-items-center"><input class="form-check-input fs-4 m-0" type="radio"><span class="fs-4 fw-bold text-dark ms-3">Option 2</span></label>
            </div>
        </div>`;
    new bootstrap.Modal(document.getElementById('previewModal')).show();
};

async function loadTests() {
    const tbody = document.getElementById('testTableBody'); 
    if (tbody) tbody.innerHTML = `<tr><td colspan="5"><p class="placeholder-glow mb-1"><span class="placeholder col-8 bg-secondary rounded"></span></p></td></tr>`;
    try {
        const res = await fetch(`${BASE_URL}/api/admin/tests`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (res.ok) {
            globalManagedTests = await res.json(); const testFilter = document.getElementById('filterTestName');
            if (tbody) tbody.innerHTML = ''; if (testFilter) testFilter.innerHTML = '<option value="all">All Tests</option>';
            globalManagedTests.forEach(test => {
                if (testFilter) testFilter.innerHTML += `<option value="${test.title}">${test.title}</option>`;
                const badge = test.isActive ? `<span class="badge bg-success">Live</span>` : `<span class="badge bg-secondary">Draft</span>`;
                const typeIcon = test.testType === 'multiplication' ? '✖️' : test.testType === 'division' ? '➗' : '➕';
                const safeTitleStr = test.title.replace(/'/g, "\\'"); 
                if (tbody) tbody.innerHTML += `
                    <tr>
                        <td class="small fw-bold"><div class="mb-1">${typeIcon} ${test.title}</div><div class="small text-muted fw-normal">${test.questions.length}Q | ${test.timeLimitMinutes}m</div></td>
                        <td>${badge}</td>
                        <td class="text-nowrap">
                            <button class="btn btn-outline-info btn-sm py-0 px-2 me-1" onclick="previewTest('${test._id}')" title="Preview"><i class="fa-solid fa-eye"></i></button>
                            <button class="btn btn-outline-success btn-sm py-0 px-2 me-1" onclick="shareTestToWhatsApp('${safeTitleStr}')" title="Share WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
                            <button class="btn btn-outline-success btn-sm py-0 px-2 me-1" onclick="exportToExcel('${test._id}', '${safeTitleStr}')" title="Export Excel"><i class="fa-solid fa-file-excel"></i></button>
                            <button class="btn btn-outline-primary btn-sm py-0 px-2 me-1" onclick="editTest('${test._id}')" title="Edit Test"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-light btn-sm py-0 px-2 me-1 border bg-body" onclick="toggleTest('${test._id}')"><i class="fa-solid fa-power-off"></i></button>
                            <button class="btn btn-outline-danger btn-sm py-0 px-2" onclick="deleteTest('${test._id}')"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>`;
            });
        }
    } catch (e) { if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center">Failed to load.</td></tr>`; }
}
window.toggleTest = async function(id) { await fetch(`${BASE_URL}/api/admin/tests/${id}/toggle`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }}); loadTests(); };
window.deleteTest = async function(id) { if (!confirm("Delete test?")) return; await fetch(`${BASE_URL}/api/admin/tests/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }}); loadTests(); };

// SUBMISSIONS & CHARTS (Unchanged)
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
function applyFilters() { /* ... unchanged rendering logic ... */ }
function renderCharts(submissions) { /* ... unchanged charts logic ... */ }
const dashboardTab = document.getElementById('dashboard-tab'); if (dashboardTab) dashboardTab.addEventListener('shown.bs.tab', function () { renderCharts(globalSubmissions); });

async function initializeAdminDashboard() {
    try { setMinDateLimits(); await Promise.all([loadStudents(), loadTests(), renderReviewEcosystem()]); } 
    catch (e) { console.error("Error", e); } 
    finally { const loader = document.getElementById('globalLoader'); if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.classList.add('d-none'), 500); } }
}
initializeAdminDashboard();