
"use strict";

// ============================================
// IA EXEL — CONFIGURATION
// ============================================

let excelData = [];
let chartInstance = null;
let currentUser = null;

const SESSION_KEY = "iaexel_access_token";
const REFRESH_KEY = "iaexel_refresh_token";

const THEME_KEY = "exelia_theme";
const LIGHT_CLASS = "light";

// ============================================
// AUTHENTIFICATION
// ============================================

function getAccessToken() {
    return sessionStorage.getItem(SESSION_KEY);
}

function saveSession(session) {
    if (!session || !session.access_token) {
        return false;
    }

    sessionStorage.setItem(SESSION_KEY, session.access_token);

    if (session.refresh_token) {
        sessionStorage.setItem(REFRESH_KEY, session.refresh_token);
    }

    return true;
}

function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    currentUser = null;
}

async function apiRequest(url, options = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    let result;

    try {
        result = await response.json();
    } catch {
        throw new Error("Réponse invalide du serveur.");
    }

    if (!response.ok) {
        throw new Error(
            result.message || result.error || "Une erreur est survenue."
        );
    }

    return result;
}

function showAuthMessage(message, type = "error") {
    const element = document.getElementById("authMessage");

    if (!element) return;

    element.textContent = message;
    element.className = `auth-message ${type}`;
}

function setAuthMode(mode) {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const title = document.getElementById("authTitle");
    const description = document.getElementById("authDescription");
    const switchText = document.getElementById("authSwitchText");
    const switchButton = document.getElementById("authSwitchBtn");

    if (!loginForm || !registerForm) return;

    const isLogin = mode === "login";

    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;

    if (title) {
        title.textContent = isLogin ? "Connexion" : "Créer un compte";
    }

    if (description) {
        description.textContent = isLogin
            ? "Connectez-vous pour accéder à votre espace IA Exel."
            : "Créez votre compte pour utiliser IA Exel.";
    }

    if (switchText) {
        switchText.textContent = isLogin
            ? "Vous n'avez pas encore de compte ?"
            : "Vous avez déjà un compte ?";
    }

    if (switchButton) {
        switchButton.textContent = isLogin
            ? "S'inscrire"
            : "Se connecter";
    }

    showAuthMessage("");
}

function displayAuthenticatedApp(user) {
    currentUser = user;

    const authSection = document.getElementById("authSection");
    const appContent = document.getElementById("appContent");
    const accountArea = document.getElementById("accountArea");
    const userEmail = document.getElementById("userEmail");

    if (authSection) authSection.hidden = true;
    if (appContent) appContent.hidden = false;
    if (accountArea) accountArea.hidden = false;

    if (userEmail) {
        userEmail.textContent = user.email || "";
    }
}

function displayLoginScreen() {
    clearSession();

    const authSection = document.getElementById("authSection");
    const appContent = document.getElementById("appContent");
    const accountArea = document.getElementById("accountArea");

    if (authSection) authSection.hidden = false;
    if (appContent) appContent.hidden = true;
    if (accountArea) accountArea.hidden = true;

    setAuthMode("login");
}

// Vérifier la session existante
async function checkAuthentication() {
    const token = getAccessToken();

    if (!token) {
        displayLoginScreen();
        return;
    }

    try {
        const result = await apiRequest("/api/auth/me", {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        if (!result.user) {
            throw new Error("Utilisateur introuvable.");
        }

        displayAuthenticatedApp(result.user);

    } catch (error) {
        console.warn("Session invalide :", error.message);
        displayLoginScreen();
    }
}

// Inscription
async function handleRegister(event) {
    event.preventDefault();

    const username = document.getElementById("registerUsername").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    const button = event.submitter;
    if (button) button.disabled = true;

    try {
        showAuthMessage("Création du compte...", "info");

        const result = await apiRequest("/api/auth/register", {
            method: "POST",
            body: JSON.stringify({
                username,
                email,
                password
            })
        });

        if (result.session && saveSession(result.session)) {
            await checkAuthentication();
            showAuthMessage("Compte créé avec succès.", "success");
        } else {
            showAuthMessage(
                "Compte créé ! Vérifiez votre boîte e-mail pour confirmer votre inscription, puis connectez-vous.",
                "success"
            );

            setAuthMode("login");

            const loginEmail = document.getElementById("loginEmail");
            if (loginEmail) loginEmail.value = email;
        }

        event.target.reset();

    } catch (error) {
        showAuthMessage(error.message);
    } finally {
        if (button) button.disabled = false;
    }
}

// Connexion
async function handleLogin(event) {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    const button = event.submitter;
    if (button) button.disabled = true;

    try {
        showAuthMessage("Connexion en cours...", "info");

        const result = await apiRequest("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
                email,
                password
            })
        });

        if (!saveSession(result.session)) {
            throw new Error(
                "Connexion effectuée, mais aucune session n'a été reçue."
            );
        }

        await checkAuthentication();

        if (currentUser) {
            showAuthMessage("Connexion réussie.", "success");
            event.target.reset();
        }

    } catch (error) {
        showAuthMessage(error.message);
    } finally {
        if (button) button.disabled = false;
    }
}

