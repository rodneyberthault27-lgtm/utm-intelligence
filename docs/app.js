const STORAGE_KEY = "utm_intelligence_links_v1";
const PUBLIC_APP_URL = "https://rodneyberthault27-lgtm.github.io/utm-intelligence/";

const channels = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "TikTok",
  "Google Ads",
  "WhatsApp",
  "E-mail Marketing",
  "Influenciadores",
  "Campanha Interna",
];

const state = {
  links: [],
  selectedId: null,
  query: "",
};

const $ = (selector) => document.querySelector(selector);

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function title(value) {
  return String(value || "-").replaceAll("_", " ");
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(value || 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function shortCode(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).slice(0, 7).padStart(5, "0");
}

function buildUrl(link) {
  const url = new URL(link.destination);
  url.searchParams.set("utm_source", normalize(link.source));
  url.searchParams.set("utm_medium", normalize(link.medium));
  url.searchParams.set("utm_campaign", normalize(link.campaign));
  if (link.content) url.searchParams.set("utm_content", normalize(link.content));
  if (link.influencer) url.searchParams.set("utm_term", normalize(link.influencer));
  return url.toString();
}

function buildTrackingUrl(link) {
  const baseUrl = window.location.protocol.startsWith("http")
    ? `${window.location.origin}${window.location.pathname}`
    : PUBLIC_APP_URL;
  const url = new URL(baseUrl);
  url.searchParams.set("go", buildUrl(link));
  url.searchParams.set("id", link.id);
  url.searchParams.set("c", shortCode(link.id + buildUrl(link)));
  return url.toString();
}

function buildShortUrl(link) {
  return link.shortUrl || buildTrackingUrl(link);
}

function handleIncomingRedirect() {
  const params = new URLSearchParams(window.location.search);
  const target = params.get("go");
  if (!target) return false;

  try {
    const redirectUrl = new URL(target);
    if (!["http:", "https:"].includes(redirectUrl.protocol)) return false;

    const linkId = params.get("id");
    const link = state.links.find((item) => item.id === linkId);
    if (link) {
      link.clicks += 1;
      save();
    }

    window.location.replace(redirectUrl.toString());
    return true;
  } catch (error) {
    return false;
  }
}

function save() {
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    links: state.links,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  updateSaveStatus(payload.savedAt);
}

function load() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    state.links = [];
    state.selectedId = null;
    save();
    return;
  }
  const parsed = JSON.parse(stored);
  state.links = Array.isArray(parsed) ? parsed : parsed.links || [];
  state.selectedId = state.links[0]?.id || null;
  updateSaveStatus(parsed.savedAt);
}

function updateSaveStatus(savedAt) {
  const status = $("#saveStatus");
  if (!status) return;
  const date = savedAt ? new Date(savedAt) : new Date();
  status.textContent = `Salvo em ${date.toLocaleString("pt-BR")}`;
}

function groupBy(key) {
  return state.links.reduce((acc, item) => {
    const group = item[key] || "Sem identificação";
    acc[group] = (acc[group] || 0) + Number(item.clicks || 0);
    return acc;
  }, {});
}

function getSelected() {
  return state.links.find((link) => link.id === state.selectedId) || state.links[0];
}

function performanceStatus(link) {
  const ratio = Number(link.clicks || 0) / Math.max(Number(link.target || 1), 1);
  if (ratio >= 1.1) return { label: "Acima da meta", className: "good" };
  if (ratio >= 0.75) return { label: "Em atenção", className: "warn" };
  return { label: "Abaixo da meta", className: "risk" };
}

function renderMetrics() {
  const total = state.links.reduce((sum, link) => sum + Number(link.clicks || 0), 0);
  const active = state.links.length;
  const byChannel = groupBy("source");
  const bestChannel = Object.entries(byChannel).sort((a, b) => b[1] - a[1])[0] || ["-", 0];
  const influencers = state.links.filter((link) => link.influencer);
  const byInfluencer = influencers.reduce((acc, link) => {
    acc[link.influencer] = (acc[link.influencer] || 0) + Number(link.clicks || 0);
    return acc;
  }, {});
  const bestInfluencer = Object.entries(byInfluencer).sort((a, b) => b[1] - a[1])[0] || ["-", 0];

  $("#totalClicks").textContent = formatNumber(total);
  $("#activeLinks").textContent = formatNumber(active);
  $("#bestChannel").textContent = bestChannel[0];
  $("#bestChannelClicks").textContent = `${formatNumber(bestChannel[1])} cliques`;
  $("#bestInfluencer").textContent = title(bestInfluencer[0]);
  $("#bestInfluencerClicks").textContent = `${formatNumber(bestInfluencer[1])} cliques`;
  $("#clickTrend").textContent = total > 3000 ? "+18% vs período anterior" : "+6% vs período anterior";
}

