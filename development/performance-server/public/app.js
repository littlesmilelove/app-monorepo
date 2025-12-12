/* global fetch */

const state = {
  sessions: [],
  currentSessionId: null,
  sessionData: null,
  analysis: null,
  timeline: {
    minTs: 0,
    maxTs: 0,
    span: 0,
    basePxPerMs: 1,
    zoom: 1,
    displaySpan: 0,
    collapseGaps: true,
    collapses: [],
    userAdjusted: false,
  },
  selection: null,
};

const GAP_THRESHOLD_MS = 5000;
const GAP_COLLAPSED_MS = 200;

const palette = [
  '#60a5fa',
  '#f97316',
  '#22d3ee',
  '#a78bfa',
  '#34d399',
  '#f472b6',
  '#facc15',
  '#38bdf8',
  '#f87171',
  '#c084fc',
  '#fb7185',
];

function getColorForModule(module) {
  if (!module) return palette[0];
  let hash = 0;
  for (let i = 0; i < module.length; i += 1) {
    hash = (hash * 31 + module.charCodeAt(i)) % palette.length;
  }
  return palette[Math.abs(hash) % palette.length];
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

function normalizePath(p) {
  return typeof p === 'string' ? p.replace(/\\/g, '/') : '';
}

function deriveModuleFromPath(filePath) {
  if (!filePath) return 'unknown';
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/').filter(Boolean);
  const pkgIdx = parts.indexOf('packages');
  if (pkgIdx >= 0 && parts[pkgIdx + 1]) {
    const pkg = parts[pkgIdx + 1];
    const scope = parts[pkgIdx + 2];
    if (scope && scope !== 'src') {
      return `${pkg}/${scope}`;
    }
    const afterSrc = parts[pkgIdx + 3];
    return afterSrc ? `${pkg}/${afterSrc}` : pkg;
  }
  return parts.slice(0, 2).join('/') || normalized;
}

function pickTimestamp(event, payload) {
  const candidate =
    payload?.absoluteTime ??
    event?.absoluteTime ??
    payload?.timestamp ??
    event?.timestamp ??
    payload?.time ??
    event?.time ??
    payload?.ts ??
    event?.ts;
  const num = Number(candidate);
  return Number.isFinite(num) ? num : 0;
}

function formatNumber(num) {
  return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) return '-';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(1)} ms`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(text) {
  const btn = document.getElementById('reloadSession');
  if (btn) {
    btn.textContent = text;
  }
}

function renderSessionOptions() {
  const select = document.getElementById('sessionSelect');
  select.innerHTML = '';
  if (!state.sessions.length) {
    select.innerHTML = '<option value="">No sessions</option>';
    return;
  }
  state.sessions.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.sessionId;
    const activeMark = s.active ? ' • live' : '';
    opt.textContent = `${s.sessionId} (${s.platform || 'unknown'})${activeMark}`;
    select.appendChild(opt);
  });
  if (state.currentSessionId) {
    select.value = state.currentSessionId;
  } else {
    state.currentSessionId = state.sessions[0].sessionId;
    select.value = state.currentSessionId;
  }
}

function renderMeta() {
  const meta = state.sessionData?.meta || state.analysis?.meta || {};
  const eventCounts = meta.eventCounts || {};
  document.getElementById('metaPlatform').textContent = meta.platform || '-';
  document.getElementById('metaStart').textContent = meta.startTime
    ? new Date(meta.startTime).toLocaleString()
    : '-';
  document.getElementById('metaEvents').textContent = formatNumber(
    Object.values(eventCounts).reduce((a, b) => a + b, 0) || 0,
  );
  document.getElementById('metaFunctions').textContent = formatNumber(
    state.analysis?.analysis?.summary?.totalCalls || 0,
  );
}

function buildPoints(list, accessorX, accessorY) {
  return list
    .map((item) => ({
      x: Number(accessorX(item)),
      y: Number(accessorY(item)),
    }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
}

function renderSparkline(containerId, points, color, formatter) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!points.length) {
    container.innerHTML = '<div class="text-sm text-slate-500">No data</div>';
    return;
  }
  const width = container.clientWidth || 600;
  const height = 110;
  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  const path = points
    .map((p, idx) => {
      const x = ((p.x - minX) / spanX) * width;
      const y = height - ((p.y - minY) / spanY) * height;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  const last = points[points.length - 1];
  container.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="overflow-visible">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2" />
    </svg>
    <div class="mt-2 text-xs text-slate-400">${formatter ? formatter(last.y) : last.y}</div>
  `;
}

