const STORAGE_KEY = "tiny_decision_desktop_wheels_v2";
const LAYOUT_KEY = "tiny_decision_desktop_layout_v1";
const FILE_META_KEY = "tiny_decision_desktop_file_meta_v1";
const HANDLE_DB_NAME = "tiny-wheel-desktop-handles";
const HANDLE_STORE_NAME = "files";
const DATA_FILE_HANDLE_KEY = "wheel-data";
const TAU = Math.PI * 2;
const POINTER_ANGLE = -Math.PI / 2;
const SPLITTER_SIZE = 12;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 520;
const MIN_EDITOR_WIDTH = 300;
const MAX_EDITOR_WIDTH = 680;
const MIN_MAIN_WIDTH = 360;

const defaultColors = [
    "#ef3348", "#f47742", "#df4c4c", "#d83e89", "#9d38ca",
    "#674ed7", "#2f6bdb", "#439cd2", "#80bd4c", "#f25a37", "#88c464"
];

const defaultData = {
    activeWheelId: "yes-no-wheel",
    folders: [],
    wheels: [
    {
        id: "yes-no-wheel",
        name: "Si o no",
        rotation: 0,
        result: "",
        options: [
        { text: "Si", probability: 33, color: "#4caf50", enabled: true, description: "" },
        { text: "No", probability: 33, color: "#e53935", enabled: true, description: "" },
        { text: "Tal vez", probability: 34, color: "#f9a825", enabled: true, description: "" }
        ]
    }
    ]
};

let appData = loadData();
let layoutState = loadLayoutState();
let isSpinning = false;
let draggedWheelId = null;
let draggedOptionIndex = null;
let dialogState = null;
let dataFileHandle = null;
let dataFileSaveTimer = null;
let dataFileState = "local";

const appRoot = document.querySelector(".app");
const sidebarPanel = document.getElementById("sidebarPanel");
const editorPanel = document.getElementById("editorPanel");
const wheelList = document.getElementById("wheelList");
const wheelNameInput = document.getElementById("wheelNameInput");
const wheelStage = document.querySelector(".wheel-stage");
const wheelCanvas = document.getElementById("wheelCanvas");
const wheelTooltip = document.getElementById("wheelTooltip");
const ctx = wheelCanvas.getContext("2d");
const leftSplitter = document.getElementById("leftSplitter");
const rightSplitter = document.getElementById("rightSplitter");
const toggleLeftPanelButton = document.getElementById("toggleLeftPanelButton");
const toggleRightPanelButton = document.getElementById("toggleRightPanelButton");
const spinButton = document.getElementById("spinButton");
const resultValue = document.getElementById("resultValue");
const optionList = document.getElementById("optionList");
const totalProbability = document.getElementById("totalProbability");
const newWheelButton = document.getElementById("newWheelButton");
const newFolderButton = document.getElementById("newFolderButton");
const duplicateWheelButton = document.getElementById("duplicateWheelButton");
const deleteWheelButton = document.getElementById("deleteWheelButton");
const addOptionButton = document.getElementById("addOptionButton");
const equalizeButton = document.getElementById("equalizeButton");
const createDataFileButton = document.getElementById("createDataFileButton");
const openDataFileButton = document.getElementById("openDataFileButton");
const saveDataFileButton = document.getElementById("saveDataFileButton");
const dataFileBadge = document.getElementById("dataFileBadge");
const dataFileName = document.getElementById("dataFileName");
const dataFileHint = document.getElementById("dataFileHint");
const dialogBackdrop = document.getElementById("dialogBackdrop");
const dialogTitle = document.getElementById("dialogTitle");
const dialogMessage = document.getElementById("dialogMessage");
const dialogInput = document.getElementById("dialogInput");
const dialogTextarea = document.getElementById("dialogTextarea");
const dialogCancelButton = document.getElementById("dialogCancelButton");
const dialogConfirmButton = document.getElementById("dialogConfirmButton");

function loadLayoutState() {
    try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    return normalizeLayout({
        sidebarWidth: saved?.sidebarWidth,
        editorWidth: saved?.editorWidth,
        sidebarCollapsed: saved?.sidebarCollapsed,
        editorCollapsed: saved?.editorCollapsed
    });
    } catch (error) {
    return { sidebarWidth: 280, editorWidth: 420, sidebarCollapsed: false, editorCollapsed: false };
    }
}

function loadData() {
    try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.wheels) || saved.wheels.length === 0) {
        return structuredClone(defaultData);
    }

    const normalized = normalizeData(saved);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
    } catch (error) {
    return structuredClone(defaultData);
    }
}

function loadFileMeta() {
    try {
    const saved = JSON.parse(localStorage.getItem(FILE_META_KEY));
    if (!saved || typeof saved.name !== "string") return null;

    const normalized = { name: saved.name };
    localStorage.setItem(FILE_META_KEY, JSON.stringify(normalized));
    return normalized;
    } catch (error) {
    return null;
    }
}

function saveFileMeta(name) {
    localStorage.setItem(FILE_META_KEY, JSON.stringify({
    name
    }));
}

function clearFileMeta() {
    localStorage.removeItem(FILE_META_KEY);
}

function normalizeData(data) {
    const folders = Array.isArray(data.folders)
    ? data.folders
        .filter((folder) => folder && typeof folder.name === "string")
        .map((folder, folderIndex) => ({
            id: folder.id || crypto.randomUUID(),
            name: folder.name.trim() || `Carpeta ${folderIndex + 1}`
        }))
    : [];

    const validFolderIds = new Set(folders.map((folder) => folder.id));
    const wheels = data.wheels
    .filter((wheel) => wheel && typeof wheel.name === "string")
    .map((wheel, wheelIndex) => ({
        id: wheel.id || crypto.randomUUID(),
        name: wheel.name.trim() || `Rueda ${wheelIndex + 1}`,
        folderId: validFolderIds.has(wheel.folderId) ? wheel.folderId : null,
        rotation: Number.isFinite(wheel.rotation) ? wheel.rotation : 0,
        result: typeof wheel.result === "string" ? wheel.result : "",
        options: Array.isArray(wheel.options)
        ? wheel.options.map((option, optionIndex) => ({
            text: String(option.text ?? `Opción ${optionIndex + 1}`),
            probability: sanitizeProbability(option.probability ?? option.weight ?? 1),
            color: isValidColor(option.color) ? option.color : defaultColors[optionIndex % defaultColors.length],
            enabled: option.enabled !== false,
            description: typeof option.description === "string" ? option.description : ""
            }))
        : []
    }))
    .filter((wheel) => wheel.options.length >= 2);

    if (wheels.length === 0) return structuredClone(defaultData);

    return {
    activeWheelId: wheels.some((wheel) => wheel.id === data.activeWheelId) ? data.activeWheelId : wheels[0].id,
    folders,
    wheels
    };
}

function saveData({ skipFileSync = false } = {}) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    if (!skipFileSync) scheduleDataFileSave();
}

