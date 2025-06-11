
let currentData = [];
let originalData = [];
let selectedCell = null;
let lockedCells = new Set();
let searchResults = [];
let currentSearchIndex = 0;
let stickyRowIndexes = new Set();
let currentFilename = "";

// ====================== OPEN EXPLORER ======================
function openExplorer(path = "") {
    fetch(`/browse?path=${encodeURIComponent(path)}`)
        .then(res => res.json())
        .then(data => {
            if (data.error) return alert(data.error);
            document.getElementById("currentPath").textContent = "documents/" + data.path;
            const list = document.getElementById("fileExplorerList");
            list.innerHTML = "";

            let hasContent = false;

            data.folders.forEach(folder => {
                const div = document.createElement("div");
                div.className = "explorer-item folder";
                div.textContent = "📁 " + folder;
                div.ondblclick = () => openExplorer((data.path ? data.path + "/" : "") + folder);
                list.appendChild(div);
                hasContent = true;
            });

            data.csv_files.forEach(file => {
                const div = document.createElement("div");
                div.className = "explorer-item file";
                div.textContent = "📄 " + file;
                div.ondblclick = () => {
                    currentFilename = (data.path ? data.path + "/" : "") + file;
                    document.getElementById("fileExplorerModal").classList.add("hidden");
                    fetch(`/load_csv?file=${encodeURIComponent(currentFilename)}`)
                        .then(r => r.text())
                        .then(text => {
                            currentData = parseCSV(text);
                            originalData = JSON.parse(JSON.stringify(currentData));
                            renderTable(currentData);
                        });
                };
                list.appendChild(div);
                hasContent = true;
            });

            document.getElementById("emptyMessage").style.display = hasContent ? "none" : "block";
            document.getElementById("fileExplorerModal").classList.remove("hidden");
        });
}

document.getElementById("btnGoUp").onclick = () => {
    const current = document.getElementById("currentPath").textContent.replace("documents/", "");
    const parts = current.split("/");
    parts.pop();
    openExplorer(parts.join("/"));
};

document.getElementById("btn-open").onclick = () => openExplorer();
document.getElementById("btn-help").onclick = () => document.getElementById("helpModal").classList.remove("hidden");
document.getElementById("closeHelp").onclick = () => document.getElementById("helpModal").classList.add("hidden");