function renderMemory() {
  const memory = state.sessionData?.events?.memory || [];
  const points = buildPoints(
    memory,
    (e) => e.timestamp ?? e.absoluteTime ?? e.data?.timestamp ?? 0,
    (e) => e.data?.heapUsed ?? e.heapUsed ?? e.data,
  );
  renderSparkline('memorySparkline', points, '#60a5fa', formatBytes);
  document.getElementById('memorySummary').textContent = points.length
    ? `${formatBytes(points[points.length - 1].y)} (latest)`
    : '-';
  document.getElementById('memoryCount').textContent = `${points.length} pts`;
}

function renderFps() {
  const fps = state.sessionData?.events?.fps || [];
  const points = buildPoints(
    fps,
    (e) => e.timestamp ?? e.absoluteTime ?? e.data?.timestamp ?? 0,
    (e) => e.data?.fps ?? e.fps ?? 0,
  );
  renderSparkline('fpsSparkline', points, '#f97316', (v) => `${v.toFixed(0)} fps`);
  document.getElementById('fpsSummary').textContent = points.length
    ? `${points[points.length - 1].y.toFixed(0)} fps (latest)`
    : '-';
  document.getElementById('fpsCount').textContent = `${points.length} pts`;
}

function buildFunctionEvents() {
  const functionEvents = state.sessionData?.events?.function_call || [];
  return functionEvents
    .map((e) => {
      const payload = e.data || e;
      const endTs = pickTimestamp(e, payload);
      const dur = Number(payload.duration || 0);
      const startTs = Math.max(0, endTs - dur);
      return {
        type: 'function',
        name: payload.name || 'unknown',
        module: payload.module || 'unknown',
        duration: dur,
        start: startTs,
        end: endTs,
        file: normalizePath(payload.file || ''),
        line: payload.line || 0,
        stack: Array.isArray(payload.stack) ? payload.stack : [],
      };
    })
    .filter((e) => e.duration > 0)
    .sort((a, b) => a.start - b.start);
}

function buildModuleLoadEvents() {
  const moduleLoads = state.sessionData?.events?.module_load || [];
  return moduleLoads
    .map((e) => {
      const payload = e.data || e;
      const ts = pickTimestamp(e, payload);
      const duration = Math.max(Number(payload.duration || 0), 0);
      const path = normalizePath(payload.path || payload.module || 'unknown');
      return {
        type: 'module',
        path,
        module: deriveModuleFromPath(path),
        duration,
        start: ts,
        end: ts + duration,
      };
    })
    .filter((e) => Number.isFinite(e.start))
    .sort((a, b) => a.start - b.start);
}

function buildCollapseMap(events, minTs, collapseGaps) {
  if (!events.length) {
    return { collapses: [], displaySpan: 0 };
  }
  const sorted = [...events].sort((a, b) => a.start - b.start);
  const collapses = [];
  let offset = 0;
  let prevStart = sorted[0]?.start ?? minTs;
  sorted.forEach((ev) => {
    const gap = ev.start - prevStart;
    if (collapseGaps && gap > GAP_THRESHOLD_MS) {
      offset += gap - GAP_COLLAPSED_MS;
      collapses.push({ at: ev.start, offset });
    }
    prevStart = ev.start;
  });
  const maxEnd = Math.max(...events.map((ev) => ev.end ?? ev.start));
  const displaySpan = Math.max(maxEnd - minTs - offset, 1);
  return { collapses, displaySpan };
}