function supportsFileSystemAccess() {
    return typeof window.showOpenFilePicker === "function" && typeof window.showSaveFilePicker === "function";
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeLayout(nextState = {}) {
    const currentRoot = document.querySelector(".app");
    const totalWidth = currentRoot?.getBoundingClientRect().width || window.innerWidth || 1200;
    const sidebarCollapsed = nextState.sidebarCollapsed === true;
    const editorCollapsed = nextState.editorCollapsed === true;
    const visibleSplitterSize = (sidebarCollapsed ? 0 : SPLITTER_SIZE) + (editorCollapsed ? 0 : SPLITTER_SIZE);
    const minVisiblePanelWidth = (sidebarCollapsed ? 0 : MIN_SIDEBAR_WIDTH) + (editorCollapsed ? 0 : MIN_EDITOR_WIDTH);
    const maxVisiblePanelWidth = Math.max(minVisiblePanelWidth, totalWidth - MIN_MAIN_WIDTH - visibleSplitterSize);

    let sidebarWidth = clamp(
    Number.isFinite(Number(nextState.sidebarWidth)) ? Number(nextState.sidebarWidth) : 280,
    MIN_SIDEBAR_WIDTH,
    MAX_SIDEBAR_WIDTH
    );
    let editorWidth = clamp(
    Number.isFinite(Number(nextState.editorWidth)) ? Number(nextState.editorWidth) : 420,
    MIN_EDITOR_WIDTH,
    MAX_EDITOR_WIDTH
    );

    const visiblePanelWidth = (sidebarCollapsed ? 0 : sidebarWidth) + (editorCollapsed ? 0 : editorWidth);

    if (visiblePanelWidth > maxVisiblePanelWidth) {
    let overflow = visiblePanelWidth - maxVisiblePanelWidth;

    if (!editorCollapsed) {
        const reduceEditor = Math.min(editorWidth - MIN_EDITOR_WIDTH, Math.ceil(overflow / (sidebarCollapsed ? 1 : 2)));
        editorWidth -= reduceEditor;
        overflow -= reduceEditor;
    }

    if (overflow > 0 && !sidebarCollapsed) {
        sidebarWidth = Math.max(MIN_SIDEBAR_WIDTH, sidebarWidth - overflow);
    }
    }

    return { sidebarWidth, editorWidth, sidebarCollapsed, editorCollapsed };
}

function applyLayout(nextState, { persist = true } = {}) {
    layoutState = normalizeLayout({
    sidebarWidth: nextState.sidebarWidth,
    editorWidth: nextState.editorWidth,
    sidebarCollapsed: nextState.sidebarCollapsed,
    editorCollapsed: nextState.editorCollapsed
    });

    document.documentElement.style.setProperty("--sidebar-width", `${layoutState.sidebarWidth}px`);
    document.documentElement.style.setProperty("--editor-width", `${layoutState.editorWidth}px`);
    appRoot.classList.toggle("sidebar-collapsed", layoutState.sidebarCollapsed);
    appRoot.classList.toggle("editor-collapsed", layoutState.editorCollapsed);
    sidebarPanel.setAttribute("aria-hidden", String(layoutState.sidebarCollapsed));
    editorPanel.setAttribute("aria-hidden", String(layoutState.editorCollapsed));
    leftSplitter.setAttribute("aria-valuenow", String(Math.round(layoutState.sidebarWidth)));
    rightSplitter.setAttribute("aria-valuenow", String(Math.round(layoutState.editorWidth)));
    updatePanelToggleButtons();

    if (persist) {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layoutState));
    }
}

function updatePanelToggleButtons() {
    toggleLeftPanelButton.textContent = layoutState.sidebarCollapsed ? ">" : "<";
    toggleLeftPanelButton.title = layoutState.sidebarCollapsed ? "Mostrar panel izquierdo" : "Ocultar panel izquierdo";
    toggleLeftPanelButton.setAttribute("aria-label", toggleLeftPanelButton.title);
    toggleLeftPanelButton.setAttribute("aria-expanded", String(!layoutState.sidebarCollapsed));

    toggleRightPanelButton.textContent = layoutState.editorCollapsed ? "<" : ">";
    toggleRightPanelButton.title = layoutState.editorCollapsed ? "Mostrar panel derecho" : "Ocultar panel derecho";
    toggleRightPanelButton.setAttribute("aria-label", toggleRightPanelButton.title);
    toggleRightPanelButton.setAttribute("aria-expanded", String(!layoutState.editorCollapsed));
}

function togglePanel(side) {
    applyLayout({
    sidebarWidth: layoutState.sidebarWidth,
    editorWidth: layoutState.editorWidth,
    sidebarCollapsed: side === "left" ? !layoutState.sidebarCollapsed : layoutState.sidebarCollapsed,
    editorCollapsed: side === "right" ? !layoutState.editorCollapsed : layoutState.editorCollapsed
    });

    requestAnimationFrame(() => drawWheel(getActiveWheel()));
}

function startColumnResize(side) {
    return (event) => {
    if (window.matchMedia("(max-width: 980px)").matches) return;

    event.preventDefault();
    const splitter = side === "left" ? leftSplitter : rightSplitter;
    const bounds = appRoot.getBoundingClientRect();

    appRoot.classList.add("resizing");
    splitter.setPointerCapture(event.pointerId);

    const handleMove = (moveEvent) => {
        if (side === "left") {
        const visibleEditorWidth = layoutState.editorCollapsed ? 0 : layoutState.editorWidth;
        const visibleSplitterSize = SPLITTER_SIZE + (layoutState.editorCollapsed ? 0 : SPLITTER_SIZE);
        const maxWidth = Math.max(MIN_SIDEBAR_WIDTH, bounds.width - visibleEditorWidth - MIN_MAIN_WIDTH - visibleSplitterSize);
        const sidebarWidth = clamp(moveEvent.clientX - bounds.left, MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, maxWidth));
        applyLayout({
            sidebarWidth,
            editorWidth: layoutState.editorWidth,
            sidebarCollapsed: layoutState.sidebarCollapsed,
            editorCollapsed: layoutState.editorCollapsed
        });
        return;
        }

        const visibleSidebarWidth = layoutState.sidebarCollapsed ? 0 : layoutState.sidebarWidth;
        const visibleSplitterSize = SPLITTER_SIZE + (layoutState.sidebarCollapsed ? 0 : SPLITTER_SIZE);
        const maxWidth = Math.max(MIN_EDITOR_WIDTH, bounds.width - visibleSidebarWidth - MIN_MAIN_WIDTH - visibleSplitterSize);
        const editorWidth = clamp(bounds.right - moveEvent.clientX, MIN_EDITOR_WIDTH, Math.min(MAX_EDITOR_WIDTH, maxWidth));
        applyLayout({
        sidebarWidth: layoutState.sidebarWidth,
        editorWidth,
        sidebarCollapsed: layoutState.sidebarCollapsed,
        editorCollapsed: layoutState.editorCollapsed
        });
    };

    const stopResize = () => {
        appRoot.classList.remove("resizing");
        splitter.removeEventListener("pointermove", handleMove);
        splitter.removeEventListener("pointerup", stopResize);
        splitter.removeEventListener("pointercancel", stopResize);

        if (splitter.hasPointerCapture(event.pointerId)) {
        splitter.releasePointerCapture(event.pointerId);
        }
    };

    splitter.addEventListener("pointermove", handleMove);
    splitter.addEventListener("pointerup", stopResize);
    splitter.addEventListener("pointercancel", stopResize);
    };
}