// ====================== SEARCH ======================
function clearSearchHighlights() {
    document.querySelectorAll("td, th").forEach(cell => {
        cell.classList.remove("search-match", "search-current");
    });
    searchResults = [];
    currentSearchIndex = 0;
}
function highlightSearchMatches(query) {
    if (!query) return clearSearchHighlights();
    clearSearchHighlights();
    const q = query.toLowerCase();
    document.querySelectorAll("td, th").forEach(cell => {
        const text = (cell.textContent || '').trim().toLowerCase();
        if (q.length >= 2 && text.includes(q)) {
            cell.classList.add("search-match");
            searchResults.push(cell);
        }
    });
    if (searchResults.length > 0) {
        currentSearchIndex = 0;
        focusSearchResult();
    document.getElementById('searchCount').textContent = `${searchResults.length} результатов`;
    }
}
function focusSearchResult() {
    searchResults.forEach(c => c.classList.remove("search-current"));
    const cell = searchResults[currentSearchIndex];
    if (cell) {
        cell.classList.add("search-current");
        cell.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}
function nextSearchResult() {
    if (searchResults.length === 0) return;
    currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    focusSearchResult();
    document.getElementById('searchCount').textContent = `${searchResults.length} результатов`;
}
function prevSearchResult() {
    if (searchResults.length === 0) return;
    currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    focusSearchResult();
    document.getElementById('searchCount').textContent = `${searchResults.length} результатов`;
}
document.getElementById("search").addEventListener("input", e => highlightSearchMatches(e.target.value));

// ====================== FORMAT PANEL ======================
function applyToSelectedCell(callback) {
    if (!selectedCell) return;
    callback(selectedCell);
}

function changeFontSize(delta) {
    applyToSelectedCell(cell => {
        const size = parseInt(window.getComputedStyle(cell).fontSize) || 14;
        cell.style.fontSize = (size + delta) + "px";
    });
}

function toggleBold() {
    applyToSelectedCell(cell => {
        cell.style.fontWeight = (cell.style.fontWeight === "bold") ? "normal" : "bold";
    });
}
function toggleItalic() {
    applyToSelectedCell(cell => {
        cell.style.fontStyle = (cell.style.fontStyle === "italic") ? "normal" : "italic";
    });
}
function toggleUnderline() {
    applyToSelectedCell(cell => {
        cell.style.textDecoration = (cell.style.textDecoration === "underline") ? "none" : "underline";
    });
}
function alignText(direction) {
    applyToSelectedCell(cell => {
        cell.style.textAlign = direction;
    });
}

function resetFormatting() {
    applyToSelectedCell(cell => {
        cell.removeAttribute("style");
    });
}

// ====================== CSV ======================
function parseCSV(str) {
    return str.trim().split("\n").map(row => row.split(","));
}
function renderTable(data) {
    const table = document.getElementById("csvTable");
    table.innerHTML = "";
    const tbody = document.createElement("tbody");

    for (let r = 0; r < data.length; r++) {
        const tr = document.createElement("tr");
        for (let c = 0; c < data[r].length; c++) {
            const cell = document.createElement("td");
            cell.textContent = data[r][c];
            cell.dataset.row = r;
            cell.dataset.col = c;
            const key = r + "," + c;
            cell.contentEditable = !lockedCells.has(key);
            
            if (lockedCells.has(key)) {
                cell.classList.add("locked");
                const lockIcon = document.createElement("span");
                lockIcon.textContent = "🔒";
                lockIcon.style.float = "right";
                lockIcon.style.opacity = "0.5";
                lockIcon.style.fontSize = "10px";
                lockIcon.style.marginLeft = "4px";
                cell.appendChild(lockIcon);
            }

            cell.onclick = () => selectedCell = cell;
            tr.appendChild(cell);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);
}


// ====== Add Row / Column ======
document.getElementById("btn-add-row").onclick = () => {
    if (!currentData.length) return;
    const cols = currentData[0].length;
    currentData.push(new Array(cols).fill(""));
    renderTable(currentData);
};

document.getElementById("btn-add-col").onclick = () => {
    currentData.forEach(row => row.push(""));
    renderTable(currentData);
};

// ====== Save to current file ======
document.getElementById("btn-save").onclick = () => {
    if (!currentFilename) return alert("Файл не выбран");
    const csv = currentData.map(row => row.join(",")).join("\n");
    fetch('/save_csv', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: currentFilename, csv })
    }).then(r => r.json()).then(res => {
        if (res.success) alert("Сохранено");
        else alert("Ошибка сохранения");
    });
};

// ====== Theme Toggle ======
document.getElementById("btn-theme").onclick = () => {
    document.body.classList.toggle("dark");
};

// ====== Dummy Undo/Redo ======
function undo() { alert("undo() пока не реализовано"); }
function redo() { alert("redo() пока не реализовано"); }

document.getElementById("btn-toggle-lock").onclick = () => {
    if (!selectedCell) return;
    const key = selectedCell.dataset.row + "," + selectedCell.dataset.col;
    if (lockedCells.has(key)) lockedCells.delete(key);
    else lockedCells.add(key);
    renderTable(currentData);
};

document.addEventListener("keydown", e => {
    if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        document.getElementById("btn-save").click();
    }
    if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        document.getElementById("btn-open").click();
    }
    if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        undo();
    }
    if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redo();
    }
    if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        document.getElementById("btn-add-row").click();
    }
    if (e.ctrlKey && e.key === "d") {
        e.preventDefault();
        document.getElementById("btn-delete-row").click();
    }
    if (e.ctrlKey && e.key === "e") {
        e.preventDefault();
        document.getElementById("btn-add-col").click();
    }
    if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        document.getElementById("btn-delete-col").click();
    }
    if (e.ctrlKey && e.key === "?") {
        e.preventDefault();
        document.getElementById("btn-help").click();
    }

    if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        document.getElementById("search").focus();
    }
    if (e.key === "Escape") {
        document.getElementById("search").value = "";
        highlightSearchMatches("");
    }
    if (e.ctrlKey && e.key === "ArrowDown") {
        e.preventDefault();
        nextSearchResult();
    }
    if (e.ctrlKey && e.key === "ArrowUp") {
        e.preventDefault();
        prevSearchResult();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleBold();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        toggleItalic();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        toggleUnderline();
    }
    if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        document.getElementById("btn-toggle-lock").click();
    }
});