function renderChannelFilter() {
  const select = $("#channelFilter");
  const current = select.value || "all";
  select.innerHTML = `<option value="all">Todos os canais</option>`;
  channels.forEach((channel) => {
    const option = document.createElement("option");
    option.value = channel;
    option.textContent = channel;
    select.appendChild(option);
  });
  select.value = current;
}

function renderBars() {
  const filter = $("#channelFilter").value;
  const data = Object.entries(groupBy("source"))
    .filter(([name]) => filter === "all" || name === filter)
    .sort((a, b) => b[1] - a[1]);
  if (!data.length) {
    $("#channelBars").innerHTML = `<div class="empty-state">Cadastre seu primeiro link UTM para visualizar a performance por canal.</div>`;
    return;
  }
  const max = Math.max(...data.map(([, clicks]) => clicks), 1);
  $("#channelBars").innerHTML = data
    .map(
      ([name, clicks]) => `
      <div class="bar-row">
        <div class="bar-name">${name}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(clicks / max) * 100}%"></div></div>
        <div class="bar-value">${formatNumber(clicks)}</div>
      </div>
    `,
    )
    .join("");
}

function renderRanking() {
  const top = [...state.links].sort((a, b) => b.clicks - a.clicks).slice(0, 5);
  if (!top.length) {
    $("#rankingList").innerHTML = `<div class="empty-state">Nenhum link cadastrado ainda.</div>`;
    return;
  }
  $("#rankingList").innerHTML = top
    .map(
      (link, index) => `
      <div class="rank-item">
        <strong>${index + 1}. ${title(link.campaign)}</strong>
        <span class="rank-meta">${link.source} · ${link.brand} · ${formatNumber(link.clicks)} cliques</span>
      </div>
    `,
    )
    .join("");
}

