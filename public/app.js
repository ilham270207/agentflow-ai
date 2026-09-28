const form = document.getElementById("goalForm");
const goal = document.getElementById("goal");
const counter = document.getElementById("counter");
const result = document.getElementById("result");
const tasks = document.getElementById("tasks");
const planTitle = document.getElementById("planTitle");
const planSummary = document.getElementById("planSummary");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const error = document.getElementById("error");
const generate = document.getElementById("generate");
const reset = document.getElementById("reset");
const modeLabel = document.getElementById("modeLabel");
const modeBadge = document.getElementById("modeBadge");
const totalTasks = document.getElementById("totalTasks");
const doneTasks = document.getElementById("doneTasks");
const remainingTasks = document.getElementById("remainingTasks");
const history = document.getElementById("history");
const historyList = document.getElementById("historyList");
const clearHistory = document.getElementById("clearHistory");

const HISTORY_KEY = "agentflow-history-v1";
let currentPlan = null;
let currentChecks = [];

goal.addEventListener("input", () => {
  counter.textContent = `${goal.value.length} / 1000`;
});

document.querySelectorAll("[data-example]").forEach(btn => {
  btn.addEventListener("click", () => {
    goal.value = btn.dataset.example;
    goal.dispatchEvent(new Event("input"));
    goal.focus();
  });
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const value = goal.value.trim();
  if (!value) return;

  setLoading(true);
  hideError();

  try {
    const response = await fetch("/api/plan", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ goal: value })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong.");

    renderPlan(data.plan, data.mode);
    saveHistory(data.plan, data.mode);
    result.classList.remove("hidden");
    result.scrollIntoView({behavior: "smooth", block: "start"});
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
});

function renderPlan(plan, mode = "local", checks = []) {
  currentPlan = plan;
  currentChecks = Array.isArray(checks) ? checks : [];
  planTitle.textContent = plan.title || "Your workflow";
  planSummary.textContent = plan.summary || "A practical workflow generated from your goal.";
  const isAI = mode === "ai";
  modeLabel.textContent = isAI ? "AI connected" : "Local agent ready";
  modeBadge.textContent = isAI ? "AI MODE" : "LOCAL DEMO";
  modeBadge.classList.toggle("ai", isAI);
  tasks.innerHTML = "";

  (plan.tasks || []).forEach((task, index) => {
    const el = document.createElement("label");
    el.className = "task";
    el.innerHTML = `
      <input type="checkbox" ${currentChecks[index] ? "checked" : ""} data-index="${index}">
      <span class="task-number">${String(index + 1).padStart(2, "0")}</span>
      <div class="task-body">
        <b>Day ${task.day ?? index + 1} · ${escapeHtml(task.title || "Task")}</b>
        <small>${escapeHtml(task.detail || "")}</small>
      </div>
      <span class="checkmark">✓</span>
    `;
    el.querySelector("input").addEventListener("change", updateProgress);
    tasks.appendChild(el);
  });
  updateProgress();
}

function updateProgress() {
  const boxes = [...tasks.querySelectorAll("input")];
  currentChecks = boxes.map(b => b.checked);
  const done = boxes.filter(b => b.checked).length;
  const total = boxes.length;
  const pct = total ? Math.round(done / total * 100) : 0;

  progressText.textContent = `${pct}%`;
  progressBar.style.width = `${pct}%`;
  totalTasks.textContent = total;
  doneTasks.textContent = done;
  remainingTasks.textContent = Math.max(0, total - done);

  boxes.forEach(box => box.closest(".task").classList.toggle("complete", box.checked));
  persistCurrentProgress();
}

function setLoading(loading) {
  generate.disabled = loading;
  generate.innerHTML = loading ? "Building plan…" : 'Generate workflow <span>→</span>';
}

function saveHistory(plan, mode) {
  const item = {
    id: Date.now(),
    plan,
    mode,
    checks: new Array(plan.tasks?.length || 0).fill(false)
  };
  const list = getHistory().filter(x => x.plan?.title !== plan.title);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([item, ...list].slice(0, 5)));
  renderHistory();
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function renderHistory() {
  const list = getHistory();
  history.classList.toggle("hidden", list.length === 0);
  historyList.innerHTML = "";
  list.forEach(item => {
    const button = document.createElement("button");
    button.className = "history-item";
    button.innerHTML = `<span>${escapeHtml(item.plan.title || "Untitled")}</span><small>${item.plan.tasks?.length || 0} tasks · ${item.mode === "ai" ? "AI" : "Local"}</small>`;
    button.addEventListener("click", () => {
      goal.value = item.plan.title || "";
      goal.dispatchEvent(new Event("input"));
      renderPlan(item.plan, item.mode, item.checks);
      result.classList.remove("hidden");
      result.scrollIntoView({behavior:"smooth", block:"start"});
    });
    historyList.appendChild(button);
  });
}

function persistCurrentProgress() {
  if (!currentPlan?.title) return;
  const list = getHistory();
  const item = list.find(x => x.plan?.title === currentPlan.title);
  if (item) {
    item.checks = currentChecks;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  }
}

reset.addEventListener("click", () => {
  result.classList.add("hidden");
  goal.value = "";
  goal.dispatchEvent(new Event("input"));
  goal.focus();
  window.scrollTo({top:0, behavior:"smooth"});
});

clearHistory.addEventListener("click", () => {
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
});

function showError(message) {
  error.textContent = message;
  error.classList.remove("hidden");
}
function hideError() {
  error.classList.add("hidden");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

renderHistory();
