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

let currentConversation = null;

const CHAT_HISTORY_KEY = "agentflow-chat-history";

function loadChatHistory() {
  try {
    const history = JSON.parse(
      localStorage.getItem(CHAT_HISTORY_KEY) || "[]"
    );

    // Migrasi branding lama di chat history:
    // Planvora -> Umaira
    const migrated = history.map(conversation => ({
      ...conversation,
      title: typeof conversation.title === "string"
        ? conversation.title.replace(/Planvora|Planvra/gi, "Umaira")
        : conversation.title,
      messages: Array.isArray(conversation.messages)
        ? conversation.messages.map(message => ({
            ...message,
            content: typeof message.content === "string"
              ? message.content.replace(/Planvora|Planvra/gi, "Umaira")
              : message.content
          }))
        : conversation.messages
    }));

    localStorage.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify(migrated)
    );

    return migrated;
  } catch {
    return [];
  }
}

function saveChatHistory(items) {
  localStorage.setItem(
    CHAT_HISTORY_KEY,
    JSON.stringify(items.slice(0, 60))
  );
}

function createConversation(title = "New conversation") {
  const conversation = {
    id: `chat-${Date.now()}`,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };

  currentConversation = conversation;

  const history = loadChatHistory();
  history.unshift(conversation);
  saveChatHistory(history);

  return conversation;
}

function persistConversation() {
  if (!currentConversation) return;

  currentConversation.updatedAt = Date.now();

  const history = loadChatHistory();

  const index = history.findIndex(
    item => item.id === currentConversation.id
  );

  if (index >= 0) {
    history[index] = currentConversation;
  } else {
    history.unshift(currentConversation);
  }

  saveChatHistory(history);
}

function loadConversation(id) {
  const history = loadChatHistory();

  const conversation = history.find(
    item => item.id === id
  );

  if (!conversation) return null;

  currentConversation = conversation;
  return conversation;
}

function deleteConversation(id) {
  const history = loadChatHistory().filter(
    item => item.id !== id
  );

  saveChatHistory(history);

  if (currentConversation?.id === id) {
    currentConversation = null;
  }
}

