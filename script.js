let excelData = [];
let chartInstance = null;

// Theme controls: toggle light/dark + color pickers (saved in localStorage)
const THEME_KEY = "exelia_theme";
const LIGHT_CLASS = "light";

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
  try { localStorage.setItem(THEME_KEY, JSON.stringify(themeObj)); }
  catch (e) { console.warn("Impossible de sauvegarder le thème", e); }
}

function loadTheme() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { console.warn("Erreur lecture thème", e); return null; }
}

function setLightMode(isLight) {
  if (isLight) document.documentElement.classList.add(LIGHT_CLASS);
  else document.documentElement.classList.remove(LIGHT_CLASS);

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
    toggle.addEventListener("click", () => {
      const isLight = document.documentElement.classList.contains(LIGHT_CLASS);
      setLightMode(!isLight);
    });
  }

  const onColorChange = () => {
    const vars = {
      accentBlue: colorAccentBlue?.value || getComputedStyle(document.documentElement).getPropertyValue("--accent-blue").trim(),
      accentGreen: colorAccentGreen?.value || getComputedStyle(document.documentElement).getPropertyValue("--accent-green").trim(),
      bg: colorBg?.value || getComputedStyle(document.documentElement).getPropertyValue("--bg-dark").trim(),
      text: colorText?.value || getComputedStyle(document.documentElement).getPropertyValue("--text").trim(),
      isLight: document.documentElement.classList.contains(LIGHT_CLASS)
    };
    applyThemeVars(vars);
    saveTheme(vars);
  };

  [colorAccentBlue, colorAccentGreen, colorBg, colorText].forEach((input) => {
    if (!input) return;
    input.addEventListener("input", onColorChange);
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      localStorage.removeItem(THEME_KEY);
      location.reload();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initThemeControls);
} else {
  initThemeControls();
}

// Read Excel file and convert to JSON

document.getElementById("excelFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
        const arrayBuffer = event.target.result;
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        excelData = XLSX.utils.sheet_to_json(sheet);
        console.log("Données Excel chargées:", excelData);
    };

    reader.readAsArrayBuffer(file);
});

function renderList(id, items) {
    const list = document.getElementById(id);
    list.innerHTML = "";

    if (!items || items.length === 0) {
        list.innerHTML = "<li>Aucune donnée disponible.</li>";
        return;
    }

    items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = typeof item === "string" ? item : (item.description || JSON.stringify(item));
        list.appendChild(li);
    });
}

function renderSummary(text) {
    document.getElementById("summary").textContent = text || "Aucune synthèse disponible.";
}

function renderAnomalies(anomalies) {
    const tbody = document.querySelector("#anomaliesTable tbody");
    tbody.innerHTML = "";

    if (!anomalies || anomalies.length === 0) {
        tbody.innerHTML = "<tr><td colspan='4'>Aucune anomalie détectée.</td></tr>";
        return;
    }

    anomalies.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${item.column || "-"}</td>
            <td>${item.row || "-"}</td>
            <td>${item.value ?? "-"}</td>
            <td><span class="badge">${item.score ?? "n/a"}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function renderChartFromData(data) {
    if (!Array.isArray(data) || data.length === 0) return;

    const keys = Object.keys(data[0]);
    const numericKey = keys.find((key) => {
        const values = data
            .map((row) => Number(row[key]))
            .filter((value) => !Number.isNaN(value));
        return values.length > 0;
    });

    if (!numericKey) return;

    const labels = data.slice(0, 10).map((_, index) => `L${index + 1}`);
    const values = data.slice(0, 10).map((row) => Number(row[numericKey]) || 0);

    const canvas = document.getElementById("chart");
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
}

async function analyzeData(question = "") {
    if (!excelData.length) {
        alert("Importez d’abord un fichier Excel.");
        return;
    }

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
            throw new Error(result.error || "Erreur pendant l’analyse.");
        }

        const summaryText = result.summary || result.analysis || "Aucune synthèse disponible.";
        renderSummary(summaryText);

        const trends = Array.isArray(result.trends) ? result.trends : [];
        renderList("trends", trends.map((item) => item.description || item));

        const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
        renderList("suggestions", suggestions);

        const anomalies = Array.isArray(result.anomalies)
            ? result.anomalies
            : Array.isArray(result._local?.localAnomalies)
                ? result._local.localAnomalies
                : [];

        renderAnomalies(anomalies);
        renderChartFromData(excelData);

    } catch (error) {
        console.error(error);
        renderSummary(error.message || "Erreur de traitement.");
    }
}

document.getElementById("analyzeBtn").addEventListener("click", () => analyzeData());

document.getElementById("sendChatBtn").addEventListener("click", () => {
    const question = document.getElementById("chatInput").value.trim();
    if (!question) return;

    const chatMessages = document.getElementById("chatMessages");
    const userMessage = document.createElement("div");
    userMessage.textContent = "Vous : " + question;
    chatMessages.appendChild(userMessage);

    document.getElementById("chatInput").value = "";
    analyzeData(question);

    const answerMessage = document.createElement("div");
    answerMessage.textContent = "IA : Analyse en cours...";
    chatMessages.appendChild(answerMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

document.getElementById("downloadBtn").addEventListener("click", () => {
    if (!excelData.length) {
        alert("Aucun fichier Excel importé.");
        return;
    }

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "excel_analyse.xlsx");
});
