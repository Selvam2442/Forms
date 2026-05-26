const token = localStorage.getItem('token');
const BASE_URL = 'https://forms-xg9n.onrender.com';
if (!token) window.location.href = 'index.html';
document.getElementById('logoutBtn').addEventListener('click', () => { localStorage.clear(); window.location.href = 'index.html'; });

// 🔥 PWA Service Worker
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js'); }

// 🔥 GAMIFICATION & INFO LOAD
try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.name) document.getElementById('studentGreeting').innerHTML = `<i class="fa-solid fa-user me-1"></i>Welcome, ${payload.name}`;
    if (payload.streak > 0) {
        document.getElementById('streakDisplay').style.display = 'inline-block';
        document.getElementById('streakCount').innerText = payload.streak;
        if (payload.streak > 1) { confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } }); }
    }
} catch (e) { console.error(e); }

let globalTests = [], globalSubmissions = [], activeTest = null, countdownInterval = null, testStartTime = null; 

async function loadDashboard() {
    try {
        const testRes = await fetch(`${BASE_URL}/api/student/tests`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (testRes.ok) globalTests = await testRes.json();
        
        const subRes = await fetch(`${BASE_URL}/api/student/my-submissions`, { headers: { 'Authorization': `Bearer ${token}` }});
        if (subRes.ok) globalSubmissions = await subRes.json();
        
        renderDashboard();
    } catch (e) {
        console.error("Error loading dashboard data");
    } finally {
        // 🔥 FADE OUT LOADER WHEN FINISHED
        const loader = document.getElementById('globalLoader');
        loader.style.opacity = '0';
        setTimeout(() => loader.classList.add('d-none'), 500);
    }
}

function renderDashboard() {
    document.getElementById('dashboardSection').classList.remove('d-none'); document.getElementById('testTakingSection').classList.add('d-none');
    const testContainer = document.getElementById('availableTestsContainer'); testContainer.innerHTML = '';
    const submittedIds = globalSubmissions.map(s => s.testId ? s.testId._id : null);
    const available = globalTests.filter(t => !submittedIds.includes(t._id));

    if (available.length === 0) testContainer.innerHTML = '<div class="alert alert-light border border-dashed text-center text-muted">You are all caught up!</div>';
    
    available.forEach(t => { 
        let dueHtml = t.dueDate ? `<br><small class="text-danger fw-bold"><i class="fa-solid fa-triangle-exclamation me-1"></i>Due: ${new Date(t.dueDate).toLocaleString()}</small>` : '';
        testContainer.innerHTML += `<div class="card shadow-sm border-0 mb-3 bg-white"><div class="card-body d-flex justify-content-between align-items-center"><div><h6 class="fw-bold mb-0 text-dark">${t.title}</h6><small class="text-muted">${t.questions.length} Questions | ${t.timeLimitMinutes} Mins</small>${dueHtml}</div><button class="btn btn-primary btn-sm fw-bold px-3 shadow-sm" onclick="startTest('${t._id}')">Start</button></div></div>`; 
    });

    const subContainer = document.getElementById('myResultsContainer'); subContainer.innerHTML = '';
    if (globalSubmissions.length === 0) subContainer.innerHTML = '<div class="alert alert-light border border-dashed text-center text-muted">No results yet.</div>';
    globalSubmissions.forEach(sub => {
        let badge = sub.status === 'graded' ? '<span class="badge bg-success">Graded</span>' : '<span class="badge bg-warning text-dark">Under Review</span>';
        let reviewBtn = sub.status === 'graded' ? `<button class="btn btn-outline-primary btn-sm w-100 fw-bold mt-3" onclick="viewDetails('${sub._id}')">Review Answers</button>` : `<div class="text-center mt-3 small text-muted"><i class="fa-solid fa-lock me-1"></i>Answers locked until graded</div>`;
        subContainer.innerHTML += `<div class="card shadow-sm border-0 mb-3 bg-white"><div class="card-body"><div class="d-flex justify-content-between mb-2"><h6 class="fw-bold mb-0 text-dark">${sub.testId ? sub.testId.title : 'Deleted'}</h6>${badge}</div><div class="fs-5 fw-bold text-primary">Score: ${sub.status === 'graded' ? sub.finalScore : '<i class="fa-solid fa-eye-slash me-2"></i>Hidden'}</div>${reviewBtn}</div></div>`;
    });
}

function shuffleArray(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function generateChoices(c) { let ch = new Set([c]); while(ch.size < 3) { let o = Math.floor(Math.random() * 20) - 10; if (o===0) o=5; ch.add(c+o); } return shuffleArray(Array.from(ch)); }
window.playAudio = function(s) { const n = s.split(','); let t = n.map(x => { let num = parseInt(x.trim()); return num < 0 ? "minus " + Math.abs(num) : num; }).join(", "); window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.rate = 0.8; u.pitch = 1.1; window.speechSynthesis.speak(u); };

function startTimer(minutes) {
    let timeRemaining = minutes * 60; const display = document.getElementById('timerDisplay'); clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        const m = Math.floor(timeRemaining / 60).toString().padStart(2, '0'); const s = (timeRemaining % 60).toString().padStart(2, '0');
        display.innerHTML = `<i class="fa-solid fa-clock me-1"></i>${m}:${s}`;
        if (timeRemaining <= 0) { clearInterval(countdownInterval); alert("Time is up! Submitting your test automatically."); submitTest(true); }
        timeRemaining--;
    }, 1000);
}

