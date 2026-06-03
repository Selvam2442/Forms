const token = localStorage.getItem('token');
const BASE_URL = 'https://forms-xg9n.onrender.com';

if (!token) window.location.href = 'index.html';

document.getElementById('logoutBtn').addEventListener('click', () => { 
    localStorage.clear(); 
    window.location.href = 'index.html'; 
});

let globalTests = [];
let globalSubmissions = [];
let activeTest = null;
let currentQuestionIndex = 0;
let studentAnswers = {}; 
let timerInterval = null;
let timeTakenSeconds = 0;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playAudioClick() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(); 
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.type = 'triangle'; 
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    osc.start(); osc.stop(audioCtx.currentTime + 0.05);
}

function playAudioSuccess() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    [440, 554, 659].forEach((freq, i) => { 
        setTimeout(() => {
            const osc = audioCtx.createOscillator(); 
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.type = 'sine'; osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start(); osc.stop(audioCtx.currentTime + 0.5);
        }, i * 150);
    });
}

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
        const loader = document.getElementById('globalLoader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.classList.add('d-none'), 500);
        }
    }
}

function renderDashboard() {
    const userPayload = JSON.parse(atob(token.split('.')[1]));
    const firstName = userPayload.name.split(' ')[0];
    document.getElementById('studentGreeting').innerHTML = `<i class="fa-solid fa-user me-1"></i>Welcome, ${firstName}`;
    
    const availableContainer = document.getElementById('availableTestsContainer');
    const resultsContainer = document.getElementById('myResultsContainer');
    
    availableContainer.innerHTML = ''; 
    resultsContainer.innerHTML = '';
    const completedTestIds = globalSubmissions.map(s => s.testId ? s.testId._id : null);
    
    let testsShown = 0;
    globalTests.forEach(test => {
        if (!completedTestIds.includes(test._id)) {
            testsShown++;
            const icon = test.testType === 'multiplication' ? '✖️' : test.testType === 'division' ? '➗' : '➕';
            const formatTag = test.answerFormat === 'direct' ? '⌨️ Direct Entry' : '🔘 Multiple Choice';
            
            availableContainer.innerHTML += `
                <div class="card shadow-sm border-0 mb-3 bg-body rounded-3">
                    <div class="card-body d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="fw-bold mb-1 text-primary">${icon} ${test.title}</h6>
                            <small class="text-muted"><i class="fa-solid fa-list-ol me-1"></i>${test.questions.length} Qs | <i class="fa-solid fa-stopwatch me-1"></i>${test.timeLimitMinutes}m | <strong class="text-dark">${formatTag}</strong></small>
                        </div>
                        <button class="btn btn-primary btn-sm fw-bold px-3 shadow-sm rounded-pill" onclick="startTest('${test._id}')">Start</button>
                    </div>
                </div>`;
        }
    });
    
    if (testsShown === 0) {
        availableContainer.innerHTML = `<div class="alert alert-light border text-center text-muted small fw-bold">No new tests available.</div>`;
    }

    let resultsShown = 0;
    globalSubmissions.forEach(sub => {
        resultsShown++;
        let statusBadge = `<span class="badge bg-warning text-dark"><i class="fa-solid fa-clock me-1"></i>Pending Review</span>`;
        let actionBtn = `<button class="btn btn-light btn-sm text-muted fw-bold border disabled">Waiting</button>`;
        
        if (sub.status === 'graded') {
            const total = sub.answers ? sub.answers.length : 0;
            const pct = total > 0 ? Math.round((sub.finalScore / total) * 100) : 0;
            
            statusBadge = `<span class="badge bg-success"><i class="fa-solid fa-check me-1"></i>Graded</span>`;
            actionBtn = `<button class="btn btn-outline-primary btn-sm fw-bold px-3" onclick="viewDetails('${sub._id}')">Review (${pct}%)</button>`;
        } else if (sub.status === 'retake_requested') {
            statusBadge = `<span class="badge bg-danger"><i class="fa-solid fa-rotate-left me-1"></i>Retake Required</span>`;
            actionBtn = `<button class="btn btn-danger btn-sm fw-bold px-3" onclick="startTest('${sub.testId._id}')">Retake Now</button>`;
        }

        resultsContainer.innerHTML += `
            <div class="card shadow-sm border-0 mb-3 bg-body rounded-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6 class="fw-bold mb-0 text-dark">${sub.testId ? sub.testId.title : 'Deleted Test'}</h6>
                        ${statusBadge}
                    </div>
                    <div class="d-flex justify-content-between align-items-end">
                        <small class="text-muted fw-bold">Date: ${new Date(sub.submitTime).toLocaleDateString()}</small>
                        ${actionBtn}
                    </div>
                </div>
            </div>`;
    });
    
    if (resultsShown === 0) {
        resultsContainer.innerHTML = `<div class="alert alert-light border text-center text-muted small fw-bold">No results yet.</div>`;
    }

    if (!sessionStorage.getItem('welcomeShown')) {
        document.getElementById('welcomeModalName').innerText = `Welcome, ${firstName}!`;
        const reminderBox = document.getElementById('welcomeReminderBox');
        if (testsShown > 0) {
            reminderBox.classList.remove('d-none');
            document.getElementById('welcomeTestCount').innerText = testsShown;
        } else {
            reminderBox.classList.add('d-none');
        }
        new bootstrap.Modal(document.getElementById('welcomeModal')).show();
        sessionStorage.setItem('welcomeShown', 'true');
    }
}

