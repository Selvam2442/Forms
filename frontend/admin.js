const token = localStorage.getItem('token');
if (!token) window.location.href = 'index.html';

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

// Chart Instances
let statusChartObj = null;
let scoreChartObj = null;

// ==========================================
// STUDENT DIRECTORY & QUIZ BUILDER 
// ==========================================
// (Standard student & test creation logic from before)
document.getElementById('createStudentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('studentName').value;
    try {
        const res = await fetch('https://forms-xg9n.onrender.com/api/admin/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: nameInput })
        });
        const data = await res.json();
        if (res.ok) {
            alert(`Student Created!\nName: ${data.student.name}\nID: ${data.student.rollNumber}\nPIN: ${data.student.pin}`);
            document.getElementById('studentName').value = '';
        }
    } catch (e) { alert("Server Error"); }
});

let isDraftMode = false;
function addQuestionCard() {
    const card = document.createElement('div');
    card.className = 'card border-0 bg-light p-3 my-2 position-relative rounded-3';
    card.style.borderLeft = '4px solid #4285f4';
    card.innerHTML = `
        <button type="button" class="btn btn-sm btn-link text-danger position-absolute top-0 end-0 remove-btn"><i class="fa-solid fa-trash"></i></button>
        <div class="row g-2 mt-1">
            <div class="col-8">
                <label class="text-muted small fw-bold">Vertical Stack (Commas)</label>
                <input type="text" class="form-control form-control-sm q-numbers" placeholder="5, 10, -3" required>
            </div>
            <div class="col-4">
                <label class="text-muted small fw-bold">Preview</label>
                <input type="text" class="form-control form-control-sm q-answer text-success fw-bold bg-white" readonly>
            </div>
        </div>
    `;
    card.querySelector('.q-numbers').addEventListener('input', (e) => {
        const sum = e.target.value.split(',').reduce((t, v) => t + (parseInt(v.trim()) || 0), 0);
        card.querySelector('.q-answer').value = e.target.value.trim() ? sum : '';
    });
    card.querySelector('.remove-btn').addEventListener('click', () => card.remove());
    document.getElementById('questionsContainer').appendChild(card);
}
addQuestionCard();
document.getElementById('addQuestionBtn').addEventListener('click', addQuestionCard);

document.getElementById('createTestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('testTitle').value;
    const timeLimit = document.getElementById('testTime').value;
    const questionsArray = [];
    document.querySelectorAll('.q-numbers').forEach(input => {
        if (input.value.trim()) questionsArray.push({ numbersArray: input.value.split(',').map(n => parseInt(n.trim(), 10)) });
    });
    try {
        const res = await fetch('http://127.0.0.1:5000/api/admin/tests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ title, timeLimitMinutes: parseInt(timeLimit), questions: questionsArray, isActive: !isDraftMode })
        });
        if (res.ok) {
            alert("Test Created!");
            document.getElementById('testTitle').value = '';
            document.getElementById('questionsContainer').innerHTML = '';
            addQuestionCard();
        }
    } catch (e) { alert("Server Error"); }
});

// ==========================================
// ANALYTICS & SUBMISSIONS & LEADERBOARD
// ==========================================
function renderCharts(submissions) {
    let pending = 0, graded = 0;
    const scoresByTest = {};

    submissions.forEach(sub => {
        if (sub.status === 'pending_review' || sub.status === 'retake_requested') pending++;
        else graded++;

        const testName = sub.testId ? sub.testId.title : 'Unknown';
        if (!scoresByTest[testName]) scoresByTest[testName] = { total: 0, count: 0 };
        scoresByTest[testName].total += sub.finalScore;
        scoresByTest[testName].count += 1;
    });

    // Destroy old charts if they exist
    if(statusChartObj) statusChartObj.destroy();
    if(scoreChartObj) scoreChartObj.destroy();

    // Pie Chart
    statusChartObj = new Chart(document.getElementById('statusChart'), {
        type: 'doughnut',
        data: {
            labels: ['Needs Review', 'Graded'],
            datasets: [{ data: [pending, graded], backgroundColor: ['#ffc107', '#198754'] }]
        },
        options: { plugins: { title: { display: true, text: 'Submission Status' } } }
    });

    // Bar Chart
    const testLabels = Object.keys(scoresByTest);
    const avgScores = testLabels.map(t => scoresByTest[t].total / scoresByTest[t].count);
    scoreChartObj = new Chart(document.getElementById('scoreChart'), {
        type: 'bar',
        data: {
            labels: testLabels,
            datasets: [{ label: 'Avg Score', data: avgScores, backgroundColor: '#0d6efd' }]
        },
        options: { plugins: { title: { display: true, text: 'Average Scores by Test' } } }
    });
}