window.startTest = function(id) {
    activeTest = globalTests.find(t => t._id === id); if (!activeTest) return;
    document.getElementById('dashboardSection').classList.add('d-none'); document.getElementById('testTakingSection').classList.remove('d-none'); document.getElementById('activeTestTitle').innerText = activeTest.title;
    testStartTime = Date.now(); startTimer(activeTest.timeLimitMinutes);
    const qContainer = document.getElementById('activeTestQuestions'); qContainer.innerHTML = '';
    let sq = shuffleArray([...activeTest.questions]);
    sq.forEach((q, index) => {
        const sum = q.numbersArray.reduce((a, b) => a + b, 0); const choices = generateChoices(sum);
        let cHtml = choices.map(c => `<div class="form-check custom-radio mb-2"><input class="form-check-input student-answer-input" type="radio" name="q_${q.questionId}" value="${c}" id="q_${q.questionId}_${c}"><label class="form-check-label fw-bold fs-5 text-dark" for="q_${q.questionId}_${c}">${c}</label></div>`).join('');
        qContainer.innerHTML += `<div class="mb-4 p-4 bg-white rounded-4 shadow-sm border"><div class="d-flex justify-content-between align-items-center mb-3"><h5 class="fw-bold text-primary mb-0">Question ${index + 1}</h5><button class="btn btn-light text-primary rounded-circle shadow-sm p-2" onclick="playAudio('${q.numbersArray.join(',')}')"><i class="fa-solid fa-volume-high"></i></button></div><div class="row align-items-center"><div class="col-5 text-center border-end"><div class="d-inline-block text-end font-monospace fs-4 fw-bold pe-3 abacus-numbers">${q.numbersArray.join('<br>')}</div></div><div class="col-7 ps-4"><p class="text-muted small fw-bold mb-3">Select correct sum:</p>${cHtml}</div></div></div>`;
    });
}
window.cancelTest = function() { activeTest = null; testStartTime = null; clearInterval(countdownInterval); window.speechSynthesis.cancel(); renderDashboard(); }
window.submitTest = async function(isAuto = false) {
    const answers = {}; let allFilled = true;
    activeTest.questions.forEach(q => { const r = document.querySelector(`input[name="q_${q.questionId}"]:checked`); if (!r) allFilled = false; else answers[q.questionId] = r.value; });
    if (!isAuto && !allFilled) { alert("Please select an answer for all questions."); return; }
    if (!isAuto && !confirm("Are you sure you want to submit?")) return;
    clearInterval(countdownInterval); const tSecs = testStartTime ? Math.floor((Date.now() - testStartTime) / 1000) : 0;
    try { const res = await fetch(`${BASE_URL}/api/student/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ testId: activeTest._id, answers, timeTakenSeconds: tSecs }) }); if (res.ok) { if (!isAuto) alert("Submitted successfully!"); activeTest = null; loadDashboard(); } } catch (e) { alert("Error."); }
}
window.viewDetails = function(subId) {
    const sub = globalSubmissions.find(s => s._id === subId); if (!sub || !sub.answers) return;
    document.getElementById('reviewTestName').innerText = sub.testId ? sub.testId.title : 'Unknown Test'; const tbody = document.getElementById('reviewTableBody'); tbody.innerHTML = '';
    sub.answers.forEach((ans, idx) => { tbody.innerHTML += `<tr class="${ans.isCorrect ? '' : 'table-danger'}"><td class="fw-bold text-muted">${idx + 1}</td><td class="small">${ans.numbersArray ? ans.numbersArray.join(', ') : 'N/A'}</td><td class="fw-bold fs-5 text-${ans.isCorrect ? 'success' : 'danger'}">${ans.studentAnswer || '-'}</td><td class="fw-bold fs-5 text-dark">${ans.correctAnswer}</td><td>${ans.isCorrect ? '<i class="fa-solid fa-circle-check text-success fs-5"></i>' : '<i class="fa-solid fa-circle-xmark text-danger fs-5"></i>'}</td></tr>`; });
    new bootstrap.Modal(document.getElementById('reviewModal')).show();
}
loadDashboard();