window.startTest = function(testId) {
    activeTest = globalTests.find(t => t._id === testId);
    if (!activeTest) return;

    currentQuestionIndex = 0;
    studentAnswers = {};

    activeTest.questions.forEach(q => {
        if (!q.options && activeTest.answerFormat !== 'direct') {
            let realAns = 0;
            if (activeTest.testType === 'multiplication') realAns = q.numbersArray[0] * q.numbersArray[1];
            else if (activeTest.testType === 'division') realAns = q.numbersArray[0] / q.numbersArray[1];
            else realAns = q.numbersArray.reduce((a, b) => a + b, 0);

            const opts = new Set([realAns]);
            while(opts.size < 4) {
                const offset = [1, -1, 10, -10, 5, -5, 2, -2][Math.floor(Math.random() * 8)];
                let fake = realAns + offset;
                if (activeTest.testType === 'division') fake = Math.floor(fake);
                
                if (fake >= 0) {
                    opts.add(fake);
                }
            }
            q.options = Array.from(opts).sort(() => Math.random() - 0.5);
        }
    });

    document.getElementById('dashboardSection').classList.add('d-none');
    document.getElementById('testTakingSection').classList.remove('d-none');
    document.getElementById('activeTestTitle').innerText = activeTest.title;

    let totalSeconds = activeTest.timeLimitMinutes * 60;
    timeTakenSeconds = 0;
    clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        totalSeconds--; 
        timeTakenSeconds++;
        let m = Math.floor(totalSeconds / 60); 
        let s = totalSeconds % 60;
        document.getElementById('timerDisplay').innerHTML = `<i class="fa-solid fa-clock me-1"></i>${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        if (totalSeconds <= 0) { 
            clearInterval(timerInterval); 
            alert("Time is up! Auto-submitting your test."); 
            submitTest(); 
        }
    }, 1000);

    renderQuestion();
};

window.renderQuestion = function() {
    const q = activeTest.questions[currentQuestionIndex];
    const total = activeTest.questions.length;
    const savedAnswer = studentAnswers[q.questionId] !== undefined && studentAnswers[q.questionId] !== null ? studentAnswers[q.questionId] : '';

    document.getElementById('testProgressBar').style.width = `${((currentQuestionIndex) / total) * 100}%`;

    let formatHtml = '';
    if (!activeTest.testType || activeTest.testType === 'addition') {
        const formattedNumbers = q.numbersArray.map((n) => n >= 0 ? `+${n}` : n).join('<br>');
        formatHtml = `<div class="text-end px-4 border-bottom border-dark border-3 pb-2 d-inline-block" style="min-width: 150px;"><h1 class="abacus-numbers fw-bold text-dark display-4 mb-0" style="letter-spacing: 4px; line-height: 1.6;">${formattedNumbers}</h1></div>`;
    } else {
        const sign = activeTest.testType === 'multiplication' ? '×' : '÷';
        formatHtml = `<h1 class="fw-bold text-dark display-1 mb-0">${q.numbersArray[0]} <span class="text-primary">${sign}</span> ${q.numbersArray[1]}</h1>`;
    }

    let inputAreaHtml = '';

    if (activeTest.answerFormat === 'direct') {
        inputAreaHtml = `
            <div class="mb-4">
                <input type="text" id="directAnswerInput" class="form-control form-control-lg text-center fs-1 fw-bold bg-white shadow-sm border-primary mx-auto" style="max-width: 250px; height: 70px;" readonly value="${savedAnswer}" placeholder="?">
            </div>
            
            <div class="row g-2 justify-content-center mx-auto mb-4" style="max-width: 350px;">
                <div class="col-2 col-sm-2"><button class="btn btn-light w-100 fw-bold border fs-4 py-2 shadow-sm" onclick="typeDirect('1')">1</button></div>
                <div class="col-2 col-sm-2"><button class="btn btn-light w-100 fw-bold border fs-4 py-2 shadow-sm" onclick="typeDirect('2')">2</button></div>
                <div class="col-2 col-sm-2"><button class="btn btn-light w-100 fw-bold border fs-4 py-2 shadow-sm" onclick="typeDirect('3')">3</button></div>
                <div class="col-2 col-sm-2"><button class="btn btn-light w-100 fw-bold border fs-4 py-2 shadow-sm" onclick="typeDirect('4')">4</button></div>
                <div class="col-2 col-sm-2"><button class="btn btn-light w-100 fw-bold border fs-4 py-2 shadow-sm" onclick="typeDirect('5')">5</button></div>
                
                <div class="col-2 col-sm-2"><button class="btn btn-light w-100 fw-bold border fs-4 py-2 shadow-sm" onclick="typeDirect('6')">6</button></div>
                <div class="col-2 col-sm-2"><button class="btn btn-light w-100 fw-bold border fs-4 py-2 shadow-sm" onclick="typeDirect('7')">7</button></div>
                <div class="col-2 col-sm-2"><button class="btn btn-light w-100 fw-bold border fs-4 py-2 shadow-sm" onclick="typeDirect('8')">8</button></div>
                <div class="col-2 col-sm-2"><button class="btn btn-light w-100 fw-bold border fs-4 py-2 shadow-sm" onclick="typeDirect('9')">9</button></div>
                <div class="col-2 col-sm-2"><button class="btn btn-light w-100 fw-bold border fs-4 py-2 shadow-sm" onclick="typeDirect('0')">0</button></div>
                
                <div class="col-6"><button class="btn btn-danger w-100 fw-bold border fs-5 py-2 shadow-sm" onclick="clearDirect()">AC</button></div>
                <div class="col-6"><button class="btn btn-warning w-100 fw-bold border fs-5 py-2 shadow-sm" onclick="eraseDirect()"><i class="fa-solid fa-delete-left"></i></button></div>
            </div>
        `;
    } else {
        const optionsHtml = q.options.map((opt, i) => `
            <label class="form-check custom-radio mb-3 p-3 border rounded-3 bg-white shadow-sm d-flex align-items-center w-100" style="cursor:pointer; transition: 0.2s;" onclick="playAudioClick()">
                <input class="form-check-input fs-4 m-0" type="radio" name="q_answer" value="${opt}" ${savedAnswer == opt ? 'checked' : ''} onchange="saveAnswer('${q.questionId}', this.value)">
                <span class="fs-4 fw-bold text-dark ms-3">${opt}</span>
            </label>
        `).join('');
        inputAreaHtml = `<div class="row justify-content-center"><div class="col-12 col-sm-8 text-start">${optionsHtml}</div></div>`;
    }

    let html = `
        <div class="text-center mb-4">
            <span class="badge bg-secondary mb-3 fs-6 rounded-pill px-3 py-2 shadow-sm">Question ${currentQuestionIndex + 1} of ${total}</span>
            <div class="card bg-body-secondary border-0 p-4 rounded-4 shadow-sm mb-4 d-flex flex-column align-items-center justify-content-center" style="min-height: 200px;">
                ${formatHtml}
            </div>
            ${inputAreaHtml}
        </div>
        <div class="d-flex gap-2 mt-4">
    `;

    const hasValidAnswer = savedAnswer !== null && savedAnswer !== '' && savedAnswer !== '-';
    const nextDisabled = hasValidAnswer ? '' : 'disabled';

    if (currentQuestionIndex > 0) {
        html += `<button class="btn btn-outline-secondary btn-lg w-50 fw-bold shadow-sm" onclick="changeQuestion(-1)"><i class="fa-solid fa-arrow-left me-2"></i>Previous</button>`;
    } else {
        html += `<button class="btn btn-outline-secondary btn-lg w-50 fw-bold shadow-sm disabled" style="opacity:0.4;">Previous</button>`;
    }

    if (currentQuestionIndex < total - 1) {
        html += `<button id="nextBtn" class="btn btn-primary btn-lg w-50 fw-bold shadow-sm" ${nextDisabled} onclick="changeQuestion(1)">Next<i class="fa-solid fa-arrow-right ms-2"></i></button>`;
    } else {
        html += `<button id="submitBtn" class="btn btn-success btn-lg w-50 fw-bold shadow-sm" ${nextDisabled} onclick="submitTest()"><i class="fa-solid fa-check-double me-2"></i>Submit</button>`;
    }

    html += `</div>`;
    document.getElementById('activeTestQuestions').innerHTML = html;
};

window.typeDirect = function(char) {
    playAudioClick();
    const input = document.getElementById('directAnswerInput');
    if (char === '-' && input.value !== '') return; 
    input.value += char;
    saveAnswer(activeTest.questions[currentQuestionIndex].questionId, input.value);
};

window.clearDirect = function() {
    playAudioClick();
    const input = document.getElementById('directAnswerInput');
    input.value = '';
    studentAnswers[activeTest.questions[currentQuestionIndex].questionId] = null;
    document.getElementById('nextBtn')?.setAttribute('disabled', 'true');
    document.getElementById('submitBtn')?.setAttribute('disabled', 'true');
};

window.eraseDirect = function() {
    playAudioClick();
    const input = document.getElementById('directAnswerInput');
    input.value = input.value.slice(0, -1);
    if (input.value === '' || input.value === '-') {
        studentAnswers[activeTest.questions[currentQuestionIndex].questionId] = null;
        document.getElementById('nextBtn')?.setAttribute('disabled', 'true');
        document.getElementById('submitBtn')?.setAttribute('disabled', 'true');
    } else {
        saveAnswer(activeTest.questions[currentQuestionIndex].questionId, input.value);
    }
};

window.saveAnswer = function(qId, val) { 
    studentAnswers[qId] = val; 
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) nextBtn.removeAttribute('disabled');
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.removeAttribute('disabled');
};

window.changeQuestion = function(direction) { 
    currentQuestionIndex += direction; 
    renderQuestion(); 
};

window.cancelTest = function() {
    if (!confirm("Quit test? All answers will be lost.")) return;
    clearInterval(timerInterval); 
    document.getElementById('testTakingSection').classList.add('d-none'); 
    document.getElementById('dashboardSection').classList.remove('d-none');
};

window.submitTest = async function() {
    clearInterval(timerInterval);
    const formattedAnswers = {};
    activeTest.questions.forEach(q => { 
        formattedAnswers[q.questionId] = studentAnswers[q.questionId] ? parseInt(studentAnswers[q.questionId]) : 0; 
    });

    document.getElementById('activeTestQuestions').innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"></div><h4 class="mt-3 text-primary fw-bold">Grading Exam...</h4></div>`;

    try {
        const res = await fetch(`${BASE_URL}/api/student/submit`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
            body: JSON.stringify({ testId: activeTest._id, answers: formattedAnswers, timeTakenSeconds: timeTakenSeconds }) 
        });
        
        if (res.ok) {
            playAudioSuccess(); 
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            document.getElementById('testTakingSection').classList.add('d-none'); 
            document.getElementById('dashboardSection').classList.remove('d-none');
            loadDashboard(); 
        } else { 
            alert("Error submitting test"); 
        }
    } catch (e) { 
        alert("Network error."); 
    }
};

