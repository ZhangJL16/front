document.addEventListener("DOMContentLoaded", () => {
  const tableContainer = document.getElementById("tableContainer");
  const deleteBtn = document.getElementById("deleteBtn");
  const queryBtn = document.getElementById("queryBtn");
  const searchInput = document.getElementById("searchInput");
  const selectAll = document.getElementById("selectAll");
  const exitDelete = document.getElementById("exitDelete");   // 新增
  const dataSection = document.querySelector(".data-section"); // 顶部加一行
    // 工具：仅操作“可见行”的复选框
    function getVisibleRowCheckboxes() {
        return Array.from(document.querySelectorAll(".row-select"))
            .filter(cb => cb.closest("tr").style.display !== "none");
    }

    function updateExitVisibility() {
  const anyChecked = getVisibleRowCheckboxes().some(cb => cb.checked);
  if (!anyChecked) { dataSection.classList.add("show-exit"); }
  else { dataSection.classList.remove("show-exit"); }
}

    function exitDeleteMode() {
    deleteMode = false;
    deleteBtn.classList.remove("delete-active");
    tableContainer.classList.remove("show-checkbox");
    dataSection.classList.remove("show-exit");         // 这里用 dataSection
    document.querySelectorAll(".row-select").forEach(cb => { cb.checked = false; cb.style.display = "none"; });
    selectAll.checked = false;
    selectAll.style.display = "none";
    }

    // 表头全选
    selectAll.addEventListener("change", () => {
    const vis = getVisibleRowCheckboxes();
    vis.forEach(cb => cb.checked = selectAll.checked);
    updateExitVisibility();
    });

    document.addEventListener("change", (e) => {
    if (!e.target.classList.contains("row-select")) return;
    const vis = getVisibleRowCheckboxes();
    selectAll.checked = vis.length > 0 && vis.every(cb => cb.checked);
    updateExitVisibility();
    });

    // 统一的过滤函数
    function filterRows(keyword) {
    const kw = keyword.trim();
    document.querySelectorAll("#dataTable tbody tr").forEach(r => {
        const upper = r.children[1].textContent;
        const lower = r.children[2].textContent;
        r.style.display = (upper.includes(kw) || lower.includes(kw)) ? "" : "none";
    });
    }
  // === 查询按钮：点击显示/隐藏查询框 ===
  queryBtn.addEventListener("click", () => {
    filterRows(searchInput.value);
  });

  // 查询逻辑：回车执行
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") filterRows(searchInput.value);
  });
    exitDelete.addEventListener("click", () => {
        exitDeleteMode();
    });
  // === 删除按钮：首次点击启用选择模式，再次点击确认删除 ===
    let deleteMode = false;
    deleteBtn.addEventListener("click", () => {
    const rows = document.querySelectorAll(".row-select");

    if (!deleteMode) {
        // 进入删除模式
        deleteMode = true;
        deleteBtn.classList.add("delete-active");
        tableContainer.classList.add("show-checkbox");
        rows.forEach(cb => { cb.style.display = "inline-block"; cb.checked = false; });
        selectAll.checked = false;
        selectAll.style.display = "inline-block";
        updateExitVisibility(); // 无选中则显示×
        return;
    }

    // 执行删除
    const checked = getVisibleRowCheckboxes().filter(cb => cb.checked);
    if (checked.length === 0) {
        alert("请选择要删除的记录");
        return;
    }
    const details = checked.map(cb => {
    const r = cb.closest("tr").children;
    return `上：${r[1].textContent}，下：${r[2].textContent}，范围：${r[3].textContent}`;
    });
    if (confirm(`确认删除以下 ${checked.length} 条数据？\n${details.join("\n")}`)) {
        checked.forEach(cb => cb.closest("tr").remove());
    }
    exitDeleteMode();
    });

});

// ===================== 上传弹窗整合逻辑 =====================
document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadBtn");
  const uploadModal = document.getElementById("uploadModelModal");
  const checkModelBtn = document.getElementById("checkModel");
  const cancelModelBtn = document.getElementById("cancelModel");
  const uploadBox = document.getElementById("uploadBox");
  const uploadTip = document.querySelector(".upload-tip");
  const fileInput = document.getElementById("fileInput");
  const tableBody = document.querySelector("#dataTable tbody");
const upperSelect = document.getElementById("upperModel");
const lowerSelect = document.getElementById("lowerModel");