function addChatMessage(role, content, attachments = []) {
  if (!currentConversation) {
    createConversation();
  }

  const message = {
    id: `msg-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    role,
    content: String(content || ""),
    createdAt: Date.now()
  };

  if (Array.isArray(attachments) && attachments.length) {
    message.attachments = attachments.map(file => ({
      name: String(file.name || "Attachment"),
      mimeType: String(file.mimeType || file.type || "application/octet-stream"),
      size: Number(file.size || 0)
    }));
  }

  currentConversation.messages.push(message);
  persistConversation();

  return message;
}

function getCurrentMessages() {
  return currentConversation?.messages || [];
}

function clearCurrentConversation() {
  if (!currentConversation) return;

  currentConversation.messages = [];
  currentConversation.title = "New conversation";
  currentConversation.updatedAt = Date.now();

  persistConversation();
}


const HISTORY_KEY = "agentflow-v12-history";
const loadHistory = () => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
};
const saveHistory = (items) => localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 8)));

function updateStats() {
  if (!currentPlan) return;
  syncTaskStates();
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
  $("detailComplete").textContent = task.done
    ? "Mark as incomplete"
    : "Mark complete";

  let editButton = $("detailEdit");

  if (!editButton) {
    editButton = document.createElement("button");
    editButton.id = "detailEdit";
    editButton.className = "secondary full";
    editButton.textContent = "Edit task";

    $("detailComplete").insertAdjacentElement("beforebegin", editButton);

    editButton.addEventListener("click", () => {
      const selectedTask = currentPlan?.tasks?.find(
        item => item.id === selectedTaskId
      );

      if (selectedTask) {
        openTaskEditor(selectedTask);
      }
    });
  }

  editButton.disabled = task.status === "blocked";

  let subtaskBox = $("detailSubtasks");

  if (!subtaskBox) {
    subtaskBox = document.createElement("div");
    subtaskBox.id = "detailSubtasks";
    subtaskBox.className = "detail-subtasks";
    $("detailContent").appendChild(subtaskBox);
  }

  const subtasks = Array.isArray(task.subtasks)
    ? task.subtasks
    : [];

  subtaskBox.innerHTML = subtasks.length
    ? `
      <div class="detail-subtasks-title">Subtasks</div>
      ${subtasks.map((subtask, index) => `
        <label class="detail-subtask ${subtask.done ? "done" : ""}">
          <input
            type="checkbox"
            data-detail-subtask="${index}"
            ${subtask.done ? "checked" : ""}
            ${task.status === "blocked" ? "disabled" : ""}
          >
          <span>${escapeHtml(subtask.title)}</span>
        </label>
      `).join("")}
    `
    : "";

  subtaskBox.querySelectorAll("[data-detail-subtask]").forEach(input => {
    input.addEventListener("change", () => {
      const index = Number(input.dataset.detailSubtask);

      if (!task.subtasks?.[index]) return;

      task.subtasks[index].done = input.checked;

      syncTaskStates();
      persistCurrent();
      renderTasks();
      renderDetail(task);
      updateStats();
    });
  });
}

function getTaskStatus(task) {
  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
  const allSubtasksDone =
    subtasks.length > 0 && subtasks.every(subtask => subtask.done);

  if (allSubtasksDone) return "completed";

  const dependencies = Array.isArray(task.dependsOn)
    ? task.dependsOn
    : [];

  if (!dependencies.length) return "ready";

  const blocked = dependencies.some(depIndex => {
    const dependency = currentPlan?.tasks?.[depIndex];
    if (!dependency) return false;

    const dependencySubtasks = Array.isArray(dependency.subtasks)
      ? dependency.subtasks
      : [];

    return !(
      dependency.done ||
      dependency.status === "completed" ||
      (
        dependencySubtasks.length > 0 &&
        dependencySubtasks.every(subtask => subtask.done)
      )
    );
  });

  return blocked ? "blocked" : "ready";
}

function taskProgress(task) {
  const subtasks = Array.isArray(task.subtasks)
    ? task.subtasks
    : [];

  if (!subtasks.length) {
    return task.done ? 100 : 0;
  }

  const completed = subtasks.filter(subtask => subtask.done).length;
  return Math.round((completed / subtasks.length) * 100);
}

function syncTaskStates() {
  if (!currentPlan) return;

  currentPlan.tasks.forEach(task => {
    const status = getTaskStatus(task);
    const progress = taskProgress(task);

    task.progress = progress;
    task.status = progress === 100 ? "completed" : status;
    task.done = progress === 100;
  });
}


function openTaskEditor(task) {
  if (!task) return;

  let modal = document.getElementById("taskEditorModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "taskEditorModal";
    modal.className = "task-editor-modal";
    document.body.appendChild(modal);
  }

  const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];

  modal.innerHTML = `
    <div class="task-editor-backdrop"></div>
    <div class="task-editor-card">
      <div class="task-editor-header">
        <div>
          <div class="task-editor-kicker">EDIT TASK</div>
          <h2>Edit task</h2>
        </div>
        <button class="task-editor-close" type="button">×</button>
      </div>

      <label>
        <span>Title</span>
        <input id="editorTaskTitle" type="text"
          value="${escapeHtml(task.title || "")}">
      </label>

      <label>
        <span>Description</span>
        <textarea id="editorTaskDescription" rows="4">${escapeHtml(task.description || "")}</textarea>
      </label>

      <div class="task-editor-grid">
        <label>
          <span>Priority</span>
          <select id="editorTaskPriority">
            ${["High", "Medium", "Low"].map(priority =>
              `<option value="${priority}" ${task.priority === priority ? "selected" : ""}>${priority}</option>`
            ).join("")}
          </select>
        </label>

        <label>
          <span>Estimate</span>
          <input id="editorTaskEstimate" type="text"
            value="${escapeHtml(task.estimate || "30–45 min")}">
        </label>
      </div>

      <div class="editor-subtasks">
        <div class="editor-subtasks-header">
          <strong>Subtasks</strong>
          <button id="editorAddSubtask" type="button" class="secondary small">
            + Add subtask
          </button>
        </div>

        <div id="editorSubtaskList"></div>
      </div>

      <div class="task-editor-actions">
        <button id="editorRegenerate" type="button" class="secondary">
          ↻ Regenerate task
        </button>

        <div class="task-editor-actions-right">
          <button id="editorCancel" type="button" class="secondary">
            Cancel
          </button>
          <button id="editorSave" type="button" class="primary">
            Save changes
          </button>
        </div>
      </div>
    </div>
  `;

  modal.classList.add("open");

  const subtaskList = modal.querySelector("#editorSubtaskList");

  function renderEditorSubtasks() {
    subtaskList.innerHTML = "";

    if (!subtasks.length) {
      subtaskList.innerHTML =
        '<div class="editor-empty">No subtasks yet.</div>';
      return;
    }

    subtasks.forEach((subtask, index) => {
      const row = document.createElement("div");
      row.className = "editor-subtask-row";

      row.innerHTML = `
        <input
          type="text"
          class="editor-subtask-input"
          data-index="${index}"
          value="${escapeHtml(subtask.title || "")}"
        >
        <button
          type="button"
          class="editor-subtask-delete"
          data-index="${index}"
          aria-label="Delete subtask"
        >×</button>
      `;

      subtaskList.appendChild(row);
    });
  }

  renderEditorSubtasks();

  modal.querySelector("#editorAddSubtask").addEventListener("click", () => {
    subtasks.push({
      id: `${task.id}-sub-${Date.now()}`,
      title: "New subtask",
      done: false
    });

    renderEditorSubtasks();

    const inputs = subtaskList.querySelectorAll(".editor-subtask-input");
    inputs[inputs.length - 1]?.focus();
  });

  subtaskList.addEventListener("click", (event) => {
    const button = event.target.closest(".editor-subtask-delete");
    if (!button) return;

    const index = Number(button.dataset.index);
    subtasks.splice(index, 1);
    renderEditorSubtasks();
  });

  function closeEditor() {
    modal.classList.remove("open");
  }

  modal.querySelector(".task-editor-close").addEventListener("click", closeEditor);
  modal.querySelector(".task-editor-backdrop").addEventListener("click", closeEditor);
  modal.querySelector("#editorCancel").addEventListener("click", closeEditor);

  modal.querySelector("#editorRegenerate").addEventListener("click", async () => {
    const button = modal.querySelector("#editorRegenerate");

    if (!currentPlan?.goal) {
      alert("Project goal is missing.");
      return;
    }

    button.disabled = true;
    button.textContent = "Regenerating...";

    try {
      const response = await fetch("/api/regenerate-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          goal: currentPlan.goal,
          task: {
            ...task,
            title: modal.querySelector("#editorTaskTitle").value.trim(),
            description: modal.querySelector("#editorTaskDescription").value.trim(),
            priority: modal.querySelector("#editorTaskPriority").value,
            estimate: modal.querySelector("#editorTaskEstimate").value.trim(),
            subtasks
          },
          contextTasks: currentPlan.tasks
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const regenerated = data.task;

      if (!regenerated) {
        throw new Error("No regenerated task returned.");
      }

      task.title = regenerated.title || task.title;
      task.description = regenerated.description || task.description;
      task.category = regenerated.category || task.category;
      task.priority = regenerated.priority || task.priority;
      task.estimate = regenerated.estimate || task.estimate;

      // Keep the existing dependency chain safe.
      task.dependsOn = Array.isArray(task.dependsOn)
        ? [...task.dependsOn]
        : [];

      if (Array.isArray(regenerated.subtasks)) {
        task.subtasks = regenerated.subtasks.map((subtask, index) => ({
          id: `${task.id}-sub-${Date.now()}-${index}`,
          title:
            typeof subtask === "string"
              ? subtask
              : String(subtask?.title || "Subtask"),
          done: false
        }));
      }

      syncTaskStates();
      persistCurrent();
      renderTasks();
      renderDetail(task);

      closeEditor();

      console.log(
        `Task regenerated using ${data.mode === "ai" ? "AI" : "local fallback"} mode.`
      );

    } catch (error) {
      console.error("Regenerate task failed:", error);
      alert("Failed to regenerate task. Please try again.");
    } finally {
      button.disabled = false;
      button.textContent = "↻ Regenerate task";
    }
  });

  modal.querySelector("#editorSave").addEventListener("click", () => {
    const title = modal.querySelector("#editorTaskTitle").value.trim();
    const description = modal.querySelector("#editorTaskDescription").value.trim();
    const priority = modal.querySelector("#editorTaskPriority").value;
    const estimate = modal.querySelector("#editorTaskEstimate").value.trim();

    if (!title) {
      alert("Task title cannot be empty.");
      return;
    }

    subtasks.forEach((subtask, index) => {
      const input = subtaskList.querySelector(
        `.editor-subtask-input[data-index="${index}"]`
      );

      if (input) {
        subtask.title = input.value.trim() || "Untitled subtask";
      }
    });

    task.title = title;
    task.description = description;
    task.priority = priority;
    task.estimate = estimate || "30–45 min";
    task.subtasks = subtasks;

    syncTaskStates();
    persistCurrent();
    renderTasks();
    renderDetail(task);

    closeEditor();
  });
}

function renderTasks() {
  if (!currentPlan) return;

  syncTaskStates();

  taskList.innerHTML = "";

  currentPlan.tasks.forEach((task, taskIndex) => {
    const subtasks = Array.isArray(task.subtasks)
      ? task.subtasks
      : [];

    const completedSubtasks = subtasks.filter(subtask => subtask.done).length;
    const progress = taskProgress(task);
    const status = task.status || getTaskStatus(task);

    const statusLabel = {
      ready: "READY",
      blocked: "BLOCKED",
      completed: "COMPLETED"
    }[status] || "READY";

    const dependencyText = Array.isArray(task.dependsOn) && task.dependsOn.length
      ? `Requires Day ${task.dependsOn.map(index => index + 1).join(", ")}`
      : "";

    const el = document.createElement("div");

    el.className =
      `task ${task.done ? "done" : ""} ` +
      `${status === "blocked" ? "task-blocked" : ""} ` +
      `${status === "completed" ? "task-completed" : ""} ` +
      `${task.id === selectedTaskId ? "selected" : ""}`;

    const subtasksHtml = subtasks.length
      ? `
        <div class="subtask-list">
          ${subtasks.map((subtask, subIndex) => `
            <label class="subtask ${subtask.done ? "done" : ""}">
              <input
                type="checkbox"
                class="subtask-check"
                data-task-index="${taskIndex}"
                data-subtask-index="${subIndex}"
                ${subtask.done ? "checked" : ""}
                ${status === "blocked" ? "disabled" : ""}
              >
              <span>${escapeHtml(subtask.title)}</span>
            </label>
          `).join("")}
        </div>
      `
      : "";

    el.innerHTML = `
      <div class="task-main">
        <button
          class="check"
          aria-label="Toggle task"
          ${status === "blocked" ? "disabled" : ""}
        >${task.done ? "✓" : ""}</button>

        <div class="task-body">
          <div class="task-heading">
            <h3>Day ${task.day} · ${escapeHtml(task.title)}</h3>
            <span class="task-status status-${status}">${statusLabel}</span>
          </div>

          <p>${escapeHtml(task.description)}</p>

          <div class="task-meta">
            <span>${escapeHtml(task.category || "Task")}</span>
            <span>${escapeHtml(task.priority || "Medium")}</span>
            <span>${escapeHtml(task.estimate || "30–45 min")}</span>
          </div>

          ${
            subtasks.length
              ? `
                <div class="subtask-progress">
                  <div class="subtask-progress-top">
                    <span>Subtasks</span>
                    <strong>${completedSubtasks}/${subtasks.length}</strong>
                  </div>
                  <div class="subtask-progress-bar">
                    <div style="width:${progress}%"></div>
                  </div>
                </div>
              `
              : ""
          }

          ${dependencyText ? `
            <div class="task-dependency">
              ${status === "blocked" ? "🔒" : "↳"} ${dependencyText}
            </div>
          ` : ""}

          ${subtasksHtml}
        </div>

        <span class="day">${escapeHtml(task.estimate || "30–45 min")}</span>
      </div>
    `;

    el.addEventListener("click", (e) => {
      const subtaskInput = e.target.closest(".subtask-check");

      if (subtaskInput) {
        e.stopPropagation();

        if (status === "blocked") return;

        const subtaskIndex = Number(subtaskInput.dataset.subtaskIndex);
        const selectedTaskIndex = Number(subtaskInput.dataset.taskIndex);
        const selectedTask = currentPlan.tasks[selectedTaskIndex];

        if (!selectedTask || !selectedTask.subtasks?.[subtaskIndex]) {
          return;
        }

        selectedTask.subtasks[subtaskIndex].done =
          subtaskInput.checked;

        syncTaskStates();
        persistCurrent();
        renderTasks();
        updateStats();
        renderDetail(selectedTask);
        return;
      }

      if (e.target.closest(".check")) {
        if (status === "blocked") return;

        if (Array.isArray(task.subtasks) && task.subtasks.length) {
          const newValue = !task.done;

          task.subtasks.forEach(subtask => {
            subtask.done = newValue;
          });
        } else {
          task.done = !task.done;
        }

        syncTaskStates();
        persistCurrent();
        renderTasks();
        updateStats();
        renderDetail(task);
        return;
      }

      selectedTaskId = task.id;
      renderTasks();
      renderDetail(task);
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

/*
 * Umaira AI
 * Legacy Planner UI initialization disabled.
 *
 * Planner/Workflow UI sudah dihapus dari index.html.
 * Fungsi Planner lama tetap berada di file untuk sementara,
 * tetapi tidak boleh menghentikan Chat Engine.
 */

console.log("Umaira AI: legacy Planner UI disabled.");

/* Umaira v1.4 — Chat Messaging */

function formatChatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderChatMarkdown(content) {
  const text = String(content || "");

  const codeBlocks = [];

  let safe = escapeHtml(text);

  /*
   * Bersihkan whitespace pada teks normal.
   * Jangan menyentuh isi code block karena indentation
   * di dalam kode bisa memiliki arti.
   */
  safe = safe.replace(
    /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g,
    (_, language, code) => {
      const index = codeBlocks.length;

      codeBlocks.push({
        language: language || "code",
        code: code.replace(/^\n+|\n+$/g, "")
      });

      return `@@CODE_BLOCK_${index}@@`;
    }
  );

  // Rapikan spasi/tab yang tidak diperlukan di awal baris teks.
  safe = safe.replace(
    /^[ \t]+(?=\S)/gm,
    ""
  );

  // Rapikan whitespace berlebih di akhir baris.
  safe = safe.replace(
    /[ \t]+$/gm,
    ""
  );

  // Inline code.
  safe = safe.replace(
    /`([^`\n]+)`/g,
    "<code>$1</code>"
  );

  // Headings.
  safe = safe.replace(
    /^### (.+)$/gm,
    "<h5>$1</h5>"
  );

  safe = safe.replace(
    /^## (.+)$/gm,
    "<h4>$1</h4>"
  );

  safe = safe.replace(
    /^# (.+)$/gm,
    "<h3>$1</h3>"
  );

  // Bold.
  safe = safe.replace(
    /\*\*(.+?)\*\*/g,
    "<strong>$1</strong>"
  );

  // Italic.
  safe = safe.replace(
    /(^|[^\*])\*([^*\n]+)\*/g,
    "$1<em>$2</em>"
  );

  // Daftar tidak berurut (rapi).
  safe = safe.replace(/(?:^[-*] .+(?:\n|$))+/gm, block => {
    const items = block.replace(/\n+$/, "").split("\n")
      .map(line => "<li>" + line.replace(/^[-*] /, "") + "</li>").join("");
    return "<ul>" + items + "</ul>\n";
  });

  // Daftar berurut.
  safe = safe.replace(/(?:^\d+\. .+(?:\n|$))+/gm, block => {
    const items = block.replace(/\n+$/, "").split("\n")
      .map(line => "<li>" + line.replace(/^\d+\. /, "") + "</li>").join("");
    return "<ol>" + items + "</ol>\n";
  });

  safe = safe.replace(/\n{3,}/g, "\n\n");

  // Buang baris baru di sekitar elemen blok agar tidak jadi <br> ekstra.
  safe = safe.replace(/\s*(<\/?(?:h3|h4|h5|ul|ol|li)>)\s*/g, "$1");
  safe = safe.replace(/\s*(@@CODE_BLOCK_\d+@@)\s*/g, "$1");

  safe = safe.replace(/\n\n/g, "<br><br>");
  safe = safe.replace(/\n/g, "<br>");

  // Kembalikan code block (satu baris, tanpa whitespace ekstra).
  // Isi kode sudah di-escape di awal fungsi, jadi tidak di-escape lagi.
  codeBlocks.forEach((block, index) => {
    const codeHtml =
      '<div class="chat-code-block"><div class="chat-code-header"><span>' +
      block.language +
      '</span><button type="button" class="copy-code-btn" data-code-index="' + index +
      '">Copy</button></div><pre><code>' + block.code + '</code></pre></div>';
    safe = safe.replace("@@CODE_BLOCK_" + index + "@@", () => codeHtml);
  });

  return safe.trim();
}

function showTypingIndicator() {
  const container = $("chatMessages");

  if (!container || $("umaIraTypingIndicator")) {
    return;
  }

  const indicator = document.createElement("div");

  indicator.id = "umaIraTypingIndicator";
  indicator.className = "chat-message assistant typing-message";

  indicator.innerHTML = `
    <div
      class="chat-bubble typing-bubble"
      aria-label="Umaira sedang mengetik"
      role="status"
    >
      <span class="typing-label">Umaira</span>

      <span class="typing-dots" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </div>
  `;

  container.appendChild(indicator);
  container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
  const indicator = $("umaIraTypingIndicator");

  if (indicator) {
    indicator.remove();
  }
}

async function regenerateLastResponse() {
  ensureConversation();

  const messages = getCurrentMessages();

  if (!messages.length) {
    return;
  }

  const lastIndex = messages.length - 1;
  const lastMessage = messages[lastIndex];

  if (!lastMessage || lastMessage.role !== "assistant") {
    return;
  }

  const requestMessages = messages.slice(0, lastIndex);

  if (!requestMessages.length) {
    return;
  }

  const regenerateButton = document.querySelector(".regenerate-button");

  if (regenerateButton) {
    regenerateButton.disabled = true;
    regenerateButton.textContent = "Generating...";
  }

  showTypingIndicator();

  try {
    const projectContext = buildUmairaChatContext();

    const apiResponse = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: requestMessages,
        projectContext
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`HTTP ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    const response = String(data.message || "").trim();

    if (!response) {
      throw new Error("Umaira returned an empty response.");
    }

    currentConversation.messages[lastIndex].content = response;

    persistConversation();
    renderChatMessages();
    renderChatHistory();

    console.log("UMAIRA: response regenerated successfully");
  } catch (error) {
    console.error("UMAIRA: regenerate failed", error);

    if (regenerateButton) {
      regenerateButton.disabled = false;
      regenerateButton.textContent = "Regenerate";
    }

    hideTypingIndicator();

    const errorMessage =
      "⚠️ Saya belum berhasil membuat ulang respons. Silakan coba lagi.";

    currentConversation.messages[lastIndex].content = errorMessage;

    persistConversation();
    renderChatMessages();
    renderChatHistory();

    return;
  }

  hideTypingIndicator();
}

function renderMessageAttachments(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) {
    return "";
  }

  return `
    <div class="chat-attachments">
      ${attachments.map(file => {
        const isImage = String(file.mimeType || "").startsWith("image/");
        const icon = isImage ? "🖼️" : getAttachmentIcon({
          type: String(file.mimeType || "")
        });

        return `
          <div class="chat-attachment-item">
            <span class="chat-attachment-icon">${icon}</span>
            <span class="chat-attachment-info">
              <strong>${escapeHtml(file.name || "Attachment")}</strong>
              <small>${formatAttachmentSize(file.size || 0)}</small>
            </span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderChatMessages() {
  const container = $("chatMessages");

  if (!container) return;

  const messages = getCurrentMessages();

  if (!messages.length) {
    container.innerHTML = `
      <div class="chat-empty umaira-empty"><div class="umaira-orb" aria-hidden="true"><img src="assets/umaira-logo.svg" alt="" width="84" height="84"></div><h2>Selamat datang di Umaira AI ✨</h2><p>Aku siap menemanimu hari ini—mulai dari mencari ide, belajar hal baru, menyelesaikan pekerjaan, hingga membangun proyek impianmu.</p><p>Mau kita mulai dari mana hari ini?</p></div>
    `;
    return;
  }

  const lastIndex = messages.length - 1;

  container.innerHTML = messages.map((message, index) => {
    const isLastAssistant =
      index === lastIndex &&
      message.role === "assistant";

    const isAssistant =
      message.role === "assistant";

    return `
      <div class="chat-message ${message.role}">
        <div class="chat-response-wrapper">
          <div class="chat-bubble">${String(renderMessageAttachments(message.attachments)).trim()}${String(renderChatMarkdown(message.content)).trim()}</div>

          ${
            isAssistant
              ? `
                <div class="chat-message-actions">
                  <button
                    type="button"
                    class="copy-response-button"
                    data-message-index="${index}"
                    aria-label="Copy response"
                  >
                    Copy
                  </button>

                  ${
                    isLastAssistant
                      ? `
                        <button
                          type="button"
                          class="regenerate-button"
                          aria-label="Regenerate response"
                        >
                          ↻ Regenerate
                        </button>
                      `
                      : ""
                  }
                </div>
              `
              : ""
          }
        </div>
      </div>
    `;
  }).join("");

  setupChatCodeCopy();
  setupCopyResponseButtons();
  setupRegenerateButton();

  container.scrollTop = container.scrollHeight;
}

async function copyChatResponse(button) {
  const index = Number(button.dataset.messageIndex);
  const messages = getCurrentMessages();
  const message = messages[index];

  if (!message || message.role !== "assistant") {
    return;
  }

  const text = String(message.content || "");

  if (!text) {
    return;
  }

  const originalText = button.textContent;

  try {
    if (
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error("Clipboard API unavailable");
    }

    button.textContent = "✓ Copied";

    setTimeout(() => {
      button.textContent = originalText;
    }, 1200);

    console.log("UMAIRA: response copied successfully");
  } catch (error) {
    console.warn("Clipboard API failed, using fallback:", error);

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      const copied = document.execCommand("copy");

      if (!copied) {
        throw new Error("Fallback copy command failed");
      }

      button.textContent = "✓ Copied";

      setTimeout(() => {
        button.textContent = originalText;
      }, 1200);

      console.log("UMAIRA: response copied using fallback");
    } catch (fallbackError) {
      console.error("UMAIRA: response copy failed", fallbackError);

      button.textContent = "Copy failed";

      setTimeout(() => {
        button.textContent = originalText;
      }, 1500);
    } finally {
      textarea.remove();
    }
  }
}

function setupCopyResponseButtons() {
  document.querySelectorAll(".copy-response-button").forEach(button => {
    button.addEventListener("click", () => {
      copyChatResponse(button);
    });
  });
}

function setupRegenerateButton() {
  document.querySelectorAll(".regenerate-button").forEach(button => {
    button.addEventListener("click", () => {
      regenerateLastResponse();
    });
  });
}

async function copyCodeToClipboard(code) {
  if (!code) {
    throw new Error("Empty code");
  }

  if (
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    await navigator.clipboard.writeText(code);
    return;
  }

  throw new Error("Clipboard API unavailable");
}

function copyCodeFallback(code) {
  const textarea = document.createElement("textarea");

  textarea.value = code;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);

  textarea.focus();
  textarea.select();

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch (error) {
    console.warn("Code copy fallback failed:", error);
  }

  textarea.remove();

  if (!copied) {
    throw new Error("Code copy fallback failed");
  }
}

function setupChatCodeCopy() {
  document.querySelectorAll(".chat-code-copy").forEach(button => {
    button.addEventListener("click", async () => {
      const code = button.dataset.code || "";

      if (!code) {
        return;
      }

      const originalText = button.textContent || "Copy";

      button.disabled = true;

      try {
        try {
          await copyCodeToClipboard(code);
        } catch (clipboardError) {
          console.warn(
            "Clipboard API unavailable for code copy, using fallback:",
            clipboardError
          );

          copyCodeFallback(code);
        }

        button.textContent = "✓ Copied";

        console.log("UMAIRA: code copied successfully");

        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 1200);

      } catch (error) {
        console.error("UMAIRA: code copy failed:", error);

        button.textContent = "Copy failed";

        setTimeout(() => {
          button.textContent = originalText;
          button.disabled = false;
        }, 1500);
      }
    });
  });
}

function renderChatHistory() {
  const container = $("chatHistoryList");
  if (!container) return;

  const showArchived = window.__umairaShowArchived === true;
  const searchEl = $("chatSearchInput");
  const query = String(searchEl ? searchEl.value : "").trim().toLowerCase();
  const all = loadChatHistory();
  const archivedTotal = all.filter(c => c.archived).length;

  let list = all.filter(c => Boolean(c.archived) === showArchived);
  if (query) {
    list = list.filter(c =>
      String(c.title || "").toLowerCase().includes(query) ||
      (Array.isArray(c.messages) && c.messages.some(m =>
        typeof m.content === "string" && m.content.toLowerCase().includes(query)))
    );
  }
  list.sort((a, b) =>
    Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
    (b.updatedAt || 0) - (a.updatedAt || 0));

  const DAY = 86400000;
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const today0 = d0.getTime();
  const groupOf = c => {
    if (c.pinned && !showArchived) return "Disematkan";
    const t = c.updatedAt || 0;
    if (t >= today0) return "Hari ini";
    if (t >= today0 - DAY) return "Kemarin";
    if (t >= today0 - 7 * DAY) return "7 hari terakhir";
    return "Lebih lama";
  };
  const order = ["Disematkan", "Hari ini", "Kemarin", "7 hari terakhir", "Lebih lama"];
  const groups = {};
  list.forEach(c => {
    const g = groupOf(c);
    (groups[g] = groups[g] || []).push(c);
  });

  const rowHtml = c => {
    const id = escapeHtml(c.id);
    const active = currentConversation && currentConversation.id === c.id;
    const count = Array.isArray(c.messages) ? c.messages.length : 0;
    return `
      <div class="chat-history-row ${active ? "active" : ""}" data-chat-row="${id}">
        <button type="button" class="chat-history-item" data-chat-id="${id}">
          <span class="chat-history-icon ${c.pinned ? "is-pinned" : ""}">${c.pinned ? "⌖" : "◈"}</span>
          <span class="chat-history-content">
            <span class="chat-history-title">${escapeHtml(c.title || "New conversation")}</span>
            <span class="chat-history-meta">${escapeHtml(formatChatTime(c.updatedAt))}${count ? ` · ${count} pesan` : ""}</span>
          </span>
        </button>
      </div>`;
  };

  let out = "";
  if (archivedTotal > 0 || showArchived) {
    out += `<button type="button" class="chat-archive-toggle" data-archive-toggle="1">${
      showArchived ? "← Kembali ke obrolan" : "▣ Lihat arsip (" + archivedTotal + ")"}</button>`;
  }

  if (!list.length) {
    const msg = query ? "Tidak ada obrolan yang cocok."
      : showArchived ? "Belum ada obrolan yang diarsipkan." : "Belum ada obrolan.";
    out += `<div class="chat-history-empty"><div class="chat-history-empty-icon">✦</div><span>${msg}</span></div>`;
  } else {
    order.forEach(g => {
      if (!groups[g]) return;
      out += `<div class="chat-history-group">${g}</div>` + groups[g].map(rowHtml).join("");
    });
  }
  container.innerHTML = out;
  umairaBindChatHistory(container);
}

function umairaSyncCurrent(conversation) {
  if (currentConversation && conversation && currentConversation.id === conversation.id) {
    currentConversation.title = conversation.title;
    currentConversation.pinned = conversation.pinned;
    currentConversation.archived = conversation.archived;
  }
}

function umairaPickAfterRemoval() {
  const remaining = loadChatHistory().filter(c => !c.archived);
  if (remaining.length) loadConversation(remaining[0].id);
  else createConversation();
}

function umairaBindChatHistory(container) {
  if (container.dataset.bound === "1") return;
  container.dataset.bound = "1";

  container.addEventListener("click", async event => {
    const target = event.target;

    if (target.closest("[data-archive-toggle]")) {
      window.__umairaShowArchived = !(window.__umairaShowArchived === true);
      renderChatHistory();
      return;
    }

    const menuBtn = target.closest("[data-chat-menu]");
    if (menuBtn) {
      event.stopPropagation();
      const id = menuBtn.dataset.chatMenu;
      const menu = container.querySelector(`[data-menu-for="${CSS.escape(id)}"]`);
      if (!menu) return;
      const wasHidden = menu.hidden;
      container.querySelectorAll(".chat-history-menu").forEach(m => { m.hidden = true; });
      if (wasHidden) {
        menu.hidden = false;
        const r = menuBtn.getBoundingClientRect();
        const mw = menu.offsetWidth || 220;
        const mh = menu.offsetHeight || 260;
        let top = r.bottom + 4;
        if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
        let left = Math.min(r.right - mw, window.innerWidth - mw - 8);
        left = Math.max(8, left);
        menu.style.top = top + "px";
        menu.style.left = left + "px";
      }
      return;
    }

    const actBtn = target.closest("[data-chat-action]");
    if (actBtn) {
      event.stopPropagation();
      const id = actBtn.dataset.chatActionId;
      const action = actBtn.dataset.chatAction;
      const historyNow = loadChatHistory();
      const conversation = historyNow.find(c => c.id === id);
      if (!conversation) return;
      container.querySelectorAll(".chat-history-menu").forEach(m => { m.hidden = true; });

      if (action === "rename") {
        const next = window.prompt("Nama obrolan baru:", conversation.title || "New conversation");
        if (!next || !next.trim()) return;
        conversation.title = next.trim().slice(0, 80);
        saveChatHistory(historyNow);
        umairaSyncCurrent(conversation);
      } else if (action === "pin") {
        conversation.pinned = !conversation.pinned;
        saveChatHistory(historyNow);
        umairaSyncCurrent(conversation);
      } else if (action === "archive") {
        conversation.archived = !conversation.archived;
        saveChatHistory(historyNow);
        umairaSyncCurrent(conversation);
        if (conversation.archived && currentConversation && currentConversation.id === id) {
          umairaPickAfterRemoval();
        }
      } else if (action === "delete") {
        if (!window.confirm(`Hapus percakapan "${conversation.title || "New conversation"}"?`)) return;
        deleteConversation(id);
        if (!currentConversation) umairaPickAfterRemoval();
      } else if (action === "share") {
        const text = (conversation.messages || []).map(m =>
          `${m.role === "user" ? "Saya" : "Umaira AI"}:\n${typeof m.content === "string" ? m.content : ""}`
        ).join("\n\n");
        try {
          if (navigator.share) {
            await navigator.share({ title: conversation.title || "Obrolan Umaira AI", text });
          } else {
            await navigator.clipboard.writeText(text);
            window.alert("Isi obrolan disalin ke clipboard.");
          }
        } catch (error) {
          if (!error || error.name !== "AbortError") {
            window.alert("Obrolan belum bisa dibagikan. Coba lagi.");
          }
        }
        return;
      } else if (action === "files") {
        const names = (conversation.messages || [])
          .flatMap(m => Array.isArray(m.attachments) ? m.attachments : [])
          .map(f => f.name || f.filename || "Lampiran");
        window.alert(names.length
          ? "File dalam obrolan:\n\n" + [...new Set(names)].join("\n")
          : "Belum ada file yang tercatat di obrolan ini.");
        return;
      }

      renderChatHistory();
      if (currentConversation) {
        renderChatMessages();
        const title = $("chatTitle");
        if (title) title.textContent = currentConversation.title || "New conversation";
      }
      return;
    }

    const item = target.closest("[data-chat-id]");
    if (item) {
      const conversation = loadConversation(item.dataset.chatId);
      if (!conversation) return;
      const chatNav = document.querySelector('.nav-item[data-view="chat"]');
      if (chatNav) chatNav.click();
      renderChatMessages();
      renderChatHistory();
      const title = $("chatTitle");
      if (title) title.textContent = conversation.title || "New conversation";
      document.body.classList.remove("sidebar-open");
    }
  });
}

function ensureConversation() {
  if (!currentConversation) {
    createConversation();
  }

  renderChatHistory();

  const title = $("chatTitle");

  if (title) {
    title.textContent =
      currentConversation?.title || "New conversation";
  }
}

function localChatResponse(message) {
  const text = String(message || "").toLowerCase();

  if (
    text.includes("markdown") ||
    text.includes("code block") ||
    text.includes("contoh kode") ||
    text.includes("test markdown")
  ) {
    return `# Markdown Test

Markdown **sudah aktif** di Umaira.

## Formatting

Kita bisa menggunakan **bold**, *italic*, dan \`inline code\`.

### Contoh JavaScript

Berikut contoh code block:

\`\`\`javascript
const project = "Umaira";

function greet(name) {
  return \`Halo, \${name}!\`;
}

console.log(greet(project));
\`\`\`

### Checklist

- Markdown heading
- **Bold text**
- *Italic text*
- Inline \`code\`
- Code block
- JavaScript syntax

Jika semuanya tampil dengan benar, renderer Markdown berhasil.`;
  }

  if (text.includes("task") || text.includes("tugas")) {
    return "I can help you break down tasks, review progress, and improve your workflow.";
  }

  if (
    text.includes("plan") ||
    text.includes("planning") ||
    text.includes("rencana")
  ) {
    return "I can help you create a practical plan with clear steps, priorities, dependencies, and estimates.";
  }

  if (
    text.includes("code") ||
    text.includes("coding") ||
    text.includes("javascript")
  ) {
    return "I can help explain code, find bugs, suggest improvements, and plan implementation steps.";
  }

  if (currentPlan) {
    return `Your current project is "${currentPlan.goal}". I can help you work through its tasks and decide what to do next.`;
  }

  return "I'm ready to help. Tell me what you're working on or what you want to accomplish.";
}

function wantsPlannerAction(text) {
  const value = String(text || "").toLowerCase().trim();

  const triggers = [
    "masukkan ke planner",
    "masukan ke planner",
    "tambahkan ke planner",
    "tambah ke planner",
    "terapkan ke planner",
    "apply ke planner",
    "masukkan ke project",
    "tambahkan ke project"
  ];

  return triggers.some(trigger => value.includes(trigger));
}

function wantsRegenerateTask(text) {
  const value = String(text || "").toLowerCase().trim();

  const triggers = [
    "regenerate task",
    "regenerate tugas",
    "buat ulang task",
    "buat ulang tugas",
    "generate ulang task",
    "generate ulang tugas"
  ];

  return triggers.some(trigger => value.includes(trigger));
}

async function applyChatTaskToPlanner() {
  if (!currentPlan) {
    return {
      ok: false,
      message:
        "Belum ada Planner aktif. Buat atau buka project Planner terlebih dahulu."
    };
  }

  const messages = getCurrentMessages();

  const projectContext = JSON.stringify({
    goal: currentPlan.goal,
    summary: currentPlan.summary,
    tasks: currentPlan.tasks
  });

  const apiResponse = await fetch("/api/chat-action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "add_task",
      messages,
      projectContext
    })
  });

  if (!apiResponse.ok) {
    throw new Error(`HTTP ${apiResponse.status}`);
  }

  const data = await apiResponse.json();

  if (!data.task || !data.task.title) {
    throw new Error("Planner action returned no task.");
  }

  const taskIndex = currentPlan.tasks.length;

  const dependsOn = Array.isArray(data.task.dependsOn)
    ? data.task.dependsOn.filter(
        index =>
          Number.isInteger(index) &&
          index >= 0 &&
          index < taskIndex
      )
    : [];

  const newTask = {
    id: `${currentPlan.id}-${Date.now()}-${taskIndex}`,
    day: taskIndex + 1,
    title: String(data.task.title),
    description: String(data.task.description || ""),
    category: String(data.task.category || "General"),
    priority: ["High", "Medium", "Low"].includes(data.task.priority)
      ? data.task.priority
      : "Medium",
    estimate: String(data.task.estimate || "30–45 min"),
    status: dependsOn.length ? "blocked" : "ready",
    done: false,
    dependsOn,
    subtasks: Array.isArray(data.task.subtasks)
      ? data.task.subtasks.map((subtask, index) => ({
          id: `${currentPlan.id}-${Date.now()}-${taskIndex}-sub-${index}`,
          title: String(subtask),
          done: false
        }))
      : []
  };

  currentPlan.tasks.push(newTask);

  selectedTaskId = newTask.id;

  syncTaskStates();
  persistCurrent();
  renderTasks();
  renderDetail(newTask);

  return {
    ok: true,
    task: newTask
  };
}

function wantsDeleteTask(text) {
  const value = String(text || "").toLowerCase().trim();

  const triggers = [
    "delete task",
    "delete tugas",
    "hapus task",
    "hapus tugas",
    "hapus task ini",
    "hapus tugas ini"
  ];

  return triggers.some(trigger => value.includes(trigger));
}

async function applyChatDeleteTaskToPlanner() {
  if (!currentPlan) {
    return {
      ok: false,
      message:
        "Belum ada Planner aktif. Buat atau buka project Planner terlebih dahulu."
    };
  }

  if (!selectedTaskId) {
    return {
      ok: false,
      message:
        "Pilih task yang ingin dihapus terlebih dahulu."
    };
  }

  const index = currentPlan.tasks.findIndex(
    item => item.id === selectedTaskId
  );

  if (index === -1) {
    return {
      ok: false,
      message:
        "Task yang dipilih tidak ditemukan di Planner."
    };
  }

  const deletedTask = currentPlan.tasks[index];

  currentPlan.tasks.splice(index, 1);

  selectedTaskId =
    currentPlan.tasks[index]?.id ||
    currentPlan.tasks[index - 1]?.id ||
    currentPlan.tasks[0]?.id ||
    null;

  syncTaskStates();
  persistCurrent();
  renderTasks();

  if (selectedTaskId) {
    const nextTask = currentPlan.tasks.find(
      item => item.id === selectedTaskId
    );
    renderDetail(nextTask);
  } else {
    renderDetail(null);
  }

  return {
    ok: true,
    task: deletedTask
  };
}

function wantsEditTask(text) {
  const value = String(text || "").toLowerCase().trim();

  const triggers = [
    "edit task",
    "edit tugas",
    "ubah task",
    "ubah tugas",
    "ubah task ini",
    "ubah tugas ini"
  ];

  return triggers.some(trigger => value.includes(trigger));
}

async function applyChatEditTaskToPlanner(instruction) {
  if (!currentPlan) {
    return {
      ok: false,
      message:
        "Belum ada Planner aktif. Buat atau buka project Planner terlebih dahulu."
    };
  }

  if (!selectedTaskId) {
    return {
      ok: false,
      message:
        "Pilih task yang ingin diedit terlebih dahulu."
    };
  }

  const task = currentPlan.tasks.find(
    item => item.id === selectedTaskId
  );

  if (!task) {
    return {
      ok: false,
      message:
        "Task yang dipilih tidak ditemukan di Planner."
    };
  }

  const apiResponse = await fetch("/api/edit-task", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      goal: currentPlan.goal,
      instruction,
      task: {
        ...task,
        dependsOn: Array.isArray(task.dependsOn)
          ? [...task.dependsOn]
          : []
      },
      contextTasks: currentPlan.tasks
    })
  });

  if (!apiResponse.ok) {
    throw new Error(`HTTP ${apiResponse.status}`);
  }

  const data = await apiResponse.json();
  const edited = data.task;

  if (!edited || !edited.title) {
    throw new Error("No edited task returned.");
  }

  task.title = String(edited.title);
  task.description = String(
    edited.description || task.description || ""
  );
  task.category = String(
    edited.category || task.category || "General"
  );

  task.priority = ["High", "Medium", "Low"].includes(
    edited.priority
  )
    ? edited.priority
    : task.priority;

  task.estimate = String(
    edited.estimate || task.estimate || "30–45 min"
  );

  if (Array.isArray(edited.subtasks)) {
    task.subtasks = edited.subtasks.map((subtask, index) => ({
      id: `${task.id}-sub-${Date.now()}-${index}`,
      title:
        typeof subtask === "string"
          ? subtask
          : String(subtask?.title || "Subtask"),
      done: false
    }));
  }

  syncTaskStates();
  persistCurrent();
  renderTasks();
  renderDetail(task);

  return {
    ok: true,
    task
  };
}

