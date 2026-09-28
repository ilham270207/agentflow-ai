const $ = (id) => document.getElementById(id);
const goalInput = $("goalInput");
const generateBtn = $("generateBtn");
const modeBadge = $("modeBadge");
const projectSection = $("projectSection");
const emptyState = $("emptyState");
const taskList = $("taskList");
const historyList = $("historyList");
const errorBox = $("error");
let currentPlan = null;
let selectedTaskId = null;

const HISTORY_KEY = "agentflow-v12-history";
const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
};
const saveHistory = (items) => localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 8)));

function updateStats() {
  if (!currentPlan) return;
  const total = currentPlan.tasks.length;
  const completed = currentPlan.tasks.filter(t => t.done).length;
  const remaining = total - completed;
  const pct = total ? Math.round(completed / total * 100) : 0;
  $("totalStat").textContent = total;
  $("completedStat").textContent = completed;
  $("remainingStat").textContent = remaining;
  $("progressStat").textContent = `${pct}%`;
  $("progressLabel").textContent = `${pct}%`;
  $("progressBar").style.width = `${pct}%`;
}

function renderDetail(task) {
  if (!task) {
    $("detailEmpty").classList.remove("hidden");
    $("detailContent").classList.add("hidden");
    return;
  }
  $("detailEmpty").classList.add("hidden");
  $("detailContent").classList.remove("hidden");
  $("detailCategory").textContent = task.category || "Task";
  $("detailTitle").textContent = task.title;
  $("detailDescription").textContent = task.description;
  $("detailPriority").textContent = task.priority || "Medium";
  $("detailEstimate").textContent = task.estimate || "30–45 min";
  $("detailComplete").textContent = task.done ? "Mark as incomplete" : "Mark complete";
}

function renderTasks() {
  taskList.innerHTML = "";
  currentPlan.tasks.forEach(task => {
    const el = document.createElement("div");
    el.className = `task ${task.done ? "done" : ""} ${task.id === selectedTaskId ? "selected" : ""}`;
    el.innerHTML = `
      <button class="check" aria-label="Toggle task">${task.done ? "✓" : ""}</button>
      <div><h3>Day ${task.day} · ${escapeHtml(task.title)}</h3><p>${escapeHtml(task.description)}</p></div>
      <span class="day">${escapeHtml(task.estimate || "30–45 min")}</span>`;
    el.addEventListener("click", (e) => {
      if (e.target.closest(".check")) {
        task.done = !task.done;
        persistCurrent();
        renderTasks();
        updateStats();
        renderDetail(task);
      } else {
        selectedTaskId = task.id;
        renderTasks();
        renderDetail(task);
      }
    });
    taskList.appendChild(el);
  });
  updateStats();
}

function persistCurrent() {
  if (!currentPlan) return;
  const history = loadHistory();
  const snapshot = JSON.parse(JSON.stringify(currentPlan));
  const idx = history.findIndex(h => h.id === currentPlan.id);
  if (idx >= 0) history[idx] = snapshot;
  else history.unshift(snapshot);
  saveHistory(history);
  renderHistory();
}

function showPlan(plan) {
  currentPlan = plan;
  currentPlan.id = currentPlan.id || `${Date.now()}`;
  currentPlan.tasks = (currentPlan.tasks || []).map((t, i) => ({...t, id: t.id || `${currentPlan.id}-${i}`, done: Boolean(t.done)}));
  selectedTaskId = currentPlan.tasks[0]?.id || null;
  $("projectTitle").textContent = currentPlan.goal;
  $("projectSummary").textContent = currentPlan.summary || `${currentPlan.duration || currentPlan.tasks.length}-day workflow`;
  modeBadge.textContent = currentPlan.mode === "ai" ? "AI MODE" : "LOCAL DEMO";
  modeBadge.className = `badge ${currentPlan.mode === "ai" ? "ai" : ""}`;
  emptyState.classList.add("hidden");
  projectSection.classList.remove("hidden");
  renderTasks();
  renderDetail(currentPlan.tasks[0]);
  persistCurrent();
  projectSection.scrollIntoView({behavior:"smooth", block:"start"});
}

async function generate() {
  const goal = goalInput.value.trim();
  errorBox.textContent = "";
  if (!goal) {
    errorBox.textContent = "Enter a goal first.";
    goalInput.focus();
    return;
  }
  generateBtn.disabled = true;
  generateBtn.textContent = "Planning…";
  try {
    const res = await fetch("/api/plan", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({goal})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not generate workflow.");
    showPlan(data);
  } catch (err) {
    errorBox.textContent = err.message;
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = 'Generate workflow <span>→</span>';
  }
}

function renderHistory() {
  const items = loadHistory();
  historyList.innerHTML = "";
  if (!items.length) {
    historyList.innerHTML = '<div class="history-empty">No projects yet. Generate your first workflow above.</div>';
    return;
  }
  items.forEach(item => {
    const done = item.tasks.filter(t => t.done).length;
    const el = document.createElement("div");
    el.className = "history-item";
    el.innerHTML = `<div><strong>${escapeHtml(item.goal)}</strong><br><span>${done}/${item.tasks.length} tasks completed</span></div><span>Open →</span>`;
    el.addEventListener("click", () => showPlan(item));
    historyList.appendChild(el);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

generateBtn.addEventListener("click", generate);
goalInput.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") generate(); });
document.querySelectorAll("[data-goal]").forEach(btn => btn.addEventListener("click", () => {
  goalInput.value = btn.dataset.goal;
  goalInput.focus();
}));
$("detailComplete").addEventListener("click", () => {
  if (!currentPlan) return;
  const task = currentPlan.tasks.find(t => t.id === selectedTaskId);
  if (!task) return;
  task.done = !task.done;
  persistCurrent();
  renderTasks();
  renderDetail(task);
});
$("newPlanBtn").addEventListener("click", () => {
  goalInput.focus();
  window.scrollTo({top:0, behavior:"smooth"});
});
$("focusNav").addEventListener("click", () => projectSection.scrollIntoView({behavior:"smooth"}));
$("historyNav").addEventListener("click", () => $("historySection").scrollIntoView({behavior:"smooth"}));
$("clearHistoryBtn").addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});
$("resetBtn").addEventListener("click", () => {
  currentPlan = null;
  selectedTaskId = null;
  projectSection.classList.add("hidden");
  emptyState.classList.remove("hidden");
  goalInput.value = "";
  renderHistory();
  window.scrollTo({top:0, behavior:"smooth"});
});
renderHistory();
