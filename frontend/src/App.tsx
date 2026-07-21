import { useState, useEffect, useMemo, type FormEvent } from 'react';
import type { ThreatCategory, ThreatLog, ToastMessage } from './types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';



// JWT Claims Parser
const parseJwt = (token: string) => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            window.atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
};

// Format seconds into MM:SS
const formatTimeLeft = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// Format audit log timestamp into YYYY-MM-DD HH:mm:ss
const formatAuditTime = (isoString: string) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

export default function App() {
    // Authentication States
    const [token, setToken] = useState<string | null>(localStorage.getItem("accessToken"));
    const [role, setRole] = useState<string | null>(localStorage.getItem("userRole"));
    const [username, setUsername] = useState<string | null>(localStorage.getItem("username"));
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    // Login Form State
    const [loginUsername, setLoginUsername] = useState("");
    const [loginPassword, setLoginPassword] = useState("");
    const [loginError, setLoginError] = useState(false);

    // Global States
    const [categories, setCategories] = useState<ThreatCategory[]>([]);
    const [logs, setLogs] = useState<ThreatLog[]>([]);

    // Filter States
    const [severityFilter, setSeverityFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");

    // Modal & UI States
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [isFirewallModalOpen, setIsFirewallModalOpen] = useState(false);
    const [blockedIps, setBlockedIps] = useState<any[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLog, setEditingLog] = useState<Partial<ThreatLog>>({});
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    // Log Form State
    const [newLog, setNewLog] = useState({
        categoryId: "",
        threatName: "",
        severityLevel: "LOW",
        description: "",
        sourceIp: "",
        destinationIp: "",
        port: "",
        status: "DETECTED"
    });

    // Category Form State
    const [newCatName, setNewCatName] = useState("");
    const [newCatDesc, setNewCatDesc] = useState("");

    // Initial Loading
    useEffect(() => {
        if (token) {
            fetchCategories();
            fetchLogs();
        }
    }, [token]);

    // Auto logout on token expiration and real-time countdown
    useEffect(() => {
        if (!token) {
            setTimeLeft(null);
            return;
        }

        const jwtPayload = parseJwt(token);
        if (!jwtPayload || !jwtPayload.exp) {
            setTimeLeft(null);
            return;
        }

        const expirationTime = jwtPayload.exp * 1000;
        let intervalId: number;

        const updateTimer = () => {
            const secondsRemaining = Math.max(0, Math.floor((expirationTime - Date.now()) / 1000));
            setTimeLeft(secondsRemaining);

            if (secondsRemaining <= 0) {
                clearInterval(intervalId);
                alert("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
                handleLogout();
            }
        };

        updateTimer();
        intervalId = window.setInterval(updateTimer, 1000);

        return () => clearInterval(intervalId);
    }, [token]);

    // SSE connection
    useEffect(() => {
        if (!token) return;

        let eventSource: EventSource;

        const connectSse = () => {
            eventSource = new EventSource("/api/sse/connect");

            eventSource.addEventListener("INIT", (event) => {
                console.log("SSE Connection Initialized:", event.data);
            });

            eventSource.addEventListener("THREAT_LOG", (event) => {
                try {
                    const logDto: ThreatLog = JSON.parse(event.data);
                    let isUpdate = false;
                    setLogs((prevLogs) => {
                        const existingIndex = prevLogs.findIndex((l) => l.id === logDto.id);
                        if (existingIndex !== -1) {
                            isUpdate = true;
                            const updated = [...prevLogs];
                            updated[existingIndex] = logDto;
                            return updated;
                        } else {
                            return [logDto, ...prevLogs];
                        }
                    });
                    showSseToast(logDto, false, isUpdate);
                } catch (e) {
                    console.error("Error parsing THREAT_LOG event:", e);
                }
            });

            eventSource.addEventListener("THREAT_LOG_DELETE", (event) => {
                try {
                    const logDto: ThreatLog = JSON.parse(event.data);
                    setLogs((prevLogs) => prevLogs.filter((l) => l.id !== logDto.id));
                    showSseToast(logDto, true, false);
                } catch (e) {
                    console.error("Error parsing THREAT_LOG_DELETE event:", e);
                }
            });

            eventSource.addEventListener("THREAT_LOG_RESET", () => {
                console.log("SSE Reset event received. Reloading logs.");
                fetchLogs();
                addToast("🔄 데이터베이스가 기본값으로 초기화되었습니다.", "low", "시스템 알림");
            });

            eventSource.onerror = (error) => {
                console.error("SSE connection lost. Reconnecting in 5s...", error);
                eventSource.close();
                setTimeout(connectSse, 5000);
            };
        };

        connectSse();

        return () => {
            if (eventSource) eventSource.close();
        };
    }, [token]);

    const fetchAuditLogs = async () => {
        try {
            const res = await authFetch("/api/audit-logs");
            if (res.ok) {
                const data = await res.json();
                setAuditLogs(data);
            }
        } catch (err) {
            console.error("Failed to load audit logs:", err);
        }
    };

    const resetAuditLogs = async () => {
        if (!window.confirm("⚠️ 정말로 모든 시스템 감사 로그를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없으며, 초기화 기록 자체가 새로운 감사 로그로 첫 줄에 남게 됩니다.")) {
            return;
        }

        try {
            const res = await authFetch("/api/audit-logs", {
                method: "DELETE"
            });
            if (res.ok) {
                addToast("🗑️ 시스템 감사 로그가 초기화되었습니다.", "low", "시스템 알림");
                fetchAuditLogs();
            } else {
                throw new Error("초기화 실패");
            }
        } catch (err: any) {
            alert("감사 로그 초기화 중 오류 발생: " + err.message);
        }
    };

    useEffect(() => {
        if (isAuditModalOpen && token) {
            fetchAuditLogs();
        }
    }, [isAuditModalOpen, token]);

    // Firewall / Blocked IP Functions
    const fetchBlockedIps = async () => {
        try {
            const res = await authFetch("/api/firewall/blocked-ips");
            if (res.ok) {
                const data = await res.json();
                setBlockedIps(data);
            }
        } catch (err) {
            console.error("Failed to load blocked IPs:", err);
        }
    };

    const blockIp = async (ipAddress: string, reason: string) => {
        try {
            const res = await authFetch("/api/firewall/block", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ipAddress, reason })
            });
            const data = await res.json();
            if (res.ok) {
                addToast(`🔒 차단 완료: ${ipAddress}`, "high", "방화벽 정책");
                fetchBlockedIps();
                fetchLogs();
            } else {
                addToast(`⚠️ ${data.error}`, "medium", "방화벽 오류");
            }
        } catch (err) {
            console.error("Failed to block IP:", err);
        }
    };

    const unblockIp = async (ipAddress: string) => {
        if (!window.confirm(`${ipAddress} 의 차단을 해제하시겠습니까?`)) return;
        try {
            const res = await authFetch(`/api/firewall/block/${ipAddress}`, {
                method: "DELETE"
            });
            if (res.ok) {
                addToast(`🔓 차단 해제: ${ipAddress}`, "low", "방화벽 정책");
                fetchBlockedIps();
                fetchLogs();
            }
        } catch (err) {
            console.error("Failed to unblock IP:", err);
        }
    };

    useEffect(() => {
        if (isFirewallModalOpen && token) {
            fetchBlockedIps();
        }
    }, [isFirewallModalOpen, token]);

    // Data Fetching
    const fetchCategories = async () => {
        try {
            const res = await authFetch("/api/categories");
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
            }
        } catch (err) {
            console.error("Failed to load categories:", err);
        }
    };

    const fetchLogs = async () => {
        try {
            const res = await authFetch("/api/logs");
            if (res.ok) {
                const data = await res.json();
                setLogs(data);
            }
        } catch (err) {
            console.error("Failed to load logs:", err);
        }
    };


    // Authentication Handlers
    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: loginUsername, password: loginPassword })
            });

            if (!response.ok) throw new Error("Invalid credentials");

            const data = await response.json();
            localStorage.setItem("accessToken", data.accessToken);
            localStorage.setItem("username", data.username);
            localStorage.setItem("userRole", data.role);

            setToken(data.accessToken);
            setUsername(data.username);
            setRole(data.role);
            setLoginError(false);
            setLoginUsername("");
            setLoginPassword("");
        } catch (err) {
            setLoginError(true);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("username");
        localStorage.removeItem("userRole");
        setToken(null);
        setUsername(null);
        setRole(null);
        window.location.reload();
    };

    // Scoped JWT Fetch Wrapper to intercept and automatically refresh sliding session
    const authFetch = async (url: string, options: RequestInit = {}) => {
        const headers = new Headers(options.headers || {});
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
        if (options.body && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            handleLogout();
        } else {
            const newToken = response.headers.get("X-New-Token");
            if (newToken) {
                localStorage.setItem("accessToken", newToken);
                setToken(newToken);
            }
        }
        return response;
    };

    // Action Handlers
    const handleLogSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const payload = {
            categoryId: parseInt(newLog.categoryId),
            threatName: newLog.threatName,
            severityLevel: newLog.severityLevel,
            description: newLog.description,
            sourceIp: newLog.sourceIp,
            destinationIp: newLog.destinationIp,
            port: newLog.port ? parseInt(newLog.port) : null,
            status: newLog.status
        };

        try {
            const res = await authFetch("/api/logs", {
                method: "POST",
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errMsg = await res.text();
                throw new Error(errMsg || "Failed to save log");
            }

            setNewLog({
                categoryId: "",
                threatName: "",
                severityLevel: "LOW",
                description: "",
                sourceIp: "",
                destinationIp: "",
                port: "",
                status: "DETECTED"
            });
            fetchLogs();
        } catch (err: any) {
            alert("위협 로그 등록 실패: " + err.message);
        }
    };

    const handleEditSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingLog.id) return;

        const payload = {
            categoryId: editingLog.categoryId,
            threatName: editingLog.threatName,
            severityLevel: editingLog.severityLevel,
            description: editingLog.description,
            sourceIp: editingLog.sourceIp,
            destinationIp: editingLog.destinationIp,
            port: editingLog.port ? parseInt(editingLog.port.toString()) : null,
            status: editingLog.status
        };

        try {
            const res = await authFetch(`/api/logs/${editingLog.id}`, {
                method: "PUT",
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errMsg = await res.text();
                throw new Error(errMsg || "Failed to update log");
            }

            setIsEditModalOpen(false);
            setEditingLog({});
            fetchLogs();
        } catch (err: any) {
            alert("수정 실패: " + err.message);
        }
    };

    const handleCategorySubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            const res = await authFetch("/api/categories", {
                method: "POST",
                body: JSON.stringify({ name: newCatName, description: newCatDesc })
            });

            if (!res.ok) {
                const errMsg = await res.text();
                throw new Error(errMsg || "Failed to save category");
            }

            setNewCatName("");
            setNewCatDesc("");
            fetchCategories();
        } catch (err: any) {
            alert("카테고리 등록 실패: " + err.message);
        }
    };

    const deleteLog = async (id: number) => {
        if (!confirm("정말로 이 위협 로그를 아카이브에서 삭제하시겠습니까?")) return;
        try {
            const res = await authFetch(`/api/logs/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete log");
            fetchLogs();
        } catch (err: any) {
            alert("로그 삭제 실패: " + err.message);
        }
    };

    const deleteCategory = async (id: number) => {
        if (!confirm("카테고리를 삭제하면 해당 카테고리에 할당된 모든 위협 로그도 함께 삭제될 수 있습니다. 진행하시겠습니까?")) return;
        try {
            const res = await authFetch(`/api/categories/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete category");
            fetchCategories();
            fetchLogs();
        } catch (err: any) {
            alert("카테고리 삭제 실패: " + err.message);
        }
    };


    const resetLogs = async () => {
        if (!confirm("정말로 모든 위협 로그 기록을 삭제하고 기본값(4개)으로 초기화하시겠습니까?")) return;
        try {
            const res = await authFetch("/api/logs/reset", { method: "POST" });
            if (res.ok) {
                fetchLogs();
                addToast("🔄 데이터베이스가 성공적으로 초기화되었습니다.", "low", "시스템 알림");
            } else {
                addToast("❌ 로그 초기화 권한이 없거나 실패했습니다.", "danger", "시스템 에러");
            }
        } catch (err) {
            addToast("❌ 로그 초기화 중 오류 발생", "danger", "시스템 에러");
        }
    };

    const openEditModal = async (id: number) => {
        try {
            const res = await authFetch(`/api/logs/${id}`);
            if (!res.ok) throw new Error("Failed to fetch log details");
            const data = await res.json();
            setEditingLog(data);
            setIsEditModalOpen(true);
        } catch (err: any) {
            alert("수정 창 열기 실패: " + err.message);
        }
    };

    // Toast Helpers
    const addToast = (message: string, type: 'low' | 'danger' | 'high' | 'medium' = 'low', title?: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast: ToastMessage = { id, message, type, title };
        setToasts((prev) => [...prev, newToast]);
        setTimeout(() => removeToast(id), 5000);
    };

    const showSseToast = (logDto: ThreatLog, isDelete: boolean, isUpdate: boolean) => {
        const id = Math.random().toString(36).substring(2, 9);
        const severity = (logDto.severityLevel || "LOW").toUpperCase();
        const type = severity.toLowerCase() as 'low' | 'medium' | 'high';

        const title = isDelete ? "🗑️ 위협 로그 삭제됨" : (isUpdate ? "✏️ 위협 로그 수정됨" : "🚨 신규 위협 감지됨");
        const portStr = logDto.port !== null && logDto.port !== undefined && logDto.port !== 0 ? `:${logDto.port}` : '';
        let ipInfo = (logDto.sourceIp || logDto.destinationIp) ? `${logDto.sourceIp || 'Unknown'} → ${logDto.destinationIp || 'Unknown'}${portStr}` : '';
        if (logDto.sourceIp && logDto.sourceIp !== 'Unknown' && logDto.abuseScore !== null && logDto.abuseScore !== undefined) {
            ipInfo += ` (Abuse Score: ${logDto.abuseScore}%)`;
        }

        const newToast: ToastMessage = {
            id,
            title,
            message: isDelete ? `${logDto.threatName} 아카이브에서 제거됨` : logDto.threatName,
            type: isDelete ? 'low' : type,
            threatName: isDelete ? undefined : logDto.threatName,
            ipInfo
        };
        setToasts((prev) => [...prev, newToast]);
        setTimeout(() => removeToast(id), 5000);
    };

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const getToastIcon = (toast: ToastMessage) => {
        if (toast.title?.includes("삭제") || toast.title?.includes("🗑️")) return "🗑️";
        if (toast.title?.includes("수정") || toast.title?.includes("✏️")) return "✏️";
        if (toast.type === "high") return "🔴";
        if (toast.type === "medium") return "🟡";
        if (toast.type === "low") return "🟢";
        return "⚙️";
    };

    // Filter Logic
    const filteredLogs = logs.filter((log) => {
        const matchesSeverity = !severityFilter || log.severityLevel.toUpperCase() === severityFilter.toUpperCase();
        const matchesCategory = !categoryFilter || log.categoryId.toString() === categoryFilter;
        return matchesSeverity && matchesCategory;
    });

    // Sorting State
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" | null }>({
        key: "",
        direction: null
    });

    const requestSort = (key: string) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        }
        setSortConfig({ key, direction });
    };

    const resetSort = () => {
        setSortConfig({ key: "", direction: null });
    };

    const sortedLogs = useMemo(() => {
        let sortableLogs = [...filteredLogs];
        if (sortConfig.key && sortConfig.direction) {
            sortableLogs.sort((a, b) => {
                let aVal: any = "";
                let bVal: any = "";

                switch (sortConfig.key) {
                    case "category":
                        aVal = a.categoryName || "";
                        bVal = b.categoryName || "";
                        break;
                    case "threatName":
                        aVal = a.threatName || "";
                        bVal = b.threatName || "";
                        break;
                    case "abuseScore":
                        aVal = a.abuseScore !== null && a.abuseScore !== undefined ? a.abuseScore : -1;
                        bVal = b.abuseScore !== null && b.abuseScore !== undefined ? b.abuseScore : -1;
                        break;
                    case "severity":
                        const sevOrder: { [key: string]: number } = { HIGH: 3, MEDIUM: 2, LOW: 1 };
                        aVal = sevOrder[(a.severityLevel || "LOW").toUpperCase()] || 0;
                        bVal = sevOrder[(b.severityLevel || "LOW").toUpperCase()] || 0;
                        break;
                    case "status":
                        aVal = a.status || "";
                        bVal = b.status || "";
                        break;
                    case "loggedAt":
                        aVal = a.loggedAt ? new Date(a.loggedAt).getTime() : 0;
                        bVal = b.loggedAt ? new Date(b.loggedAt).getTime() : 0;
                        break;
                    default:
                        break;
                }

                if (aVal < bVal) {
                    return sortConfig.direction === "asc" ? -1 : 1;
                }
                if (aVal > bVal) {
                    return sortConfig.direction === "asc" ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableLogs;
    }, [filteredLogs, sortConfig]);

    // Stats Calculation
    const totalCount = logs.length;
    const highCount = logs.filter((l) => l.severityLevel.toUpperCase() === "HIGH").length;
    const mediumCount = logs.filter((l) => l.severityLevel.toUpperCase() === "MEDIUM").length;
    const lowCount = logs.filter((l) => l.severityLevel.toUpperCase() === "LOW").length;

    // Prepare Category Distribution Data
    const categoryCounts: { [key: string]: number } = {};
    filteredLogs.forEach((log) => {
        const catName = log.categoryName || "미지정";
        categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
    });
    const categoryChartData = Object.keys(categoryCounts).map((key) => ({
        name: key,
        value: categoryCounts[key],
    }));

    // Prepare Severity Data
    const severityChartData = [
        { name: "HIGH", count: highCount, fill: "#ef4444" },
        { name: "MEDIUM", count: mediumCount, fill: "#f59e0b" },
        { name: "LOW", count: lowCount, fill: "#10b981" },
    ];

    const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#3b82f6"];

    // Excel Export
    const exportToCsv = () => {
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
    };

    const downloadExcelReport = async () => {
        try {
            const res = await authFetch("/api/reports/excel");
            if (!res.ok) throw new Error("Excel 다운로드 실패");
            const blob = await res.blob();
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Security_Threat_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (err: any) {
            alert("엑셀 보고서 다운로드 중 오류 발생: " + err.message);
        }
    };

    const downloadPdfReport = async () => {
        try {
            const res = await authFetch("/api/reports/pdf");
            if (!res.ok) throw new Error("PDF 다운로드 실패");
            const blob = await res.blob();
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `Security_Threat_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (err: any) {
            alert("PDF 보고서 다운로드 중 오류 발생: " + err.message);
        }
    };

    const formatDateTimeToThreeLines = (isoString?: string) => {
        if (!isoString) return "-";
        const date = new Date(isoString);
        
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        
        return (
            <>
                <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{yyyy}년</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 500, margin: "1px 0", whiteSpace: "nowrap" }}>{mm}월 {dd}일</div>
                <div style={{ fontSize: "0.8rem", fontFamily: "monospace", color: "#818cf8", whiteSpace: "nowrap" }}>{hh}:{min}:{ss}</div>
            </>
        );
    };

    const getRoleLabel = (r: string | null) => {
        if (r === "ROLE_ADMIN") return "관리자";
        if (r === "ROLE_ANALYST") return "분석가";
        return "일반 사용자";
    };

    if (!token) {
        return (
            <div className="modal active" style={{ backdropFilter: "blur(25px)", WebkitBackdropFilter: "blur(25px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", top: 0, left: 0, width: "100%", height: "100%" }}>
                <div className="modal-content" style={{ maxWidth: "400px", border: "1px solid rgba(255, 255, 255, 0.15)", background: "rgba(11, 15, 25, 0.95)", boxShadow: "0 0 50px rgba(99, 102, 241, 0.25)", padding: "2rem" }}>
                    <div className="modal-header" style={{ justifyContent: "center", marginBottom: "1.5rem" }}>
                        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ffffff", textAlign: "center", letterSpacing: "-0.03em" }}>
                            🛡️ Security Threat Archive
                        </h2>
                    </div>
                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label">아이디 (Username)</label>
                            <input className="form-input" type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} placeholder="아이디 입력" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">비밀번호 (Password)</label>
                            <input className="form-input" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="비밀번호 입력" required />
                        </div>
                        {loginError && (
                            <div style={{ color: "var(--severity-high)", fontSize: "0.85rem", marginBottom: "1rem", textAlign: "center" }}>
                                ❌ 아이디 또는 비밀번호가 올바르지 않습니다.
                            </div>
                        )}
                        <button type="submit" className="btn btn-primary" style={{ width: "100%", fontSize: "1rem", padding: "0.85rem" }}>로그인</button>
                    </form>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textAlign: "center", marginTop: "1.5rem", lineHeight: 1.5, borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
                        <strong>테스트 계정 정보:</strong><br />
                        관리자 (카테고리/로그 CRUD): <code>admin</code> / <code>admin123</code><br />
                        분석가 (로그 CRUD): <code>analyst</code> / <code>analyst123</code><br />
                        일반 (조회 전용): <code>user</code> / <code>user123</code>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            {/* Header */}
            <header>
                <div className="brand-section">
                    <h1>🛡️ Security Threat Archive</h1>
                    <p>네트워크 위협 정보 및 보안 사고 기록 분석 플랫폼</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                        <span id="user-info-badge" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", background: "rgba(255, 255, 255, 0.05)", padding: "0.4rem 0.8rem", borderRadius: "6px", border: "1px solid var(--border-color)", display: "inline-block" }}>
                            👤 {username} ({getRoleLabel(role)})
                        </span>
                        {role === "ROLE_ADMIN" && (
                            <>
                                <button className="btn btn-danger btn-sm" onClick={resetLogs}>🔄 데이터 초기화</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setIsCategoryModalOpen(true)}>📁 카테고리 관리</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setIsAuditModalOpen(true)}>🛡️ 감사 로그</button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setIsFirewallModalOpen(true)} style={{ background: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)", borderColor: "#b91c1c" }}>🔥 방화벽 관리</button>
                            </>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={handleLogout} style={{ padding: "0.6rem 1rem" }}>🔓 로그아웃</button>
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", fontFamily: "monospace", opacity: 0.85, marginRight: "0.5rem" }}>
                        세션 만료: <strong style={{ color: timeLeft && timeLeft < 60 ? "#ef4444" : "var(--text-primary)" }}>{formatTimeLeft(timeLeft)}</strong>
                    </span>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card" id="stat-total">
                    <span className="stat-title">전체 위협 로그</span>
                    <span className="stat-value">{totalCount}</span>
                    <span className="stat-desc">시스템에 등록된 전체 보안 사고 수</span>
                </div>
                <div className="stat-card high-severity" id="stat-high">
                    <span className="stat-title">심각도: HIGH</span>
                    <span className="stat-value">{highCount}</span>
                    <span className="stat-desc">즉각적인 조치가 필요한 심각한 위협</span>
                </div>
                <div className="stat-card medium-severity" id="stat-medium">
                    <span className="stat-title">심각도: MEDIUM</span>
                    <span className="stat-value">{mediumCount}</span>
                    <span className="stat-desc">지속적인 모니터링이 요구되는 위험</span>
                </div>
                <div className="stat-card low-severity" id="stat-low">
                    <span className="stat-title">심각도: LOW</span>
                    <span className="stat-value">{lowCount}</span>
                    <span className="stat-desc">일반 정보 보안 침해 및 단순 경고</span>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="charts-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
                <div className="panel" style={{ height: "320px", padding: "1.5rem", display: "flex", flexDirection: "column" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-primary)" }}>📊 위협 카테고리 분포</h3>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        {categoryChartData.length === 0 ? (
                            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                데이터가 없습니다.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={55}
                                        outerRadius={75}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryChartData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255, 255, 255, 0.1)", borderRadius: "8px", color: "#fff", fontSize: "0.8rem" }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: "0.75rem" }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
                <div className="panel" style={{ height: "320px", padding: "1.5rem", display: "flex", flexDirection: "column" }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text-primary)" }}>📈 위협 심각도 현황</h3>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        {totalCount === 0 ? (
                            <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                                데이터가 없습니다.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={severityChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} allowDecimals={false} />
                                    <Tooltip
                                        cursor={{ fill: "rgba(255, 255, 255, 0.02)" }}
                                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "rgba(255, 255, 255, 0.1)", borderRadius: "8px", color: "#fff", fontSize: "0.8rem" }}
                                    />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
                                        {severityChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Dashboard Body */}
            <div className="dashboard-grid" id="dashboard-grid" style={{ gridTemplateColumns: (role === "ROLE_ADMIN" || role === "ROLE_ANALYST") ? "350px 1fr" : "1fr" }}>
                {/* Left Panel: Add Log Form */}
                {(role === "ROLE_ADMIN" || role === "ROLE_ANALYST") && (
                    <div className="panel" id="left-panel">
                        <div className="panel-header">
                            <h2 className="panel-title">📝 새 위협 기록 등록</h2>
                        </div>
                        <form onSubmit={handleLogSubmit}>
                            <div className="form-group">
                                <label className="form-label">공격 분류 (Category)</label>
                                <select className="form-select" value={newLog.categoryId} onChange={(e) => setNewLog({ ...newLog, categoryId: e.target.value })} required>
                                    <option value="">-- 카테고리 선택 --</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">위협 명칭 (Threat Name)</label>
                                <input className="form-input" type="text" value={newLog.threatName} onChange={(e) => setNewLog({ ...newLog, threatName: e.target.value })} placeholder="예: Ping of Death Attack" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">심각도 수준 (Severity)</label>
                                <select className="form-select" value={newLog.severityLevel} onChange={(e) => setNewLog({ ...newLog, severityLevel: e.target.value })} required>
                                    <option value="HIGH">🔴 HIGH (높음)</option>
                                    <option value="MEDIUM">🟡 MEDIUM (중간)</option>
                                    <option value="LOW">🟢 LOW (낮음)</option>
                                </select>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label">출발지 IP</label>
                                    <input className="form-input" type="text" value={newLog.sourceIp} onChange={(e) => setNewLog({ ...newLog, sourceIp: e.target.value })} placeholder="예: 192.168.1.100" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label">목적지 IP</label>
                                    <input className="form-input" type="text" value={newLog.destinationIp} onChange={(e) => setNewLog({ ...newLog, destinationIp: e.target.value })} placeholder="예: 10.0.0.5" />
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label">포트 번호</label>
                                    <input className="form-input" type="number" value={newLog.port} onChange={(e) => setNewLog({ ...newLog, port: e.target.value })} placeholder="예: 80" min="0" max="65535" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label">처리 상태</label>
                                    <select className="form-select" value={newLog.status} onChange={(e) => setNewLog({ ...newLog, status: e.target.value })} required>
                                        <option value="DETECTED">🟣 DETECTED (탐지)</option>
                                        <option value="ANALYZING">🔵 ANALYZING (분석중)</option>
                                        <option value="RESOLVED">🟢 RESOLVED (조치완료)</option>
                                        <option value="FALSE_POSITIVE">🟤 FALSE_POSITIVE (오탐)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">위협 상세 설명 (Description)</label>
                                <textarea className="form-textarea" value={newLog.description} onChange={(e) => setNewLog({ ...newLog, description: e.target.value })} placeholder="위협에 대한 구체적인 공격 경로 및 증상 기술"></textarea>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>💾 위협 로그 기록</button>
                        </form>
                    </div>
                )}

                {/* Right Panel: Logs List */}
                <div className="panel" style={{ flex: 1, minWidth: 0 }}>
                    <div className="panel-header" style={{ flexWrap: "wrap", gap: "1rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <h2 className="panel-title">📁 위협 아카이브 로그 목록</h2>
                            <span id="log-count-badge" style={{ fontSize: "0.75rem", background: "rgba(255,255,255,0.05)", padding: "0.2rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>
                                {filteredLogs.length}개 항목
                            </span>
                        </div>
                        {/* Filters & Export */}
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                            <select className="form-select" value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={{ padding: "0.4rem 0.8rem", width: "auto", fontSize: "0.85rem" }}>
                                <option value="">모든 심각도</option>
                                <option value="HIGH">HIGH (높음)</option>
                                <option value="MEDIUM">MEDIUM (중간)</option>
                                <option value="LOW">LOW (낮음)</option>
                            </select>
                            <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ padding: "0.4rem 0.8rem", width: "auto", fontSize: "0.85rem" }}>
                                <option value="">전체 카테고리</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <button className="btn btn-secondary btn-sm" onClick={exportToCsv} style={{ whiteSpace: "nowrap" }}>📥 CSV</button>
                            <button className="btn btn-secondary btn-sm" onClick={downloadExcelReport} style={{ whiteSpace: "nowrap" }}>📊 Excel</button>
                            <button className="btn btn-secondary btn-sm" onClick={downloadPdfReport} style={{ whiteSpace: "nowrap" }}>📄 PDF 리포트</button>
                            {sortConfig.key && (
                                <button className="btn btn-secondary btn-sm" onClick={resetSort} style={{ whiteSpace: "nowrap", borderColor: "rgba(245, 158, 11, 0.5)", color: "#f59e0b", fontWeight: 600 }}>🔄 정렬 초기화</button>
                            )}
                        </div>
                    </div>

                    <div className="table-container">
                        <table className="threat-table" id="threat-table">
                            <thead>
                                <tr>
                                    <th onClick={() => requestSort("category")} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                                        분류 {sortConfig.key === "category" ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕"}
                                    </th>
                                    <th onClick={() => requestSort("threatName")} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                                        위협명 {sortConfig.key === "threatName" ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕"}
                                    </th>
                                    <th onClick={() => requestSort("abuseScore")} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                                        위험점수 {sortConfig.key === "abuseScore" ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕"}
                                    </th>
                                    <th onClick={() => requestSort("severity")} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                                        심각도 {sortConfig.key === "severity" ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕"}
                                    </th>
                                    <th onClick={() => requestSort("status")} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                                        상태 {sortConfig.key === "status" ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕"}
                                    </th>
                                    <th onClick={() => requestSort("loggedAt")} style={{ cursor: "pointer", userSelect: "none", textAlign: "center", whiteSpace: "nowrap" }}>
                                        탐지 일시 {sortConfig.key === "loggedAt" ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕"}
                                    </th>
                                    {(role === "ROLE_ADMIN" || role === "ROLE_ANALYST") && <th style={{ whiteSpace: "nowrap" }}>작업</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {sortedLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={(role === "ROLE_ADMIN" || role === "ROLE_ANALYST") ? 7 : 6} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>
                                            조건에 맞는 위협 로그가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedLogs.map((log) => {
                                        const severity = (log.severityLevel || "LOW").toUpperCase();
                                        const sevBadgeClass = severity === "HIGH" ? "badge-high" : (severity === "MEDIUM" ? "badge-medium" : "badge-low");

                                        const status = (log.status || "DETECTED").toUpperCase();
                                        const statusBadgeClass = status === "ANALYZING" ? "badge-analyzing" : (status === "RESOLVED" ? "badge-resolved" : (status === "FALSE_POSITIVE" ? "badge-falsepositive" : "badge-detected"));

                                        const portStr = log.port !== null && log.port !== undefined && log.port !== 0 ? `:${log.port}` : '';
                                        const ipInfo = (log.sourceIp || log.destinationIp) ? `${log.sourceIp || 'Unknown'} → ${log.destinationIp || 'Unknown'}${portStr}` : '';

                                        let abuseBadgeClass = 'badge-low';
                                        let abuseLabel = 'Safe';
                                        if (log.abuseScore && log.abuseScore > 50) {
                                            abuseBadgeClass = 'badge-high';
                                            abuseLabel = 'Malicious';
                                        } else if (log.abuseScore && log.abuseScore > 0) {
                                            abuseBadgeClass = 'badge-medium';
                                            abuseLabel = 'Suspicious';
                                        }

                                        const isExpanded = expandedLogId === log.id;

                                        return (
                                            <>
                                                <tr
                                                    key={`main-${log.id}`}
                                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                                    className={isExpanded ? "expanded-row" : ""}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <td style={{ fontWeight: 500 }}>{log.categoryName || "미지정"}</td>
                                                    <td>
                                                        <div><strong>{log.threatName}</strong></div>
                                                        {ipInfo && (
                                                            <div style={{ fontSize: "0.8rem", color: "#818cf8", marginTop: "2px", fontFamily: "monospace", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                                                {ipInfo}
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>
                                                            {log.description || ""}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {log.sourceIp && log.sourceIp !== 'Unknown' && log.abuseScore !== null && log.abuseScore !== undefined ? (
                                                            <span className={`badge ${abuseBadgeClass}`} style={{ fontSize: "0.75rem", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                                                                {abuseLabel}: {log.abuseScore}%
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>-</span>
                                                        )}
                                                    </td>
                                                    <td><span className={`badge ${sevBadgeClass}`}>{severity}</span></td>
                                                    <td><span className={`badge ${statusBadgeClass}`}>{status.replace('_', ' ')}</span></td>
                                                    <td style={{ textAlign: "center" }}>{formatDateTimeToThreeLines(log.loggedAt)}</td>
                                                    {(role === "ROLE_ADMIN" || role === "ROLE_ANALYST") && (
                                                        <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                                                            <div className="actions-wrapper">
                                                                <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(log.id)} style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                                                                    ✏️ 수정
                                                                </button>
                                                                {role === "ROLE_ADMIN" && (
                                                                    <button className="btn btn-danger btn-sm" onClick={() => deleteLog(log.id)} style={{ whiteSpace: "nowrap" }}>
                                                                        🗑️
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                                {/* Expanded Accordion Row */}
                                                <tr key={`details-${log.id}`} className="details-row" style={{ display: isExpanded ? "table-row" : "none", backgroundColor: "rgba(0, 0, 0, 0.2)" }}>
                                                    <td colSpan={(role === "ROLE_ADMIN" || role === "ROLE_ANALYST") ? 7 : 6} style={{ padding: "1.25rem", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                                                        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                                                            {/* SOAR 원클릭 차단 패널 */}
                                                            {role === "ROLE_ADMIN" && log.sourceIp && log.sourceIp !== "Unknown" && (
                                                                <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.75rem 1rem", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px" }}>
                                                                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", flexShrink: 0 }}>
                                                                        🔥 <strong style={{ color: "#f87171" }}>SOAR 원클릭 차단</strong> — 출발지 IP:
                                                                        <code style={{ marginLeft: "0.5rem", color: "#818cf8", fontFamily: "monospace" }}>{log.sourceIp}</code>
                                                                    </span>
                                                                    {blockedIps.some((b: any) => b.ipAddress === log.sourceIp) ? (
                                                                        <span className="badge badge-high" style={{ fontSize: "0.75rem", flexShrink: 0 }}>🔒 차단됨</span>
                                                                    ) : (
                                                                        <button
                                                                            className="btn btn-danger btn-sm"
                                                                            style={{ flexShrink: 0, padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
                                                                            onClick={(e) => { e.stopPropagation(); blockIp(log.sourceIp ?? "", `${log.threatName ?? "위협"} 위협 탐지 — 관리자 원클릭 차단`); }}
                                                                        >
                                                                            🚫 IP 차단
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                            <div>
                                                                <strong style={{ color: "var(--text-primary)", fontSize: "0.85rem", display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>📝 상세 설명 (Description)</strong>
                                                                <div style={{ color: "var(--text-secondary)", fontSize: "0.85rem", background: "rgba(255, 255, 255, 0.02)", borderRadius: "8px", border: "1px solid var(--border-color)", padding: "0.8rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                                                    {log.description || '상세 설명이 등록되지 않았습니다.'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <strong style={{ color: "#818cf8", fontSize: "0.85rem", display: "block", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>🛡️ AI 권고 조치 방안 (Mitigation Playbook)</strong>
                                                                <div className="terminal-container" style={{ background: "#090d16", border: "1px solid rgba(129, 140, 248, 0.2)", borderRadius: "8px", padding: "1rem", fontFamily: "'Courier New', Courier, monospace", color: "#a5b4fc", fontSize: "0.8rem", lineHeight: 1.6, maxHeight: 300, overflowY: "auto", whiteSpace: "pre-wrap", textAlign: "left" }}>
                                                                    {log.aiRecommendation || '대응 가이드를 작성하는 중이거나 내용이 없습니다.'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Category Management Modal */}
            {isCategoryModalOpen && (
                <div className="modal active" id="category-modal" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1000 }}>
                    <div className="modal-content" style={{ maxWidth: "600px" }}>
                        <div className="modal-header">
                            <h3 className="modal-title">📁 카테고리 관리</h3>
                            <button className="close-btn" onClick={() => setIsCategoryModalOpen(false)}>&times;</button>
                        </div>
                        <div>
                            <form onSubmit={handleCategorySubmit} style={{ marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid var(--border-color)" }}>
                                <div className="form-group">
                                    <label className="form-label">카테고리 이름</label>
                                    <input className="form-input" type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="예: SQL Injection" required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">카테고리 설명</label>
                                    <input className="form-input" type="text" value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="카테고리에 대한 짤막한 요약" />
                                </div>
                                <button type="submit" className="btn btn-primary btn-sm">추가</button>
                            </form>
                            
                            <h4 style={{ marginBottom: "0.75rem" }}>등록된 카테고리 목록</h4>
                            <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                                <table className="threat-table" style={{ fontSize: "0.9rem" }}>
                                    <thead>
                                        <tr>
                                            <th>이름</th>
                                            <th>설명</th>
                                            <th>삭제</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categories.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} style={{ textAlign: "center", color: "var(--text-secondary)" }}>등록된 카테고리가 없습니다.</td>
                                            </tr>
                                        ) : (
                                            categories.map((cat) => (
                                                <tr key={cat.id}>
                                                    <td style={{ fontWeight: "600" }}>{cat.name}</td>
                                                    <td>{cat.description || "-"}</td>
                                                    <td>
                                                        <button className="btn btn-danger btn-sm" onClick={() => deleteCategory(cat.id)}>삭제</button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Firewall Management Modal */}
            {isFirewallModalOpen && (
                <div className="modal active" id="firewall-modal" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1000 }}>
                    <div className="modal-content" style={{ maxWidth: "750px", width: "90%" }}>
                        <div className="modal-header">
                            <h3 className="modal-title">🔥 가상 방화벽 정책 관리 (SOAR Firewall)</h3>
                            <button className="close-btn" onClick={() => setIsFirewallModalOpen(false)}>&times;</button>
                        </div>
                        <div style={{ padding: "0.5rem 0" }}>
                            <div style={{ padding: "0.6rem 0.9rem", background: "rgba(239, 68, 68, 0.07)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.82rem", color: "#f87171" }}>
                                ⚠️ 차단된 IP에서 유입되는 모든 보안 로그는 자동으로 <strong>BLOCKED</strong> 상태로 처리됩니다. 로그 상세 보기에서도 원클릭 차단이 가능합니다.
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                                <strong style={{ fontSize: "0.9rem" }}>차단된 IP 목록 ({blockedIps.length}개)</strong>
                                <button className="btn btn-secondary btn-sm" onClick={fetchBlockedIps} style={{ fontSize: "0.78rem" }}>🔄 새로고침</button>
                            </div>
                            <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                                <table className="threat-table" style={{ fontSize: "0.85rem", width: "100%" }}>
                                    <thead>
                                        <tr>
                                            <th style={{ whiteSpace: "nowrap" }}>차단 IP</th>
                                            <th>차단 사유</th>
                                            <th style={{ whiteSpace: "nowrap", width: "170px" }}>차단 등록 시각</th>
                                            <th style={{ width: "80px" }}>해제</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {blockedIps.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>
                                                    차단된 IP가 없습니다. 로그 상세 보기에서 원클릭으로 차단할 수 있습니다.
                                                </td>
                                            </tr>
                                        ) : (
                                            blockedIps.map((b: any) => (
                                                <tr key={b.id}>
                                                    <td style={{ fontFamily: "monospace", fontWeight: 700, color: "#f87171" }}>{b.ipAddress}</td>
                                                    <td style={{ fontSize: "0.8rem", color: "var(--text-secondary)", textAlign: "left" }}>{b.reason}</td>
                                                    <td style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{formatAuditTime(b.blockedAt)}</td>
                                                    <td>
                                                        <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }} onClick={() => unblockIp(b.ipAddress)}>
                                                            🔓 해제
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* System Audit Logs Modal */}
            {isAuditModalOpen && (
                <div className="modal active" id="audit-modal" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1000 }}>
                    <div className="modal-content" style={{ maxWidth: "900px", width: "90%" }}>
                        <div className="modal-header">
                            <h3 className="modal-title">🛡️ 시스템 감사 로그 (Audit Trail)</h3>
                            <button className="close-btn" onClick={() => setIsAuditModalOpen(false)}>&times;</button>
                        </div>
                        <div style={{ padding: "0.5rem 0" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                                    시스템 중요 변경 사항 및 관리자 활동 기록입니다. (최신순 100개)
                                </p>
                                <button className="btn btn-danger btn-sm" onClick={resetAuditLogs} style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
                                    🗑️ 감사 로그 초기화
                                </button>
                            </div>
                            
                            <div style={{ maxHeight: "450px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                                <table className="threat-table" style={{ fontSize: "0.85rem", width: "100%" }}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: "180px", whiteSpace: "nowrap" }}>발생 시각</th>
                                            <th style={{ width: "100px", whiteSpace: "nowrap" }}>작업 분류</th>
                                            <th style={{ width: "100px", whiteSpace: "nowrap" }}>수행자 ID</th>
                                            <th style={{ width: "100px", whiteSpace: "nowrap" }}>권한</th>
                                            <th style={{ width: "130px", whiteSpace: "nowrap" }}>IP 주소</th>
                                            <th>상세 수행 내역</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-secondary)", padding: "2rem" }}>
                                                    기록된 감사 로그가 없습니다.
                                                </td>
                                            </tr>
                                        ) : (
                                            auditLogs.map((log) => {
                                                let roleBadge = "badge-low";
                                                if (log.role && log.role.includes("ADMIN")) {
                                                    roleBadge = "badge-high";
                                                } else if (log.role && log.role.includes("ANALYST")) {
                                                    roleBadge = "badge-medium";
                                                }
                                                
                                                return (
                                                    <tr key={log.id}>
                                                        <td style={{ fontFamily: "monospace" }}>{formatAuditTime(log.timestamp)}</td>
                                                        <td>
                                                            <span style={{ fontWeight: 600, fontSize: "0.75rem", background: "rgba(99, 102, 241, 0.1)", color: "#818cf8", padding: "0.2rem 0.4rem", borderRadius: "4px", border: "1px solid rgba(99, 102, 241, 0.2)" }}>
                                                                {log.action}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontWeight: "600" }}>{log.username}</td>
                                                        <td>
                                                            <span className={`badge ${roleBadge}`} style={{ fontSize: "0.7rem" }}>
                                                                {log.role ? log.role.replace(/[\[\]]/g, '') : "ANONYMOUS"}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontFamily: "monospace", color: "#818cf8" }}>{log.clientIp}</td>
                                                        <td style={{ textAlign: "left", fontSize: "0.8rem", whiteSpace: "normal", wordBreak: "break-all" }}>{log.details}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Log Update Modal */}
            {isEditModalOpen && editingLog.id && (
                <div className="modal active" id="edit-modal" style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1000 }}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h3 className="modal-title">✏️ 위협 로그 수정</h3>
                            <button className="close-btn" onClick={() => { setIsEditModalOpen(false); setEditingLog({}); }}>&times;</button>
                        </div>
                        <form onSubmit={handleEditSubmit}>
                            <div className="form-group">
                                <label className="form-label">공격 분류 (Category)</label>
                                <select className="form-select" value={editingLog.categoryId} onChange={(e) => setEditingLog({ ...editingLog, categoryId: parseInt(e.target.value) })} required>
                                    <option value="">-- 카테고리 선택 --</option>
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">위협 명칭 (Threat Name)</label>
                                <input className="form-input" type="text" value={editingLog.threatName || ""} onChange={(e) => setEditingLog({ ...editingLog, threatName: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">심각도 수준 (Severity)</label>
                                <select className="form-select" value={editingLog.severityLevel || ""} onChange={(e) => setEditingLog({ ...editingLog, severityLevel: e.target.value })} required>
                                    <option value="HIGH">🔴 HIGH (높음)</option>
                                    <option value="MEDIUM">🟡 MEDIUM (중간)</option>
                                    <option value="LOW">LOW (낮음)</option>
                                </select>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label">출발지 IP</label>
                                    <input className="form-input" type="text" value={editingLog.sourceIp || ""} onChange={(e) => setEditingLog({ ...editingLog, sourceIp: e.target.value })} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label">목적지 IP</label>
                                    <input className="form-input" type="text" value={editingLog.destinationIp || ""} onChange={(e) => setEditingLog({ ...editingLog, destinationIp: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label">포트 번호</label>
                                    <input className="form-input" type="number" value={editingLog.port !== null && editingLog.port !== undefined && editingLog.port !== 0 ? editingLog.port : ""} onChange={(e) => setEditingLog({ ...editingLog, port: e.target.value ? parseInt(e.target.value) : null })} min="0" max="65535" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="form-label">처리 상태</label>
                                    <select className="form-select" value={editingLog.status || "DETECTED"} onChange={(e) => setEditingLog({ ...editingLog, status: e.target.value })} required>
                                        <option value="DETECTED">🟣 DETECTED (탐지)</option>
                                        <option value="ANALYZING">🔵 ANALYZING (분석중)</option>
                                        <option value="RESOLVED">🟢 RESOLVED (조치완료)</option>
                                        <option value="FALSE_POSITIVE">🟤 FALSE_POSITIVE (오탐)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">위협 상세 설명 (Description)</label>
                                <textarea className="form-textarea" value={editingLog.description || ""} onChange={(e) => setEditingLog({ ...editingLog, description: e.target.value })}></textarea>
                            </div>
                            {editingLog.aiRecommendation && (
                                <div className="form-group" style={{ marginBottom: "1.25rem" }}>
                                    <label className="form-label" style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "#818cf8" }}>
                                        🛡️ AI 권고 조치 방안 (Mitigation Playbook)
                                    </label>
                                    <div style={{ background: "rgba(11, 15, 25, 0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", padding: "1rem", color: "#86efac", fontSize: "0.85rem", lineHeight: 1.6, fontFamily: "monospace", maxHeight: "200px", overflowY: "auto", whiteSpace: "pre-wrap", boxShadow: "inset 0 0 10px rgba(0,0,0,0.5)" }}>
                                        {editingLog.aiRecommendation}
                                    </div>
                                </div>
                            )}
                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                                <button type="button" className="btn btn-secondary" onClick={() => { setIsEditModalOpen(false); setEditingLog({}); }}>취소</button>
                                <button type="submit" className="btn btn-primary">수정 완료</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Real-time Toast Notifications Container */}
            <div id="toast-container">
                {toasts.map((toast) => (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        <div className="toast-header">
                            <span className="toast-title">
                                {getToastIcon(toast)} <strong>{toast.title || "시스템 알림"}</strong>
                            </span>
                            <button className="toast-close" onClick={() => removeToast(toast.id)}>&times;</button>
                        </div>
                        <div className="toast-body">
                            {toast.threatName ? <strong>{toast.threatName} </strong> : null}
                            {toast.message}
                        </div>
                        {toast.ipInfo ? <div className="toast-info">{toast.ipInfo}</div> : null}
                    </div>
                ))}
            </div>
        </div>
    );
}
