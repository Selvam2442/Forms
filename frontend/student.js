const token = localStorage.getItem('token');
const userName = localStorage.getItem('userName') || 'Student';
if (!token) window.location.href = 'index.html';

document.getElementById('studentWelcome').textContent = `Hi, ${userName}`;
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    if (document.fullscreenElement) document.exitFullscreen();
    window.location.href = 'index.html';
});

let activeQuestionsList = [], currentQuestionIndex = 0, studentSavedAnswers = [];
let currentTestId = null, timerInterval = null, testStartTime = null, cheatWarnings = 0;

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && currentTestId !== null) {
        cheatWarnings++;
        alert(`WARNING: Test interruption detected. Incident logged. (Total: ${cheatWarnings})`);
    }
});

// ==========================================
// MENTAL MATH DICTATION (NEW)
// ==========================================
document.getElementById('dictateBtn').addEventListener('click', () => {
    const q = activeQuestionsList[currentQuestionIndex];
    if (!q) return;
    
    // Format numbers for speech: "Add five. Minus two. Add ten."
    const textToSpeak = q.numbersArray.map(n => n < 0 ? `Minus ${Math.abs(n)}` : `Add ${n}`).join('. ');
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.8; // Slow down slightly for clarity
    window.speechSynthesis.speak(utterance);
});

// ==========================================
// DASHBOARD FETCHING
// ==========================================
async function fetchDashboardEcosystem() {
    try {
        const testRes = await fetch('http://127.0.0.1:5000/api/student/tests', { headers: { 'Authorization': `Bearer ${token}` }});
        if (testRes.ok) {
            const tests = await testRes.json();
            const container = document.getElementById('testsContainer');
            container.innerHTML = '';
            document.getElementById('noTestsMessage').classList.toggle('d-none', tests.length > 0);
            
            tests.forEach(test => {
                const item = document.createElement('div');
                item.className = 'col';
                item.innerHTML = `
                    <div class="card shadow-sm border-0 rounded-3 p-3 bg-white border-start border-4 border-primary">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="fw-bold mb-1 text-dark">${test.title}</h6>
                                <span class="text-muted small"><i class="fa-solid fa-clock me-1"></i>${test.timeLimitMinutes}m | <i class="fa-solid fa-list me-1"></i>${test.questions.length}Q</span>
                            </div>
                            <button class="btn btn-primary fw-bold btn-sm rounded-pill px-3" onclick='initializeTargetTest(${JSON.stringify(test)})'><i class="fa-solid fa-play me-1"></i>Start</button>
                        </div>
                    </div>`;
                container.appendChild(item);
            });
        }

        const histRes = await fetch('http://127.0.0.1:5000/api/student/history', { headers: { 'Authorization': `Bearer ${token}` }});
        if (histRes.ok) {
            const history = await histRes.json();
            const histContainer = document.getElementById('historyContainer');
            histContainer.innerHTML = '';
            history.forEach(sub => {
                let badge = sub.status === 'pending_review' ? `<span class="badge bg-warning text-dark">Reviewing</span>` 
                          : sub.status === 'retake_requested' ? `<span class="badge bg-info text-dark">Retake Req</span>` 
                          : `<span class="badge bg-success">Graded</span>`;
                let retakeBtn = sub.status === 'graded' ? `<button class="btn btn-sm text-secondary" onclick="triggerRetakeRequest('${sub._id}')"><i class="fa-solid fa-rotate-right me-1"></i>Retake</button>` : '';

                const card = document.createElement('div');
                card.className = 'col';
                card.innerHTML = `
                    <div class="card shadow-sm border-0 p-3 bg-white rounded-3">
                        <div class="d-flex justify-content-between mb-1"><strong class="small text-dark">${sub.testId ? sub.testId.title : 'Test'}</strong>${badge}</div>
                        <div class="fs-4 fw-bold text-success">${sub.finalScore} Pts</div>
                        <div class="small text-muted mt-1 bg-light p-2 rounded"><i class="fa-solid fa-comment-dots me-1"></i>${sub.adminFeedback || 'No notes.'}</div>
                        <div class="text-end mt-2">${retakeBtn}</div>
                    </div>`;
                histContainer.appendChild(card);
            });
        }

        // Grouped Leaderboard
        const leadRes = await fetch('http://127.0.0.1:5000/api/student/leaderboard', { headers: { 'Authorization': `Bearer ${token}` }});
        if (leadRes.ok) {
            const groupedLeaders = await leadRes.json();
            const container = document.getElementById('leaderboardContainer');
            container.innerHTML = '';

            for (const [testName, leaders] of Object.entries(groupedLeaders)) {
                const col = document.createElement('div');
                col.className = 'col-12 col-md-6';
                let listHtml = `<div class="card border-0 shadow-sm"><div class="card-header bg-warning text-dark fw-bold small"><i class="fa-solid fa-crown me-2"></i>${testName}</div><ul class="list-group list-group-flush">`;
                
                leaders.forEach((entry, idx) => {
                    let iconColor = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? '#cd7f32' : 'gray';
                    listHtml += `<li class="list-group-item d-flex justify-content-between p-2 small"><span class="fw-bold"><i class="fa-solid fa-medal me-2" style="color: ${iconColor};"></i>${entry.studentName}</span><span class="badge bg-dark">${entry.finalScore}</span></li>`;
                });
                col.innerHTML = listHtml + `</ul></div>`;
                container.appendChild(col);
            }
        }
    } catch (e) {}
}