async function applyChatRegenerateTaskToPlanner() {
  if (!currentPlan) {
    return {
      ok: false,
      message:
        "Belum ada Planner aktif. Buat atau buka project Planner terlebih dahulu."
    };
  }

  if (!selectedTaskId) {
    return {
      ok: false,
      message:
        "Pilih task yang ingin di-regenerate terlebih dahulu."
    };
  }

  const task = currentPlan.tasks.find(
    item => item.id === selectedTaskId
  );

  if (!task) {
    return {
      ok: false,
      message:
        "Task yang dipilih tidak ditemukan di Planner."
    };
  }

  const apiResponse = await fetch("/api/regenerate-task", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      goal: currentPlan.goal,
      task: {
        ...task,
        dependsOn: Array.isArray(task.dependsOn)
          ? [...task.dependsOn]
          : []
      },
      contextTasks: currentPlan.tasks
    })
  });

  if (!apiResponse.ok) {
    throw new Error(`HTTP ${apiResponse.status}`);
  }

  const data = await apiResponse.json();
  const regenerated = data.task;

  if (!regenerated || !regenerated.title) {
    throw new Error("No regenerated task returned.");
  }

  task.title = String(regenerated.title);
  task.description = String(
    regenerated.description || task.description || ""
  );
  task.category = String(
    regenerated.category || task.category || "General"
  );
  task.priority = ["High", "Medium", "Low"].includes(
    regenerated.priority
  )
    ? regenerated.priority
    : task.priority;

  task.estimate = String(
    regenerated.estimate || task.estimate || "30–45 min"
  );

  // Keep the existing dependency chain safe.
  task.dependsOn = Array.isArray(task.dependsOn)
    ? [...task.dependsOn]
    : [];

  if (Array.isArray(regenerated.subtasks)) {
    task.subtasks = regenerated.subtasks.map((subtask, index) => ({
      id: `${task.id}-sub-${Date.now()}-${index}`,
      title:
        typeof subtask === "string"
          ? subtask
          : String(subtask?.title || "Subtask"),
      done: false
    }));
  }

  syncTaskStates();
  persistCurrent();
  renderTasks();
  renderDetail(task);

  return {
    ok: true,
    task
  };
}