// Déconnexion
async function handleLogout() {
    const token = getAccessToken();

    try {
        if (token) {
            await apiRequest("/api/auth/logout", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
        }
    } catch (error) {
        console.error("Erreur de déconnexion :", error);
    } finally {
        displayLoginScreen();
        showAuthMessage("Vous êtes déconnecté.", "success");
    }
}

function initAuthentication() {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const switchButton = document.getElementById("authSwitchBtn");
    const logoutButton = document.getElementById("logoutBtn");

    if (loginForm) {
        loginForm.addEventListener("submit", handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener("submit", handleRegister);
    }

    if (switchButton) {
        switchButton.addEventListener("click", () => {
            const isLogin = !document.getElementById("loginForm").hidden;
            setAuthMode(isLogin ? "register" : "login");
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", handleLogout);
    }

    checkAuthentication();
}

// ============================================
// GESTION DES THÈMES
// ============================================

function applyThemeVars(vars) {
    const root = document.documentElement;
    if (!vars) return;

    if (vars.bg) root.style.setProperty("--bg-dark", vars.bg);
    if (vars.panel) root.style.setProperty("--panel-dark", vars.panel);
    if (vars.text) root.style.setProperty("--text", vars.text);
    if (vars.muted) root.style.setProperty("--muted", vars.muted);
    if (vars.accentBlue) root.style.setProperty("--accent-blue", vars.accentBlue);
    if (vars.accentGreen) root.style.setProperty("--accent-green", vars.accentGreen);
}

function saveTheme(themeObj) {
    try {
        localStorage.setItem(THEME_KEY, JSON.stringify(themeObj));
    } catch (error) {
        console.warn("Impossible de sauvegarder le thème", error);
    }
}

function loadTheme() {
    try {
        const raw = localStorage.getItem(THEME_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn("Erreur lecture thème", error);
        return null;
    }
}

function setLightMode(isLight) {
    if (isLight) {
        document.documentElement.classList.add(LIGHT_CLASS);
    } else {
        document.documentElement.classList.remove(LIGHT_CLASS);
    }

    const toggleEl = document.getElementById("themeToggle");

    if (toggleEl) {
        toggleEl.setAttribute("aria-pressed", isLight ? "true" : "false");
    }

    const stored = loadTheme() || {};
    stored.isLight = isLight;
    saveTheme(stored);
}

function initThemeControls() {
    const toggle = document.getElementById("themeToggle");
    const colorAccentBlue = document.getElementById("colorAccentBlue");
    const colorAccentGreen = document.getElementById("colorAccentGreen");
    const colorBg = document.getElementById("colorBg");
    const colorText = document.getElementById("colorText");
    const resetBtn = document.getElementById("resetThemeBtn");
    const applyIaBtn = document.getElementById("applyIaThemeBtn");

    const saved = loadTheme();

    if (saved) {
        applyThemeVars(saved);

        if (saved.accentBlue && colorAccentBlue) colorAccentBlue.value = saved.accentBlue;
        if (saved.accentGreen && colorAccentGreen) colorAccentGreen.value = saved.accentGreen;
        if (saved.bg && colorBg) colorBg.value = saved.bg;
        if (saved.text && colorText) colorText.value = saved.text;

        setLightMode(Boolean(saved.isLight));
    }

    if (toggle) {
        const toggleHandler = () => {
            const isLight = document.documentElement.classList.contains(LIGHT_CLASS);
            setLightMode(!isLight);
        };

        toggle.addEventListener("click", toggleHandler);

        toggle.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleHandler();
            }
        });

        toggle.setAttribute(
            "aria-pressed",
            document.documentElement.classList.contains(LIGHT_CLASS) ? "true" : "false"
        );
    }

    const onColorChange = () => {
        const vars = {
            accentBlue: colorAccentBlue?.value,
            accentGreen: colorAccentGreen?.value,
            bg: colorBg?.value,
            text: colorText?.value,
            isLight: document.documentElement.classList.contains(LIGHT_CLASS)
        };

        applyThemeVars(vars);
        saveTheme(vars);
    };

    [colorAccentBlue, colorAccentGreen, colorBg, colorText].forEach((input) => {
        if (input) input.addEventListener("input", onColorChange);
    });

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            localStorage.removeItem(THEME_KEY);
            location.reload();
        });
    }

    if (applyIaBtn) {
        applyIaBtn.addEventListener("click", () => {
            const iaVars = {
                accentBlue: "#08a6e0",
                accentGreen: "#12c28b",
                bg: "#061021",
                text: "#e8f6ff",
                isLight: false
            };

            applyThemeVars(iaVars);
            document.body.classList.add("ia-theme");

            const stored = loadTheme() || {};
            Object.assign(stored, iaVars);
            stored.iaTheme = true;

            saveTheme(stored);
        });
    }

    if (saved && saved.iaTheme) {
        document.body.classList.add("ia-theme");
    }
}

