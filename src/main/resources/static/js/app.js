// --- JWT Authentication Fetch Interceptor ---
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
    const token = localStorage.getItem("accessToken");
    if (token) {
        options.headers = options.headers || {};
        options.headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await originalFetch(url, options);
    
    // 401 Unauthorized 발생 시 자동 로그아웃 처리
    if (response.status === 401) {
        handleLogout();
    }
    return response;
};

// Global state
let categories = [];
let logs = [];

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

async function initApp() {
    if (checkAuth()) {
        await loadCategories();
        await loadLogs();
        initSse();
    }
}

function checkAuth() {
    const token = localStorage.getItem("accessToken");
    const role = localStorage.getItem("userRole");
    const username = localStorage.getItem("username");
    
    const loginModal = document.getElementById("login-modal");
    const userInfoBadge = document.getElementById("user-info-badge");
    const btnLogout = document.getElementById("btn-logout");
    const btnManageCategory = document.getElementById("btn-manage-category");
    const leftPanel = document.getElementById("left-panel");
    const dashboardGrid = document.getElementById("dashboard-grid");
    const thActions = document.getElementById("th-actions");
    
    if (!token) {
        if (loginModal) loginModal.classList.add("active");
        if (userInfoBadge) userInfoBadge.style.display = "none";
        if (btnLogout) btnLogout.style.display = "none";
        if (btnManageCategory) btnManageCategory.style.display = "none";
        return false;
    }
    
    if (loginModal) loginModal.classList.remove("active");
    
    if (userInfoBadge) {
        let roleName = "일반 사용자";
        if (role === "ROLE_ADMIN") roleName = "관리자";
        else if (role === "ROLE_ANALYST") roleName = "분석가";
        
        userInfoBadge.textContent = `👤 ${username} (${roleName})`;
        userInfoBadge.style.display = "inline-block";
    }
    if (btnLogout) btnLogout.style.display = "inline-block";
    
    // 역할별 UI 컨트롤
    if (role === "ROLE_ADMIN") {
        if (btnManageCategory) btnManageCategory.style.display = "inline-block";
        if (leftPanel) leftPanel.style.display = "block";
        if (dashboardGrid) {
            if (window.innerWidth >= 1024) {
                dashboardGrid.style.gridTemplateColumns = "350px 1fr";
            } else {
                dashboardGrid.style.gridTemplateColumns = "1fr";
            }
        }
        if (thActions) thActions.style.display = "";
    } else if (role === "ROLE_ANALYST") {
        if (btnManageCategory) btnManageCategory.style.display = "none";
        if (leftPanel) leftPanel.style.display = "block";
        if (dashboardGrid) {
            if (window.innerWidth >= 1024) {
                dashboardGrid.style.gridTemplateColumns = "350px 1fr";
            } else {
                dashboardGrid.style.gridTemplateColumns = "1fr";
            }
        }
        if (thActions) thActions.style.display = "";
    } else { // ROLE_USER (일반 사용자 - 읽기 전용)
        if (btnManageCategory) btnManageCategory.style.display = "none";
        if (leftPanel) leftPanel.style.display = "none";
        if (dashboardGrid) dashboardGrid.style.gridTemplateColumns = "1fr";
        if (thActions) thActions.style.display = "none";
    }
    
    return true;
}

// 1. Fetch & Load Categories
async function loadCategories() {
    try {
        const response = await fetch("/api/categories");
        if (!response.ok) throw new Error("Failed to fetch categories");
        categories = await response.ok ? await response.json() : [];
        
        populateCategorySelects();
        renderCategoryTable();
    } catch (error) {
        console.error("Error loading categories:", error);
    }
}

// 2. Fetch & Load Threat Logs
async function loadLogs() {
    try {
        const response = await fetch("/api/logs");
        if (!response.ok) throw new Error("Failed to fetch logs");
        logs = await response.json();
        
        renderLogTable();
        updateStats();
    } catch (error) {
        console.error("Error loading logs:", error);
    }
}