function mapCollapsedTime(ts, minTs, collapses) {
  let offset = 0;
  for (let i = 0; i < collapses.length; i += 1) {
    if (ts >= collapses[i].at) {
      offset = collapses[i].offset;
    } else {
      break;
    }
  }
  return Math.max(0, ts - minTs - offset);
}

function computeTimeline(events) {
  if (!events.length) {
    state.timeline = {
      minTs: 0,
      maxTs: 0,
      span: 0,
      basePxPerMs: 1,
      zoom: 1,
      displaySpan: 0,
      collapseGaps: state.timeline.collapseGaps ?? true,
      collapses: [],
      userAdjusted: false,
    };
    return;
  }
  const minTs = Math.min(...events.map((e) => e.start));
  const maxTs = Math.max(...events.map((e) => e.start + e.duration));
  const span = Math.max(maxTs - minTs, 1);
  const basePxPerMs = 1200 / span;
  const shouldKeepZoom =
    state.timeline &&
    state.timeline.span > 0 &&
    state.timeline.minTs === minTs &&
    state.timeline.maxTs === maxTs;
  const zoom = shouldKeepZoom ? state.timeline.zoom : 1;
  const userAdjusted = shouldKeepZoom ? state.timeline.userAdjusted : false;
  const { collapses, displaySpan } = buildCollapseMap(events, minTs, state.timeline.collapseGaps ?? true);
  state.timeline = {
    minTs,
    maxTs,
    span,
    basePxPerMs,
    zoom,
    displaySpan,
    collapseGaps: state.timeline.collapseGaps ?? true,
    collapses,
    userAdjusted,
  };
}

function renderAxis(minTs, maxTs, pxPerMs, trackWidth) {
  const axis = document.getElementById('timelineAxis');
  axis.innerHTML = '';
  axis.style.width = `${trackWidth}px`;
  const span = maxTs - minTs;
  if (span <= 0) return;
  const niceStep = span / 8;
  const rawStep = niceStep < 1000 ? 500 : Math.round(niceStep / 1000) * 1000;
  const step = rawStep || 1000;
  for (let t = minTs; t <= maxTs + 1; t += step) {
    const left = (t - minTs) * pxPerMs;
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = `${left}px`;
    tick.textContent = formatMs(t - minTs);
    axis.appendChild(tick);

    const grid = document.createElement('div');
    grid.className = 'grid-line';
    grid.style.left = `${left}px`;
    grid.style.height = '100%';
    axis.appendChild(grid);
  }
}

function renderModuleLegend(modules) {
  const legend = document.getElementById('moduleLegend');
  legend.innerHTML = '';
  modules.forEach((m) => {
    const item = document.createElement('div');
    item.className = 'flex items-center gap-2 px-2 py-1 rounded border border-dark-border';
    const swatch = document.createElement('span');
    swatch.className = 'inline-block w-3 h-3 rounded';
    swatch.style.background = getColorForModule(m);
    const label = document.createElement('span');
    label.textContent = m;
    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  });
}

function renderModuleLoadLegend(modules) {
  const legend = document.getElementById('moduleLoadLegend');
  if (!legend) return;
  legend.innerHTML = '';
  const limited = modules.slice(0, 40);
  limited.forEach((m) => {
    const item = document.createElement('div');
    item.className = 'flex items-center gap-2 px-2 py-1 rounded border border-dark-border';
    const swatch = document.createElement('span');
    swatch.className = 'inline-block w-3 h-3 rounded';
    swatch.style.background = getColorForModule(m);
    const label = document.createElement('span');
    label.textContent = m;
    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  });
  if (modules.length > limited.length) {
    const more = document.createElement('div');
    more.className = 'text-xs text-slate-500';
    more.textContent = `+${modules.length - limited.length} more`;
    legend.appendChild(more);
  }
}