const UMAIRA_CHAT_PROJECT_KEY = "umaira-chat-project-v1";

function getUmairaChatProject() {
  try {
    const projects = JSON.parse(localStorage.getItem("umaira-projects-v1") || "[]");
    const id = localStorage.getItem(UMAIRA_CHAT_PROJECT_KEY);
    const project = Array.isArray(projects)
      ? projects.find(item => item && item.id === id)
      : null;
    if (!project && id) localStorage.removeItem(UMAIRA_CHAT_PROJECT_KEY);
    return project || null;
  } catch {
    return null;
  }
}

function buildUmairaChatContext() {
  const context = {};
  if (typeof currentPlan !== "undefined" && currentPlan) {
    context.goal = currentPlan.goal;
    context.summary = currentPlan.summary;
    context.tasks = currentPlan.tasks;
  }

  const project = getUmairaChatProject();
  if (project) {
    context.savedProject = {
      name: String(project.name || "").slice(0, 120),
      description: String(project.description || "").slice(0, 2000),
      notes: String(project.notes || project.content || "").slice(0, 4000)
    };
  }

  return Object.keys(context).length ? JSON.stringify(context) : "";
}

function renderUmairaChatProjectIndicator() {
  const root = document.getElementById("chatProjectIndicator");
  if (!root) return;

  root.replaceChildren();
  const project = getUmairaChatProject();
  root.hidden = !project;
  if (!project) return;

  const icon = document.createElement("span");
  icon.className = "chat-project-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML = '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3.5 6.5A2 2 0 0 1 5.5 4.5H10L12 7H18.5A2 2 0 0 1 20.5 9V17.5A2 2 0 0 1 18.5 19.5H5.5A2 2 0 0 1 3.5 17.5V6.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 13.2L10.4 15.5L15.8 10.2" stroke="#62D6A0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const details = document.createElement("div");
  details.className = "chat-project-details";

  const label = document.createElement("span");
  label.className = "chat-project-label";
  label.textContent = project.name;

  const status = document.createElement("span");
  status.className = "chat-project-status";
  status.innerHTML = '<span class="chat-project-status-dot" aria-hidden="true"></span>Aktif';

  details.append(label, status);

  const detach = document.createElement("button");
  detach.type = "button";
  detach.className = "chat-project-detach";
  detach.textContent = "Lepas";
  detach.addEventListener("click", () => {
    localStorage.removeItem(UMAIRA_CHAT_PROJECT_KEY);
    renderUmairaChatProjectIndicator();
    showUmairaToast("Konteks proyek dilepas dari Chat.");
  });

  root.append(icon, details, detach);
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", renderUmairaChatProjectIndicator);
} else {
  renderUmairaChatProjectIndicator();
}