window.viewDetails = function(subId) {
    const sub = globalSubmissions.find(s => s._id === subId); 
    if (!sub) return;
    
    const tbody = document.getElementById('reviewTableBody'); 
    tbody.innerHTML = '';
    let totalQuestions = sub.answers ? sub.answers.length : 0;
    
    if (sub.answers) { 
        sub.answers.forEach((ans, index) => { 
            tbody.innerHTML += `
                <tr class="${ans.isCorrect ? '' : 'table-danger'}">
                    <td class="fw-bold text-muted">${index + 1}</td>
                    <td class="small">${ans.numbersArray ? ans.numbersArray.join(', ') : 'N/A'}</td>
                    <td class="fw-bold fs-5 text-${ans.isCorrect ? 'success' : 'danger'}">${ans.studentAnswer}</td>
                    <td class="fw-bold fs-5">${ans.correctAnswer}</td>
                    <td>${ans.isCorrect ? '<i class="fa-solid fa-circle-check text-success fs-5"></i>' : '<i class="fa-solid fa-circle-xmark text-danger fs-5"></i>'}</td>
                </tr>`; 
        }); 
    }

    const testTitle = sub.testId ? sub.testId.title : 'Deleted Test';
    const studentName = document.getElementById('studentGreeting').innerText.replace('Welcome, ', '').trim();
    
    const percentage = totalQuestions > 0 ? Math.round((sub.finalScore / totalQuestions) * 100) : 0;
    
    document.getElementById('cardStudentName').innerText = studentName;
    document.getElementById('cardScore').innerHTML = `${sub.finalScore} / ${totalQuestions} <span class="fs-4">(${percentage}%)</span>`;
    document.getElementById('cardTestName').innerText = testTitle;
    
    let msg = "Keep practicing, you're getting there!";
    if (percentage === 100) msg = "Absolutely Perfect! You are a Math Genius! 🌟";
    else if (percentage >= 80) msg = "Outstanding Performance! Keep it up! 🔥";
    else if (percentage >= 50) msg = "Good job! A little more practice and you'll be unstoppable! 💪";
    document.getElementById('cardMessage').innerText = msg;

    const waBtn = document.getElementById('waShareResultBtn');
    if (waBtn) {
        waBtn.onclick = function() {
            const waText = `*AABFC Abacus Center*\n\nHello! I just completed the *${testTitle}* exam and scored *${sub.finalScore}/${totalQuestions} (${percentage}%)*! 🏆\n\n"${msg}"`;
            const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;
            window.open(waUrl, '_blank');
        };
    }

    const retakeBtn = document.getElementById('requestRetakeBtn');
    if (retakeBtn) {
        retakeBtn.onclick = async function() {
            if (!confirm("Send a request to the Admin to reset this test so you can try again?")) return;
            
            try {
                const res = await fetch(`${BASE_URL}/api/student/submissions/${subId}/request-retake`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (res.ok) {
                    alert("Retake request sent to Admin! Check back later.");
                    bootstrap.Modal.getInstance(document.getElementById('reviewModal')).hide();
                    loadDashboard();
                } else {
                    alert("Failed to send request.");
                }
            } catch (e) {
                alert("Network error.");
            }
        };
    }

    new bootstrap.Modal(document.getElementById('reviewModal')).show();
}

loadDashboard();