// 从 Type 表当前列表收集型号
function collectModelsFromTypeTable() {
  const set = new Set();
  document.querySelectorAll("#typeTable tbody tr").forEach(tr => {
    const model = (tr.children[1]?.textContent || "").trim();
    if (model) set.add(model);
  });
  return Array.from(set).sort();
}
function fillModelSelects() {
  const models = collectModelsFromTypeTable();
  // 清空并填充
  // 上、下减振器选择框
const upperSelect = document.getElementById("upperModel");
const lowerSelect = document.getElementById("lowerModel");

// 清空原选项
upperSelect.innerHTML = '';
lowerSelect.innerHTML = '';

// 设置不同的默认文字
upperSelect.appendChild(new Option("请选择上减振器型号", "", true, true));
lowerSelect.appendChild(new Option("请选择下减振器型号", "", true, true));

// 加载型号列表
models.forEach(m => {
  upperSelect.appendChild(new Option(m, m));
  lowerSelect.appendChild(new Option(m, m));
});

}
  // 打开弹窗
  uploadBtn.addEventListener("click", () => {
    uploadModal.style.display = "flex";
    uploadBox.style.display = "none";
    uploadTip.style.display = "block";
    fillModelSelects();  // 每次打开弹窗都同步最新型号
  });

  // 取消
  cancelModelBtn.addEventListener("click", () => {
    uploadModal.style.display = "none";
  });

  // 型号校验
  checkModelBtn.addEventListener("click", () => {
  const upper = upperSelect.value;
  const lower = lowerSelect.value;
  if (!upper || !lower) { alert("请选择完整的上、下减振器型号"); return; }    

    // 校验通过，显示上传区
    uploadTip.style.display = "none";
    uploadBox.style.display = "block";
  });

  // 点击上传区域 -> 打开文件选择框
  uploadBox.addEventListener("click", () => {
    fileInput.click();
  });

  // 文件选择后解析
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split(".").pop().toLowerCase();
    if (ext !== "csv" && ext !== "xlsx") {
      alert("仅支持上传 .csv 或 .xlsx 文件");
      return;
    }
    const upper = upperSelect.value;
    const lower = lowerSelect.value;
    if (ext === "csv") {
      const reader = new FileReader();
      reader.onload = (event) => {
        const lines = event.target.result.trim().split(/\r?\n/).slice(1);
        lines.forEach(line => {
          const [freq, resp] = line.split(",").map(s => s.trim());
          const index = tableBody.children.length + 1;
          const row = document.createElement("tr");
          row.innerHTML = `
            <td><input type="checkbox" class="row-select" style="display:none;"></td>
            <td>${index}</td>
            <td>${upper}</td>
            <td>${lower}</td>
            <td>${freq}</td>
            <td>${resp}</td>
          `;
          tableBody.appendChild(row);
        });
        alert("文件已上传并载入表格。");
        uploadModal.style.display = "none";
      };
      reader.readAsText(file, "utf-8");
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }).slice(1);
        rows.forEach(row => {
          if (row.length < 2) return;
          const index = tableBody.children.length + 1;
            const tr = document.createElement("tr");
            tr.innerHTML = `
            <td><input type="checkbox" class="row-select" style="display:none;"></td>
            <td>${upper}</td>
            <td>${lower}</td>
            <td>${rowFreqOrRange}</td>
            <td>${rowMaxExcit}</td>
            <td>
                <button class="action-btn btn-preview">预览</button>
                <button class="action-btn btn-edit">修改</button>
            </td>
            `;
            tableBody.appendChild(tr);
        });
        alert("Excel 文件已上传并载入表格。");
        uploadModal.style.display = "none";
      };
      reader.readAsArrayBuffer(file);
    }

    fileInput.value = "";
  });
  document.getElementById("dataTable").addEventListener("click", e => {
  if(e.target.classList.contains("btn-preview")){
    const tr = e.target.closest("tr").children;
    previewMeta.textContent = `上：${tr[1].textContent}  下：${tr[2].textContent}  范围：${tr[3].textContent}`;
    previewModal.style.display="flex";
  }
});
document.getElementById("previewClose").onclick = ()=> previewModal.style.display="none";

// 修改
const dataEditModal = document.getElementById("dataEditModal");
const editUpper = document.getElementById("editUpper");
const editLower = document.getElementById("editLower");
const editTbody = document.querySelector("#editDataTable tbody");

function parseRange(r){
  const parts = r.replace(/[^\d\-]/g,"").split("-");
  return [parseInt(parts[0]), parseInt(parts[1])];
}