async function sendChatMessage() {
  console.log("UMAIRA DEBUG: sendChatMessage() START");

  const input = $("chatInput");
  const button = $("chatSendBtn");

  if (!input || !button) return;

  const content = input.value
    .split("\n")
    .map(line => line.trim())
    .filter((line, index, lines) => {
      if (line !== "") return true;
      return index > 0 && index < lines.length - 1;
    })
    .join("\n")
    .trim();

  const hasAttachments =
    Array.isArray(umairaAttachments) && umairaAttachments.length > 0;

  if (!content && !hasAttachments) return;

  ensureConversation();

  const messageAttachments = Array.isArray(umairaAttachments)
    ? umairaAttachments
    : [];

  addChatMessage("user", content, messageAttachments);

  if (
    currentConversation.messages.length === 1 &&
    currentConversation.title === "New conversation"
  ) {
    currentConversation.title =
      content.length > 42
        ? `${content.slice(0, 42)}…`
        : content;

    persistConversation();
  }

  input.value = "";

  renderChatMessages();
  renderChatHistory();

  button.disabled = true;
  button.innerHTML = '<span>…</span>';
  showTypingIndicator();

  await new Promise(resolve => setTimeout(resolve, 300));

  let response = null;

  try {
    const projectContext = buildUmairaChatContext();

    const attachments = await prepareUmairaAttachments(messageAttachments);

    console.log("UMAIRA ATTACHMENT DEBUG:", attachments.map(file => ({
      name: file.name,
      mimeType: file.mimeType,
      dataLength: file.data?.length || 0
    })));

    const apiResponse = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: getCurrentMessages(),
        projectContext,
        attachments
      })
    });

    if (!apiResponse.ok) {
      throw new Error(`HTTP ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    response = data.message;

    console.log(
      `Chat response mode: ${data.mode || "unknown"}`
    );
  } catch (error) {
    console.error("UMAIRA CHAT ERROR:", error);

    const detail = error?.message || "Kesalahan tidak diketahui";
    response =
      "Maaf, Umaira gagal mendapatkan jawaban dari layanan AI.\n\n" +
      "**Detail:** " + detail + "\n\n" +
      "Silakan periksa koneksi server dan log Termux, lalu coba lagi.";
  }

  if (!response) {
    response =
      "Layanan AI tidak mengembalikan jawaban. Silakan coba lagi.";
  }

  hideTypingIndicator();
  addChatMessage("assistant", response);

  renderChatMessages();
  renderChatHistory();

  if (wantsDeleteTask(content)) {
    try {
      const r = await applyChatDeleteTaskToPlanner();
      addChatMessage("assistant", r.ok
        ? `🗑️ **Task berhasil dihapus:** "${escapeHtml(r.task.title)}"`
        : `ℹ️ ${r.message}`);
    } catch (error) {
      console.error("Delete task failed:", error);
      addChatMessage("assistant", "⚠️ Saya belum berhasil menghapus task. Silakan coba lagi.");
    }
    renderChatMessages();
    renderChatHistory();
  } else if (wantsEditTask(content)) {
    try {
      const r = await applyChatEditTaskToPlanner(content);
      addChatMessage("assistant", r.ok
        ? `✅ **Task berhasil diedit:** "${escapeHtml(r.task.title)}"`
        : `ℹ️ ${r.message}`);
    } catch (error) {
      console.error("Edit task failed:", error);
      addChatMessage("assistant", "⚠️ Saya belum berhasil mengedit task. Silakan coba lagi.");
    }
    renderChatMessages();
    renderChatHistory();
  } else if (wantsRegenerateTask(content)) {
    try {
      const r = await applyChatRegenerateTaskToPlanner();
      addChatMessage("assistant", r.ok
        ? `✅ **Task berhasil di-regenerate:** "${escapeHtml(r.task.title)}"`
        : `ℹ️ ${r.message}`);
    } catch (error) {
      console.error("Regenerate task failed:", error);
      addChatMessage("assistant", "⚠️ Saya belum berhasil me-regenerate task. Silakan coba lagi.");
    }
    renderChatMessages();
    renderChatHistory();
  } else if (wantsPlannerAction(content)) {
    try {
      const actionResult = await applyChatTaskToPlanner();

      if (actionResult.ok) {
        addChatMessage(
          "assistant",
          `✅ **Task berhasil ditambahkan ke Planner:** "${escapeHtml(actionResult.task.title)}"`
        );
      } else {
        addChatMessage(
          "assistant",
          `ℹ️ ${actionResult.message}`
        );
      }

      renderChatMessages();
      renderChatHistory();
    } catch (error) {
      console.error("Planner action failed:", error);

      addChatMessage(
        "assistant",
        "⚠️ Saya belum berhasil menambahkan task ke Planner. Silakan coba lagi."
      );

      renderChatMessages();
      renderChatHistory();
    }
  }

  button.disabled = false;
  button.innerHTML = '<span>↑</span>';

  input.focus();
}

function initChat() {
  const sendButton = $("chatSendBtn");
  const input = $("chatInput");
  const newButton = $("newChatBtn");
  const headerMenuButton = $("chatHeaderMenuBtn");
  const headerMenu = $("chatHeaderMenu");

  if (!sendButton || !input) return;

  const history = loadChatHistory();

  if (history.length) {
    currentConversation = history[0];
  } else {
    createConversation();
  }

  renderChatMessages();
  renderChatHistory();

  $("chatTitle").textContent =
    currentConversation?.title || "New conversation";

  sendButton.addEventListener("click", () => {
    console.log("UMAIRA DEBUG: SEND BUTTON CLICKED");
    sendChatMessage();
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  });

  newButton?.addEventListener("click", () => {
    createConversation();
    renderChatMessages();
    renderChatHistory();

    $("chatTitle").textContent = "New conversation";
    input.focus();
  });

  headerMenuButton?.addEventListener("click", event => {
    event.stopPropagation();
    if (!headerMenu) return;

    headerMenu.hidden = !headerMenu.hidden;
    headerMenuButton.setAttribute("aria-expanded", String(!headerMenu.hidden));
  });

  headerMenu?.addEventListener("click", async event => {
    const actionButton = event.target.closest("[data-header-action]");
    if (!actionButton || !currentConversation) return;

    event.stopPropagation();
    headerMenu.hidden = true;
    headerMenuButton?.setAttribute("aria-expanded", "false");

    const action = actionButton.dataset.headerAction;
    const id = currentConversation.id;
    const historyNow = loadChatHistory();
    const conversation = historyNow.find(c => c.id === id);
    if (!conversation) return;

    if (action === "rename") {
      const next = window.prompt("Nama obrolan baru:", conversation.title || "New conversation");
      if (!next || !next.trim()) return;
      conversation.title = next.trim().slice(0, 80);
      saveChatHistory(historyNow);
      umairaSyncCurrent(conversation);
      $("chatTitle").textContent = conversation.title;
    } else if (action === "share") {
      const text = (conversation.messages || []).map(m =>
        (m.role === "user" ? "Saya" : "Umaira AI") + ":\n" +
        (typeof m.content === "string" ? m.content : "")
      ).join("\n\n");
      try {
        if (navigator.share) {
          await navigator.share({ title: conversation.title || "Obrolan Umaira AI", text });
        } else {
          await navigator.clipboard.writeText(text);
          window.alert("Isi obrolan disalin ke clipboard.");
        }
      } catch (error) {
        if (!error || error.name !== "AbortError") {
          window.alert("Obrolan belum bisa dibagikan. Coba lagi.");
        }
      }
      return;
    } else if (action === "files") {
      const names = (conversation.messages || [])
        .flatMap(m => Array.isArray(m.attachments) ? m.attachments : [])
        .map(f => f.name || f.filename || "Lampiran");
      window.alert(names.length
        ? "File dalam obrolan:\n\n" + [...new Set(names)].join("\n")
        : "Belum ada file yang tercatat di obrolan ini.");
      return;
    } else if (action === "pin") {
      conversation.pinned = !conversation.pinned;
      saveChatHistory(historyNow);
      umairaSyncCurrent(conversation);
    } else if (action === "archive") {
      conversation.archived = !conversation.archived;
      saveChatHistory(historyNow);
      umairaSyncCurrent(conversation);
      if (conversation.archived) umairaPickAfterRemoval();
    } else if (action === "clear") {
      if (!(await umairaShowConfirm({ title: "Bersihkan pesan?", message: "Semua pesan dalam obrolan ini akan dihapus. Tindakan ini tidak dapat dibatalkan.", confirmLabel: "Bersihkan" }))) return;
      clearCurrentConversation();
    } else if (action === "delete") {
      if (!(await umairaShowConfirm({ title: "Hapus obrolan?", message: "Obrolan \u201c" + (conversation.title || "New conversation") + "\u201d akan dihapus. Tindakan ini tidak dapat dibatalkan.", confirmLabel: "Hapus obrolan" }))) return;
      deleteConversation(id);
      if (!currentConversation || currentConversation.id === id) umairaPickAfterRemoval();
    }

    renderChatMessages();
    renderChatHistory();
    $("chatTitle").textContent = currentConversation?.title || "New conversation";
    input.focus();
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".chat-header-actions") && headerMenu) {
      headerMenu.hidden = true;
      headerMenuButton?.setAttribute("aria-expanded", "false");
    }
  });
}



/* UMAIRA CUSTOM CONFIRM DIALOG */
function umairaShowConfirm({ title, message, confirmLabel = "Ya, lanjutkan" } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "umaira-confirm-overlay umaira-chat-confirm-overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("section");
    dialog.className = "umaira-confirm-dialog umaira-chat-confirm-dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "umairaConfirmTitle");
    dialog.setAttribute("aria-describedby", "umairaConfirmMessage");

    const icon = document.createElement("div");
    icon.className = "umaira-confirm-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "!";

    const heading = document.createElement("h3");
    heading.id = "umairaConfirmTitle";
    heading.textContent = title || "Konfirmasi tindakan";

    const paragraph = document.createElement("p");
    paragraph.id = "umairaConfirmMessage";
    paragraph.textContent = message || "Apakah kamu yakin ingin melanjutkan?";

    const actions = document.createElement("div");
    actions.className = "umaira-confirm-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "umaira-confirm-cancel";
    cancel.textContent = "Batal";

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "umaira-confirm-delete";
    confirm.textContent = confirmLabel;

    actions.append(cancel, confirm);
    dialog.append(icon, heading, paragraph, actions);
    overlay.append(dialog);
    document.body.append(overlay);

    let finished = false;
    const finish = value => {
      if (finished) return;
      finished = true;
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
      resolve(value);
    };
    const onKeydown = event => {
      if (event.key === "Escape") finish(false);
      if (event.key === "Tab") {
        event.preventDefault();
        (document.activeElement === cancel ? confirm : cancel).focus();
      }
    };

    cancel.addEventListener("click", () => finish(false));
    confirm.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", event => {
      if (event.target === overlay) finish(false);
    });
    document.addEventListener("keydown", onKeydown);
    cancel.focus();
  });
}

function setupChatInputKeyboard() {
  const input = $("chatInput");

  if (!input) {
    console.warn("UMAIRA: chat input not found for keyboard setup");
    return;
  }

  if (input.dataset.keyboardSetup === "true") {
    return;
  }

  input.dataset.keyboardSetup = "true";

  input.addEventListener("keydown", event => {
    if (event.key !== "Enter") {
      return;
    }

    if (event.isComposing) {
      return;
    }

    if (event.shiftKey) {
      return;
    }

    event.preventDefault();

    const sendButton = $("chatSendBtn");

    if (!sendButton || sendButton.disabled) {
      return;
    }

    const content = input.value.trim();

    if (!content) {
      return;
    }

    console.log("UMAIRA: Enter pressed, sending message");

    sendChatMessage();
  });

  console.log("UMAIRA: Enter / Shift+Enter keyboard setup ready");
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("UMAIRA DEBUG: DOMContentLoaded fired");

  try {
    initChat();
    setupChatInputKeyboard();
    setupComposerMenu();
    setupUmairaVoiceInput();
    setupAttachmentDragDropPaste();
    setupChatInputAutoResize();
    setupComposerAttachments();
    console.log("UMAIRA DEBUG: initChat completed");
  } catch (error) {
    console.error("UMAIRA DEBUG: initChat FAILED", error);
    window.__UMAIRA_INIT_ERROR__ = error;
  }
});


/* =========================================
   UMAIRA COMPOSER MENU
   ========================================= */

function setupComposerMenu() {
  const plusButton = $("composerPlusBtn");
  const menu = $("composerMenu");

  if (!plusButton || !menu) {
    console.warn("UMAIRA: composer menu elements not found");
    return;
  }

  if (plusButton.dataset.menuSetup === "true") {
    return;
  }

  plusButton.dataset.menuSetup = "true";

  const closeMenu = () => {
    menu.hidden = true;
    plusButton.classList.remove("is-open");
    plusButton.setAttribute("aria-expanded", "false");
  };

  const toggleMenu = event => {
    event.stopPropagation();

    const isOpen = !menu.hidden;

    if (isOpen) {
      closeMenu();
      return;
    }

    menu.hidden = false;
    plusButton.classList.add("is-open");
    plusButton.setAttribute("aria-expanded", "true");
  };

  plusButton.addEventListener("click", toggleMenu);

  document.addEventListener("click", event => {
    if (!menu.contains(event.target) && !plusButton.contains(event.target)) {
      closeMenu();
    }
  });

  const openFilePicker = id => {
    const input = $(id);

    if (!input) return;

    closeMenu();
    input.click();
  };

  $("composerCameraBtn")?.addEventListener("click", () => {
    openFilePicker("composerCameraInput");
  });

  $("composerImageBtn")?.addEventListener("click", () => {
    openFilePicker("composerImageInput");
  });

  $("composerFileBtn")?.addEventListener("click", () => {
    openFilePicker("composerFileInput");
  });

  $("composerAttachmentBtn")?.addEventListener("click", () => {
    openFilePicker("composerAttachmentInput");
  });

  console.log("UMAIRA: composer menu ready");
}


/* =========================================
   UMAIRA FILE ATTACHMENT
   ========================================= */

let umairaAttachments = [];

function formatAttachmentSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const size = bytes / Math.pow(1024, index);

  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function getAttachmentIcon(file) {
  if (file.type.startsWith("image/")) return "🖼️";
  if (file.type.startsWith("video/")) return "🎬";
  if (file.type.startsWith("audio/")) return "🎵";
  if (file.type.includes("pdf")) return "📕";
  if (file.type.includes("zip") || file.type.includes("compressed")) {
    return "🗜️";
  }

  return "📄";
}

function renderComposerAttachments() {
  const container = $("composerAttachments");

  if (!container) return;

  container.innerHTML = "";

  umairaAttachments.forEach((file, index) => {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";

    const icon = document.createElement("div");
    icon.className = "attachment-icon";
    icon.textContent = getAttachmentIcon(file);

    const info = document.createElement("div");
    info.className = "attachment-info";

    const name = document.createElement("div");
    name.className = "attachment-name";
    name.textContent = file.name;

    const size = document.createElement("div");
    size.className = "attachment-size";
    size.textContent = formatAttachmentSize(file.size);

    info.appendChild(name);
    info.appendChild(size);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "attachment-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Hapus ${file.name}`);

    remove.addEventListener("click", () => {
      umairaAttachments.splice(index, 1);
      renderComposerAttachments();
    });

    chip.appendChild(icon);
    chip.appendChild(info);
    chip.appendChild(remove);

    container.appendChild(chip);
  });
}

function addComposerFiles(fileList) {
  if (!fileList || !fileList.length) {
    return;
  }

  const incomingFiles = Array.from(fileList);

  for (const file of incomingFiles) {
    const alreadyExists = umairaAttachments.some(existing =>
      existing.name === file.name &&
      existing.size === file.size &&
      existing.lastModified === file.lastModified
    );

    if (!alreadyExists) {
      umairaAttachments.push(file);
    }
  }

  renderComposerAttachments();

  console.log(
    "UMAIRA: attachments:",
    umairaAttachments.map(file => file.name)
  );
}

function setupComposerAttachments() {
  const inputIds = [
    "composerCameraInput",
    "composerImageInput",
    "composerFileInput",
    "composerAttachmentInput"
  ];

  for (const id of inputIds) {
    const input = $(id);

    if (!input) continue;

    if (input.dataset.attachmentSetup === "true") {
      continue;
    }

    input.dataset.attachmentSetup = "true";

    input.addEventListener("change", event => {
      const files = event.target.files;

      if (!files || !files.length) {
        return;
      }

      addComposerFiles(files);

      if (id === "composerCameraInput") {
        console.log("UMAIRA: camera photo captured:", files[0].name);
      }

      // Allow selecting the same file again later.
      event.target.value = "";
    });
  }

  console.log("UMAIRA: attachment handling ready");
}





