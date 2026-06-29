/* ═══════════════════════════════════════════════
   state.js - 全局共享状态
   ═══════════════════════════════════════════════ */

const MoCang = {
    files: [],
    groups: [],
    settingsData: null,
    ungroupedPosition: 0,
    activeFileId: null,
    activeFilePath: null,
    searchTimer: null,
    viewMode: "preview",
    isDragging: false,
    editorContent: "",
    editorDirty: false,
    autoSaveTimer: null,
    editingAliasId: null,
    collapsedGroups: new Set(),
    AUTO_SAVE_INTERVAL: 60000,
};