function resizeByKeyboard(side, event) {
    if (window.matchMedia("(max-width: 980px)").matches) return;
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;

    event.preventDefault();
    const step = event.shiftKey ? 32 : 18;

    if (side === "left") {
    const direction = event.key === "ArrowRight" ? 1 : -1;
    applyLayout({
        sidebarWidth: layoutState.sidebarWidth + direction * step,
        editorWidth: layoutState.editorWidth,
        sidebarCollapsed: layoutState.sidebarCollapsed,
        editorCollapsed: layoutState.editorCollapsed
    });
    return;
    }

    const direction = event.key === "ArrowLeft" ? 1 : -1;
    applyLayout({
    sidebarWidth: layoutState.sidebarWidth,
    editorWidth: layoutState.editorWidth + direction * step,
    sidebarCollapsed: layoutState.sidebarCollapsed,
    editorCollapsed: layoutState.editorCollapsed
    });
}

function scheduleDataFileSave() {
    if (!dataFileHandle) return;

    clearTimeout(dataFileSaveTimer);
    dataFileSaveTimer = setTimeout(() => {
    dataFileSaveTimer = null;
    void writeDataFile({ requestPermission: false });
    }, 320);
}

function openHandleDatabase() {
    return new Promise((resolve, reject) => {
    const request = indexedDB.open(HANDLE_DB_NAME, 1);

    request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(HANDLE_STORE_NAME)) {
        request.result.createObjectStore(HANDLE_STORE_NAME);
        }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    });
}

async function readStoredFileHandle() {
    if (!("indexedDB" in window) || !supportsFileSystemAccess()) return null;

    try {
    const database = await openHandleDatabase();
    return await new Promise((resolve, reject) => {
        const transaction = database.transaction(HANDLE_STORE_NAME, "readonly");
        const request = transaction.objectStore(HANDLE_STORE_NAME).get(DATA_FILE_HANDLE_KEY);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
        database.close();
        reject(transaction.error);
        };
    });
    } catch (error) {
    console.error(error);
    return null;
    }
}

async function storeFileHandle(handle) {
    if (!("indexedDB" in window) || !supportsFileSystemAccess()) return;

    try {
    const database = await openHandleDatabase();
    await new Promise((resolve, reject) => {
        const transaction = database.transaction(HANDLE_STORE_NAME, "readwrite");
        const request = transaction.objectStore(HANDLE_STORE_NAME).put(handle, DATA_FILE_HANDLE_KEY);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
        database.close();
        reject(transaction.error);
        };
    });
    } catch (error) {
    console.error(error);
    }
}

async function clearStoredFileHandle() {
    if (!("indexedDB" in window) || !supportsFileSystemAccess()) return;

    try {
    const database = await openHandleDatabase();
    await new Promise((resolve, reject) => {
        const transaction = database.transaction(HANDLE_STORE_NAME, "readwrite");
        const request = transaction.objectStore(HANDLE_STORE_NAME).delete(DATA_FILE_HANDLE_KEY);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => database.close();
        transaction.onerror = () => {
        database.close();
        reject(transaction.error);
        };
    });
    } catch (error) {
    console.error(error);
    }
}

async function ensureFilePermission(handle, writable, requestPermission) {
    if (!handle) return false;

    const options = writable ? { mode: "readwrite" } : {};

    if (typeof handle.queryPermission === "function") {
    const permission = await handle.queryPermission(options);
    if (permission === "granted") return true;
    if (!requestPermission || typeof handle.requestPermission !== "function") return false;
    return handle.requestPermission(options).then((result) => result === "granted");
    }

    return true;
}

async function readDataFromFile(handle) {
    const file = await handle.getFile();
    const text = await file.text();

    if (!text.trim()) {
    return structuredClone(appData);
    }

    return normalizeData(JSON.parse(text));
}

function downloadDataBackup(fileName = "tiny-wheel-data.json") {
    const blob = new Blob([JSON.stringify(appData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();

    URL.revokeObjectURL(url);
}

async function bindDataFileHandle(handle, { loadContents = false, requestPermission = false } = {}) {
    dataFileHandle = handle;
    dataFileState = "linked";
    saveFileMeta(handle.name);
    await storeFileHandle(handle);

    if (loadContents) {
    const hasReadAccess = await ensureFilePermission(handle, false, requestPermission);
    if (!hasReadAccess) {
        dataFileState = "warning";
        renderFileStatus();
        return false;
    }

    try {
        appData = await readDataFromFile(handle);
        saveData({ skipFileSync: true });
        renderApp();
    } catch (error) {
        console.error(error);
        return false;
    }
    }

    renderFileStatus();
    return true;
}

async function writeDataFile({ requestPermission = false } = {}) {
    if (!supportsFileSystemAccess()) {
    downloadDataBackup();
    return true;
    }

    if (!dataFileHandle) {
    return createDataFile();
    }

    const hasWriteAccess = await ensureFilePermission(dataFileHandle, true, requestPermission);
    if (!hasWriteAccess) {
    dataFileState = "warning";
    renderFileStatus();
    return false;
    }

    try {
    const writable = await dataFileHandle.createWritable();
    await writable.write(JSON.stringify(appData, null, 2));
    await writable.close();
    dataFileState = "synced";
    saveFileMeta(dataFileHandle.name);
    renderFileStatus();

    return true;
    } catch (error) {
    console.error(error);
    dataFileState = "error";
    renderFileStatus();
    return false;
    }
}

async function createDataFile() {
    if (!supportsFileSystemAccess()) {
    downloadDataBackup();
    return true;
    }

    try {
    const handle = await window.showSaveFilePicker({
        suggestedName: "tiny-wheel-data.json",
        types: [{
        description: "Tiny Wheel data",
        accept: { "application/json": [".json"] }
        }]
    });

    const linked = await bindDataFileHandle(handle, { loadContents: false, requestPermission: true });
    if (!linked) return false;
    return writeDataFile({ requestPermission: true });
    } catch (error) {
    if (error?.name !== "AbortError") {
        console.error(error);
    }
    return false;
    }
}

async function openDataFile() {
    if (!supportsFileSystemAccess()) {
    return;
    }

    try {
    const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{
        description: "Tiny Wheel data",
        accept: { "application/json": [".json"] }
        }]
    });

    await bindDataFileHandle(handle, { loadContents: true, requestPermission: true });
    } catch (error) {
    if (error?.name !== "AbortError") {
        console.error(error);
    }
    }
}

async function restoreLinkedDataFile() {
    if (!supportsFileSystemAccess()) {
    renderFileStatus();
    return;
    }

    const handle = await readStoredFileHandle();
    if (!handle) {
    renderFileStatus();
    return;
    }

    dataFileHandle = handle;
    saveFileMeta(handle.name);

    const hasReadAccess = await ensureFilePermission(handle, false, false);
    if (!hasReadAccess) {
    dataFileState = "warning";
    renderFileStatus();
    return;
    }

    try {
    appData = await readDataFromFile(handle);
    dataFileState = "linked";
    saveData({ skipFileSync: true });
    renderApp();
    } catch (error) {
    console.error(error);
    dataFileHandle = null;
    dataFileState = "error";
    clearFileMeta();
    await clearStoredFileHandle();
    }

    renderFileStatus();
}