/* =========================================
   UMAIRA ATTACHMENT -> BASE64
   ========================================= */



function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof Blob)) {
      reject(new Error("Lampiran bukan file yang valid."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string" || !result.includes(",")) {
        reject(new Error("Gagal mengubah file menjadi Base64."));
        return;
      }

      resolve(result.split(",").pop());
    };

    reader.onerror = () => {
      reject(reader.error || new Error("Gagal membaca file."));
    };

    reader.readAsDataURL(file);
  });
}

async function prepareUmairaAttachments(files = umairaAttachments) {
  if (!Array.isArray(files) || !files.length) {
    return [];
  }

  const filesToPrepare = files.slice(0, 5);

  return Promise.all(
    filesToPrepare.map(async file => ({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      data: await fileToBase64(file)
    }))
  );
}


/* =========================================
   UMAIRA VOICE INPUT
   ========================================= */

let umairaSpeechRecognition = null;
let umairaSpeechActive = false;

function setupUmairaVoiceInput() {
  const button = $("composerMicBtn");
  const input = $("chatInput");

  if (!button || !input) {
    console.warn("UMAIRA: voice input elements not found");
    return;
  }

  if (button.dataset.voiceSetup === "true") {
    return;
  }

  button.dataset.voiceSetup = "true";

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    button.title = "Voice input tidak didukung browser ini";
    button.addEventListener("click", () => {
      alert("Voice input belum didukung oleh browser ini.");
    });
    return;
  }

  umairaSpeechRecognition = new SpeechRecognition();

  umairaSpeechRecognition.lang = "id-ID";
  umairaSpeechRecognition.continuous = false;
  umairaSpeechRecognition.interimResults = true;

  umairaSpeechRecognition.onstart = () => {
    umairaSpeechActive = true;

    button.classList.add("is-recording");
    button.setAttribute("aria-pressed", "true");
    button.setAttribute("aria-label", "Stop voice input");
    button.textContent = "⏹️";

    console.log("UMAIRA: voice input started");
  };

  umairaSpeechRecognition.onresult = event => {
    let finalText = "";
    let interimText = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript =
        event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        finalText += transcript;
      } else {
        interimText += transcript;
      }
    }

    const existingText = input.dataset.voiceBase || "";

    if (finalText) {
      const combined = [existingText, finalText]
        .filter(Boolean)
        .join(" ")
        .trim();

      input.value = combined;
      input.dataset.voiceBase = combined;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (interimText) {
      const preview = [existingText, interimText]
        .filter(Boolean)
        .join(" ")
        .trim();

      input.value = preview;
    }
  };

  umairaSpeechRecognition.onerror = event => {
    console.warn(
      "UMAIRA: voice input error:",
      event.error
    );

    stopUmairaVoiceInput();
  };

  umairaSpeechRecognition.onend = () => {
    stopUmairaVoiceInput();
  };

  button.addEventListener("click", () => {
    if (umairaSpeechActive) {
      stopUmairaVoiceInput();
      return;
    }

    input.dataset.voiceBase = input.value.trim();

    try {
      umairaSpeechRecognition.start();
    } catch (error) {
      console.warn(
        "UMAIRA: could not start voice input:",
        error
      );
    }
  });

  console.log("UMAIRA: voice input ready");
}

function stopUmairaVoiceInput() {
  const button = $("composerMicBtn");

  umairaSpeechActive = false;

  if (button) {
    button.classList.remove("is-recording");
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", "Voice input");
    button.textContent = "🎙️";
  }
}


/* =========================================
   UMAIRA VOICE INPUT
   ========================================= */




/* =========================================
   UMAIRA — DRAG & DROP / PASTE ATTACHMENT
   ========================================= */

function setupAttachmentDragDropPaste() {
  const wrapper = document.querySelector(".chat-composer-wrap");

  if (!wrapper) {
    console.warn("UMAIRA: composer wrapper tidak ditemukan");
    return;
  }

  if (wrapper.dataset.dragPasteSetup === "true") {
    return;
  }

  wrapper.dataset.dragPasteSetup = "true";

  let dragCounter = 0;

  wrapper.addEventListener("dragenter", event => {
    event.preventDefault();
    event.stopPropagation();

    dragCounter++;

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }

    wrapper.classList.add("is-dragover");
  });

  wrapper.addEventListener("dragover", event => {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }

    wrapper.classList.add("is-dragover");
  });

  wrapper.addEventListener("dragleave", event => {
    event.preventDefault();
    event.stopPropagation();

    dragCounter--;

    if (dragCounter <= 0) {
      dragCounter = 0;
      wrapper.classList.remove("is-dragover");
    }
  });

  wrapper.addEventListener("drop", event => {
    event.preventDefault();
    event.stopPropagation();

    dragCounter = 0;
    wrapper.classList.remove("is-dragover");

    const files = event.dataTransfer?.files;

    if (!files || !files.length) {
      return;
    }

    addComposerFiles(files);

    console.log(
      "UMAIRA: files dropped:",
      Array.from(files).map(file => file.name)
    );
  });

  document.addEventListener("paste", event => {
    const clipboardItems = event.clipboardData?.items;

    if (!clipboardItems || !clipboardItems.length) {
      return;
    }

    const imageFiles = [];

    for (const item of clipboardItems) {
      if (item.kind !== "file") {
        continue;
      }

      const file = item.getAsFile();

      if (!file) {
        continue;
      }

      if (file.type.startsWith("image/")) {
        imageFiles.push(file);
      }
    }

    if (!imageFiles.length) {
      return;
    }

    addComposerFiles(imageFiles);

    wrapper.classList.remove("is-paste");
    void wrapper.offsetWidth;
    wrapper.classList.add("is-paste");

    console.log(
      "UMAIRA: pasted images:",
      imageFiles.map(file => file.name || file.type)
    );
  });

  console.log("UMAIRA: drag & drop + paste ready");
}


/* =========================================
   UMAIRA — AUTO RESIZE TEXTAREA 4.1
   ========================================= */

function setupChatInputAutoResize() {
  const input = $("chatInput");

  if (!input) {
    console.warn("UMAIRA: chat input tidak ditemukan");
    return;
  }

  if (input.dataset.autoResizeSetup === "true") {
    return;
  }

  input.dataset.autoResizeSetup = "true";

  const resize = () => {
    input.style.height = "auto";

    const maxHeight = window.innerWidth <= 600
      ? 90
      : 120;

    const nextHeight = Math.min(
      input.scrollHeight,
      maxHeight
    );

    input.style.height = `${nextHeight}px`;

    input.style.overflowY =
      input.scrollHeight > maxHeight
        ? "auto"
        : "hidden";
  };

  input.addEventListener("input", resize);

  input.addEventListener("focus", resize);

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      return;
    }

    requestAnimationFrame(resize);
  });

  window.addEventListener("resize", resize);

  resize();

  console.log("UMAIRA: textarea auto-resize ready");
}