// ============================================
// OUTILS D'AFFICHAGE
// ============================================

function safeGet(id) {
    const element = document.getElementById(id);

    if (!element) {
        console.warn(`Élément #${id} introuvable`);
    }

    return element;
}

function safeRenderList(id, items) {
    const element = document.getElementById(id);
    if (!element) return;

    element.replaceChildren();

    if (!items || items.length === 0) {
        const li = document.createElement("li");
        li.textContent = "Aucune donnée disponible.";
        element.appendChild(li);
        return;
    }

    items.forEach((item) => {
        const li = document.createElement("li");

        li.textContent = typeof item === "string"
            ? item
            : (item.description || JSON.stringify(item));

        element.appendChild(li);
    });
}

function safeRenderSummary(text) {
    const element = document.getElementById("summary");
    if (!element) return;

    element.textContent = text || "Aucune synthèse disponible.";
}

function safeRenderAnomalies(anomalies) {
    const tbody = document.querySelector("#anomaliesTable tbody");
    if (!tbody) return;

    tbody.replaceChildren();

    if (!anomalies || anomalies.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = 4;
        td.textContent = "Aucune anomalie détectée.";

        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    anomalies.forEach((item) => {
        const tr = document.createElement("tr");

        const values = [
            item.column ?? "-",
            item.row ?? "-",
            item.value ?? "-",
            item.score ?? "n/a"
        ];

        values.forEach((value) => {
            const td = document.createElement("td");
            td.textContent = String(value);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

function safeRenderChart(data) {
    try {
        if (!Array.isArray(data) || data.length === 0) return;

        const keys = Object.keys(data[0]);

        const numericKey = keys.find((key) =>
            data.some((row) => {
                const value = row[key];
                return value !== null && value !== "" &&
                    Number.isFinite(Number(value));
            })
        );

        if (!numericKey) return;

        const labels = data.slice(0, 10).map((_, index) => `L${index + 1}`);

        const values = data.slice(0, 10).map((row) =>
            Number(row[numericKey]) || 0
        );

        const canvas = document.getElementById("chart");
        if (!canvas) return;

        if (chartInstance) {
            chartInstance.destroy();
        }

        chartInstance = new Chart(canvas, {
            type: "bar",
            data: {
                labels,
                datasets: [{
                    label: numericKey,
                    data: values,
                    backgroundColor: "rgba(14,165,233,0.6)",
                    borderColor: "rgba(14,165,233,1)",
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });

    } catch (error) {
        console.error("Erreur graphique :", error);
    }
}

// ============================================
// IMPORTATION ET ANALYSE EXCEL
// ============================================

function initExcelFeatures() {
    const excelFileInput = safeGet("excelFile");
    const analyzeBtn = safeGet("analyzeBtn");
    const downloadBtn = safeGet("downloadBtn");
    const sendChatBtn = safeGet("sendChatBtn");

    if (excelFileInput) {
        excelFileInput.addEventListener("change", (event) => {
            const file = event.target.files[0];
            const fileInfo = document.getElementById("fileInfo");

            if (!file) return;

            excelData = [];

            if (!/\.(xlsx|xls)$/i.test(file.name)) {
                alert("Veuillez choisir un fichier Excel valide.");
                excelFileInput.value = "";

                if (fileInfo) {
                    fileInfo.textContent = "Aucun fichier sélectionné";
                }

                return;
            }

            if (fileInfo) {
                fileInfo.textContent = "⏳ Chargement de " + file.name + "...";
            }

            const reader = new FileReader();

            reader.onload = (readerEvent) => {
                try {
                    const data = new Uint8Array(readerEvent.target.result);

                    const workbook = XLSX.read(data, {
                        type: "array"
                    });

                    if (!workbook.SheetNames.length) {
                        throw new Error("Aucune feuille Excel trouvée.");
                    }

                    const sheet = workbook.Sheets[workbook.SheetNames[0]];

                    excelData = XLSX.utils.sheet_to_json(sheet);

                    if (!excelData.length) {
                        throw new Error("Le fichier Excel ne contient aucune donnée.");
                    }

                    if (fileInfo) {
                        fileInfo.replaceChildren();

                        const name = document.createElement("strong");
                        name.textContent = "✓ " + file.name;

                        const details = document.createElement("small");
                        details.textContent =
                            (file.size / 1024).toFixed(2) + " Ko — " +
                            excelData.length + " lignes importées";

                        fileInfo.append(name, details);
                    }

                    console.log("Fichier importé :", file.name);

                } catch (error) {
                    excelData = [];

                    console.error("Erreur lecture Excel :", error);

                    if (fileInfo) {
                        fileInfo.textContent = "❌ Impossible de lire ce fichier.";
                    }

                    alert(error.message);
                }
            };

            reader.onerror = () => {
                excelData = [];

                if (fileInfo) {
                    fileInfo.textContent = "❌ Erreur de lecture du fichier.";
                }

                alert("Impossible de lire le fichier.");
            };

            reader.readAsArrayBuffer(file);
        });
    }

    // ANALYSE IA
    if (analyzeBtn) {
        analyzeBtn.addEventListener("click", async () => {
            try {
                if (!excelData.length) {
                    alert("Importez d’abord un fichier Excel.");
                    return;
                }

                analyzeBtn.disabled = true;
                analyzeBtn.textContent = "Analyse en cours...";

                const response = await fetch("/api/analyze", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        data: excelData
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "Erreur pendant l’analyse.");
                }

                const summaryText =
                    result.summary ||
                    result.analysis ||
                    "Aucune synthèse disponible.";

                const trends = Array.isArray(result.trends)
                    ? result.trends : [];

                const suggestions = Array.isArray(result.suggestions)
                    ? result.suggestions : [];

                const anomalies = Array.isArray(result.anomalies)
                    ? result.anomalies
                    : Array.isArray(result._local?.localAnomalies)
                        ? result._local.localAnomalies
                        : [];

                safeRenderSummary(summaryText);

                safeRenderList(
                    "trends",
                    trends.map(item => item.description || item)
                );

                safeRenderList("suggestions", suggestions);
                safeRenderAnomalies(anomalies);
                safeRenderChart(excelData);

            } catch (error) {
                console.error("Erreur analyse :", error);
                alert(error.message || "Erreur pendant l’analyse.");
            } finally {
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = "Analyser";
            }
        });
    }

    // CHAT IA
    if (sendChatBtn) {
        sendChatBtn.addEventListener("click", async () => {
            const input = safeGet("chatInput");
            const chatMessages = safeGet("chatMessages");

            if (!input) return;

            const question = input.value.trim();
            if (!question) return;

            if (!excelData.length) {
                alert("Importez d’abord un fichier Excel.");
                return;
            }

            if (chatMessages) {
                const userMessage = document.createElement("div");
                userMessage.textContent = "Vous : " + question;
                chatMessages.appendChild(userMessage);
            }

            input.value = "";
            sendChatBtn.disabled = true;

            try {
                const response = await fetch("/api/analyze", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        data: excelData,
                        question
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || "Erreur pendant la requête.");
                }

                if (chatMessages) {
                    const answerDiv = document.createElement("div");

                    answerDiv.textContent =
                        "IA : " +
                        (result.summary || result.answer || "Aucune réponse.");

                    chatMessages.appendChild(answerDiv);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }

            } catch (error) {
                console.error("Erreur chat :", error);
                alert(error.message || "Erreur lors de la question.");
            } finally {
                sendChatBtn.disabled = false;
            }
        });
    }

    // TÉLÉCHARGEMENT
    if (downloadBtn) {
        downloadBtn.addEventListener("click", () => {
            try {
                if (!excelData.length) {
                    alert("Aucun fichier Excel importé.");
                    return;
                }

                const ws = XLSX.utils.json_to_sheet(excelData);
                const wb = XLSX.utils.book_new();

                XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

                XLSX.writeFile(wb, "excel_analyse.xlsx");

            } catch (error) {
                console.error("Erreur téléchargement :", error);
                alert("Impossible de générer le fichier.");
            }
        });
    }
}

// ============================================
// INITIALISATION
// ============================================

function initApp() {
    initThemeControls();
    initAuthentication();
    initExcelFeatures();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}

