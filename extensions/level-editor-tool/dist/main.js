"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = exports.unload = exports.load = void 0;
function load() {
    console.log('[Level Editor Tool] loaded');
}
exports.load = load;
function unload() { }
exports.unload = unload;
exports.methods = {
    openPanel() {
        Editor.Panel.open('level-editor-tool');
    },
    async savePrefab(serialized) {
        var _a, _b, _c;
        const { join } = require('path');
        const { mkdirSync, readFileSync } = require('fs');
        const levelsPath = join(Editor.Project.path, 'assets', 'Levels');
        mkdirSync(levelsPath, { recursive: true });
        const url = 'db://assets/Levels/Level_001.prefab';
        await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/Levels');
        const existing = await Editor.Message.request('asset-db', 'query-asset-info', url);
        if (existing)
            await Editor.Message.request('asset-db', 'save-asset', url, serialized);
        else
            await Editor.Message.request('asset-db', 'create-asset', url, serialized);
        // Verify the actual file written by AssetDB, not only the in-memory string.
        const savedObjects = JSON.parse(readFileSync(join(levelsPath, 'Level_001.prefab'), 'utf8'));
        const savedRoot = savedObjects[(_b = (_a = savedObjects[0]) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.__id__];
        const savedRootInfo = savedObjects[(_c = savedRoot === null || savedRoot === void 0 ? void 0 : savedRoot._prefab) === null || _c === void 0 ? void 0 : _c.__id__];
        const savedPieces = ((savedRoot === null || savedRoot === void 0 ? void 0 : savedRoot._children) || []).map((ref) => savedObjects[ref.__id__]);
        const validDiskFile = (savedRootInfo === null || savedRootInfo === void 0 ? void 0 : savedRootInfo.__type__) === 'cc.PrefabInfo'
            && savedPieces.length > 0
            && savedPieces.every((node) => (node === null || node === void 0 ? void 0 : node._name) && node._name !== 'New Node' && node._prefab === null && node._lpos && node._lrot);
        if (!validDiskFile) {
            throw new Error('AssetDB đã ghi Prefab không đầy đủ; file bị chặn và không được báo thành công.');
        }
        return url;
    },
};