// Helper: Populate select options
function populateCategorySelects() {
    const logSelect = document.getElementById("form-category");
    const editSelect = document.getElementById("edit-category");
    const filterSelect = document.getElementById("filter-category");
    
    // Clear and add placeholder
    logSelect.innerHTML = '<option value="">-- 카테고리 선택 --</option>';
    editSelect.innerHTML = '<option value="">-- 카테고리 선택 --</option>';
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">전체 카테고리</option>';
    }
    
    categories.forEach(cat => {
        const opt1 = document.createElement("option");
        opt1.value = cat.id;
        opt1.textContent = cat.name;
        logSelect.appendChild(opt1);
        
        const opt2 = document.createElement("option");
        opt2.value = cat.id;
        opt2.textContent = cat.name;
        editSelect.appendChild(opt2);
        
        if (filterSelect) {
            const opt3 = document.createElement("option");
            opt3.value = cat.id;
            opt3.textContent = cat.name;
            filterSelect.appendChild(opt3);
        }
    });
}

// Helper: Render Category Table inside modal
function renderCategoryTable() {
    const tableBody = document.getElementById("category-list-body");
    tableBody.innerHTML = "";
    
    if (categories.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-secondary);">등록된 카테고리가 없습니다.</td></tr>';
        return;
    }
    
    categories.forEach(cat => {
        const tr = document.createElement("tr");
        
        const tdName = document.createElement("td");
        tdName.textContent = cat.name;
        tdName.style.fontWeight = "600";
        
        const tdDesc = document.createElement("td");
        tdDesc.textContent = cat.description || "-";
        
        const tdAction = document.createElement("td");
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-danger btn-sm";
        deleteBtn.textContent = "삭제";
        deleteBtn.onclick = () => deleteCategory(cat.id);
        tdAction.appendChild(deleteBtn);
        
        tr.appendChild(tdName);
        tr.appendChild(tdDesc);
        tr.appendChild(tdAction);
        
        tableBody.appendChild(tr);
    });
}