function renderFileStatus() {
    const fileMeta = loadFileMeta();
    const linkedFileName = dataFileHandle?.name || fileMeta?.name || "Sin JSON";

    dataFileBadge.classList.remove("warning");
    saveDataFileButton.disabled = false;

    if (!supportsFileSystemAccess()) {
    dataFileBadge.textContent = "Descarga";
    dataFileName.textContent = "JSON manual";
    dataFileHint.textContent = "Este navegador no permite vincular archivos. Guardar JSON descargará una copia.";
    openDataFileButton.disabled = true;
    createDataFileButton.disabled = false;
    return;
    }

    openDataFileButton.disabled = false;
    createDataFileButton.disabled = false;

    if (!dataFileHandle && !fileMeta) {
    dataFileBadge.textContent = "Local";
    dataFileName.textContent = linkedFileName;
    dataFileHint.textContent = "Crea o vincula un archivo JSON para guardar las ruedas fuera del HTML.";
    return;
    }

    if (!dataFileHandle && fileMeta) {
    dataFileBadge.textContent = "Local";
    dataFileBadge.classList.add("warning");
    dataFileName.textContent = linkedFileName;
    dataFileHint.textContent = "Había un JSON recordado, pero hace falta volver a abrirlo para reactivar el guardado externo.";
    return;
    }

    dataFileBadge.textContent = "JSON";
    dataFileName.textContent = linkedFileName;

    if (dataFileState === "synced") {
    dataFileHint.textContent = "Archivo vinculado. Los cambios se guardan también en ese JSON y en localStorage como respaldo.";
    return;
    }

    if (dataFileState === "warning") {
    dataFileBadge.classList.add("warning");
    dataFileHint.textContent = "Archivo vinculado, pero falta permiso de lectura o escritura. Usa Guardar JSON para reactivar el acceso.";
    return;
    }

    if (dataFileState === "error") {
    dataFileBadge.classList.add("warning");
    dataFileHint.textContent = "Hubo un problema con el archivo vinculado. Puedes volver a abrirlo o crear uno nuevo.";
    return;
    }

    dataFileHint.textContent = "Archivo vinculado. La app cargará este JSON al abrirse si el navegador conserva el permiso.";
}

function getActiveWheel() {
    return appData.wheels.find((wheel) => wheel.id === appData.activeWheelId) || appData.wheels[0];
}

function getFolderName(folderId) {
    if (!folderId) return "Sin carpeta";
    return appData.folders.find((folder) => folder.id === folderId)?.name || "Sin carpeta";
}

function getFolderGroups() {
    return [{ id: null, name: "Sin carpeta", system: true }, ...appData.folders];
}

function getLastWheelIndexByFolder(folderId) {
    let lastIndex = -1;

    appData.wheels.forEach((wheel, index) => {
    if ((wheel.folderId || null) === folderId) {
        lastIndex = index;
    }
    });

    return lastIndex;
}

function clearWheelDragState() {
    wheelList.querySelectorAll(".wheel-item, .folder-wheels").forEach((element) => {
    element.classList.remove("dragging", "drop-before", "drop-after", "drag-over");
    });
}

function clearOptionDragState() {
    optionList.querySelectorAll(".option-row").forEach((element) => {
    element.classList.remove("dragging", "drop-before", "drop-after");
    });
}

function getDropPosition(event, element) {
    const rect = element.getBoundingClientRect();
    return event.clientY > rect.top + rect.height / 2 ? "after" : "before";
}

function openDialog({
    title,
    message = "",
    confirmLabel = "Aceptar",
    cancelLabel = "Cancelar",
    initialValue = "",
    input = false,
    multiline = false,
    maxLength = 42
}) {
    return new Promise((resolve) => {
    dialogState = { resolve, input, multiline };
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    dialogConfirmButton.textContent = confirmLabel;
    dialogCancelButton.textContent = cancelLabel;
    dialogInput.hidden = !input || multiline;
    dialogTextarea.hidden = !input || !multiline;
    dialogInput.value = input && !multiline ? initialValue : "";
    dialogTextarea.value = input && multiline ? initialValue : "";
    dialogInput.maxLength = multiline ? 42 : maxLength;
    dialogTextarea.maxLength = multiline ? maxLength : 280;
    dialogBackdrop.hidden = false;

    if (input && multiline) {
        requestAnimationFrame(() => {
        dialogTextarea.focus();
        dialogTextarea.select();
        });
    } else if (input) {
        requestAnimationFrame(() => {
        dialogInput.focus();
        dialogInput.select();
        });
    } else {
        requestAnimationFrame(() => dialogConfirmButton.focus());
    }
    });
}

function closeDialog(result) {
    if (!dialogState) return;
    const { resolve } = dialogState;
    dialogState = null;
    dialogBackdrop.hidden = true;
    resolve(result);
}

function openTextDialog(config) {
    return openDialog({ ...config, input: true });
}

function openDescriptionDialog(config) {
    return openDialog({ ...config, input: true, multiline: true, maxLength: 280 });
}

function openConfirmDialog(config) {
    return openDialog({ ...config, input: false });
}