function renderTimeline() {
  const track = document.getElementById('functionTrack');
  const moduleTrack = document.getElementById('moduleTrack');
  const wrapper = document.getElementById('functionTrackWrapper');
  track.innerHTML = '';
  if (moduleTrack) {
    moduleTrack.innerHTML = '';
  }
  if (!wrapper) return;
  const functionEvents = buildFunctionEvents();
  const moduleLoads = buildModuleLoadEvents();
  const timelineEvents = [...functionEvents, ...moduleLoads];
  if (!timelineEvents.length) {
    track.innerHTML = '<div class="text-sm text-slate-500">No function calls</div>';
    if (moduleTrack) {
      moduleTrack.innerHTML = '<div class="text-xs text-slate-500 px-2 pt-2">No module loads</div>';
    }
    document.getElementById('timelineSpan').textContent = '-';
    document.getElementById('timelineAxis').innerHTML = '';
    renderModuleLegend([]);
    renderModuleLoadLegend([]);
    return;
  }

  computeTimeline(timelineEvents);
  const { minTs, basePxPerMs, collapses } = state.timeline;
  let { zoom } = state.timeline;

  if (!state.timeline.userAdjusted && functionEvents.length) {
    const fnMin = Math.min(...functionEvents.map((e) => e.start));
    const fnMax = Math.max(...functionEvents.map((e) => e.start + e.duration));
    const fnSpan = Math.max(fnMax - fnMin, 1);
    const desiredZoom = Math.min(Math.max(state.timeline.displaySpan / fnSpan, 1), 30);
    state.timeline.zoom = desiredZoom;
  }
  zoom = state.timeline.zoom;

  const placed = functionEvents.map((ev) => ({
    ...ev,
    displayStart: mapCollapsedTime(ev.start, minTs, collapses),
    displayDuration: ev.duration,
  }));

  const displaySpan = state.timeline.displaySpan;

  const pxPerMs = basePxPerMs * zoom * (state.timeline.span / displaySpan);
  const trackWidth = Math.max(displaySpan * pxPerMs, 900);
  track.style.width = `${trackWidth}px`;
  if (moduleTrack) {
    moduleTrack.style.width = `${trackWidth}px`;
  }

  if (!functionEvents.length) {
    track.innerHTML = '<div class="text-sm text-slate-500 px-2 py-2">No function calls</div>';
  }

  // Pack bars into lanes to avoid overlap, ignoring stack expansion
  const laneEnds = [];
  const laneItems = [];
  placed.forEach((ev) => {
    let laneIndex = laneEnds.findIndex((end) => ev.displayStart >= end);
    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(ev.displayStart + ev.displayDuration);
    } else {
      laneEnds[laneIndex] = ev.displayStart + ev.displayDuration;
    }
    laneItems.push({ ...ev, lane: laneIndex });
  });

  laneItems.forEach((item) => {
    const bar = document.createElement('div');
    bar.className = 'flame-bar';
    bar.style.left = `${item.displayStart * pxPerMs}px`;
    bar.style.width = `${Math.max(item.displayDuration * pxPerMs, 2)}px`;
    bar.style.top = `${item.lane * 24}px`;
    bar.style.height = '20px';
    bar.style.borderWidth = '1px';
    bar.style.background = getColorForModule(item.module);
    bar.title = `${item.name} (${item.module}) • ${formatMs(item.duration)} @ ${formatMs(
      item.start - minTs,
    )} → ${formatMs(item.end - minTs)}`;

    const label = document.createElement('span');
    label.className = 'label';
    if (item.displayDuration * pxPerMs > 40) {
      label.textContent = item.name;
    } else {
      label.textContent = '';
    }
    bar.appendChild(label);
    bar.addEventListener('click', () => {
      state.selection = { ...item, type: 'function' };
      renderSelection();
    });
    track.appendChild(bar);
  });

  const maxLane = laneEnds.length;
  const minHeight = functionEvents.length ? 0 : 60;
  track.style.height = `${Math.max(maxLane * 26 + 16, minHeight)}px`;
  document.getElementById('timelineSpan').textContent = `0 → ${formatMs(displaySpan)}`;
  renderAxis(0, displaySpan, pxPerMs, trackWidth);
  renderModuleLegend(Array.from(new Set(placed.map((e) => e.module))));
  if (moduleTrack) {
    if (!moduleLoads.length) {
      moduleTrack.innerHTML = '<div class="text-xs text-slate-500 px-2 pt-2">No module loads</div>';
    } else {
      moduleLoads.forEach((mod) => {
        const pin = document.createElement('div');
        pin.className = 'module-pin';
        pin.style.left = `${mapCollapsedTime(mod.start, minTs, collapses) * pxPerMs}px`;
        pin.style.width = `${Math.max(mod.duration * pxPerMs, 3)}px`;
        pin.style.background = getColorForModule(mod.module);
        pin.title = `${mod.path} • ${formatMs(mod.duration)} @ ${formatMs(mod.start - minTs)}`;
        pin.addEventListener('click', () => {
          state.selection = { ...mod, type: 'module' };
          renderSelection();
        });
        moduleTrack.appendChild(pin);
      });
    }
  }
  renderModuleLoadLegend(Array.from(new Set(moduleLoads.map((m) => m.module))));
  renderSelection();

  wrapper.onwheel = (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const rect = wrapper.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const currentPxPerMs =
      state.timeline.basePxPerMs *
      state.timeline.zoom *
      (state.timeline.span / Math.max(state.timeline.displaySpan, 1));
    const cursorTime = (screenX + wrapper.scrollLeft) / currentPxPerMs;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(state.timeline.zoom * factor, 0.2), 30);
    state.timeline.zoom = newZoom;
    state.timeline.userAdjusted = true;
    const newPxPerMs =
      state.timeline.basePxPerMs *
      newZoom *
      (state.timeline.span / Math.max(state.timeline.displaySpan, 1));
    const newTrackWidth = Math.max(state.timeline.displaySpan * newPxPerMs, 900);
    track.style.width = `${newTrackWidth}px`;
    if (moduleTrack) {
      moduleTrack.style.width = `${newTrackWidth}px`;
    }
    const newScrollLeft = cursorTime * newPxPerMs - screenX;
    wrapper.scrollLeft = Math.max(newScrollLeft, 0);
    renderTimeline();
  };
}