// Helper: Render Threat Logs Table
function renderLogTable() {
    const tableBody = document.getElementById("log-table-body");
    tableBody.innerHTML = "";
    
    const severityFilter = document.getElementById("filter-severity") ? document.getElementById("filter-severity").value : "";
    const categoryFilter = document.getElementById("filter-category") ? document.getElementById("filter-category").value : "";
    
    const displayLogs = logs.filter(log => {
        const matchesSeverity = !severityFilter || (log.severityLevel || "").toUpperCase() === severityFilter.toUpperCase();
        const matchesCategory = !categoryFilter || (log.categoryId !== null && log.categoryId !== undefined && log.categoryId.toString() === categoryFilter);
        return matchesSeverity && matchesCategory;
    });
    
    const countBadge = document.getElementById("log-count-badge");
    if (countBadge) {
        countBadge.textContent = `${displayLogs.length}개 항목`;
    }
    
    if (displayLogs.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 2rem;">조건에 맞는 위협 로그가 없습니다.</td></tr>';
        return;
    }
    
    displayLogs.forEach(log => {
        const tr = document.createElement("tr");
        tr.id = `main-row-${log.id}`;
        tr.style.cursor = "pointer";
        tr.onclick = (e) => {
            // 버튼이나 액션 영역 클릭시 드롭다운 토글 방지
            if (e.target.closest(".actions-wrapper") || e.target.closest("button")) {
                return;
            }
            toggleLogDetails(log.id);
        };
        
        const tdCat = document.createElement("td");
        tdCat.textContent = log.categoryName || "미지정";
        tdCat.style.fontWeight = "500";
        
        const tdName = document.createElement("td");
        const portStr = log.port !== null && log.port !== undefined && log.port !== 0 ? `:${log.port}` : '';
        const ipInfo = (log.sourceIp || log.destinationIp) ? `${log.sourceIp || 'Unknown'} → ${log.destinationIp || 'Unknown'}${portStr}` : '';
        
        tdName.innerHTML = `
            <div><strong>${log.threatName}</strong></div>
            ${ipInfo ? `<div style="font-size: 0.8rem; color: #818cf8; margin-top: 2px; font-family: monospace; display: flex; align-items: center; gap: 0.25rem;">${ipInfo}</div>` : ''}
            <div style="font-size: 0.8rem; color: var(--text-secondary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;">${log.description || ''}</div>
        `;
        
        // IP 평판 독립 열 추가
        const tdAbuse = document.createElement("td");
        if (log.sourceIp && log.sourceIp !== 'Unknown' && log.abuseScore !== null && log.abuseScore !== undefined) {
            let scoreClass = 'badge-low';
            let scoreLabel = 'Safe';
            if (log.abuseScore > 50) {
                scoreClass = 'badge-high';
                scoreLabel = 'Malicious';
            } else if (log.abuseScore > 0) {
                scoreClass = 'badge-medium';
                scoreLabel = 'Suspicious';
            }
            tdAbuse.innerHTML = `<span class="badge ${scoreClass}" style="font-size: 0.75rem; text-transform: uppercase; white-space: nowrap;">${scoreLabel}: ${log.abuseScore}%</span>`;
        } else {
            tdAbuse.innerHTML = `<span style="color: var(--text-secondary); font-size: 0.85rem;">-</span>`;
        }
        
        const tdSeverity = document.createElement("td");
        const severity = (log.severityLevel || "LOW").toUpperCase();
        let badgeClass = "badge-low";
        if (severity === "HIGH") badgeClass = "badge-high";
        else if (severity === "MEDIUM") badgeClass = "badge-medium";
        
        const badge = document.createElement("span");
        badge.className = `badge ${badgeClass}`;
        badge.textContent = severity;
        tdSeverity.appendChild(badge);

        const tdStatus = document.createElement("td");
        const status = (log.status || "DETECTED").toUpperCase();
        let statusBadgeClass = "badge-detected";
        if (status === "ANALYZING") statusBadgeClass = "badge-analyzing";
        else if (status === "RESOLVED") statusBadgeClass = "badge-resolved";
        else if (status === "FALSE_POSITIVE") statusBadgeClass = "badge-falsepositive";
        
        const statusBadge = document.createElement("span");
        statusBadge.className = `badge ${statusBadgeClass}`;
        statusBadge.textContent = status.replace('_', ' ');
        tdStatus.appendChild(statusBadge);
        
        const tdDate = document.createElement("td");
        tdDate.className = "date-text";
        tdDate.style.textAlign = "center";
        tdDate.innerHTML = formatDateTimeToThreeLines(log.loggedAt);
        
        const role = localStorage.getItem("userRole");
        const tdActions = document.createElement("td");
        tdActions.className = "actions-cell";
        
        const actionsWrapper = document.createElement("div");
        actionsWrapper.className = "actions-wrapper";
        
        const editBtn = document.createElement("button");
        editBtn.className = "btn btn-secondary btn-sm";
        editBtn.innerHTML = "✏️ 수정";
        editBtn.style.whiteSpace = "nowrap";
        editBtn.style.display = "inline-flex";
        editBtn.style.alignItems = "center";
        editBtn.style.gap = "0.2rem";
        editBtn.onclick = () => openEditModal(log.id);
        
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "btn btn-danger btn-sm";
        deleteBtn.innerHTML = "🗑️";
        deleteBtn.style.whiteSpace = "nowrap";
        deleteBtn.onclick = () => deleteLog(log.id);
        
        actionsWrapper.appendChild(editBtn);
        if (role === "ROLE_ADMIN") {
            actionsWrapper.appendChild(deleteBtn);
        }
        tdActions.appendChild(actionsWrapper);
        
        tr.appendChild(tdCat);
        tr.appendChild(tdName);
        tr.appendChild(tdAbuse); // 위험 점수 열 바인딩
        tr.appendChild(tdSeverity);
        tr.appendChild(tdStatus);
        tr.appendChild(tdDate);
        
        if (role === "ROLE_ADMIN" || role === "ROLE_ANALYST") {
            tr.appendChild(tdActions);
        }
        
        // 상세 보기 드롭다운 행 생성 및 구성
        const colCount = (role === "ROLE_ADMIN" || role === "ROLE_ANALYST") ? 7 : 6;
        const detailsTr = document.createElement("tr");
        detailsTr.id = `details-${log.id}`;
        detailsTr.className = "details-row";
        detailsTr.style.display = "none";
        detailsTr.style.backgroundColor = "rgba(0, 0, 0, 0.2)";
        
        detailsTr.innerHTML = `
            <td colspan="${colCount}" style="padding: 1.25rem; border-bottom: 1px solid var(--border-color); text-align: left;">
                <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                    <div>
                        <strong style="color: var(--text-primary); font-size: 0.85rem; display: block; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">📝 상세 설명 (Description)</strong>
                        <div style="color: var(--text-secondary); font-size: 0.85rem; background: rgba(255, 255, 255, 0.02); border-radius: 8px; border: 1px solid var(--border-color); padding: 0.8rem; line-height: 1.5; white-space: pre-wrap;">
                            ${log.description || '상세 설명이 등록되지 않았습니다.'}
                        </div>
                    </div>
                    <div>
                        <strong style="color: #818cf8; font-size: 0.85rem; display: block; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">🛡️ AI 권고 조치 방안 (Mitigation Playbook)</strong>
                        <div class="terminal-container" style="background: #090d16; border: 1px solid rgba(129, 140, 248, 0.2); border-radius: 8px; padding: 1rem; font-family: 'Courier New', Courier, monospace; color: #a5b4fc; font-size: 0.8rem; line-height: 1.6; max-height: 300px; overflow-y: auto; white-space: pre-wrap; text-align: left;">
                            ${log.aiRecommendation || '대응 가이드를 작성하는 중이거나 내용이 없습니다.'}
                        </div>
                    </div>
                </div>
            </td>
        `;
        
        tableBody.appendChild(tr);
        tableBody.appendChild(detailsTr);
    });
}