function moveWheelRelative(wheelId, targetWheelId, position) {
    const sourceIndex = appData.wheels.findIndex((wheel) => wheel.id === wheelId);
    const targetIndex = appData.wheels.findIndex((wheel) => wheel.id === targetWheelId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;

    const targetWheel = appData.wheels[targetIndex];
    let insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    if (sourceIndex < insertIndex) insertIndex -= 1;
    if (sourceIndex === insertIndex) return;

    const [wheel] = appData.wheels.splice(sourceIndex, 1);
    wheel.folderId = targetWheel.folderId || null;
    appData.wheels.splice(insertIndex, 0, wheel);
    saveData();
    renderApp();
}

function moveWheelToFolder(wheelId, folderId) {
    const normalizedFolderId = folderId || null;
    const sourceIndex = appData.wheels.findIndex((wheel) => wheel.id === wheelId);
    if (sourceIndex < 0) return;

    const [wheel] = appData.wheels.splice(sourceIndex, 1);
    wheel.folderId = normalizedFolderId;

    const lastIndex = getLastWheelIndexByFolder(normalizedFolderId);
    const insertIndex = lastIndex < 0 ? appData.wheels.length : lastIndex + 1;
    appData.wheels.splice(insertIndex, 0, wheel);
    saveData();
    renderApp();
}

function moveOptionRelative(sourceIndex, targetIndex, position) {
    const wheel = getActiveWheel();
    if (!wheel || sourceIndex === targetIndex) return;

    let insertIndex = position === "after" ? targetIndex + 1 : targetIndex;
    if (sourceIndex < insertIndex) insertIndex -= 1;
    if (sourceIndex === insertIndex) return;

    const [option] = wheel.options.splice(sourceIndex, 1);
    wheel.options.splice(insertIndex, 0, option);
    wheel.result = "";
    saveData();
    renderOptions(wheel);
    drawWheel(wheel);
    updateWheelListSummary(wheel);
    resultValue.textContent = "Toca el centro para girar";
}

async function createFolder() {
    const name = await openTextDialog({
    title: "Nueva carpeta",
    message: "Agrupa ruedas y luego arrástralas dentro de la carpeta.",
    confirmLabel: "Crear"
    });
    if (name === null) return;

    const trimmed = name.trim();
    if (!trimmed) {
    return;
    }

    appData.folders.push({ id: crypto.randomUUID(), name: trimmed });
    saveData();
    renderWheelList(getActiveWheel());
}

async function renameFolder(folderId) {
    const folder = appData.folders.find((item) => item.id === folderId);
    if (!folder) return;

    const nextName = await openTextDialog({
    title: "Renombrar carpeta",
    message: "El nuevo nombre se aplicará inmediatamente a todas las ruedas de esa carpeta.",
    confirmLabel: "Guardar",
    initialValue: folder.name
    });
    if (nextName === null) return;

    const trimmed = nextName.trim();
    if (!trimmed) {
    return;
    }

    folder.name = trimmed;
    saveData();
    renderWheelList(getActiveWheel());
}

async function deleteFolder(folderId) {
    const folder = appData.folders.find((item) => item.id === folderId);
    if (!folder) return;

    const shouldDelete = await openConfirmDialog({
    title: "Borrar carpeta",
    message: `Las ruedas de "${folder.name}" volverán a "Sin carpeta".`,
    confirmLabel: "Borrar"
    });
    if (!shouldDelete) return;

    appData.folders = appData.folders.filter((item) => item.id !== folderId);
    appData.wheels.forEach((wheel) => {
    if (wheel.folderId === folderId) wheel.folderId = null;
    });
    saveData();
    renderWheelList(getActiveWheel());
}

function sanitizeProbability(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.max(0.01, Math.min(10000, number));
}

function isOptionEnabled(option) {
    return option.enabled !== false;
}

function getOptionDescription(option) {
    return typeof option?.description === "string" ? option.description.trim() : "";
}

function getEnabledOptionCount(wheel) {
    return wheel.options.reduce((count, option) => count + (isOptionEnabled(option) ? 1 : 0), 0);
}

function isValidColor(value) {
    return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function getColorChannels(hexColor) {
    const safeColor = isValidColor(hexColor) ? hexColor : "#555555";
    const channels = safeColor.match(/[0-9a-fA-F]{2}/g) || ["55", "55", "55"];
    return channels.map((channel) => parseInt(channel, 16));
}

function getPerceivedBrightness(hexColor) {
    const [red, green, blue] = getColorChannels(hexColor);
    return (red * 299 + green * 587 + blue * 114) / 1000;
}

function getContrastingTextColor(hexColor, enabled = true) {
    const isLight = getPerceivedBrightness(hexColor) >= 128;
    if (isLight) return enabled ? "rgba(10, 10, 14, 0.9)" : "rgba(10, 10, 14, 0.46)";
    return enabled ? "rgba(255, 255, 255, 0.96)" : "rgba(255, 255, 255, 0.5)";
}

function getTotalProbability(wheel) {
    return wheel.options.reduce((total, option) => total + sanitizeProbability(option.probability), 0);
}

function getSegments(wheel) {
    const total = getTotalProbability(wheel) || 1;
    const selectableTotal = wheel.options.reduce(
    (sum, option) => sum + (isOptionEnabled(option) ? sanitizeProbability(option.probability) : 0),
    0
    );
    let cursor = 0;

    return wheel.options.map((option, index) => {
    const size = TAU * sanitizeProbability(option.probability) / total;
    const segment = {
        index,
        option,
        start: cursor,
        end: cursor + size,
        size,
        normalizedProbability: sanitizeProbability(option.probability) / total * 100,
        selectionProbability: isOptionEnabled(option) && selectableTotal
        ? sanitizeProbability(option.probability) / selectableTotal * 100
        : 0
    };
    cursor += size;
    return segment;
    });
}

function getSelectableSegments(wheel) {
    return getSegments(wheel).filter((segment) => isOptionEnabled(segment.option));
}

function getIdleResultMessage(wheel) {
    return getEnabledOptionCount(wheel) > 0 ? "Toca el centro para girar" : "Activa al menos una opción";
}

function darkenColor(hexColor, amount = 0.45) {
    const clampedAmount = Math.max(0, Math.min(1, amount));
    const darkened = getColorChannels(hexColor).map((value) => {
    const nextValue = Math.round(value * (1 - clampedAmount));
    return nextValue.toString(16).padStart(2, "0");
    });
    return `#${darkened.join("")}`;
}

function getWheelGeometry() {
    const size = wheelCanvas.width;
    const center = size / 2;
    const outerRadius = center - 12;

    return {
    size,
    center,
    outerRadius,
    segmentOuterRadius: outerRadius - 15,
    innerRadius: 88
    };
}

function getSegmentIndexFromCanvasClick(wheel, event) {
    const rect = wheelCanvas.getBoundingClientRect();
    const scaleX = wheelCanvas.width / rect.width;
    const scaleY = wheelCanvas.height / rect.height;
    const { center, innerRadius, segmentOuterRadius } = getWheelGeometry();
    const x = (event.clientX - rect.left) * scaleX - center;
    const y = (event.clientY - rect.top) * scaleY - center;
    const distance = Math.hypot(x, y);

    if (distance < innerRadius || distance > segmentOuterRadius) {
    return -1;
    }

    const angle = normalizeAngle(Math.atan2(y, x) - wheel.rotation);
    const segments = getSegments(wheel);
    const found = segments.find((segment) => angle >= segment.start && angle < segment.end);
    return found ? found.index : segments.length - 1;
}

function hideWheelTooltip() {
    wheelTooltip.hidden = true;
}

function moveWheelTooltip(event) {
    const stageRect = wheelStage.getBoundingClientRect();
    const padding = 10;
    const offset = 16;
    const tooltipWidth = wheelTooltip.offsetWidth;
    const tooltipHeight = wheelTooltip.offsetHeight;
    const pointerX = event.clientX - stageRect.left;
    const pointerY = event.clientY - stageRect.top;
    let left = pointerX + offset;
    let top = pointerY + offset;

    if (left + tooltipWidth > stageRect.width - padding) {
    left = pointerX - tooltipWidth - offset;
    }

    if (top + tooltipHeight > stageRect.height - padding) {
    top = pointerY - tooltipHeight - offset;
    }

    wheelTooltip.style.left = `${clamp(left, padding, Math.max(padding, stageRect.width - tooltipWidth - padding))}px`;
    wheelTooltip.style.top = `${clamp(top, padding, Math.max(padding, stageRect.height - tooltipHeight - padding))}px`;
}

function handleWheelCanvasMouseMove(event) {
    const wheel = getActiveWheel();
    if (!wheel || isSpinning) {
    hideWheelTooltip();
    return;
    }

    const segmentIndex = getSegmentIndexFromCanvasClick(wheel, event);
    const option = wheel.options[segmentIndex];
    const description = getOptionDescription(option);

    if (!description) {
    hideWheelTooltip();
    return;
    }

    if (wheelTooltip.textContent !== description) {
    wheelTooltip.textContent = description;
    }

    wheelTooltip.hidden = false;
    moveWheelTooltip(event);
}

function renderApp() {
    const wheel = getActiveWheel();
    hideWheelTooltip();
    renderWheelList(wheel);
    renderTitle(wheel);
    renderOptions(wheel);
    drawWheel(wheel);
    updateSpinButton(wheel);
    renderFileStatus();
}

function renderWheelList(activeWheel) {
    wheelList.innerHTML = "";

    getFolderGroups().forEach((folder) => {
    const group = document.createElement("section");
    group.className = `folder-group${folder.system ? " uncategorized" : ""}`;
    group.dataset.folderId = folder.id || "";

    const header = document.createElement("div");
    header.className = "folder-header";
    header.innerHTML = `
        <div class="folder-title">
        <span class="folder-badge">${folder.system ? "General" : "Carpeta"}</span>
        <strong></strong>
        <span class="folder-count"></span>
        </div>
    `;

    const title = header.querySelector("strong");
    const count = header.querySelector(".folder-count");
    const folderWheels = appData.wheels.filter((wheel) => (wheel.folderId || null) === (folder.id || null));

    title.textContent = folder.name;
    count.textContent = String(folderWheels.length);

    if (!folder.system) {
        const tools = document.createElement("div");
        tools.className = "folder-tools";
        tools.innerHTML = `
        <button class="folder-action" type="button" aria-label="Renombrar carpeta">Renombrar</button>
        <button class="folder-action danger" type="button" aria-label="Borrar carpeta">×</button>
        `;
        const [renameButton, deleteButton] = tools.querySelectorAll("button");
        renameButton.addEventListener("click", () => renameFolder(folder.id));
        deleteButton.addEventListener("click", () => deleteFolder(folder.id));
        header.appendChild(tools);
    }

    const container = document.createElement("div");
    container.className = "folder-wheels";

    container.addEventListener("dragover", (event) => {
        if (!draggedWheelId || event.target.closest(".wheel-item")) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        container.classList.add("drag-over");
    });

    container.addEventListener("dragleave", (event) => {
        if (container.contains(event.relatedTarget)) return;
        container.classList.remove("drag-over");
    });

    container.addEventListener("drop", (event) => {
        if (!draggedWheelId || event.target.closest(".wheel-item")) return;
        event.preventDefault();
        moveWheelToFolder(draggedWheelId, folder.id || null);
    });

    if (!folderWheels.length) {
        const empty = document.createElement("div");
        empty.className = "folder-empty";
        empty.textContent = "Arrastra ruedas aquí";
        container.appendChild(empty);
    }

    folderWheels.forEach((wheel) => {
        const button = document.createElement("button");
        button.className = `wheel-item${wheel.id === activeWheel.id ? " active" : ""}`;
        button.type = "button";
        button.dataset.id = wheel.id;
        button.draggable = true;
        button.innerHTML = `<strong></strong><span></span>`;
        button.querySelector("strong").textContent = wheel.name;
        button.querySelector("span").textContent = `${wheel.options.length} opciones · ${formatNumber(getTotalProbability(wheel))}% total`;

        button.addEventListener("click", () => changeActiveWheel(wheel.id));
        button.addEventListener("dragstart", (event) => {
        draggedWheelId = wheel.id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", wheel.id);
        button.classList.add("dragging");
        });
        button.addEventListener("dragend", () => {
        draggedWheelId = null;
        clearWheelDragState();
        });
        button.addEventListener("dragover", (event) => {
        if (!draggedWheelId || draggedWheelId === wheel.id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const position = getDropPosition(event, button);
        clearWheelDragState();
        button.classList.add(position === "before" ? "drop-before" : "drop-after");
        });
        button.addEventListener("drop", (event) => {
        if (!draggedWheelId || draggedWheelId === wheel.id) return;
        event.preventDefault();
        const position = getDropPosition(event, button);
        moveWheelRelative(draggedWheelId, wheel.id, position);
        });

        container.appendChild(button);
    });

    group.appendChild(header);
    group.appendChild(container);
    wheelList.appendChild(group);
    });
}

function renderTitle(wheel) {
    wheelNameInput.value = wheel.name;
    resultValue.textContent = wheel.result || getIdleResultMessage(wheel);
}

function renderOptions(wheel) {
    optionList.innerHTML = "";
    updateTotalLabel(wheel);

    const segments = getSegments(wheel);
    wheel.options.forEach((option, index) => {
    const row = document.createElement("div");
    row.className = "option-row";
    row.dataset.index = String(index);
    row.classList.toggle("inactive", !isOptionEnabled(option));

    row.innerHTML = `
        <button class="drag-handle" type="button" aria-label="Reordenar opción" draggable="true">⋮⋮</button>
        <input class="color-input" type="color" aria-label="Color de opción" />
        <input class="text-input" type="text" maxlength="42" aria-label="Texto de opción" />
        <div class="weight-wrap">
        <input class="weight-input" type="number" min="0.01" step="0.01" aria-label="Probabilidad de opción" />
        </div>
        <div class="option-tools">
        <button class="description-option" type="button" aria-label="Editar descripción" title="Editar descripción">i</button>
        <button class="delete-option" type="button" aria-label="Borrar opción">×</button>
        </div>
        <div class="actual-probability"></div>
    `;

    const dragHandle = row.querySelector(".drag-handle");
    const colorInput = row.querySelector(".color-input");
    const textInput = row.querySelector(".text-input");
    const weightInput = row.querySelector(".weight-input");
    const descriptionButton = row.querySelector(".description-option");
    const deleteButton = row.querySelector(".delete-option");
    const actualProbability = row.querySelector(".actual-probability");

    colorInput.value = option.color;
    textInput.value = option.text;
    weightInput.value = stripTrailingZeros(option.probability);
    descriptionButton.classList.toggle("has-description", Boolean(getOptionDescription(option)));
    actualProbability.textContent = isOptionEnabled(option)
        ? `Probabilidad real: ${formatNumber(segments[index].selectionProbability)}%`
        : "Inactiva · no puede salir";

    dragHandle.addEventListener("dragstart", (event) => {
        draggedOptionIndex = index;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
        row.classList.add("dragging");
    });

    dragHandle.addEventListener("dragend", () => {
        draggedOptionIndex = null;
        clearOptionDragState();
    });

    row.addEventListener("dragover", (event) => {
        if (draggedOptionIndex === null || draggedOptionIndex === index) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const position = getDropPosition(event, row);
        clearOptionDragState();
        row.classList.add(position === "before" ? "drop-before" : "drop-after");
    });

    row.addEventListener("drop", (event) => {
        if (draggedOptionIndex === null || draggedOptionIndex === index) return;
        event.preventDefault();
        const position = getDropPosition(event, row);
        moveOptionRelative(draggedOptionIndex, index, position);
    });

    colorInput.addEventListener("input", () => {
        option.color = colorInput.value;
        wheel.result = "";
        saveData();
        drawWheel(wheel);
    });

    textInput.addEventListener("input", () => {
        option.text = textInput.value;
        wheel.result = "";
        resultValue.textContent = getIdleResultMessage(wheel);
        saveData();
        drawWheel(wheel);
    });

    textInput.addEventListener("blur", () => {
        if (textInput.value.trim() === "") {
        option.text = `Opción ${index + 1}`;
        textInput.value = option.text;
        saveData();
        drawWheel(wheel);
        }
    });

    weightInput.addEventListener("input", () => {
        const value = Number(weightInput.value);
        if (!Number.isFinite(value) || value <= 0) return;

        option.probability = sanitizeProbability(value);
        wheel.result = "";
        resultValue.textContent = getIdleResultMessage(wheel);
        saveData();
        drawWheel(wheel);
        updateProbabilityLabels(wheel);
        updateWheelListSummary(wheel);
    });

    weightInput.addEventListener("blur", () => {
        const value = Number(weightInput.value);
        if (!Number.isFinite(value) || value <= 0) {
        weightInput.value = stripTrailingZeros(option.probability);
        }
    });

    descriptionButton.addEventListener("click", () => {
        void editOptionDescription(index);
    });

    deleteButton.addEventListener("click", () => {
        void deleteOption(index);
    });

    optionList.appendChild(row);
    });
}

function updateTotalLabel(wheel) {
    totalProbability.textContent = `Total: ${formatNumber(getTotalProbability(wheel))}%`;
}

function updateProbabilityLabels(wheel) {
    const segments = getSegments(wheel);
    updateTotalLabel(wheel);

    optionList.querySelectorAll(".option-row").forEach((row) => {
    const index = Number(row.dataset.index);
    const label = row.querySelector(".actual-probability");
    if (!label || !segments[index]) return;
    row.classList.toggle("inactive", !isOptionEnabled(wheel.options[index]));
    label.textContent = isOptionEnabled(wheel.options[index])
        ? `Probabilidad real: ${formatNumber(segments[index].selectionProbability)}%`
        : "Inactiva · no puede salir";
    });
}

function updateWheelListSummary(wheel) {
    const item = wheelList.querySelector(`[data-id="${CSS.escape(wheel.id)}"] span`);
    if (item) item.textContent = `${wheel.options.length} opciones · ${formatNumber(getTotalProbability(wheel))}% total`;
}

function drawWheel(wheel) {
    const { size, center, outerRadius, innerRadius, segmentOuterRadius } = getWheelGeometry();

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(center, center);

    ctx.beginPath();
    ctx.arc(0, 0, outerRadius, 0, TAU);
    ctx.fillStyle = "#18181e";
    ctx.fill();

    const segments = getSegments(wheel);
    segments.forEach((segment) => {
    const start = wheel.rotation + segment.start;
    const end = wheel.rotation + segment.end;
    const enabled = isOptionEnabled(segment.option);
    const segmentColor = enabled ? segment.option.color : darkenColor(segment.option.color, 0.45);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, segmentOuterRadius, start, end);
    ctx.closePath();
    ctx.fillStyle = segmentColor;
    ctx.fill();

    if (!enabled) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.24)";
        ctx.fill();
    }

    ctx.strokeStyle = "rgba(0, 0, 0, 0.20)";
    ctx.lineWidth = 3;
    ctx.stroke();

    drawText(segment.option.text || "—", start + segment.size / 2, outerRadius, segment.size, segmentColor, enabled);
    });

    ctx.beginPath();
    ctx.arc(0, 0, outerRadius - 5, 0, TAU);
    ctx.lineWidth = 14;
    ctx.strokeStyle = "#1b1b21";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, innerRadius, 0, TAU);
    ctx.fillStyle = "#24242c";
    ctx.fill();

    ctx.restore();
}