// ===== UMAIRA WORKSPACE NAVIGATION =====
(() => {
  const chatSection = document.getElementById("chatSection");
  const featureWorkspace = document.getElementById("featureWorkspace");
  const featureTitle = document.getElementById("featureTitle");
  const featureDescription = document.getElementById("featureDescription");
  const featurePageContent = document.getElementById("featurePageContent");
  const navItems = document.querySelectorAll(".nav-item[data-view]");

  if (!chatSection || !featureWorkspace || !featureTitle ||
      !featureDescription || !featurePageContent || !navItems.length) {
    return;
  }

  // UMAIRA SETTINGS AND ACCOUNT PAGES
  const pages = {
    settings: {
      title: "Pengaturan",
      description: "Atur preferensi pengalaman Umaira AI.",
      cards: []
    },
    account: {
      title: "Login / Akun",
      description: "Kelola akun Umaira AI.",
      cards: []
    },
    images: {
      title: "Studio Gambar",
      description: "Buat visual dari deskripsi teks dan kelola hasil generasi gambar.",
      cards: [
        ["✦", "AI Image Generator", "Tulis deskripsi, pilih rasio, lalu Umaira mengirimnya ke antrean AI Horde dan menampilkan hasilnya.", "Aktif"],
        ["▧", "Galeri Gambar", "Hasil gambar tampil di bawah form dan bisa diunduh lewat tautan Simpan gambar.", "Aktif"]
      ]
    },
    library: {
      title: "Pustaka",
      description: "Tempat terpusat untuk aset, gambar, dan file milikmu.",
      cards: [
        ["▧", "Gambar tersimpan", "Galeri akan menampilkan gambar hasil generasi dan gambar yang kamu simpan.", "Fondasi UI tersedia"],
        ["▤", "File dan lampiran", "Pengelolaan file lintas percakapan akan ditambahkan setelah penyimpanan aset dibuat.", "Tahap berikutnya"]
      ]
    },
    scheduled: {
      title: "Terjadwal",
      description: "Kelola pengingat dan pekerjaan yang ingin dijalankan pada waktu tertentu.",
      cards: [
        ["◷", "Pengingat", "Fitur jadwal akan memerlukan penyimpanan dan mekanisme penjadwalan di backend.", "Belum diaktifkan"],
        ["↻", "Tugas berulang", "Atur tugas berulang setelah sistem jadwal selesai diintegrasikan.", "Tahap berikutnya"]
      ]
    },
    plugins: {
      title: "Plugin",
      description: "Pusat integrasi untuk menghubungkan Umaira dengan layanan eksternal.",
      cards: [
        ["⧉", "Integrasi layanan", "Daftar plugin dan proses koneksi akan ditambahkan setelah sistem integrasi dibuat.", "Belum diaktifkan"],
        ["⚙", "Izin dan koneksi", "Koneksi layanan harus menggunakan izin yang jelas dan kredensial yang aman.", "Tahap berikutnya"]
      ]
    },
    projects: {
      title: "Proyek",
      description: "Ruang untuk mengelola konteks, catatan, dan pekerjaan setiap proyek.",
      cards: [
        ["▣", "Konteks proyek", "Planner dan workflow lama tetap dipertahankan. Integrasi ke workspace ini akan dilakukan bertahap.", "Planner dipertahankan"],
        ["＋", "Proyek baru", "Pengelolaan proyek langsung dari workspace akan ditambahkan setelah pemetaan data selesai.", "Tahap berikutnya"]
      ]
    },
    codex: {
      title: "Codex Workspace",
      description: "Ruang kerja coding untuk menulis, memahami, dan memperbaiki kode.",
      cards: [
        ["{ }", "Asisten coding", "Gunakan chat Umaira yang sudah ada untuk bertanya tentang kode. Workspace coding khusus akan dibuat berikutnya.", "Chat tersedia"],
        ["⌘", "Analisis dan perbaikan", "Pemeriksaan file, patch, dan alur kerja coding akan dikembangkan tanpa menghapus fitur yang ada.", "Tahap berikutnya"]
      ]
    }
  };


    // ===== UMAIRA PUSTAKA GAMBAR =====
  async function renderLibrary() {
    featurePageContent.replaceChildren();

    const EMPTY_TEXT =
      "Belum ada gambar tersimpan. Buat gambar di Studio Gambar, lalu klik Simpan ke Pustaka.";

    const styleNames = {
      cartoon: "Kartun imut",
      anime: "Anime",
      realistic: "Realistis",
      pixel: "Pixel art",
      watercolor: "Cat air"
    };

    const panel = document.createElement("section");
    panel.className = "library-panel";

    const heading = document.createElement("h2");
    heading.textContent = "Gambar tersimpan";

    const status = document.createElement("p");
    status.className = "library-status";
    status.setAttribute("role", "status");
    status.textContent = "Memuat Pustaka...";

    const grid = document.createElement("div");
    grid.className = "library-grid";

    panel.append(heading, status, grid);
    featurePageContent.appendChild(panel);

    function addCard(item) {
      const card = document.createElement("article");
      card.className = "image-result-card library-card";

      const url = typeof item.url === "string" && item.url.startsWith("/gallery/")
        ? item.url
        : "";

      const image = document.createElement("img");
      image.src = url;
      image.alt = item.prompt || "Gambar tersimpan";
      image.loading = "lazy";

      const caption = document.createElement("p");
      caption.textContent = item.prompt || "(tanpa deskripsi)";

      const meta = document.createElement("p");
      meta.className = "library-meta";
      const styleText = styleNames[item.style] || "";
      const dateText = item.createdAt
        ? new Date(item.createdAt).toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "short"
          })
        : "";
      meta.textContent = [styleText, dateText].filter(Boolean).join(" · ");

      const download = document.createElement("a");
      download.className = "image-result-download";
      download.textContent = "Unduh";
      download.href = url;
      download.download = item.file || "umaira-ai-image";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "image-result-save library-delete";
      remove.textContent = "Hapus";
      remove.addEventListener("click", async () => {
        if (!window.confirm("Hapus gambar ini dari Pustaka?")) return;
        remove.disabled = true;
        try {
          const res = await fetch(
            "/api/gallery/" + encodeURIComponent(item.id),
            { method: "DELETE" }
          );
          const body = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(body.error || "Gagal menghapus gambar.");
          card.remove();
          const remaining = grid.children.length;
          status.textContent = remaining
            ? remaining + " gambar tersimpan."
            : EMPTY_TEXT;
        } catch (error) {
          remove.disabled = false;
          status.textContent = error.message;
        }
      });

      card.append(image, caption, meta, download, remove);
      grid.appendChild(card);
    }

    try {
      const response = await fetch("/api/gallery");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Gagal memuat Pustaka.");
      }
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) {
        status.textContent = EMPTY_TEXT;
        return;
      }
      status.textContent = items.length + " gambar tersimpan.";
      items.forEach(addCard);
    } catch (error) {
      status.textContent = error.message;
    }
  }

  // ===== UMAIRA AI HORDE IMAGE STUDIO =====
  function renderImageStudio() {
    featurePageContent.replaceChildren();

    const panel = document.createElement("section");
    panel.className = "image-studio-panel";

    const heading = document.createElement("h2");
    heading.textContent = "Buat gambar dengan AI";

    const intro = document.createElement("p");
    intro.className = "image-studio-intro";
    intro.textContent =
      "Jelaskan gambar yang kamu inginkan. Umaira akan mengirimnya ke antrean AI Horde.";

    const form = document.createElement("form");
    form.className = "image-studio-form";

    const label = document.createElement("label");
    label.htmlFor = "umairaImagePrompt";
    label.textContent = "Deskripsi gambar";

    const textarea = document.createElement("textarea");
    textarea.id = "umairaImagePrompt";
    textarea.name = "prompt";
    textarea.maxLength = 2000;
    textarea.rows = 5;
    textarea.required = true;
    textarea.placeholder =
      "Contoh: kota futuristik saat senja, lampu neon ungu, detail tinggi, ilustrasi digital";

    const ratioLabel = document.createElement("label");
    ratioLabel.htmlFor = "umairaImageRatio";
    ratioLabel.textContent = "Rasio gambar";

    const ratioSelect = document.createElement("select");
    ratioSelect.id = "umairaImageRatio";
    ratioSelect.name = "aspectRatio";

    [
      ["square", "Persegi (1:1)"],
      ["portrait", "Potret (2:3)"],
      ["landscape", "Lanskap (3:2)"]
    ].forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      ratioSelect.appendChild(option);
    });

    const actions = document.createElement("div");
    actions.className = "image-studio-actions";

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "image-studio-submit";
    submit.textContent = "✦ Buat gambar";

    const status = document.createElement("p");
    status.className = "image-studio-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const result = document.createElement("div");
    result.className = "image-studio-result";

    actions.appendChild(submit);
    const styleLabel = document.createElement("label");
    styleLabel.htmlFor = "umairaImageStyle";
    styleLabel.textContent = "Gaya gambar";

    const styleSelect = document.createElement("select");
    styleSelect.id = "umairaImageStyle";
    styleSelect.name = "style";
    [
      ["none", "Tanpa gaya khusus"],
      ["cartoon", "Kartun imut"],
      ["anime", "Anime"],
      ["realistic", "Realistis"],
      ["pixel", "Pixel art"],
      ["watercolor", "Cat air"]
    ].forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      styleSelect.appendChild(option);
    });

    const negLabel = document.createElement("label");
    negLabel.htmlFor = "umairaImageNegative";
    negLabel.textContent = "Hindari (opsional)";

    const negInput = document.createElement("textarea");
    negInput.id = "umairaImageNegative";
    negInput.name = "negativePrompt";
    negInput.maxLength = 500;
    negInput.rows = 2;
    negInput.placeholder = "Contoh: teks, watermark, latar ramai";

    form.append(
      label, textarea,
      styleLabel, styleSelect,
      ratioLabel, ratioSelect,
      negLabel, negInput,
      actions
    );
    panel.append(heading, intro, form, status, result);
    featurePageContent.appendChild(panel);

    let busy = false;
    let cancelled = false;

    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (busy) return;

      const prompt = textarea.value.trim();
      if (!prompt) {
        status.textContent = "Isi deskripsi gambar terlebih dahulu.";
        return;
      }

      busy = true;
      cancelled = false;
      submit.disabled = true;
      submit.textContent = "Mengirim...";
      result.replaceChildren();
      status.textContent = "Mengirim permintaan ke AI Horde...";

      try {
        const response = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            aspectRatio: ratioSelect.value,
            style: styleSelect.value,
            negativePrompt: negInput.value.trim()
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Permintaan gambar gagal.");
        }

        status.textContent = "Masuk antrean. Menunggu worker AI Horde...";
        let finished = false;

        for (let attempt = 0; attempt < 120; attempt++) {
          if (cancelled) return;

          await new Promise(resolve => setTimeout(resolve, 5000));

          if (cancelled) return;

          const check = await fetch(
            "/api/images/status/" + encodeURIComponent(data.id)
          );
          const state = await check.json();

          if (!check.ok) {
            throw new Error(state.error || "Gagal memeriksa progres.");
          }

          if (state.faulted) {
            throw new Error("Pekerjaan gambar gagal di AI Horde. Coba prompt lain.");
          }

          if (state.done) {
            const images = Array.isArray(state.generations)
              ? state.generations.filter(item => typeof item.img === "string")
              : [];

            if (!images.length) {
              throw new Error("Pekerjaan selesai, tetapi gambar tidak tersedia.");
            }

            images.forEach(item => {
              const card = document.createElement("article");
              card.className = "image-result-card";

              const image = document.createElement("img");
              image.alt = prompt;
              image.loading = "lazy";

              let src = item.img;
              if (!/^https?:\/\//i.test(src) &&
                  !/^data:image\//i.test(src)) {
                let mime = "image/png";
                if (src.startsWith("UklGR")) mime = "image/webp";
                else if (src.startsWith("/9j/")) mime = "image/jpeg";
                src = "data:" + mime + ";base64," + src;
              }
              image.src = src;

              const caption = document.createElement("p");
              caption.textContent = prompt;

              const download = document.createElement("a");
              download.className = "image-result-download";
              download.textContent = "Simpan gambar";
              download.href = src;
              download.download = "umaira-ai-image";
              download.target = "_blank";
              download.rel = "noopener";

              const usedStyle = styleSelect.value;
              const saveBtn = document.createElement("button");
              saveBtn.type = "button";
              saveBtn.className = "image-result-save";
              saveBtn.textContent = "Simpan ke Pustaka";
              saveBtn.addEventListener("click", async () => {
                saveBtn.disabled = true;
                saveBtn.textContent = "Menyimpan...";
                try {
                  const saveRes = await fetch("/api/gallery/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      jobId: data.id,
                      prompt,
                      style: usedStyle
                    })
                  });
                  const saved = await saveRes.json();
                  if (!saveRes.ok) {
                    throw new Error(saved.error || "Gagal menyimpan.");
                  }
                  saveBtn.textContent = "Tersimpan di Pustaka ✓";
                } catch (saveError) {
                  saveBtn.disabled = false;
                  saveBtn.textContent = "Simpan ke Pustaka";
                  status.textContent = saveError.message;
                }
              });

              card.append(image, caption, download, saveBtn);
              result.appendChild(card);
            });

            status.textContent = "Gambar berhasil dibuat.";
            finished = true;
            break;
          }

          const position = Number(state.queue_position || 0);
          const wait = Number(state.wait_time || 0);
          status.textContent = position > 0
            ? "Menunggu antrean: posisi " + position +
              (wait > 0 ? " · estimasi server " + wait + " detik" : "")
            : "Gambar sedang diproses oleh worker AI Horde...";
        }

        if (!finished && !cancelled) {
          status.textContent =
            "Masih diproses atau antrean sedang padat. Coba buat ulang beberapa saat lagi.";
        }
      } catch (error) {
        status.textContent = error.message || "Terjadi kesalahan saat membuat gambar.";
      } finally {
        busy = false;
        submit.disabled = false;
        submit.textContent = "✦ Buat gambar";
      }
    });
  }


  function renderProjectsWorkspace() {
    const root = document.getElementById("featurePageContent");
    if (!root) return;

    const KEY = "umaira-projects-v1";
    const ACTIVE = "umaira-active-project-v1";

    const read = () => {
      try {
        const data = JSON.parse(localStorage.getItem(KEY) || "[]");
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };

    const save = items => localStorage.setItem(KEY, JSON.stringify(items));

    const make = (tag, cls, text) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined) node.textContent = text;
      return node;
    };

    const button = (text, cls, action) => {
      const node = make("button", cls || "projects-button", text);
      node.type = "button";
      node.addEventListener("click", action);
      return node;
    };

    function renderForm(project = null) {
      const form = make("form", "projects-form");
      const nameLabel = make("label", "project-field");
      nameLabel.append(make("span", "", "Nama proyek"));
      const name = make("input");
      name.required = true;
      name.maxLength = 120;
      name.value = project?.name || "";
      name.placeholder = "Contoh: Website portofolio";
      nameLabel.append(name);

      const descLabel = make("label", "project-field");
      descLabel.append(make("span", "", "Deskripsi"));
      const desc = make("textarea");
      desc.rows = 4;
      desc.value = project?.description || "";
      desc.placeholder = "Apa yang ingin kamu kerjakan?";
      descLabel.append(desc);

      const actions = make("div", "project-card-actions");
      const submit = button(project ? "Simpan perubahan" : "Buat proyek", "projects-button", () => {});
      submit.type = "submit";
      actions.append(submit, button("Batal", "projects-button projects-secondary", render));

      form.append(nameLabel, descLabel, actions);
      form.addEventListener("submit", event => {
        event.preventDefault();
        const title = name.value.trim();
        if (!title) return name.focus();

        const items = read();
        if (project) {
          const index = items.findIndex(item => item.id === project.id);
          if (index < 0) return render();
          items[index] = {
            ...items[index],
            name: title,
            description: desc.value.trim(),
            updatedAt: new Date().toISOString()
          };
        } else {
          const id = "project-" + Date.now();
          items.unshift({
            id,
            name: title,
            description: desc.value.trim(),
            notes: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          localStorage.setItem(ACTIVE, id);
        }
        save(items);
        render();
      });

      root.replaceChildren(form);
      name.focus();
    }

    function renderDetail(project) {
      const panel = make("section", "project-detail");
      const header = make("div", "projects-toolbar");
      const intro = make("div", "projects-intro");
      intro.append(
        make("h2", "", project.name),
        make("p", "", project.description || "Belum ada deskripsi.")
      );
      header.append(intro, button("Kembali", "projects-button projects-secondary", () => {
        localStorage.removeItem(ACTIVE);
        render();
      }));

      const label = make("label", "project-field");
      label.append(make("span", "", "Catatan proyek"));
      const notes = make("textarea");
      notes.rows = 8;
      notes.value = project.notes || "";
      notes.placeholder = "Ide, target, dan langkah pengerjaan...";
      label.append(notes);

      const status = make("p", "project-status", "");
      const saveButton = button("Simpan catatan", "projects-button", () => {
        const items = read();
        const index = items.findIndex(item => item.id === project.id);
        if (index < 0) return render();
        items[index].notes = notes.value;
        items[index].updatedAt = new Date().toISOString();
        save(items);
        status.textContent = "Catatan berhasil disimpan.";
      });

      panel.append(header, label, saveButton, status);
      root.replaceChildren(panel);
    }

    function render() {
      const items = read();
      const active = items.find(item => item.id === localStorage.getItem(ACTIVE));
      if (active) return renderDetail(active);

      const panel = make("section", "projects-panel");
      const toolbar = make("div", "projects-toolbar");
      const intro = make("div", "projects-intro");
      intro.append(
        make("h2", "", "Workspace Proyek"),
        make("p", "", "Kelola proyek dan simpan catatannya di browser ini.")
      );
      toolbar.append(intro, button("+ Proyek baru", "projects-button", () => renderForm()));
      panel.append(toolbar);

      if (!items.length) {
        const empty = make("div", "project-empty");
        empty.append(
          make("h3", "", "Belum ada proyek"),
          make("p", "", "Buat proyek pertama untuk mulai.")
        );
        panel.append(empty);
      } else {
        const list = make("div", "projects-list");
        items.forEach(project => {
          const card = make("article", "project-card");
          const content = make("div", "project-card-content");
          content.append(
            make("h3", "", project.name),
            make("p", "", project.description || "Belum ada deskripsi.")
          );
          const actions = make("div", "project-card-actions");
          actions.append(
            button(
              localStorage.getItem("umaira-chat-project-v1") === project.id
                ? "Aktif di Chat"
                : "Gunakan di Chat",
              "projects-button projects-secondary",
              () => {
                localStorage.setItem("umaira-chat-project-v1", project.id);
                renderUmairaChatProjectIndicator();
                            showUmairaToast("Konteks proyek “" + project.name + "” dipilih untuk Chat.");
                render();
              }
            ),
            button("Buka", "projects-button", () => {
              localStorage.setItem(ACTIVE, project.id);
              render();
            }),
            button("Edit", "projects-button projects-secondary", () => renderForm(project)),
            button("Hapus", "projects-button projects-danger", async () => {
              if (!await showUmairaDeleteConfirm(project.name)) return;
              save(read().filter(item => item.id !== project.id));
              showUmairaToast("Proyek “" + project.name + "” berhasil dihapus.");
              if (localStorage.getItem(ACTIVE) === project.id) {
                localStorage.removeItem(ACTIVE);
              }
              if (localStorage.getItem("umaira-chat-project-v1") === project.id) {
                localStorage.removeItem("umaira-chat-project-v1");
                renderUmairaChatProjectIndicator();
              }
              render();
            })
          );
          card.append(content, actions);
          list.append(card);
        });
        panel.append(list);
      }
      root.replaceChildren(panel);
    }

    render();
  }

  // UMAIRA SETTINGS ACCOUNT BUTTONS
  document.getElementById("navSettingsBtn")?.addEventListener("click", () => openView("settings"));
  document.getElementById("navLoginBtn")?.addEventListener("click", () => openView("account"));


  function renderUmairaAccount(panel) {
    const heading = document.createElement("h2");
    heading.textContent = "Akun";
    panel.append(heading);

    const status = document.createElement("p");
    status.className = "umaira-account-status";
    status.textContent = "Memeriksa status akun...";
    panel.append(status);

    const backToChat = document.createElement("button");
    backToChat.type = "button";
    backToChat.className = "ghost";
    backToChat.textContent = "Kembali ke Obrolan";
    backToChat.addEventListener("click", () => {
      openView("chat");
    });
    panel.append(backToChat);

    const message = document.createElement("p");
    message.setAttribute("role", "status");
    panel.append(message);

    const googleSection = document.createElement("section");
    googleSection.className = "umaira-google-login";
    googleSection.hidden = true;

    const googleHeading = document.createElement("p");
    googleHeading.className = "umaira-google-heading";
    googleHeading.textContent = "Masuk lebih cepat";

    const googleButtonHost = document.createElement("div");
    googleButtonHost.className = "umaira-google-button";
    googleButtonHost.setAttribute("aria-label", "Login dengan Google");

    const emailDivider = document.createElement("div");
    emailDivider.className = "umaira-login-divider";
    emailDivider.textContent = "atau gunakan email";

    googleSection.append(googleHeading, googleButtonHost, emailDivider);
    panel.append(googleSection);
    let googleAvailable = false;
    let accountUser = null;

    let mode = "login";
    const form = document.createElement("form");
    form.className = "umaira-account-form";
    form.autocomplete = "on";

    function field(name, title, type, autocomplete) {
      const label = document.createElement("label");
      label.className = "umaira-setting-row";
      label.textContent = title;
      const input = document.createElement("input");
      input.name = name;
      input.type = type;
      input.autocomplete = autocomplete;
      input.className = "umaira-setting-select";
      input.required = true;
      if (name === "password") input.minLength = 8;
      label.append(input);
      return { label, input };
    }

    const name = field("name", "Nama", "text", "name");
    const email = field("email", "Email", "email", "email");
    const password = field("password", "Kata sandi", "password", "current-password");
    form.append(name.label, email.label, password.label);

    const passwordWrap = document.createElement("span");
    passwordWrap.className = "umaira-password-wrap";
    password.label.insertBefore(passwordWrap, password.input);
    passwordWrap.append(password.input);

    const passwordToggle = document.createElement("button");
    passwordToggle.type = "button";
    passwordToggle.className = "umaira-password-toggle";
    passwordToggle.setAttribute("aria-label", "Tampilkan kata sandi");
    passwordToggle.title = "Tampilkan kata sandi";

    const eyeIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const eyeOffIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"></path><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path><path d="M9.9 5.2A11.2 11.2 0 0 1 12 5c6.4 0 10 7 10 7a14.7 14.7 0 0 1-3.1 3.9"></path><path d="M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 3.1-.5"></path></svg>';

    passwordToggle.innerHTML = eyeIcon;
    passwordToggle.addEventListener("click", () => {
      const visible = password.input.type === "password";
      password.input.type = visible ? "text" : "password";
      passwordToggle.innerHTML = visible ? eyeOffIcon : eyeIcon;
      passwordToggle.setAttribute(
        "aria-label",
        visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
      );
      passwordToggle.title = visible
        ? "Sembunyikan kata sandi"
        : "Tampilkan kata sandi";
    });
    passwordWrap.append(passwordToggle);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "primary";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ghost";

    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "ghost";
    logout.textContent = "Logout";
    logout.hidden = true;
    form.append(submit, toggle, logout);
    panel.append(form);

    function setMode(next) {
      mode = next;
      const registering = mode === "register";
      name.label.hidden = !registering;
      name.input.required = registering;
      password.input.autocomplete = registering ? "new-password" : "current-password";
      submit.textContent = registering ? "Buat akun" : "Login";
      toggle.textContent = registering ? "Sudah punya akun? Login" : "Belum punya akun? Daftar";
      message.textContent = "";
    }

    function showUser(user) {
      accountUser = user || null;
  const navAccountLabel = document.getElementById("navAccountLabel");
  if (navAccountLabel) {
    navAccountLabel.textContent = accountUser
      ? accountUser.name
      : "Login / Akun";
  }
      status.textContent = accountUser
        ? "Login sebagai " + accountUser.name + " (" + accountUser.email + ")"
        : "Status: belum login";
      form.hidden = Boolean(accountUser);
      logout.hidden = !accountUser;
      googleSection.hidden = Boolean(accountUser) || !googleAvailable;
    }

    async function setupGoogleLogin() {
      try {
        const configResponse = await fetch("/api/auth/google/config", {
          credentials: "same-origin",
          cache: "no-store"
        });
        if (!configResponse.ok) throw new Error("Konfigurasi Google tidak tersedia.");

        const config = await configResponse.json();
        if (!config.clientId) throw new Error("Client ID Google belum diatur.");

        if (!window.google?.accounts?.id) {
          await new Promise((resolve, reject) => {
            let script = document.getElementById("umaira-google-identity-script");
            if (!script) {
              script = document.createElement("script");
              script.id = "umaira-google-identity-script";
              script.src = "https://accounts.google.com/gsi/client";
              script.async = true;
              script.defer = true;
              document.head.append(script);
            }
            if (window.google?.accounts?.id) return resolve();
            script.addEventListener("load", resolve, { once: true });
            script.addEventListener("error", () => reject(
              new Error("Library login Google gagal dimuat.")
            ), { once: true });
          });
        }

        if (!window.google?.accounts?.id) {
          throw new Error("Layanan login Google tidak tersedia.");
        }

        window.google.accounts.id.initialize({
          client_id: config.clientId,
          callback: async (googleResponse) => {
            if (!googleResponse?.credential) {
              message.textContent = "Google tidak memberikan kredensial login.";
              return;
            }

            googleButtonHost.setAttribute("aria-busy", "true");
            message.textContent = "Memverifikasi akun Google...";
            try {
              const response = await fetch("/api/auth/google", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ credential: googleResponse.credential })
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error || "Login Google gagal.");

              showUser(result.user);
              form.reset();
              message.textContent = "Login Google berhasil.";
              openView("chat");
            } catch (error) {
              message.textContent = error.message || "Login Google gagal.";
            } finally {
              googleButtonHost.removeAttribute("aria-busy");
            }
          }
        });

        googleButtonHost.replaceChildren();
        window.google.accounts.id.renderButton(googleButtonHost, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: Math.min(320, Math.max(220, panel.clientWidth - 40))
        });

        googleAvailable = true;
        googleSection.hidden = Boolean(accountUser);
      } catch (error) {
        googleAvailable = false;
        googleSection.hidden = true;
        console.warn("Umaira Google login:", error.message);
      }
    }

    setupGoogleLogin();

    toggle.addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));

    form.addEventListener("submit", async event => {
      event.preventDefault();
      submit.disabled = true;
      message.textContent = "Memproses...";
      try {
        const body = { email: email.input.value.trim(), password: password.input.value };
        if (mode === "register") body.name = name.input.value.trim();
        const response = await fetch("/api/auth/" + mode, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body)
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Permintaan gagal.");
        showUser(result.user);
        form.reset();
        message.textContent = mode === "register" ? "Akun berhasil dibuat." : "Login berhasil.";
        openView("chat");
      } catch (error) {
        message.textContent = error.message || "Koneksi gagal.";
      } finally {
        submit.disabled = false;
      }
    });

    logout.addEventListener("click", async () => {
      logout.disabled = true;
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "same-origin"
        });
        if (!response.ok) throw new Error("Logout gagal.");
        showUser(null);
        setMode("login");
        form.reset();
        message.textContent = "Kamu sudah logout.";
      } catch (error) {
        message.textContent = error.message || "Logout gagal.";
      } finally {
        logout.disabled = false;
      }
    });

    setMode("login");
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then(response => {
        if (!response.ok) throw new Error("Status akun tidak tersedia.");
        return response.json();
      })
      .then(result => showUser(result.user || null))
      .catch(() => {
        status.textContent = "Gagal memeriksa akun. Pastikan server aktif.";
      });
  }

  function openView(view) {
    navItems.forEach(item => {
      const active = item.dataset.view === view;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });

    if (view === "settings" || view === "account") {
      navItems.forEach(item => {
        item.classList.toggle("active", item.dataset.view === view);
      });

      chatSection.hidden = true;
      featureWorkspace.hidden = false;
      featureTitle.textContent = view === "settings" ? "Pengaturan" : "Akun";
      featureDescription.textContent = view === "settings"
        ? "Sesuaikan preferensi Umaira AI."
        : "Halaman akun Umaira AI.";
      featurePageContent.replaceChildren();

      const panel = document.createElement("div");
      panel.className = "umaira-settings-panel";

      if (view === "settings") {
        const heading = document.createElement("h2");
        heading.textContent = "Preferensi tampilan";
        panel.append(heading);

        const label = document.createElement("label");
        label.className = "umaira-setting-row";
        label.textContent = "Tema tampilan";

        const select = document.createElement("select");
        select.id = "umairaThemeSetting";
        select.className = "umaira-setting-select";

        [["light", "Terang"], ["system", "Ikuti perangkat"]].forEach(([value, text]) => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          select.append(option);
        });

        select.value = localStorage.getItem("umaira-theme-preference") || "light";
        select.addEventListener("change", () => {
          localStorage.setItem("umaira-theme-preference", select.value);
          document.documentElement.dataset.umairaTheme = select.value;
          showUmairaToast("Preferensi tema berhasil disimpan.");
        });

        label.append(select);
        panel.append(label);

        const note = document.createElement("p");
        note.textContent = "Preferensi disimpan pada perangkat ini.";
        panel.append(note);
      } else {
        renderUmairaAccount(panel);
      }

      featurePageContent.append(panel);
      return;
    }

    if (view === "chat") {
      featureWorkspace.hidden = true;
      chatSection.hidden = false;

      renderChatMessages();
      return;
    }

    const page = pages[view];
    if (!page) return;

    chatSection.hidden = true;
    featureWorkspace.hidden = false;
    featureTitle.textContent = page.title;
    featureDescription.textContent = page.description;
    featurePageContent.replaceChildren();

    if (view === "images") {
      renderImageStudio();
      return;
    }

    if (view === "library") {
      renderLibrary();
      return;
    }

    if (view === "projects") { renderProjectsWorkspace(); return; }
    page.cards.forEach(card => {
      const article = document.createElement("article");
      article.className = "feature-card";

      const icon = document.createElement("div");
      icon.className = "feature-card-icon";
      icon.textContent = card[0];

      const heading = document.createElement("h2");
      heading.textContent = card[1];

      const paragraph = document.createElement("p");
      paragraph.textContent = card[2];

      const status = document.createElement("span");
      status.className = "feature-status";
      status.textContent = card[3];

      article.append(icon, heading, paragraph, status);
      featurePageContent.appendChild(article);
    });
  }

  navItems.forEach(item => {
    item.addEventListener("click", () => openView(item.dataset.view));
  });
})();





