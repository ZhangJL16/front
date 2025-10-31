// Type table management: single add + bulk import (deferred) + edit/delete/search
document.addEventListener("DOMContentLoaded", () => {
  const els = {
    container: document.getElementById("typeContainer"),
    section: document.querySelector(".type-section"),
    table: document.getElementById("typeTable"),
    tbody: document.querySelector("#typeTable tbody"),

    addBtn: document.getElementById("typeAddBtn"),
    deleteBtn: document.getElementById("typeDeleteBtn"),
    exitDeleteBtn: document.getElementById("typeExitDelete"),
    selectAll: document.getElementById("typeSelectAll"),
    searchInput: document.getElementById("typeSearchInput"),
    queryBtn: document.getElementById("typeQueryBtn"),

    modal: document.getElementById("typeModal"),
    fModel: document.getElementById("f_model"),
    fLoad: document.getElementById("f_load"),
    fDamp: document.getElementById("f_damp"),
    fKx: document.getElementById("f_kx"),
    fKy: document.getElementById("f_ky"),
    fKz: document.getElementById("f_kz"),
    saveBtn: document.getElementById("typeSave"),
    cancelBtn: document.getElementById("typeCancel"),

    bulkUpload: document.getElementById("typeBulkUpload"),
    bulkInput: document.getElementById("typeBulkInput"),
    bulkStatus: document.getElementById("typeBulkStatus"),

    editModal: document.getElementById("typeEditModal"),
    editModel: document.getElementById("edit_model"),
    editLoad: document.getElementById("edit_load"),
    editDamp: document.getElementById("edit_damp"),
    editKx: document.getElementById("edit_kx"),
    editKy: document.getElementById("edit_ky"),
    editKz: document.getElementById("edit_kz"),
    editSave: document.getElementById("typeEditSave"),
    editCancel: document.getElementById("typeEditCancel"),
  };
  if (!els.table || !els.tbody) return;

  // 批量上传的暂存：仅在点击【保存】时入库/入表
  const TYPE_STATE = { pendingBulk: [], pendingFile: "" };

  const state = { deleteMode: false, currentQuery: "", editingId: null, editingRow: null };

  const api = {
    async list(keyword = "") {
      const res = await fetch(`/api/types?q=${encodeURIComponent(keyword)}`);
      if (!res.ok) throw new Error("加载类型列表失败");
      return res.json();
    },
    async create(payload) {
      const res = await fetch("/api/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("新增类型失败");
      return res.json();
    },
    async update(id, payload) {
      const res = await fetch(`/api/types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("更新类型失败");
      return res.json();
    },
    async bulkDelete(ids) {
      const res = await fetch("/api/types/bulk_delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("删除失败");
      return res.json();
    },
  };

  // ========= helpers =========
  function toNumber(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const cleaned = String(v).replace(/[^0-9+\-eE.]/g, "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function formatNumericCell(td) {
    const t = td.textContent.trim();
    if (!t) return;
    const num = Number(t.replace(/,/g, ""));
    if (!Number.isFinite(num)) return;
    if (Math.abs(num) >= 1e6 || Math.abs(num) <= 1e-6) td.textContent = num.toExponential(4);
    else td.textContent = num.toString();
  }

  function normalizeTable() {
    els.tbody.querySelectorAll("tr").forEach((tr) => {
      for (let i = 2; i <= 6; i++) {
        const cell = tr.children[i];
        if (cell) formatNumericCell(cell);
      }
    });
  }

  function buildRow(item) {
    const tr = document.createElement("tr");
    if (item.id != null) tr.dataset.typeId = item.id;

    const firstTd = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "type-row-select";
    checkbox.style.display = state.deleteMode ? "inline-block" : "none";
    firstTd.appendChild(checkbox);
    tr.appendChild(firstTd);

    const fields = [item.model, item.load, item.damp, item.kx, item.ky, item.kz];
    fields.forEach((val) => {
      const td = document.createElement("td");
      td.textContent = val == null ? "" : val;
      tr.appendChild(td);
    });

    const actionTd = document.createElement("td");
    const editBtn = document.createElement("button");
    editBtn.className = "action-btn btn-edit";
    editBtn.textContent = "修改";
    actionTd.appendChild(editBtn);
    tr.appendChild(actionTd);
    return tr;
  }

  function render(list) {
    els.tbody.innerHTML = "";
    list.forEach((it) => els.tbody.appendChild(buildRow(it)));
    normalizeTable();
    applyDeleteMode();
  }

  async function loadTypes(keyword = state.currentQuery) {
    state.currentQuery = keyword;
    try {
      const list = await api.list(keyword);
      render(list);
    } catch (e) {
      console.error(e);
      alert(e.message || "加载类型失败");
    }
  }

  function visibleCheckboxes() {
    return Array.from(els.tbody.querySelectorAll(".type-row-select")).filter(
      (cb) => cb.closest("tr")?.style.display !== "none",
    );
  }

  function updateExitVisibility() {
    if (!els.section) return;
    const anyChecked = visibleCheckboxes().some((cb) => cb.checked);
    if (anyChecked) els.section.classList.remove("type-show-exit");
    else els.section.classList.add("type-show-exit");
  }

  function exitDeleteMode() {
    state.deleteMode = false;
    els.deleteBtn?.classList.remove("delete-active");
    els.container?.classList.remove("type-show-checkbox");
    els.section?.classList.add("type-show-exit");
    els.tbody.querySelectorAll(".type-row-select").forEach((cb) => {
      cb.checked = false;
      cb.style.display = "none";
    });
    if (els.selectAll) {
      els.selectAll.checked = false;
      els.selectAll.style.display = "none";
    }
  }

  function applyDeleteMode() {
    if (!state.deleteMode) return;
    els.container?.classList.add("type-show-checkbox");
    els.tbody.querySelectorAll(".type-row-select").forEach((cb) => {
      cb.style.display = "inline-block";
      cb.checked = false;
    });
    if (els.selectAll) {
      els.selectAll.checked = false;
      els.selectAll.style.display = "inline-block";
    }
    updateExitVisibility();
  }

  function resetBulkUpload() {
    els.bulkUpload?.classList.remove("dragover");
    if (els.bulkInput) els.bulkInput.value = "";
    if (els.bulkStatus) {
      els.bulkStatus.textContent = "支持 .xlsx / .csv 文件";
      els.bulkStatus.classList.remove("error", "success");
    }
    TYPE_STATE.pendingBulk = [];
    TYPE_STATE.pendingFile = "";
  }

  // ========= UI: open/close modal =========
  els.addBtn?.addEventListener("click", () => {
    [els.fModel, els.fLoad, els.fDamp, els.fKx, els.fKy, els.fKz].forEach((i) => i && (i.value = ""));
    resetBulkUpload();
    els.modal && (els.modal.style.display = "flex");
  });

  els.cancelBtn?.addEventListener("click", () => {
    els.modal && (els.modal.style.display = "none");
    resetBulkUpload();
  });

  document.addEventListener("click", (e) => {
    if (e.target === els.modal) {
      els.modal.style.display = "none";
      resetBulkUpload();
    }
    if (e.target === els.editModal) {
      els.editModal.style.display = "none";
      state.editingId = null;
      state.editingRow = null;
    }
  });

  // ========= query & delete =========
  els.queryBtn?.addEventListener("click", () => loadTypes(els.searchInput?.value.trim() || ""));
  els.searchInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") loadTypes(els.searchInput.value.trim());
  });

  els.deleteBtn?.addEventListener("click", async () => {
    if (!state.deleteMode) {
      state.deleteMode = true;
      els.deleteBtn?.classList.add("delete-active");
      applyDeleteMode();
      return;
    }
    const checked = visibleCheckboxes().filter((cb) => cb.checked);
    if (!checked.length) return alert("请选择要删除的记录");
    const ids = checked
      .map((cb) => Number(cb.closest("tr")?.dataset.typeId || ""))
      .filter((id) => Number.isInteger(id));
    if (!ids.length) return alert("所选记录缺少 ID，无法删除");
    const detailLines = checked.map((cb) => {
      const cells = cb.closest("tr")?.children || [];
      return `型号：${cells[1]?.textContent || ""}  载荷：${cells[2]?.textContent || ""}  阻尼：${cells[3]?.textContent || ""}`;
    });
    if (!confirm(`确认删除以下 ${ids.length} 条类型？\n${detailLines.join("\n")}`)) return;
    try {
      await api.bulkDelete(ids);
      await loadTypes(state.currentQuery);
    } catch (e) {
      console.error(e);
      alert(e.message || "删除失败");
    }
    exitDeleteMode();
  });
  els.exitDeleteBtn?.addEventListener("click", exitDeleteMode);
  els.selectAll?.addEventListener("change", () => {
    const checked = !!els.selectAll.checked;
    visibleCheckboxes().forEach((cb) => (cb.checked = checked));
    updateExitVisibility();
  });
  document.addEventListener("change", (e) => {
    if (!e.target.classList?.contains("type-row-select")) return;
    const visible = visibleCheckboxes();
    if (els.selectAll) els.selectAll.checked = visible.length > 0 && visible.every((cb) => cb.checked);
    updateExitVisibility();
  });

  // ========= edit =========
  els.table?.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".btn-edit");
    if (!editBtn) return;
    const row = editBtn.closest("tr");
    if (!row) return;
    state.editingRow = row;
    state.editingId = Number(row.dataset.typeId || "");
    const c = row.children;
    els.editModel && (els.editModel.value = c[1]?.textContent.trim() || "");
    els.editLoad && (els.editLoad.value = c[2]?.textContent.trim() || "");
    els.editDamp && (els.editDamp.value = c[3]?.textContent.trim() || "");
    els.editKx && (els.editKx.value = c[4]?.textContent.trim() || "");
    els.editKy && (els.editKy.value = c[5]?.textContent.trim() || "");
    els.editKz && (els.editKz.value = c[6]?.textContent.trim() || "");
    els.editModal && (els.editModal.style.display = "flex");
  });

  els.editCancel?.addEventListener("click", () => {
    els.editModal && (els.editModal.style.display = "none");
    state.editingId = null;
    state.editingRow = null;
  });

  els.editSave?.addEventListener("click", async () => {
    if (!state.editingRow || !Number.isInteger(state.editingId)) return;
    const payload = {
      model: els.editModel?.value.trim() || "",
      load: toNumber(els.editLoad?.value),
      damp: toNumber(els.editDamp?.value),
      kx: toNumber(els.editKx?.value),
      ky: toNumber(els.editKy?.value),
      kz: toNumber(els.editKz?.value),
    };
    if (!payload.model) return alert("请输入减振器型号");
    try {
      await api.update(state.editingId, payload);
      await loadTypes(state.currentQuery);
      els.editModal && (els.editModal.style.display = "none");
      state.editingId = null;
      state.editingRow = null;
    } catch (e) {
      console.error(e);
      alert(e.message || "保存失败");
    }
  });

  // ========= bulk upload: 解析→暂存；保存时再入库 =========
  {
    const box = els.bulkUpload, input = els.bulkInput, stat = els.bulkStatus;
    if (box && input && stat) {
      let busy = false;

      const setStatus = (msg, kind) => {
        stat.className = "type-bulk-status" + (kind ? " " + kind : "");
        stat.textContent = msg || "";
      };
      const looksLikeHeader = (cells) => {
        if (!cells || cells.length < 3) return false;
        const line = cells.map((s) => String(s).trim());
        const KW = ["型号", "载荷", "阻尼", "动刚度X", "动刚度Y", "动刚度Z"];
        let hit = 0;
        for (const k of KW) if (line.some((x) => x.includes(k))) hit++;
        return hit >= 3;
      };
      const parseCSVLine = (l) => {
        const out = [];
        let cur = "", inQ = false;
        for (let i = 0; i < l.length; i++) {
          const ch = l[i];
          if (ch === '"') { inQ = !inQ; continue; }
          if (ch === "," && !inQ) { out.push(cur.trim()); cur = ""; continue; }
          cur += ch;
        }
        out.push(cur.trim());
        return out;
      };

      async function handleFile(file) {
        if (!file || busy) return;
        busy = true;
        setStatus("解析中…");
        try {
          const ext = (file.name.split(".").pop() || "").toLowerCase();
          if (!["csv", "xlsx"].includes(ext)) {
            setStatus("仅支持 .xlsx / .csv", "error");
            return;
          }
          let rows;
          if (ext === "csv") {
            const txt = await file.text();
            const lines = txt.replace(/\uFEFF/g, "").split(/\r?\n/).filter((l) => l.trim().length);
            const arr = lines.map(parseCSVLine);
            rows = looksLikeHeader(arr[0]) ? arr.slice(1) : arr;
          } else {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const arr = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
            rows = looksLikeHeader(arr[0]) ? arr.slice(1) : arr.slice();
          }
          // 暂存有效记录（不落表）
          TYPE_STATE.pendingBulk = rows
            .map((r) => (r || []).slice(0, 6))
            .filter((r) => r[0] && String(r[0]).trim() !== "");
          TYPE_STATE.pendingFile = file.name;
          setStatus(
            `已解析 ${TYPE_STATE.pendingBulk.length} 条（未保存）`,
            TYPE_STATE.pendingBulk.length ? "success" : "error",
          );
        } catch (e) {
          console.error(e);
          setStatus("解析失败", "error");
        } finally {
          busy = false;
          input.value = ""; // 允许选择同一文件再次触发
        }
      }

      // 点击/键盘选择
      box.addEventListener("click", () => { input.value = ""; input.click(); });
      box.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.value = ""; input.click(); }
      });
      // 拖拽
      ["dragenter", "dragover"].forEach((ev) =>
        box.addEventListener(ev, (e) => { e.preventDefault(); box.classList.add("dragover"); }),
      );
      ["dragleave", "drop"].forEach((ev) =>
        box.addEventListener(ev, (e) => { e.preventDefault(); box.classList.remove("dragover"); }),
      );
      box.addEventListener("drop", (e) => handleFile(e.dataTransfer.files && e.dataTransfer.files[0]));
      input.addEventListener("change", (e) => handleFile(e.target.files?.[0]));
    }
  }

  // ========= 保存：手动录入 + 批量暂存，一次性提交 =========
// ---- 保存：先本地展示，再尝试提交后端（失败也保留前端展示） ----
els.saveBtn?.addEventListener("click", async () => {
  // 1) 收集手动区
  const model = els.fModel?.value.trim() || "";
  const manualFilled = [els.fModel, els.fLoad, els.fDamp, els.fKx, els.fKy, els.fKz]
    .some(i => i && String(i.value).trim() !== "");
  const manualRecord = (manualFilled && model)
    ? [model, els.fLoad?.value, els.fDamp?.value, els.fKx?.value, els.fKy?.value, els.fKz?.value]
    : null;

  // 2) 收集批量暂存
  const bulk = Array.isArray(TYPE_STATE.pendingBulk) ? TYPE_STATE.pendingBulk.slice() : [];

  if (!manualRecord && bulk.length === 0) {
    alert("没有可保存的数据");
    return;
  }

  // 3) 统一打包为记录数组（便于前端渲染与后端提交共用）
  const records = [];
  if (manualRecord) records.push(manualRecord);
  for (const r of bulk) records.push(r);

  // 4) 先本地渲染到表（乐观更新）
  for (const rec of records) {
    const rowObj = {
      id: null,                        // 前端临时行无 id
      model: String(rec[0] ?? "").trim(),
      load:  rec[1] ?? "",
      damp:  rec[2] ?? "",
      kx:    rec[3] ?? "",
      ky:    rec[4] ?? "",
      kz:    rec[5] ?? "",
    };
    els.tbody.appendChild(buildRow(rowObj));
  }
  // 规范化数值显示 & 删除模式适配
  normalizeTable();
  applyDeleteMode();

  // 5) 尝试提交后端（失败也不撤回前端行）
  try {
    for (const rec of records) {
      const payload = {
        model: String(rec[0]).trim(),
        load:  toNumber(rec[1]),
        damp:  toNumber(rec[2]),
        kx:    toNumber(rec[3]),
        ky:    toNumber(rec[4]),
        kz:    toNumber(rec[5]),
      };
      // 可改成批量接口；此处逐条以兼容你现有 API
      try { await api.create(payload); } catch (e) { console.warn("后端保存失败(已在前端展示):", e); }
    }
    // 不再调用 loadTypes() 去依赖后端刷新，避免“没跑后端导致清空”
  } finally {
    // 6) 清理输入与暂存，并给出状态
    [els.fModel, els.fLoad, els.fDamp, els.fKx, els.fKy, els.fKz].forEach(i => i && (i.value = ""));
    // 注意：TYPE_STATE 是局部常量，不在 window 上，直接清它
    TYPE_STATE.pendingBulk = [];
    TYPE_STATE.pendingFile = "";
    if (els.bulkStatus) els.bulkStatus.textContent = "已保存（已显示到前端）";
    // 关闭弹窗更直观
    if (els.modal) els.modal.style.display = "none";
  }
});


  // ========= 初次载入 =========
  loadTypes("");
});