async function renderReviewEcosystem() {
    try {
        const response = await fetch('http://127.0.0.1:5000/api/admin/submissions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const submissions = await response.json();
            renderCharts(submissions); // Trigger Chart.js

            const container = document.getElementById('submissionsContainer');
            container.innerHTML = ''; 

            submissions.forEach(sub => {
                let statusHtml = `<span class="badge bg-success"><i class="fa-solid fa-check me-1"></i>Approved</span>`;
                let actionHtml = `<div class="bg-light p-2 rounded small mt-2 fw-bold text-muted">Notes: ${sub.adminFeedback}</div>`;
                
                if (sub.status === 'pending_review') {
                    statusHtml = `<span class="badge bg-warning text-dark"><i class="fa-solid fa-clock me-1"></i>Awaiting</span>`;
                    actionHtml = `<button class="btn btn-primary btn-sm w-100 fw-bold mt-2" onclick="processApproval('${sub._id}')"><i class="fa-solid fa-check-double me-1"></i>Approve</button>`;
                } else if (sub.status === 'retake_requested') {
                    statusHtml = `<span class="badge bg-info text-dark"><i class="fa-solid fa-rotate-right me-1"></i>Retake Req</span>`;
                    actionHtml = `<button class="btn btn-info btn-sm w-100 text-white fw-bold mt-2" onclick="forceResetRetake('${sub._id}')">Grant Retake</button>`;
                }

                const card = document.createElement('div');
                card.className = 'col';
                card.innerHTML = `
                    <div class="card shadow-sm border-0 h-100 p-3 bg-white">
                        <div class="d-flex justify-content-between mb-1">
                            <span class="fw-bold text-dark small"><i class="fa-solid fa-user me-1"></i>${sub.studentName}</span>
                            ${statusHtml}
                        </div>
                        <div class="small text-muted mb-1">${sub.testId ? sub.testId.title : 'Deleted Test'}</div>
                        <div class="fw-bold text-primary">Score: ${sub.finalScore}</div>
                        ${actionHtml}
                        <button class="btn btn-link text-danger btn-sm w-100 mt-1" onclick="forceResetRetake('${sub._id}')" style="text-decoration:none;"><i class="fa-solid fa-eraser me-1"></i>Force Reset</button>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        // Fetch Grouped Leaderboard
        const leadRes = await fetch('http://127.0.0.1:5000/api/admin/leaderboard', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (leadRes.ok) {
            const groupedLeaders = await leadRes.json();
            const container = document.getElementById('adminLeaderboardContainer');
            container.innerHTML = '';

            for (const [testName, leaders] of Object.entries(groupedLeaders)) {
                const wrapper = document.createElement('div');
                wrapper.className = 'mb-3 card border-0 shadow-sm';
                
                let listHtml = `<div class="card-header bg-primary text-white fw-bold small">${testName}</div><ul class="list-group list-group-flush">`;
                
                leaders.forEach((entry, idx) => {
                    let iconColor = idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? '#cd7f32' : 'gray';
                    listHtml += `
                        <li class="list-group-item d-flex justify-content-between align-items-center p-2 small">
                            <span class="fw-bold"><i class="fa-solid fa-medal me-2" style="color: ${iconColor};"></i>${entry.studentName}</span>
                            <span class="badge bg-dark">${entry.finalScore} Pts</span>
                        </li>
                    `;
                });
                listHtml += `</ul>`;
                wrapper.innerHTML = listHtml;
                container.appendChild(wrapper);
            }
        }
    } catch (e) {}
}

window.processApproval = async function(id) {
    const note = prompt("Enter review notes:", "Excellent work!");
    if (note === null) return;
    await fetch(`http://127.0.0.1:5000/api/admin/submissions/${id}/approve`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ feedback: note })
    });
    renderReviewEcosystem();
};

window.forceResetRetake = async function(id) {
    if (!confirm("Delete submission and allow retake?")) return;
    await fetch(`http://127.0.0.1:5000/api/admin/submissions/${id}/reset`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
    });
    renderReviewEcosystem();
};

renderReviewEcosystem();