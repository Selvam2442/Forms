const token = localStorage.getItem('token');
const BASE_URL = 'https://forms-xg9n.onrender.com';

if (!token) window.location.href = 'index.html';
document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.clear(); window.location.href = 'index.html'; });

let globalTests = [];
let globalSubmissions = [];
let activeTest = null;

async function loadDashboard() {
    const testRes = await fetch(`${BASE_URL}/api/student/tests`, { headers: { 'Authorization': `Bearer ${token}` }});
    if (testRes.ok) globalTests = await testRes.json();

    const subRes = await fetch(`${BASE_URL}/api/student/my-submissions`, { headers: { 'Authorization': `Bearer ${token}` }});
    if (subRes.ok) globalSubmissions = await subRes.json();

    renderDashboard();
}

function renderDashboard() {
    document.getElementById('dashboardSection').classList.remove('d-none');
    document.getElementById('testTakingSection').classList.add('d-none');

    const testContainer = document.getElementById('availableTestsContainer'); testContainer.innerHTML = '';
    const submittedIds = globalSubmissions.map(s => s.testId ? s.testId._id : null);
    const available = globalTests.filter(t => !submittedIds.includes(t._id));

    if (available.length === 0) testContainer.innerHTML = '<div class="alert alert-light border border-dashed text-center text-muted">You are all caught up!</div>';
    available.forEach(t => {
        testContainer.innerHTML += `<div class="card shadow-sm border-0 mb-3 bg-white"><div class="card-body d-flex justify-content-between align-items-center"><div><h6 class="fw-bold mb-0 text-dark">${t.title}</h6><small class="text-muted">${t.questions.length} Questions | ${t.timeLimitMinutes} Mins</small></div><button class="btn btn-primary btn-sm fw-bold px-3 shadow-sm" onclick="startTest('${t._id}')">Start</button></div></div>`;
    });

    const subContainer = document.getElementById('myResultsContainer'); subContainer.innerHTML = '';
    if (globalSubmissions.length === 0) subContainer.innerHTML = '<div class="alert alert-light border border-dashed text-center text-muted">No results yet.</div>';
    globalSubmissions.forEach(sub => {
        let badge = sub.status === 'graded' ? '<span class="badge bg-success">Graded</span>' : '<span class="badge bg-warning text-dark">Under Review</span>';
        let reviewBtn = sub.status === 'graded' ? `<button class="btn btn-outline-primary btn-sm w-100 fw-bold mt-3" onclick="viewDetails('${sub._id}')">Review Answers</button>` : `<div class="text-center mt-3 small text-muted"><i class="fa-solid fa-lock me-1"></i>Answers locked until graded</div>`;
        subContainer.innerHTML += `<div class="card shadow-sm border-0 mb-3 bg-white"><div class="card-body"><div class="d-flex justify-content-between mb-2"><h6 class="fw-bold mb-0 text-dark">${sub.testId ? sub.testId.title : 'Deleted'}</h6>${badge}</div><div class="fs-5 fw-bold text-primary">Score: ${sub.finalScore}</div>${reviewBtn}</div></div>`;
    });
}

// === TEST TAKING LOGIC ===
window.startTest = function(id) {
    activeTest = globalTests.find(t => t._id === id);
    if (!activeTest) return;
    
    document.getElementById('dashboardSection').classList.add('d-none');
    document.getElementById('testTakingSection').classList.remove('d-none');
    document.getElementById('activeTestTitle').innerText = activeTest.title;

    const qContainer = document.getElementById('activeTestQuestions'); qContainer.innerHTML = '';
    activeTest.questions.forEach((q, index) => {
        qContainer.innerHTML += `
            <div class="mb-4 p-3 bg-light rounded-3 border">
                <h6 class="fw-bold text-muted mb-3">Question ${index + 1}</h6>
                <div class="d-flex align-items-center">
                    <div class="bg-white px-4 py-2 border rounded shadow-sm fw-bold fs-5 me-3 font-monospace letter-spacing-1">${q.numbersArray.join(' <br> ')}</div>
                    <input type="number" class="form-control form-control-lg student-answer-input" data-qid="${q.questionId}" placeholder="Sum..." required>
                </div>
            </div>`;
    });
}

window.cancelTest = function() { activeTest = null; renderDashboard(); }

window.submitTest = async function() {
    const inputs = document.querySelectorAll('.student-answer-input');
    const answers = {};
    let allFilled = true;
    inputs.forEach(input => {
        if (!input.value) allFilled = false;
        answers[input.dataset.qid] = input.value;
    });

    if (!allFilled) { alert("Please answer all questions before submitting."); return; }
    if (!confirm("Are you sure you want to submit?")) return;

    try {
        const res = await fetch(`${BASE_URL}/api/student/submit`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ testId: activeTest._id, answers })
        });
        if (res.ok) { alert("Submitted successfully!"); activeTest = null; loadDashboard(); }
    } catch (e) { alert("Error submitting test."); }
}

// === REVIEW LOGIC ===
window.viewDetails = function(subId) {
    const sub = globalSubmissions.find(s => s._id === subId);
    if (!sub) return;
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

loadDashboard();