function renderSlowFunctions() {
  const tbody = document.getElementById('slowFunctionsBody');
  tbody.innerHTML = '';
  const list = state.analysis?.analysis?.functions || state.analysis?.functions || [];
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="py-3 text-center text-slate-500">No functions</td></tr>';
    return;
  }
  const moduleFilter = document.getElementById('moduleFilter').value;
  const threshold = Number(document.getElementById('durationThreshold').value) || 0;
  let filtered = list;
  if (moduleFilter && moduleFilter !== 'all') {
    filtered = filtered.filter((f) => f.module === moduleFilter);
  }
  if (threshold > 0) {
    filtered = filtered.filter((f) => f.max >= threshold || f.p95 >= threshold);
  }
  filtered.forEach((f, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="py-2 pr-4 text-slate-400">${idx + 1}</td>
      <td class="py-2 pr-4">
        <div class="font-semibold">${f.name}</div>
        <div class="text-xs text-slate-500">${f.file}:${f.line || 0}</div>
      </td>
      <td class="py-2 pr-4">${f.module}</td>
      <td class="py-2 pr-4 text-right">${f.max.toFixed(1)}</td>
      <td class="py-2 pr-4 text-right">${f.p95.toFixed(1)}</td>
      <td class="py-2 pr-4 text-right">${f.avg.toFixed(1)}</td>
      <td class="py-2 pr-4 text-right">${f.count}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderRepeatedCalls() {
  const tbody = document.getElementById('repeatCallsBody');
  tbody.innerHTML = '';
  const repeats = state.analysis?.analysis?.repeatedCalls || state.analysis?.repeatedCalls || [];
  if (!repeats.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-3 text-center text-slate-500">No rapid repeats detected</td></tr>';
    return;
  }
  repeats.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="py-2 pr-4 font-semibold">${r.name}</td>
      <td class="py-2 pr-4 text-slate-400">${r.file || ''}</td>
      <td class="py-2 pr-4 text-right">${r.count}</td>
      <td class="py-2 pr-4 text-right">${r.totalDuration.toFixed(0)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function populateModuleFilter() {
  const select = document.getElementById('moduleFilter');
  const modules =
    state.analysis?.modules ||
    state.analysis?.analysis?.modules?.map((m) => m.module) ||
    state.analysis?.analysis?.modules ||
    [];
  const unique = Array.from(new Set(modules));
  select.innerHTML = '<option value="all">All modules</option>';
  unique.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    select.appendChild(opt);
  });
}

async function loadSession(sessionId) {
  if (!sessionId) return;
  setStatus('Loading...');
  try {
    const [sessionData, analysis] = await Promise.all([
      fetchJSON(`/api/sessions/${sessionId}`),
      fetchJSON(`/api/sessions/${sessionId}/analysis`),
    ]);
    state.currentSessionId = sessionId;
    state.sessionData = sessionData;
    state.analysis = analysis;
    renderMeta();
    renderMemory();
    renderFps();
    renderTimeline();
    populateModuleFilter();
    renderSlowFunctions();
    renderRepeatedCalls();
  } catch (err) {
    alert(`Failed to load session: ${err.message}`);
  } finally {
    setStatus('Load session');
  }
}

async function loadSessions() {
  try {
    const sessions = await fetchJSON('/api/sessions');
    state.sessions = sessions || [];
    renderSessionOptions();
  } catch (err) {
    alert(`Failed to list sessions: ${err.message}`);
  }
}

async function exportSpeedscope() {
  if (!state.currentSessionId) return;
  try {
    const data = await fetchJSON(`/api/sessions/${state.currentSessionId}/speedscope`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.currentSessionId}-speedscope.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Failed to export speedscope: ${err.message}`);
  }
}

function downloadRaw() {
  if (!state.sessionData) return;
  const blob = new Blob([JSON.stringify(state.sessionData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.currentSessionId || 'session'}-raw.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function wireEvents() {
  document.getElementById('refreshSessions').addEventListener('click', loadSessions);
  document.getElementById('reloadSession').addEventListener('click', () =>
    loadSession(document.getElementById('sessionSelect').value),
  );
  document.getElementById('sessionSelect').addEventListener('change', (e) => {
    state.currentSessionId = e.target.value;
  });
  document.getElementById('exportSpeedscope').addEventListener('click', exportSpeedscope);
  document.getElementById('exportRaw').addEventListener('click', downloadRaw);
  document.getElementById('applyFilter').addEventListener('click', () => {
    renderSlowFunctions();
  });
  document.getElementById('collapseGaps').addEventListener('change', (e) => {
    state.timeline.collapseGaps = e.target.checked;
    renderTimeline();
  });
}

function renderSelection() {
  const box = document.getElementById('selectionDetails');
  if (!state.selection) {
    box.classList.add('hidden');
    return;
  }
  const ev = state.selection;
  const base = state.timeline.minTs || 0;
  if (ev.type === 'module') {
    document.getElementById('selTitle').textContent = `${ev.module || 'module load'}`;
    document.getElementById('selTiming').textContent = `${formatMs(ev.duration)} @ ${formatMs(
      ev.start - base,
    )}`;
    document.getElementById('selFile').textContent = ev.path || '';
    document.getElementById('selStack').textContent = 'Module load';
  } else {
    const stack = Array.isArray(ev.stack) ? ev.stack : [];
    document.getElementById('selTitle').textContent = `${ev.name} (${ev.module || 'unknown'})`;
    document.getElementById('selTiming').textContent = `${formatMs(ev.duration)} @ ${formatMs(
      ev.start - base,
    )}`;
    document.getElementById('selFile').textContent = `${ev.file || ''}:${ev.line || 0}`;
    document.getElementById('selStack').textContent = stack.length
      ? stack.join(' → ') + ' → ' + ev.name
      : ev.name;
  }
  box.classList.remove('hidden');
}

async function init() {
  wireEvents();
  await loadSessions();
  if (state.currentSessionId) {
    loadSession(state.currentSessionId);
  }
}

document.addEventListener('DOMContentLoaded', init);