function drawText(text, angle, radius, segmentSize, segmentColor, enabled = true) {
    const textRadius = radius * 0.66;
    const visibleText = truncateText(text, segmentSize < 0.30 ? 10 : segmentSize < 0.45 ? 15 : 22);
    const fontSize = segmentSize < 0.25 ? 19 : segmentSize < 0.40 ? 23 : 28;
    const textColor = getContrastingTextColor(segmentColor, enabled);
    const textShadowColor = textColor.includes("10, 10, 14")
    ? "rgba(255, 255, 255, 0.18)"
    : "rgba(0, 0, 0, 0.30)";

    ctx.save();
    ctx.rotate(angle);
    ctx.translate(textRadius, 0);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = textColor;
    ctx.font = `500 ${fontSize}px Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    ctx.shadowColor = enabled ? textShadowColor : "rgba(0, 0, 0, 0.12)";
    ctx.shadowBlur = 4;
    ctx.fillText(visibleText, 0, 0, radius * 0.46);
    ctx.restore();
}

function truncateText(text, maxLength) {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function updateSpinButton(wheel) {
    spinButton.disabled = isSpinning || wheel.options.length < 2 || getEnabledOptionCount(wheel) === 0;
}

function spinWheel() {
    const wheel = getActiveWheel();
    const selectableSegments = getSelectableSegments(wheel);
    if (isSpinning || wheel.options.length < 2 || selectableSegments.length === 0) return;

    hideWheelTooltip();
    isSpinning = true;
    wheel.result = "";
    resultValue.textContent = "Girando...";
    updateSpinButton(wheel);

    const targetSegment = pickWeightedSegment(selectableSegments);
    const margin = Math.min(targetSegment.size * 0.18, 0.08);
    const minAngle = targetSegment.start + margin;
    const maxAngle = targetSegment.end - margin;
    const targetAngleInsideSegment = minAngle + Math.random() * Math.max(0.001, maxAngle - minAngle);

    const startRotation = wheel.rotation;
    const startNormalized = normalizeAngle(startRotation);
    const targetNormalized = normalizeAngle(POINTER_ANGLE - targetAngleInsideSegment);
    let delta = targetNormalized - startNormalized;
    if (delta < 0) delta += TAU;

    const extraTurns = 5 + Math.floor(Math.random() * 4);
    const finalRotation = startRotation + delta + extraTurns * TAU;
    const duration = 3600 + Math.random() * 900;
    const startTime = performance.now();

    function animate(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = easeOutQuart(progress);
    wheel.rotation = startRotation + (finalRotation - startRotation) * eased;
    drawWheel(wheel);

    if (progress < 1) {
        requestAnimationFrame(animate);
        return;
    }

    wheel.rotation = normalizeAngle(finalRotation);
    const finalIndex = getPointedIndex(wheel);
    const result = wheel.options[finalIndex]?.text || targetSegment.option.text;

    wheel.result = result;
    isSpinning = false;
    saveData();
    resultValue.textContent = result;
    updateSpinButton(wheel);
    }

    requestAnimationFrame(animate);
}

function pickWeightedSegment(segments) {
    const total = segments.reduce((sum, segment) => sum + sanitizeProbability(segment.option.probability), 0);
    let random = Math.random() * total;

    for (const segment of segments) {
    random -= sanitizeProbability(segment.option.probability);
    if (random <= 0) return segment;
    }

    return segments[segments.length - 1];
}

function toggleOptionState(index) {
    const wheel = getActiveWheel();
    const option = wheel?.options[index];
    if (!option || isSpinning) return;

    option.enabled = !isOptionEnabled(option);
    wheel.result = "";
    saveData();
    renderOptions(wheel);
    drawWheel(wheel);
    updateSpinButton(wheel);
    resultValue.textContent = getIdleResultMessage(wheel);
}

function handleWheelCanvasClick(event) {
    const wheel = getActiveWheel();
    if (!wheel || isSpinning) return;

    const segmentIndex = getSegmentIndexFromCanvasClick(wheel, event);
    if (segmentIndex < 0) return;

    toggleOptionState(segmentIndex);
}

function getPointedIndex(wheel) {
    const pointedAngle = normalizeAngle(POINTER_ANGLE - wheel.rotation);
    const segments = getSegments(wheel);
    const found = segments.find((segment) => pointedAngle >= segment.start && pointedAngle < segment.end);
    return found ? found.index : segments.length - 1;
}

function normalizeAngle(angle) {
    return ((angle % TAU) + TAU) % TAU;
}

function easeOutQuart(value) {
    return 1 - Math.pow(1 - value, 4);
}

function updateWheelName() {
    const wheel = getActiveWheel();
    wheel.name = wheelNameInput.value || "Sin nombre";
    wheel.result = "";
    saveData();
    updateActiveWheelNameInList(wheel);
}

function updateActiveWheelNameInList(wheel) {
    const title = wheelList.querySelector(`[data-id="${CSS.escape(wheel.id)}"] strong`);
    if (title) title.textContent = wheel.name;
}

async function editOptionDescription(index) {
    const wheel = getActiveWheel();
    const option = wheel?.options[index];
    if (!option || isSpinning) return;

    const optionName = option.text.trim() || `Opción ${index + 1}`;
    const nextDescription = await openDescriptionDialog({
    title: "Descripción de opción",
    message: `Se mostrará al pasar el ratón por "${optionName}" en la rueda.`,
    confirmLabel: "Guardar",
    initialValue: option.description || ""
    });
    if (nextDescription === null) return;

    option.description = nextDescription.trim();
    saveData();
    renderOptions(wheel);
    hideWheelTooltip();
}

function addOption() {
    const wheel = getActiveWheel();
    const index = wheel.options.length;
    wheel.options.push({
    text: `Opción ${index + 1}`,
    probability: 10,
    color: defaultColors[index % defaultColors.length],
    enabled: true,
    description: ""
    });
    wheel.result = "";
    saveData();
    renderOptions(wheel);
    drawWheel(wheel);
    updateWheelListSummary(wheel);
    resultValue.textContent = getIdleResultMessage(wheel);
}

async function deleteOption(index) {
    const wheel = getActiveWheel();
    if (wheel.options.length <= 2) {
    return;
    }

    const option = wheel.options[index];
    const optionName = option?.text?.trim() || `Opción ${index + 1}`;
    const shouldDelete = await openConfirmDialog({
    title: "Borrar opción",
    message: `Se eliminará la opción "${optionName}".`,
    confirmLabel: "Borrar"
    });
    if (!shouldDelete) return;

    wheel.options.splice(index, 1);
    wheel.result = "";
    saveData();
    renderOptions(wheel);
    drawWheel(wheel);
    updateWheelListSummary(wheel);
    resultValue.textContent = getIdleResultMessage(wheel);
}

function equalizeProbabilities() {
    const wheel = getActiveWheel();
    const probability = 100 / wheel.options.length;
    wheel.options.forEach((option) => {
    option.probability = probability;
    });
    wheel.result = "";
    saveData();
    renderOptions(wheel);
    drawWheel(wheel);
    updateWheelListSummary(wheel);
    resultValue.textContent = getIdleResultMessage(wheel);
}

function createWheel() {
    if (isSpinning) return;
    const id = crypto.randomUUID();
    const activeWheel = getActiveWheel();
    const wheel = {
    id,
    name: "Nueva rueda",
    folderId: activeWheel?.folderId || null,
    rotation: 0,
    result: "",
    options: [
        { text: "Opción 1", probability: 25, color: defaultColors[0], enabled: true, description: "" },
        { text: "Opción 2", probability: 25, color: defaultColors[1], enabled: true, description: "" },
        { text: "Opción 3", probability: 25, color: defaultColors[2], enabled: true, description: "" },
        { text: "Opción 4", probability: 25, color: defaultColors[3], enabled: true, description: "" }
    ]
    };

    appData.wheels.push(wheel);
    appData.activeWheelId = id;
    saveData();
    renderApp();
}

function duplicateWheel() {
    if (isSpinning) return;
    const wheel = getActiveWheel();
    const clone = structuredClone(wheel);
    clone.id = crypto.randomUUID();
    clone.name = `${wheel.name} copia`;
    clone.rotation = 0;
    clone.result = "";

    appData.wheels.push(clone);
    appData.activeWheelId = clone.id;
    saveData();
    renderApp();
}

async function deleteWheel() {
    if (isSpinning) return;
    if (appData.wheels.length <= 1) {
    return;
    }

    const wheel = getActiveWheel();
    const shouldDelete = await openConfirmDialog({
    title: "Borrar rueda",
    message: `Se eliminará la rueda "${wheel.name}".`,
    confirmLabel: "Borrar"
    });
    if (!shouldDelete) return;

    appData.wheels = appData.wheels.filter((item) => item.id !== wheel.id);
    appData.activeWheelId = appData.wheels[0].id;
    saveData();
    renderApp();
}

function changeActiveWheel(wheelId) {
    if (isSpinning) return;
    appData.activeWheelId = wheelId;
    saveData();
    renderApp();
}

function formatNumber(value) {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function stripTrailingZeros(value) {
    return String(value).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

dialogBackdrop.addEventListener("click", (event) => {
    if (event.target === dialogBackdrop) {
    closeDialog(dialogState?.input ? null : false);
    }
});

dialogCancelButton.addEventListener("click", () => {
    closeDialog(dialogState?.input ? null : false);
});

dialogConfirmButton.addEventListener("click", () => {
    if (!dialogState) return;
    closeDialog(dialogState.input ? (dialogState.multiline ? dialogTextarea.value : dialogInput.value) : true);
});

dialogInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    closeDialog(dialogInput.value);
});

dialogTextarea.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    closeDialog(dialogTextarea.value);
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dialogState) {
    closeDialog(dialogState.input ? null : false);
    }
});

spinButton.addEventListener("click", spinWheel);
wheelCanvas.addEventListener("click", handleWheelCanvasClick);
wheelCanvas.addEventListener("mousemove", handleWheelCanvasMouseMove);
wheelCanvas.addEventListener("mouseleave", hideWheelTooltip);
wheelNameInput.addEventListener("input", updateWheelName);
newWheelButton.addEventListener("click", createWheel);
newFolderButton.addEventListener("click", createFolder);
duplicateWheelButton.addEventListener("click", duplicateWheel);
deleteWheelButton.addEventListener("click", deleteWheel);
addOptionButton.addEventListener("click", addOption);
equalizeButton.addEventListener("click", equalizeProbabilities);
createDataFileButton.addEventListener("click", () => {
    void createDataFile();
});
openDataFileButton.addEventListener("click", () => {
    void openDataFile();
});
saveDataFileButton.addEventListener("click", () => {
    void writeDataFile({ requestPermission: true });
});
leftSplitter.addEventListener("pointerdown", startColumnResize("left"));
rightSplitter.addEventListener("pointerdown", startColumnResize("right"));
leftSplitter.addEventListener("keydown", (event) => resizeByKeyboard("left", event));
rightSplitter.addEventListener("keydown", (event) => resizeByKeyboard("right", event));
toggleLeftPanelButton.addEventListener("click", () => togglePanel("left"));
toggleRightPanelButton.addEventListener("click", () => togglePanel("right"));
window.addEventListener("resize", () => applyLayout(layoutState));

applyLayout(layoutState, { persist: false });
renderApp();
void restoreLinkedDataFile();