// Helper: Format ISO String to user-friendly local date-time in 3 clean stacked lines
function formatDateTimeToThreeLines(isoString) {
    if (!isoString) return "-";
    const date = new Date(isoString);
    
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    
    return `
        <div style="font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap;">${yyyy}년</div>
        <div style="font-size: 0.85rem; font-weight: 500; margin: 1px 0; white-space: nowrap;">${mm}월 ${dd}일</div>
        <div style="font-size: 0.8rem; font-family: monospace; color: #818cf8; white-space: nowrap;">${hh}:${min}:${ss}</div>
    `;
}

// Helper: Update Dashboard Statistics
function updateStats() {
    const totalCount = logs.length;
    const highCount = logs.filter(l => (l.severityLevel || "").toUpperCase() === "HIGH").length;
    const mediumCount = logs.filter(l => (l.severityLevel || "").toUpperCase() === "MEDIUM").length;
    const lowCount = logs.filter(l => (l.severityLevel || "").toUpperCase() === "LOW").length;
    
    document.getElementById("count-total").textContent = totalCount;
    document.getElementById("count-high").textContent = highCount;
    document.getElementById("count-medium").textContent = mediumCount;
    document.getElementById("count-low").textContent = lowCount;
}

// 3. Post New Threat Log
async function handleLogSubmit(event) {
    event.preventDefault();
    
    const categoryId = document.getElementById("form-category").value;
    const threatName = document.getElementById("form-name").value;
    const severityLevel = document.getElementById("form-severity").value;
    const description = document.getElementById("form-description").value;
    const sourceIp = document.getElementById("form-source-ip").value;
    const destinationIp = document.getElementById("form-dest-ip").value;
    const portVal = document.getElementById("form-port").value;
    const port = portVal ? parseInt(portVal) : null;
    const status = document.getElementById("form-status").value;
    
    const payload = {
        categoryId: parseInt(categoryId),
        threatName,
        severityLevel,
        description,
        sourceIp,
        destinationIp,
        port,
        status
    };
    
    try {
        const response = await fetch("/api/logs", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg || "Failed to save threat log");
        }
        
        // Reset Form & Reload logs
        document.getElementById("threat-form").reset();
        await loadLogs();
    } catch (error) {
        alert("위협 로그 등록 실패: " + error.message);
    }
}