// ==========================================
// ACTIVE TEST LOGIC
// ==========================================
window.initializeTargetTest = function(test) {
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
    document.getElementById('dashboardSection').classList.add('d-none');
    document.getElementById('activeTestSection').classList.remove('d-none');
    currentTestId = test._id; testStartTime = new Date().toISOString(); cheatWarnings = 0;
    activeQuestionsList = test.questions; currentQuestionIndex = 0; studentSavedAnswers = [];
    document.getElementById('activeTestTitle').textContent = test.title;
    renderCurrentPaginatedQuestion();
    startCountdownTimer(test.timeLimitMinutes);
};

function renderCurrentPaginatedQuestion() {
    const q = activeQuestionsList[currentQuestionIndex];
    document.getElementById('testProgressBar').style.width = `${((currentQuestionIndex) / activeQuestionsList.length) * 100}%`;
    document.getElementById('questionNumberHeader').textContent = `Question ${currentQuestionIndex + 1} of ${activeQuestionsList.length}`;
    document.getElementById('verticalNumbersDisplay').innerHTML = q.numbersArray.map(n => `<div>${n}</div>`).join('');
    
    const inputField = document.getElementById('paginatedAnswerInput');
    inputField.value = ''; inputField.focus();

    const actionBtn = document.getElementById('nextQuestionBtn');
    if (currentQuestionIndex === activeQuestionsList.length - 1) {
        actionBtn.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i>Submit';
        actionBtn.className = "btn btn-success btn-lg w-100 fw-bold rounded-pill shadow-sm";
    } else {
        actionBtn.innerHTML = 'Next<i class="fa-solid fa-arrow-right ms-2"></i>';
        actionBtn.className = "btn btn-primary btn-lg w-100 fw-bold rounded-pill shadow-sm";
    }
}

document.getElementById('nextQuestionBtn').addEventListener('click', () => {
    window.speechSynthesis.cancel(); // Stop talking when moving to next
    const inputField = document.getElementById('paginatedAnswerInput');
    if (inputField.value.trim() === '') return alert("Please enter an answer.");
    studentSavedAnswers.push({ questionId: activeQuestionsList[currentQuestionIndex].questionId, studentAnswer: parseInt(inputField.value, 10) });
    if (currentQuestionIndex < activeQuestionsList.length - 1) {
        currentQuestionIndex++; renderCurrentPaginatedQuestion();
    } else executeFinalTransmission();
});

function startCountdownTimer(minutes) {
    let secs = minutes * 60;
    const el = document.getElementById('timeRemaining');
    timerInterval = setInterval(() => {
        secs--;
        el.textContent = `${Math.floor(secs / 60).toString().padStart(2, '0')}:${(secs % 60).toString().padStart(2, '0')}`;
        if (secs <= 60) el.parentElement.className = "badge bg-danger fs-5 px-3 py-2 rounded-pill font-monospace";
        if (secs <= 0) { clearInterval(timerInterval); alert("Time's up!"); executeFinalTransmission(); }
    }, 1000);
}

async function executeFinalTransmission() {
    clearInterval(timerInterval);
    try {
        const res = await fetch('http://127.0.0.1:5000/api/student/submit', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ testId: currentTestId, startTime: testStartTime, cheatWarnings, answers: studentSavedAnswers })
        });
        if (res.ok) {
            const data = await res.json();
            if (document.fullscreenElement) document.exitFullscreen().catch(()=>{});
            document.getElementById('activeTestSection').classList.add('d-none');
            document.getElementById('resultsSection').classList.remove('d-none');
            document.getElementById('finalScore').textContent = `${data.autoGradedScore} / ${activeQuestionsList.length}`;
            
            // CONFETTI BURST FOR 100%
            if (data.autoGradedScore === activeQuestionsList.length) {
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            }
        }
    } catch (e) { alert("Submission Error"); }
}

window.triggerRetakeRequest = async function(id) {
    await fetch(`http://127.0.0.1:5000/api/student/submissions/${id}/request-retake`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }});
    fetchDashboardEcosystem();
};

document.getElementById('returnHomeBtn').addEventListener('click', () => {
    document.getElementById('resultsSection').classList.add('d-none');
    document.getElementById('dashboardSection').classList.remove('d-none');
    fetchDashboardEcosystem();
});
fetchDashboardEcosystem();