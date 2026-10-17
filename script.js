// script.js - defensive version: wrap initialization after DOM ready, add guards and logs
let excelData = [];
let chartInstance = null;

// Theme controls keys
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

  const toggleEl = document.getElementById("themeToggle");
  if (toggleEl) toggleEl.setAttribute("aria-pressed", isLight ? "true" : "false");

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
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        toggleHandler();
      }
    });
    toggle.setAttribute("aria-pressed", document.documentElement.classList.contains(LIGHT_CLASS) ? "true" : "false");
    // ensure toggle is focusable for keyboard users
    if (!toggle.hasAttribute('tabindex')) toggle.setAttribute('tabindex','0');
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
      document.body.classList.remove("ia-theme");
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

function safeGet(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`Element #${id} introuvable`);
  return el;
}

function initApp() {
  // init theme controls
  initThemeControls();

  const excelFileInput = safeGet('excelFile');
  const analyzeBtn = safeGet('analyzeBtn');
  const downloadBtn = safeGet('downloadBtn');
  const sendChatBtn = safeGet('sendChatBtn');

  if (excelFileInput) {
    excelFileInput.addEventListener('change', (e) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const arrayBuffer = event.target.result;
          const data = new Uint8Array(arrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          excelData = XLSX.utils.sheet_to_json(sheet);
          console.log('Données Excel chargées:', excelData);
        };
        reader.readAsArrayBuffer(file);
      } catch (err) {
        console.error('Erreur lecture fichier:', err);
        alert('Erreur lors de la lecture du fichier. Voir la console.');
      }
    });
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
      try {
        if (!excelData.length) {
          alert('Importez d’abord un fichier Excel.');
          return;
        }
        analyzeBtn.disabled = true;
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: excelData })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Erreur pendant l’analyse.');
        // render result - keep compatibility with previous structure
        const summaryText = result.summary || result.analysis || 'Aucune synthèse disponible.';
        const trends = Array.isArray(result.trends) ? result.trends : [];
        const suggestions = Array.isArray(result.suggestions) ? result.suggestions : [];
        const anomalies = Array.isArray(result.anomalies)
          ? result.anomalies
          : Array.isArray(result._local?.localAnomalies)
            ? result._local.localAnomalies
            : [];
        safeRenderSummary(summaryText);
        safeRenderList('trends', trends.map(i => i.description || i));
        safeRenderList('suggestions', suggestions);
        safeRenderAnomalies(anomalies);
        safeRenderChart(excelData);
      } catch (err) {
        console.error('Analyse error', err);
        alert(err.message || 'Erreur pendant l’analyse.');
      } finally {
        analyzeBtn.disabled = false;
      }
    });
  }

  if (sendChatBtn) {
    sendChatBtn.addEventListener('click', () => {
      const input = safeGet('chatInput');
      const chatMessages = safeGet('chatMessages');
      if (!input) return;
      const question = input.value.trim();
      if (!question) return;
      if (chatMessages) {
        const userMessage = document.createElement('div');
        userMessage.textContent = 'Vous : ' + question;
        chatMessages.appendChild(userMessage);
      }
      input.value = '';
      // reuse analyzeData by sending question parameter
      (async () => {
        try {
          if (!excelData.length) {
            alert('Importez d’abord un fichier Excel.');
            return;
          }
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: excelData, question })
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Erreur pendant la requête.');
          if (chatMessages) {
            const answerDiv = document.createElement('div');
            answerDiv.textContent = 'IA : ' + (result.summary || result.answer || 'Aucune réponse.');
            chatMessages.appendChild(answerDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
        } catch (err) {
          console.error('Chat error', err);
          alert(err.message || 'Erreur lors de la question.');
        }
      })();
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      try {
        if (!excelData.length) { alert('Aucun fichier Excel importé.'); return; }
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, 'excel_analyse.xlsx');
      } catch (err) {
        console.error('Download error', err);
        alert('Impossible de générer le fichier.');
      }
    });
  }
}

// safe render helpers (do nothing if element missing)
function safeRenderList(id, items) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  if (!items || items.length === 0) { el.innerHTML = '<li>Aucune donnée disponible.</li>'; return; }
  items.forEach(item => { const li = document.createElement('li'); li.textContent = typeof item === 'string' ? item : (item.description || JSON.stringify(item)); el.appendChild(li); });
}

function safeRenderSummary(text) {
  const el = document.getElementById('summary');
  if (!el) return; el.textContent = text || 'Aucune synthèse disponible.';
}

function safeRenderAnomalies(anomalies) {
  const tbody = document.querySelector('#anomaliesTable tbody');
  if (!tbody) return; tbody.innerHTML = '';
  if (!anomalies || anomalies.length === 0) { tbody.innerHTML = "<tr><td colspan='4'>Aucune anomalie détectée.</td></tr>"; return; }
  anomalies.forEach(item => { const tr = document.createElement('tr'); tr.innerHTML = `<td>${item.column||'-'}</td><td>${item.row||'-'}</td><td>${item.value??'-'}</td><td><span class="badge">${item.score??'n/a'}</span></td>`; tbody.appendChild(tr); });
}

function safeRenderChart(data) {
  try {
    if (!Array.isArray(data) || data.length === 0) return;
    const keys = Object.keys(data[0]);
    const numericKey = keys.find(k => data.map(r=>Number(r[k])).filter(v=>!Number.isNaN(v)).length>0);
    if (!numericKey) return;
    const labels = data.slice(0,10).map((_,i)=>`L${i+1}`);
    const values = data.slice(0,10).map(r=>Number(r[numericKey])||0);
    const canvas = document.getElementById('chart'); if (!canvas) return;
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(canvas, { type:'bar', data:{ labels, datasets:[{ label:numericKey, data:values, backgroundColor:'rgba(14,165,233,0.6)', borderColor:'rgba(14,165,233,1)', borderWidth:1 }]}, options:{ responsive:true, scales:{ y:{ beginAtZero:false }}} });
  } catch (err) { console.error('Chart render error', err); }
}

// Start app when DOM ready
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp); else initApp();