// 4. Post New Category
async function handleCategorySubmit(event) {
    event.preventDefault();
    
    const name = document.getElementById("cat-name").value;
    const description = document.getElementById("cat-desc").value;
    
    const payload = { name, description };
    
    try {
        const response = await fetch("/api/categories", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg || "Failed to save category");
        }
        
        document.getElementById("category-form").reset();
        await loadCategories();
    } catch (error) {
        alert("카테고리 등록 실패: " + error.message);
    }
}

// 5. Delete Threat Log
async function deleteLog(id) {
    if (!confirm("정말로 이 위협 로그를 아카이브에서 삭제하시겠습니까?")) return;
    
    try {
        const response = await fetch(`/api/logs/${id}`, {
            method: "DELETE"
        });
        
        if (!response.ok) throw new Error("Failed to delete log");
        await loadLogs();
    } catch (error) {
        alert("로그 삭제 실패: " + error.message);
    }
}

// 6. Delete Category
async function deleteCategory(id) {
    if (!confirm("카테고리를 삭제하면 해당 카테고리에 할당된 모든 위협 로그도 함께 삭제될 수 있습니다. 진행하시겠습니까?")) return;
    
    try {
        const response = await fetch(`/api/categories/${id}`, {
            method: "DELETE"
        });
        
        if (!response.ok) throw new Error("Failed to delete category");
        
        await loadCategories();
        await loadLogs(); // logs also reload due to ON DELETE CASCADE
    } catch (error) {
        alert("카테고리 삭제 실패: " + error.message);
    }
}

// 7. Edit Log Modal handlers
async function openEditModal(id) {
    try {
        const response = await fetch(`/api/logs/${id}`);
        if (!response.ok) throw new Error("Failed to fetch log details");
        const log = await response.json();
        
        document.getElementById("edit-id").value = log.id;
        document.getElementById("edit-category").value = log.categoryId;
        document.getElementById("edit-name").value = log.threatName;
        document.getElementById("edit-severity").value = log.severityLevel;
        document.getElementById("edit-description").value = log.description || "";
        document.getElementById("edit-source-ip").value = log.sourceIp || "";
        document.getElementById("edit-dest-ip").value = log.destinationIp || "";
        document.getElementById("edit-port").value = log.port !== null && log.port !== undefined && log.port !== 0 ? log.port : "";
        document.getElementById("edit-status").value = log.status || "DETECTED";
        
        // AI 권고 조치 방안 노출 설정
        const aiRecContainer = document.getElementById("edit-ai-rec-container");
        const aiRecValue = document.getElementById("edit-ai-recommendation");
        if (aiRecContainer && aiRecValue) {
            if (log.aiRecommendation) {
                aiRecValue.textContent = log.aiRecommendation;
                aiRecContainer.style.display = "block";
            } else {
                aiRecValue.textContent = "";
                aiRecContainer.style.display = "none";
            }
        }
        
        document.getElementById("edit-modal").classList.add("active");
    } catch (error) {
        alert("수정 창 열기 실패: " + error.message);
    }
}

function closeEditModal() {
    document.getElementById("edit-modal").classList.remove("active");
    document.getElementById("edit-form").reset();
}