document.getElementById("dataTable").addEventListener("click", e => {
  if(e.target.classList.contains("btn-edit")){
    const tr = e.target.closest("tr").children;
    const upper = tr[1].textContent;
    const lower = tr[2].textContent;
    const range = tr[3].textContent;

    editUpper.textContent = upper;
    editLower.textContent = lower;
    
    const [start,end] = parseRange(range);
    editTbody.innerHTML = "";
    for(let f=start; f<=end; f++){
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${f}</td>
        <td><input type="number" step="0.01"></td>
        <td><input type="number" step="0.01"></td>
      `;
      editTbody.appendChild(row);
    }
    dataEditModal.style.display = "flex";
  }
});
document.getElementById("editCancel").onclick = ()=> dataEditModal.style.display="none";
document.getElementById("editSave").onclick = ()=>{
  alert("后续接入保存逻辑");
  dataEditModal.style.display="none";
}

});
// 预览

document.addEventListener("DOMContentLoaded", () => {
  // ====== 常规表格控件（保留你已有的） ======
  const tableContainer = document.getElementById("tableContainer");
  const deleteBtn = document.getElementById("deleteBtn");
  const queryBtn = document.getElementById("queryBtn");
  const searchInput = document.getElementById("searchInput");
  const selectAll = document.getElementById("selectAll");
  const exitDelete = document.getElementById("exitDelete");
  const dataSection = document.querySelector(".data-section");

  // ====== 上传弹窗相关 ======
  const uploadBtn = document.getElementById("uploadBtn");
  const uploadModal = document.getElementById("uploadModelModal");
  const checkModelBtn = document.getElementById("checkModel");
  const cancelModelBtn = document.getElementById("cancelModel");
  const uploadBox = document.getElementById("uploadBox");
  const uploadTip = document.querySelector(".upload-tip");
  const fileInput = document.getElementById("fileInput");
  const tableBody = document.querySelector("#dataTable tbody");

  // 自定义下拉容器与隐藏的原生 select
  const psUpper = document.getElementById("ps-upper");
  const psLower = document.getElementById("ps-lower");
  const upperSelect = document.getElementById("upperModel");
  const lowerSelect = document.getElementById("lowerModel");

  // —— 自定义下拉增强
  function enhancePrettySelect(wrapper) {
    const ps   = wrapper;
    const btn  = ps.querySelector(".ps-toggle");
    const list = ps.querySelector(".ps-list");
    const sel  = ps.querySelector("select");

    function rebuild() {
      list.innerHTML = "";
      Array.from(sel.options).forEach(opt => {
        const li = document.createElement("div");
        li.className = "ps-item" + (opt.selected ? " active" : "");
        li.textContent = opt.textContent;
        li.dataset.value = opt.value;
        li.addEventListener("click", () => {
          Array.from(sel.options).forEach(o => o.selected = (o.value === opt.value));
          list.querySelectorAll(".ps-item").forEach(i => i.classList.toggle("active", i === li));
          btn.textContent = opt.textContent || btn.dataset.placeholder || "请选择";
          ps.classList.remove("open");
        });
        list.appendChild(li);
      });
      const cur = sel.options[sel.selectedIndex];
      btn.textContent = cur && cur.text ? cur.text : (btn.dataset.placeholder || "请选择");
    }

    btn.addEventListener("click", () => {
      document.querySelectorAll(".ps.open").forEach(x => x !== ps && x.classList.remove("open"));
      ps.classList.toggle("open");
    });
    document.addEventListener("click", (e) => { if (!ps.contains(e.target)) ps.classList.remove("open"); });

    ps.rebuild = rebuild;
    rebuild();
  }

  // —— 从 Type 表收集型号并填充两个 select，然后重建面板
  function collectModelsFromTypeTable() {
    const set = new Set();
    document.querySelectorAll("#typeTable tbody tr").forEach(tr => {
      const model = (tr.children[1]?.textContent || "").trim();
      if (model) set.add(model);
    });
    return Array.from(set).sort();
  }
  function fillModelSelects() {
    const models = collectModelsFromTypeTable();
    upperSelect.innerHTML = "";
    lowerSelect.innerHTML = "";
    upperSelect.appendChild(new Option("请选择上减振器型号", "", true, true));
    lowerSelect.appendChild(new Option("请选择下减振器型号", "", true, true));
    models.forEach(m => {
      upperSelect.appendChild(new Option(m, m));
      lowerSelect.appendChild(new Option(m, m));
    });
    psUpper.rebuild();
    psLower.rebuild();
  }

  // —— 打开上传弹窗：先初始化组件，再填充选项
  uploadBtn.addEventListener("click", () => {
    if (!psUpper.rebuild) enhancePrettySelect(psUpper);
    if (!psLower.rebuild) enhancePrettySelect(psLower);
    fillModelSelects();

    uploadModal.style.display = "flex";
    uploadBox.style.display   = "none";
    uploadTip.style.display   = "block";
  });

  // —— 取消
  cancelModelBtn.addEventListener("click", () => { uploadModal.style.display = "none"; });

  // —— 确认型号
  checkModelBtn.addEventListener("click", () => {
    const upper = upperSelect.value;
    const lower = lowerSelect.value;
    if (!upper || !lower) { alert("请选择完整的上、下减振器型号"); return; }
    uploadTip.style.display = "none";
    uploadBox.style.display = "block";
  });

});