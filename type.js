// Type table management: single add + bulk import + edit/delete/search
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

  const state = {
    deleteMode: false,
    currentQuery: "",
    editingId: null,
    editingRow: null,
  };

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

  function toNumber(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/[^0-9+\-eE.]/g, "").trim();
    if (cleaned === "") return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  function formatNumericCell(td) {
    const text = td.textContent.trim();
    if (text === "") return;
    const num = Number(text.replace(/,/g, ""));
    if (!Number.isFinite(num)) return;
    if (Math.abs(num) >= 1e6 || Math.abs(num) <= 1e-6) {
      td.textContent = num.toExponential(4);
    } else {
      td.textContent = num.toString();
    }
  }

  function normalizeTable() {
    els.tbody.querySelectorAll("tr").forEach((tr) => {
      for (let i = 2; i <= 6; i += 1) {
        const cell = tr.children[i];
        if (cell) formatNumericCell(cell);
      }
    });
  }

  function buildRow(item) {
    const tr = document.createElement("tr");
    tr.dataset.typeId = item.id;

    const firstTd = document.createElement("td");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "type-row-select";
    checkbox.style.display = state.deleteMode ? "inline-block" : "none";
    firstTd.appendChild(checkbox);
    tr.appendChild(firstTd);

    const fields = [item.model, item.load, item.damp, item.kx, item.ky, item.kz];
    fields.forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value == null ? "" : value;
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
    list.forEach((item) => {
      els.tbody.appendChild(buildRow(item));
    });
    normalizeTable();
    applyDeleteMode();
  }

  async function loadTypes(keyword = state.currentQuery) {
    state.currentQuery = keyword;
    try {
      const list = await api.list(keyword);
      render(list);
    } catch (err) {
      console.error(err);
      alert(err.message || "加载类型失败");
    }
  }

  function visibleCheckboxes() {
    return Array.from(
      els.tbody.querySelectorAll(".type-row-select"),
    ).filter((cb) => cb.closest("tr")?.style.display !== "none");
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
    if (els.bulkUpload) els.bulkUpload.classList.remove("dragover");
    if (els.bulkInput) els.bulkInput.value = "";
    if (els.bulkStatus) {
      els.bulkStatus.textContent = "支持 .xlsx / .csv 文件";
      els.bulkStatus.classList.remove("error", "success");
    }
  }

  function setBulkStatus(message, type) {
    if (!els.bulkStatus) return;
    els.bulkStatus.textContent = message;
    els.bulkStatus.classList.remove("error", "success");
    if (type) els.bulkStatus.classList.add(type);
  }

  function stripHeader(rows) {
    if (!rows.length) return rows;
    const first = rows[0].map((cell) => String(cell || "").trim());
    const keywords = ["型号", "载荷", "阻尼", "动刚度"];
    if (first.some((text) => keywords.some((kw) => text.includes(kw)))) {
      return rows.slice(1);
    }
    const numericCount = first.slice(1).reduce(
      (count, cell) => (Number.isFinite(Number(cell)) ? count + 1 : count),
      0,
    );
    if (numericCount === 0 && rows.length > 1) return rows.slice(1);
    return rows;
  }

  function parseRecords(rawRows) {
    return stripHeader(
      rawRows
        .map((row) => (Array.isArray(row) ? row : [row]))
        .map((row) => row.map((cell) => String(cell ?? "").trim()))
        .filter((row) => row.some((cell) => cell !== "")),
    )
      .map((row) => ({
        model: row[0] || "",
        load: row[1] || "",
        damp: row[2] || "",
        kx: row[3] || "",
        ky: row[4] || "",
        kz: row[5] || "",
      }))
      .filter((item) => item.model !== "");
  }

  async function importRecords(records) {
    if (!records.length) {
      setBulkStatus("未检测到有效数据，请检查文件内容", "error");
      return;
    }
    setBulkStatus("正在导入，请稍候...", null);
    let success = 0;
    for (const record of records) {
      const payload = {
        model: record.model,
        load: toNumber(record.load),
        damp: toNumber(record.damp),
        kx: toNumber(record.kx),
        ky: toNumber(record.ky),
        kz: toNumber(record.kz),
      };
      try {
        await api.create(payload);
        success += 1;
      } catch (err) {
        console.error("批量导入失败", err);
      }
    }
    if (success) {
      setBulkStatus(`成功导入 ${success} 条记录`, "success");
      await loadTypes(state.currentQuery);
    } else {
      setBulkStatus("未成功导入任何记录", "error");
    }
  }

  function processFile(file) {
    if (!file) return;
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!/(csv|xlsx)$/.test(ext)) {
      setBulkStatus(`不支持的文件类型：${file.name}`, "error");
      if (els.bulkInput) els.bulkInput.value = "";
      return;
    }
    setBulkStatus("正在解析文件...", null);

    const finish = (rows) => {
      const records = parseRecords(rows);
      importRecords(records).finally(() => {
        if (els.bulkInput) els.bulkInput.value = "";
      });
    };

    if (ext === "csv") {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = String(event.target?.result || "");
        const rows = text
          .split(/\r?\n/)
          .map((line) => line.split(",").map((cell) => cell.trim()));
        finish(rows);
      };
      reader.onerror = () => setBulkStatus("读取 CSV 文件失败", "error");
      reader.readAsText(file, "utf-8");
      return;
    }

    if (typeof XLSX === "undefined") {
      alert("缺少 XLSX 库，无法解析 Excel 文件");
      resetBulkUpload();
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result || []);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        finish(rows);
      } catch (err) {
        console.error("解析 Excel 失败", err);
        setBulkStatus("解析 Excel 文件失败，请检查文件内容", "error");
      }
    };
    reader.onerror = () => setBulkStatus("读取 Excel 文件失败", "error");
    reader.readAsArrayBuffer(file);
  }

  // -----------------------------------------------------------------------
  // Event bindings
  // -----------------------------------------------------------------------
  els.addBtn?.addEventListener("click", () => {
    [els.fModel, els.fLoad, els.fDamp, els.fKx, els.fKy, els.fKz].forEach((input) => {
      if (input) input.value = "";
    });
    resetBulkUpload();
    if (els.modal) els.modal.style.display = "flex";
  });

  els.cancelBtn?.addEventListener("click", () => {
    if (els.modal) els.modal.style.display = "none";
    resetBulkUpload();
  });

  els.saveBtn?.addEventListener("click", async () => {
    const model = els.fModel?.value.trim() || "";
    if (!model) {
      alert("请输入减振器型号");
      return;
    }
    const payload = {
      model,
      load: toNumber(els.fLoad?.value),
      damp: toNumber(els.fDamp?.value),
      kx: toNumber(els.fKx?.value),
      ky: toNumber(els.fKy?.value),
      kz: toNumber(els.fKz?.value),
    };
    try {
      await api.create(payload);
      await loadTypes(state.currentQuery);
      [els.fModel, els.fLoad, els.fDamp, els.fKx, els.fKy, els.fKz].forEach((input) => {
        if (input) input.value = "";
      });
      alert("添加成功，可以继续录入或点击取消关闭弹窗");
    } catch (err) {
      console.error(err);
      alert(err.message || "新增失败");
    }
  });

  els.editCancel?.addEventListener("click", () => {
    if (els.editModal) els.editModal.style.display = "none";
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
    if (!payload.model) {
      alert("请输入减振器型号");
      return;
    }
    try {
      await api.update(state.editingId, payload);
      await loadTypes(state.currentQuery);
      if (els.editModal) els.editModal.style.display = "none";
      state.editingId = null;
      state.editingRow = null;
    } catch (err) {
      console.error(err);
      alert(err.message || "保存失败");
    }
  });

  els.table?.addEventListener("click", (event) => {
    const editBtn = event.target.closest(".btn-edit");
    if (!editBtn) return;
    const row = editBtn.closest("tr");
    if (!row) return;
    state.editingRow = row;
    state.editingId = Number(row.dataset.typeId || "");
    const cells = row.children;
    if (els.editModel) els.editModel.value = cells[1]?.textContent.trim() || "";
    if (els.editLoad) els.editLoad.value = cells[2]?.textContent.trim() || "";
    if (els.editDamp) els.editDamp.value = cells[3]?.textContent.trim() || "";
    if (els.editKx) els.editKx.value = cells[4]?.textContent.trim() || "";
    if (els.editKy) els.editKy.value = cells[5]?.textContent.trim() || "";
    if (els.editKz) els.editKz.value = cells[6]?.textContent.trim() || "";
    if (els.editModal) els.editModal.style.display = "flex";
  });

  els.queryBtn?.addEventListener("click", () => {
    const keyword = els.searchInput?.value.trim() || "";
    loadTypes(keyword);
  });

  els.searchInput?.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      const keyword = els.searchInput.value.trim();
      loadTypes(keyword);
    }
  });

  els.deleteBtn?.addEventListener("click", async () => {
    if (!state.deleteMode) {
      state.deleteMode = true;
      els.deleteBtn?.classList.add("delete-active");
      applyDeleteMode();
      return;
    }
    const checked = visibleCheckboxes().filter((cb) => cb.checked);
    if (!checked.length) {
      alert("请选择要删除的记录");
      return;
    }
    const ids = checked
      .map((cb) => Number(cb.closest("tr")?.dataset.typeId || ""))
      .filter((id) => Number.isInteger(id));
    if (!ids.length) {
      alert("所选记录缺少 ID，无法删除");
      return;
    }
    const detailLines = checked.map((cb) => {
      const cells = cb.closest("tr")?.children || [];
      return `型号：${cells[1]?.textContent || ""}  载荷：${cells[2]?.textContent || ""}  阻尼：${cells[3]?.textContent || ""}`;
    });
    if (!confirm(`确认删除以下 ${ids.length} 条类型？\n${detailLines.join("\n")}`)) return;
    try {
      await api.bulkDelete(ids);
      await loadTypes(state.currentQuery);
    } catch (err) {
      console.error(err);
      alert(err.message || "删除失败");
    }
    exitDeleteMode();
  });

  els.exitDeleteBtn?.addEventListener("click", exitDeleteMode);

  els.selectAll?.addEventListener("change", () => {
    const checked = !!els.selectAll.checked;
    visibleCheckboxes().forEach((cb) => {
      cb.checked = checked;
    });
    updateExitVisibility();
  });

  document.addEventListener("change", (event) => {
    if (!event.target.classList?.contains("type-row-select")) return;
    const visible = visibleCheckboxes();
    if (els.selectAll) {
      els.selectAll.checked = visible.length > 0 && visible.every((cb) => cb.checked);
    }
    updateExitVisibility();
  });

  if (els.bulkUpload && els.bulkInput) {
    els.bulkUpload.addEventListener("click", () => els.bulkInput.click());
    els.bulkUpload.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        els.bulkInput.click();
      }
    });
    els.bulkUpload.addEventListener("dragover", (event) => {
      event.preventDefault();
      els.bulkUpload.classList.add("dragover");
    });
    els.bulkUpload.addEventListener("dragleave", () => {
      els.bulkUpload.classList.remove("dragover");
    });
    els.bulkUpload.addEventListener("drop", (event) => {
      event.preventDefault();
      els.bulkUpload.classList.remove("dragover");
      const files = event.dataTransfer?.files;
      if (!files || !files.length) {
        resetBulkUpload();
        return;
      }
      if (els.bulkInput && typeof DataTransfer !== "undefined") {
        try {
          const dt = new DataTransfer();
          dt.items.add(files[0]);
          els.bulkInput.files = dt.files;
        } catch (err) {
          console.warn("DataTransfer not supported", err);
          els.bulkInput.value = "";
        }
      }
      processFile(files[0]);
    });
    els.bulkInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        resetBulkUpload();
        return;
      }
      setBulkStatus(`已选择：${file.name}`, "success");
      processFile(file);
    });
  }

  document.addEventListener("click", (event) => {
    if (event.target === els.modal) {
      if (els.modal) els.modal.style.display = "none";
      resetBulkUpload();
    }
    if (event.target === els.editModal) {
      if (els.editModal) els.editModal.style.display = "none";
      state.editingId = null;
      state.editingRow = null;
    }
  });

  loadTypes("");
});