async function handleEditSubmit(event) {
    event.preventDefault();
    
    const id = document.getElementById("edit-id").value;
    const categoryId = document.getElementById("edit-category").value;
    const threatName = document.getElementById("edit-name").value;
    const severityLevel = document.getElementById("edit-severity").value;
    const description = document.getElementById("edit-description").value;
    const sourceIp = document.getElementById("edit-source-ip").value;
    const destinationIp = document.getElementById("edit-dest-ip").value;
    const portVal = document.getElementById("edit-port").value;
    const port = portVal ? parseInt(portVal) : null;
    const status = document.getElementById("edit-status").value;
    
    const payload = {
        categoryId: parseInt(categoryId),
        threatName,
        severityLevel,
        description,
        sourceIp,
        destinationIp,
        port,
        status
    };
    
    try {
        const response = await fetch(`/api/logs/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg || "Failed to update threat log");
        }
        
        closeEditModal();
        await loadLogs();
    } catch (error) {
        alert("수정 실패: " + error.message);
    }
}

// Category modal toggles
function openCategoryModal() {
    document.getElementById("category-modal").classList.add("active");
}

function closeCategoryModal() {
    document.getElementById("category-modal").classList.remove("active");
}

// --- SSE Real-time Notification System ---
function initSse() {
    const eventSource = new EventSource("/api/sse/connect");

    eventSource.addEventListener("INIT", (event) => {
        console.log("SSE Connection Initialized:", event.data);
    });

    eventSource.addEventListener("THREAT_LOG", (event) => {
        try {
            const logDto = JSON.parse(event.data);
            handleIncomingThreatLog(logDto);
        } catch (e) {
            console.error("Error handling SSE event:", e);
        }
    });

    eventSource.addEventListener("THREAT_LOG_DELETE", (event) => {
        try {
            const logDto = JSON.parse(event.data);
            handleIncomingDeleteLog(logDto);
        } catch (e) {
            console.error("Error handling SSE delete event:", e);
        }
    });

    eventSource.onerror = (error) => {
        console.error("SSE connection lost. Reconnecting in 5s...", error);
        eventSource.close();
        setTimeout(initSse, 5000);
    };
}

function handleIncomingThreatLog(logDto) {
    const existingIndex = logs.findIndex(l => l.id === logDto.id);
    let isUpdate = false;

    if (existingIndex !== -1) {
        // Update in place if it already exists
        logs[existingIndex] = logDto;
        isUpdate = true;
    } else {
        // Prepend new log
        logs.unshift(logDto);
    }

    // Re-render dashboard stats & table
    renderLogTable();
    updateStats();

    // Trigger toast notification
    showThreatToast(logDto, isUpdate);
}

function showThreatToast(logDto, isUpdate) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    const severity = (logDto.severityLevel || "LOW").toUpperCase();
    toast.className = `toast toast-${severity.toLowerCase()}`;

    let severityIcon = "🟢";
    if (severity === "HIGH") severityIcon = "🔴";
    else if (severity === "MEDIUM") severityIcon = "🟡";

    const typeLabel = isUpdate ? "✏️ 위협 로그 수정됨" : "🚨 신규 위협 감지됨";
    const portStr = logDto.port !== null && logDto.port !== undefined && logDto.port !== 0 ? `:${logDto.port}` : '';
    let ipInfo = (logDto.sourceIp || logDto.destinationIp) ? `${logDto.sourceIp || 'Unknown'} → ${logDto.destinationIp || 'Unknown'}${portStr}` : '';
    if (logDto.sourceIp && logDto.sourceIp !== 'Unknown' && logDto.abuseScore !== null && logDto.abuseScore !== undefined) {
        ipInfo += ` (Abuse Score: ${logDto.abuseScore}%)`;
    }
    const statusText = (logDto.status || "DETECTED").replace('_', ' ');

    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">${severityIcon} <strong>${typeLabel}</strong></span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
        <div class="toast-body">
            <strong>${logDto.threatName}</strong> [${statusText}]
        </div>
        ${logDto.description ? `<div class="toast-desc">${logDto.description}</div>` : ''}
        ${ipInfo ? `<div class="toast-info">${ipInfo}</div>` : ''}
    `;

    container.appendChild(toast);

    // Auto-remove toast after 5 seconds
    setTimeout(() => {
        toast.classList.add("fade-out");
        toast.addEventListener("animationend", () => {
            toast.remove();
        });
    }, 5000);
}

function handleIncomingDeleteLog(logDto) {
    const existingIndex = logs.findIndex(l => l.id === logDto.id);
    if (existingIndex !== -1) {
        // Remove from local cache
        logs.splice(existingIndex, 1);
        
        // Re-render
        renderLogTable();
        updateStats();
        
        // Trigger toast notification
        showDeleteToast(logDto);
    }
}

function showDeleteToast(logDto) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast toast-low"; // Neutral styling

    const portStr = logDto.port !== null && logDto.port !== undefined && logDto.port !== 0 ? `:${logDto.port}` : '';
    const ipInfo = (logDto.sourceIp || logDto.destinationIp) ? `${logDto.sourceIp || 'Unknown'} → ${logDto.destinationIp || 'Unknown'}${portStr}` : '';

    toast.innerHTML = `
        <div class="toast-header">
            <span class="toast-title">🗑️ <strong>위협 로그 삭제됨</strong></span>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
        </div>
        <div class="toast-body">
            <strong>${logDto.threatName}</strong> 아카이브에서 제거됨
        </div>
        ${ipInfo ? `<div class="toast-info">${ipInfo}</div>` : ''}
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.add("fade-out");
        toast.addEventListener("animationend", () => {
            toast.remove();
        });
    }, 5000);
}

// --- Login & Logout Handlers ---
async function handleLoginSubmit(event) {
    event.preventDefault();
    const usernameInput = document.getElementById("login-username").value;
    const passwordInput = document.getElementById("login-password").value;
    const errorMsg = document.getElementById("login-error-msg");
    
    try {
        const response = await originalFetch("/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });
        
        if (!response.ok) {
            throw new Error("Invalid credentials");
        }
        
        const data = await response.json();
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("username", data.username);
        localStorage.setItem("userRole", data.role);
        
        if (errorMsg) errorMsg.style.display = "none";
        document.getElementById("login-form").reset();
        
        await initApp();
    } catch (error) {
        if (errorMsg) errorMsg.style.display = "block";
    }
}

function handleLogout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("username");
    localStorage.removeItem("userRole");
    
    location.reload();
}

// --- Filtering & CSV Export Functions ---
function applyFilters() {
    renderLogTable();
}

function exportToCsv() {
    if (logs.length === 0) {
        alert("내보낼 로그 데이터가 없습니다.");
        return;
    }
    
    const headers = ["카테고리", "위협명", "심각도", "상태", "출발지 IP", "목적지 IP", "포트", "설명", "위험 점수(%)", "AI 권고사항", "탐지 일시"];
    const rows = logs.map(log => [
        log.categoryName || "미지정",
        log.threatName || "",
        log.severityLevel || "",
        log.status || "",
        log.sourceIp || "",
        log.destinationIp || "",
        log.port !== null && log.port !== undefined ? log.port : "",
        log.description || "",
        log.abuseScore !== null && log.abuseScore !== undefined ? log.abuseScore : 0,
        log.aiRecommendation || "",
        log.loggedAt || ""
    ]);
    
    // UTF-8 BOM to support Excel opening CSV correctly in Korean/foreign languages
    let csvContent = "\uFEFF";
    csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
    rows.forEach(row => {
        csvContent += row.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(",") + "\n";
    });
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Security_Threat_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Toggle Log Details Dropdown ---
function toggleLogDetails(logId) {
    const detailsRow = document.getElementById(`details-${logId}`);
    const mainRow = document.getElementById(`main-row-${logId}`);
    if (detailsRow) {
        if (detailsRow.style.display === "none") {
            detailsRow.style.display = "table-row";
            mainRow.classList.add("expanded-row");
        } else {
            detailsRow.style.display = "none";
            mainRow.classList.remove("expanded-row");
        }
    }
}
