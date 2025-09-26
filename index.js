/*
  Todo app features:
  - todos stored as array of { id, title, completed }
  - filter: all / active / completed
  - search that respects active filter
  - unique title validation (case-insensitive)
  - edit existing todo (form becomes edit mode)
  - sortable drag & drop with persistence (SortableJS)
*/

const LS_KEY = 'todos';
let todos = [];
let filter = 'all';
let searchQuery = '';
let editingId = null;

const form = document.getElementById('formData');
const todoInput = document.getElementById('todoInput');
const submitBtn = document.getElementById('submitBtn');
const todoListEl = document.getElementById('todoList');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');
const clearBtn = document.getElementById('clearBtn');
const emptyNote = document.getElementById('emptyNote');
const countBadge = document.getElementById('countBadge');

// Load from localStorage
function loadTodos() {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try {
      todos = JSON.parse(raw) || [];
    } catch(e) {
      todos = [];
    }
  } else {
    todos = [];
  }
}

// Save to localStorage
function saveTodos() {
  localStorage.setItem(LS_KEY, JSON.stringify(todos));
}

// Utility: generate id
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

// Render based on filter & search
function renderTodos() {
  // Filter first
  let shown = todos.slice(); // copy (keeps order)
  if (filter === 'active') shown = shown.filter(t => !t.completed);
  if (filter === 'completed') shown = shown.filter(t => t.completed);

  // Search (case-insensitive)
  if (searchQuery.trim() !== '') {
    const q = searchQuery.trim().toLowerCase();
    shown = shown.filter(t => t.title.toLowerCase().includes(q));
  }

  todoListEl.innerHTML = '';
  if (shown.length === 0) {
    emptyNote.style.display = 'block';
  } else {
    emptyNote.style.display = 'none';
  }

  shown.forEach(item => {
    const li = document.createElement('li');
    li.dataset.id = item.id;

    // Left side: checkbox + title
    const left = document.createElement('div');
    left.className = 'todo-left';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = !!item.completed;
    chk.addEventListener('change', () => {
      // toggle completed
      const idx = todos.findIndex(t => t.id === item.id);
      if (idx >= 0) {
        todos[idx].completed = chk.checked;
        saveTodos();
        renderTodos();
      }
    });

    const title = document.createElement('div');
    title.className = 'todo-title';
    if (item.completed) title.classList.add('completed');
    title.textContent = item.title;

    left.appendChild(chk);
    left.appendChild(title);

    // Right side: actions
    const right = document.createElement('div');
    right.className = 'd-flex gap-1 align-items-center';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-sm btn-outline-light btn-icon btn-icon-sm';
    editBtn.innerHTML = '<i class="bi bi-pencil"></i>';
    editBtn.title = 'Edit';
    editBtn.addEventListener('click', () => startEdit(item.id));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-outline-danger btn-icon';
    delBtn.innerHTML = '<i class="bi bi-trash"></i>';
    delBtn.title = 'Hapus';
    delBtn.addEventListener('click', () => {
      if (!confirm('Hapus todo ini?')) return;
      todos = todos.filter(t => t.id !== item.id);
      saveTodos();
      renderTodos();
    });

    right.appendChild(editBtn);
    right.appendChild(delBtn);

    li.appendChild(left);
    li.appendChild(right);

    todoListEl.appendChild(li);
  });

  // Update count badge
  const total = todos.length;
  const completedCount = todos.filter(t=>t.completed).length;
  countBadge.textContent = `${completedCount}/${total} selesai`;
}

// Add new todo (or save edit)
form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const value = todoInput.value.trim();
  if (!value) {
    alert('Judul todo tidak boleh kosong.');
    return;
  }

  // Validation: unique title (case-insensitive). If editing, exclude the editingId.
  const duplicate = todos.some(t => t.title.toLowerCase() === value.toLowerCase() && t.id !== editingId);
  if (duplicate) {
    alert('Sudah ada todo dengan judul yang sama. Gunakan judul lain.');
    return;
  }

  if (editingId) {
    // Save edit
    const idx = todos.findIndex(t => t.id === editingId);
    if (idx >= 0) {
      todos[idx].title = value;
      editingId = null;
      submitBtn.textContent = 'Tambah';
      submitBtn.classList.remove('btn-warning');
      submitBtn.classList.add('btn-primary');
    }
  } else {
    // Insert at top (keputusan design: preserve earlier behavior)
    todos.unshift({ id: uid(), title: value, completed: false });
  }

  form.reset();
  saveTodos();
  renderTodos();
});

// Start edit flow: populate input and switch to edit mode
function startEdit(id){
  const t = todos.find(x => x.id === id);
  if (!t) return;
  editingId = id;
  todoInput.value = t.title;
  submitBtn.textContent = 'Simpan';
  submitBtn.classList.remove('btn-primary');
  submitBtn.classList.add('btn-warning');
  todoInput.focus();
}

// Filter buttons
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.filter;
    renderTodos();
  });
});

// Search input (keep filter intact)
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderTodos();
});

// Clear all todos
clearBtn.addEventListener('click', () => {
  if (!confirm('Hapus semua todo? Tindakan ini tidak dapat dibatalkan.')) return;
  todos = [];
  saveTodos();
  renderTodos();
});

// SortableJS initialization
const sortable = new Sortable(todoListEl, {
  animation: 150,
  onStart: (evt) => {
    evt.item.classList.add('dragging');
  },
  onEnd: (evt) => {
    evt.item.classList.remove('dragging');
    // After reorder, read current DOM order and reconstruct todos array accordingly.
    const orderedIds = Array.from(todoListEl.children).map(li => li.dataset.id);
    // Build new array preserving properties
    const newTodos = [];
    orderedIds.forEach(id => {
      const t = todos.find(x => x.id === id);
      if (t) newTodos.push(t);
    });
    // Note: items filtered out due to active filter/search are not present in DOM.
    // We must ensure the todos that are not shown preserve relative order.
    // Strategy: Replace the positions of the shown items within the original todos array.
    // Build map for new positions
    const shownSet = new Set(orderedIds);
    const rest = todos.filter(t => !shownSet.has(t.id)); // keep their relative order
    // Merge: find index of first shown item's position in original todos to place new ordering
    // Simpler: we'll put rest after the ordered ones (keeps shown ones arranged upfront). This preserves a stable order and is expected by UX.
    todos = newTodos.concat(rest);
    saveTodos();
    renderTodos();
  }
});

// Persist on unload (also saves during operations above)
window.addEventListener('beforeunload', saveTodos);

// Load initially
loadTodos();
renderTodos();