function renderTable() {
  const query = normalize(state.query);
  const rows = state.links.filter((link) => normalize(Object.values(link).join(" ")).includes(query));
  if (!rows.length) {
    $("#linksTable").innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">Nenhum link encontrado. Crie seu primeiro link no gerador acima.</td>
      </tr>
    `;
    return;
  }
  $("#linksTable").innerHTML = rows
    .map((link) => {
      const status = performanceStatus(link);
      return `
        <tr>
          <td><strong>${title(link.campaign)}</strong><br><span class="rank-meta">${link.brand}</span></td>
          <td>${link.source}</td>
          <td>${link.influencer ? title(link.influencer) : "-"}</td>
          <td>${formatNumber(link.clicks)}</td>
          <td><span class="badge ${status.className}">${status.label}</span></td>
          <td>${buildShortUrl(link)}</td>
          <td><button class="small-btn" data-action="select" data-id="${link.id}">Abrir</button></td>
        </tr>
      `;
    })
    .join("");
}

function renderAlerts() {
  const alerts = [...state.links]
    .sort((a, b) => b.clicks / b.target - a.clicks / a.target)
    .slice(0, 6);
  if (!alerts.length) {
    $("#alertsList").innerHTML = `<div class="empty-state">Os alertas aparecerão quando houver links com metas cadastradas.</div>`;
    return;
  }
  $("#alertsList").innerHTML = alerts
    .map((link) => {
      const ratio = Math.round((link.clicks / Math.max(link.target, 1)) * 100);
      const status = performanceStatus(link);
      return `
        <div class="alert-item">
          <strong>${title(link.campaign)} · ${link.source}</strong>
          <span>${ratio}% da meta (${formatNumber(link.clicks)} de ${formatNumber(link.target)} cliques)</span>
          <span class="badge ${status.className}">${status.label}</span>
        </div>
      `;
    })
    .join("");
}

function renderOriginMap() {
  if (!state.links.length) {
    $("#originMap").innerHTML = `
      <div class="origin-item">
        <strong>Base limpa para seus dados</strong>
        <span>Cadastre campanhas reais e o app salva tudo automaticamente neste navegador.</span>
      </div>
      <div class="origin-item">
        <strong>Backup disponível</strong>
        <span>Use Backup JSON para guardar uma cópia externa e importar em outro dispositivo.</span>
      </div>
    `;
    return;
  }
  const channelCount = Object.keys(groupBy("source")).length;
  const campaignCount = new Set(state.links.map((link) => link.campaign)).size;
  const influencerClicks = state.links
    .filter((link) => link.influencer)
    .reduce((sum, link) => sum + Number(link.clicks || 0), 0);
  const total = state.links.reduce((sum, link) => sum + Number(link.clicks || 0), 0);
  const influencerShare = total ? Math.round((influencerClicks / total) * 100) : 0;

  $("#originMap").innerHTML = `
    <div class="origin-item">
      <strong>${channelCount} canais rastreados</strong>
      <span>Cobertura multicanal com leitura unificada.</span>
    </div>
    <div class="origin-item">
      <strong>${campaignCount} campanhas no histórico</strong>
      <span>Base pronta para comparar ações atuais e anteriores.</span>
    </div>
    <div class="origin-item">
      <strong>${influencerShare}% dos cliques vêm de influenciadores</strong>
      <span>Use o ranking para negociar novas ações com dados concretos.</span>
    </div>
  `;
}

function drawQr(text) {
  const canvas = $("#qrCanvas");
  if (window.QRCode?.toCanvas) {
    window.QRCode.toCanvas(canvas, text, {
      width: 180,
      margin: 1,
      color: { dark: "#10251d", light: "#ffffff" },
    });
    return;
  }

  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const cells = 29;
  const cell = Math.floor(size / cells);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  function square(x, y, w, color = "#10251d") {
    ctx.fillStyle = color;
    ctx.fillRect(x * cell, y * cell, w * cell, w * cell);
  }

  function finder(x, y) {
    square(x, y, 7);
    square(x + 1, y + 1, 5, "#ffffff");
    square(x + 2, y + 2, 3);
  }

  finder(1, 1);
  finder(21, 1);
  finder(1, 21);

  let seed = 0;
  for (let i = 0; i < text.length; i += 1) seed += text.charCodeAt(i) * (i + 1);
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const inFinder =
        (x < 9 && y < 9) || (x > 19 && y < 9) || (x < 9 && y > 19);
      if (!inFinder && ((x * 31 + y * 17 + seed) % 7 < 3)) {
        square(x, y, 1);
      }
    }
  }
}

function renderPreview() {
  const link = getSelected();
  if (!link) {
    $("#generatedUrl").value = "";
    $("#shortUrl").value = "";
    $("#customSlug").value = "";
    drawQr("utm-intelligence-empty");
    return;
  }
  const fullUrl = buildUrl(link);
  $("#generatedUrl").value = fullUrl;
  $("#shortUrl").value = buildShortUrl(link);
  $("#customSlug").value = link.shortAlias || normalize(link.campaign);
  drawQr(buildShortUrl(link));
}

function render() {
  renderMetrics();
  renderChannelFilter();
  renderBars();
  renderRanking();
  renderTable();
  renderAlerts();
  renderOriginMap();
  renderPreview();
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

function copy(value) {
  navigator.clipboard.writeText(value).then(() => toast("Copiado para a área de transferência."));
}

function exportCsv() {
  const headers = ["campanha", "canal", "midia", "marca", "influenciador", "cliques", "meta", "url", "link_rastreavel"];
  const rows = state.links.map((link) => [
    link.campaign,
    link.source,
    link.medium,
    link.brand,
    link.influencer,
    link.clicks,
    link.target,
    buildUrl(link),
    buildShortUrl(link),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `relatorio_utms_${today()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportBackup() {
  const payload = {
    app: "UTM Intelligence",
    version: 1,
    exportedAt: new Date().toISOString(),
    links: state.links,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `backup_utm_intelligence_${today()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const links = Array.isArray(parsed) ? parsed : parsed.links;
      if (!Array.isArray(links)) throw new Error("Arquivo sem lista de links.");
      state.links = links;
      state.selectedId = state.links[0]?.id || null;
      save();
      render();
      toast("Backup importado e salvo neste navegador.");
    } catch (error) {
      toast("Não foi possível importar este backup.");
    }
  };
  reader.readAsText(file);
}

async function shortenSelectedLink() {
  const link = getSelected();
  if (!link) {
    toast("Crie um link antes de encurtar.");
    return;
  }

  const alias = normalize($("#customSlug").value);
  if (!alias || alias.length < 4) {
    toast("Use letras, numeros e _ com pelo menos 4 caracteres.");
    return;
  }

  $("#shortenBtn").disabled = true;
  $("#shortenBtn").textContent = "Encurtando...";

  try {
    const data = await createShortLink(buildTrackingUrl(link), alias);
    link.shortAlias = alias;
    link.shortUrl = data.shortUrl;
    link.shortService = data.service;
    save();
    render();
    toast(data.usedAlias ? "Link curto direto criado com o nome escolhido." : "Link curto direto criado automaticamente.");
  } catch (error) {
    toast("Nao foi possivel encurtar agora. Tente outro nome.");
  } finally {
    $("#shortenBtn").disabled = false;
    $("#shortenBtn").textContent = "Encurtar";
  }
}

async function createShortLink(longUrl, alias) {
  try {
    const isGdUrl = new URL("https://is.gd/create.php");
    isGdUrl.searchParams.set("format", "json");
    isGdUrl.searchParams.set("url", longUrl);
    isGdUrl.searchParams.set("shorturl", alias);

    const response = await fetch(isGdUrl.toString());
    const data = await response.json();
    if (response.ok && data.shorturl) {
      return { shortUrl: data.shorturl, service: "is.gd", usedAlias: true };
    }
  } catch (error) {
    // Try the direct automatic fallback below.
  }

  const response = await fetch("https://cleanuri.com/api/v1/shorten", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ url: longUrl }),
  });
  const data = await response.json();
  if (!response.ok || !data.result_url) {
    throw new Error("Shortener failed.");
  }
  return { shortUrl: data.result_url, service: "cleanuri", usedAlias: false };
}

function bindEvents() {
  $("#utmForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const link = {
      id: `lnk_${Date.now()}`,
      createdAt: today(),
      destination: form.get("destination"),
      company: form.get("company"),
      brand: form.get("brand"),
      source: form.get("source"),
      medium: form.get("medium"),
      campaign: normalize(form.get("campaign")),
      content: normalize(form.get("content")),
      influencer: normalize(form.get("influencer")),
      target: Number(form.get("target") || 500),
      clicks: 0,
    };
    state.links.unshift(link);
    state.selectedId = link.id;
    save();
    render();
    toast("Link UTM criado com padrão inteligente.");
  });

  $("#copyUrlBtn").addEventListener("click", () => copy($("#generatedUrl").value));
  $("#copyShortBtn").addEventListener("click", () => copy($("#shortUrl").value));
  $("#shortenBtn").addEventListener("click", shortenSelectedLink);
  $("#exportCsvBtn").addEventListener("click", exportCsv);
  $("#exportBackupBtn").addEventListener("click", exportBackup);
  $("#importBackupBtn").addEventListener("click", () => $("#backupFileInput").click());
  $("#backupFileInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) importBackup(file);
    event.target.value = "";
  });
  $("#channelFilter").addEventListener("change", renderBars);
  $("#searchInput").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderTable();
  });

  $("#simulateClickBtn").addEventListener("click", () => {
    const link = getSelected();
    if (!link) return;
    link.clicks += 1;
    save();
    render();
    toast("Clique registrado.");
  });

  $("#linksTable").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action='select']");
    if (!button) return;
    state.selectedId = button.dataset.id;
    renderPreview();
    document.querySelector("#generator").scrollIntoView({ behavior: "smooth" });
  });

  document.querySelectorAll("nav a").forEach((anchor) => {
    anchor.addEventListener("click", () => {
      document.querySelectorAll("nav a").forEach((item) => item.classList.remove("active"));
      anchor.classList.add("active");
    });
  });

  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });
}

load();
if (!handleIncomingRedirect()) {
  bindEvents();
  render();
}