function showUmairaToast(message) {
  const previous = document.querySelector(".umaira-toast");
  if (previous) previous.remove();

  const toast = document.createElement("div");
  toast.className = "umaira-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const icon = document.createElement("span");
  icon.className = "umaira-toast-icon";
  icon.textContent = "✓";
  icon.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.className = "umaira-toast-message";
  text.textContent = message;

  toast.append(icon, text);
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("is-visible"));

  setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => toast.remove(), 220);
  }, 2800);
}



function showUmairaDeleteConfirm(projectName) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "umaira-confirm-overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("section");
    dialog.className = "umaira-confirm-dialog";
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "umairaConfirmTitle");
    dialog.setAttribute("aria-describedby", "umairaConfirmDescription");

    const icon = document.createElement("div");
    icon.className = "umaira-confirm-icon";
    icon.textContent = "!";
    icon.setAttribute("aria-hidden", "true");

    const title = document.createElement("h3");
    title.id = "umairaConfirmTitle";
    title.textContent = "Hapus proyek?";

    const description = document.createElement("p");
    description.id = "umairaConfirmDescription";
    description.textContent = "Proyek “" + projectName + "” akan dihapus dari daftar Umaira. Tindakan ini tidak dapat dibatalkan.";

    const actions = document.createElement("div");
    actions.className = "umaira-confirm-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "umaira-confirm-cancel";
    cancel.textContent = "Batal";

    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.className = "umaira-confirm-delete";
    confirm.textContent = "Ya, hapus";

    let finished = false;
    const finish = value => {
      if (finished) return;
      finished = true;
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
      resolve(value);
    };
    const onKeydown = event => {
      if (event.key === "Escape") finish(false);
      if (event.key === "Enter") finish(true);
    };

    cancel.addEventListener("click", () => finish(false));
    confirm.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", event => {
      if (event.target === overlay) finish(false);
    });

    actions.append(cancel, confirm);
    dialog.append(icon, title, description, actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    document.addEventListener("keydown", onKeydown);
    cancel.focus();
  });
}
