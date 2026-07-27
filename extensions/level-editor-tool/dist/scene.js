"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = exports.unload = exports.load = void 0;
const model_1 = require("./model");
const PREVIEW_ROOT = '__LevelEditorPreview';
function load() { }
exports.load = load;
function unload() { }
exports.unload = unload;
function cc() {
    return require('cc');
}
function getScene() {
    return cc().director.getScene();
}
function destroyPreview() {
    var _a;
    const root = (_a = getScene()) === null || _a === void 0 ? void 0 : _a.getChildByName(PREVIEW_ROOT);
    if (root)
        root._destroyImmediate();
}
function makeMaterial(hex) {
    const { Material, Color } = cc();
    const material = new Material();
    material.initialize({ effectName: 'builtin-unlit', defines: { USE_COLOR: true } });
    material.setProperty('mainColor', new Color(hex));
    return material;
}
function makeBox(name, parent, position, scale, material) {
    const { Node, MeshRenderer, primitives, utils } = cc();
    const node = new Node(name);
    node.parent = parent;
    node.setPosition(position.x, position.y, position.z);
    node.setScale(scale.x, scale.y, scale.z);
    const renderer = node.addComponent(MeshRenderer);
    renderer.mesh = utils.createMesh(primitives.box({ width: 1, height: 1, length: 1 }));
    renderer.setMaterial(material, 0);
    return node;
}
function buildPreview(grids, pieces, focusLayer = null) {
    const { Node } = cc();
    const scene = getScene();
    if (!scene)
        throw new Error('Không có Scene đang mở. Hãy mở EditorMap.scene.');
    destroyPreview();
    const root = new Node(PREVIEW_ROOT);
    root.parent = scene;
    root._objFlags |= 24; // DontSave | EditorOnly: visible in Editor, never written to the scene/runtime build.
    const gridColors = ['#415a77', '#4f654d', '#684d60', '#594c72', '#6a5b43'];
    const gridMaterials = gridColors.map(makeMaterial);
    const materials = {};
    for (const key of Object.keys(model_1.PIECE_CONFIG)) {
        materials[key] = makeMaterial(model_1.PIECE_CONFIG[key].color);
    }
    grids.forEach((grid, layer) => {
        const layerRoot = new Node(`Grid_${layer + 1}`);
        layerRoot.parent = root;
        layerRoot.active = grid.visible && (focusLayer === null || focusLayer === layer);
        for (let x = 0; x < grid.width; x += 1) {
            for (let y = 0; y < grid.height; y += 1) {
                makeBox(`Cell_${x}_${y}_${layer}`, layerRoot, { x, y, z: layer }, { x: 0.91, y: 0.91, z: 0.025 }, gridMaterials[layer % gridMaterials.length]);
            }
        }
    });
    for (const piece of pieces) {
        for (const cell of (0, model_1.occupiedCells)(piece)) {
            const layerRoot = root.getChildByName(`Grid_${cell.z + 1}`);
            if (!layerRoot)
                continue;
            makeBox(`Piece_${piece.id}_${cell.x}_${cell.y}_${cell.z}`, layerRoot, { x: cell.x, y: cell.y, z: cell.z + 0.04 }, { x: 0.82, y: 0.82, z: 0.07 }, materials[piece.kind]);
        }
    }
}
function loadPrefab(uuid) {
    const { assetManager } = cc();
    return new Promise((resolve, reject) => {
        assetManager.loadAny(uuid, (error, asset) => {
            if (error)
                reject(error);
            else
                resolve(asset);
        });
    });
}
// Turn an instantiated Prefab into ordinary nodes before it is nested inside
// the generated level. Otherwise EditorExtends serializes only a tiny nested-
// prefab stub and loses our position/rotation overrides.
function bakePrefabTree(node, stats) {
    stats.nodes += 1;
    stats.components += node.components.length;
    node._prefab = null;
    for (const component of node.components)
        component.__prefab = null;
    for (const child of node.children)
        bakePrefabTree(child, stats);
}
function countSerializedTree(objects, nodeId, visited = new Set()) {
    if (visited.has(nodeId))
        return { nodes: 0, components: 0 };
    visited.add(nodeId);
    const node = objects[nodeId];
    if (!node || node.__type__ !== 'cc.Node')
        return { nodes: 0, components: 0 };
    const result = { nodes: 1, components: Array.isArray(node._components) ? node._components.length : 0 };
    for (const childRef of node._children || []) {
        const child = countSerializedTree(objects, childRef.__id__, visited);
        result.nodes += child.nodes;
        result.components += child.components;
    }
    return result;
}
function sameAngle(actual, expected) {
    const delta = ((actual - expected + 540) % 360) - 180;
    return Math.abs(delta) < 0.001;
}
async function serializeLevel(pieces) {
    var _a, _b, _c, _d, _e, _f, _g;
    const { Node, Prefab, instantiate } = cc();
    if (!pieces.length)
        throw new Error('Level chưa có Piece nào.');
    const root = new Node('Level_001');
    const bakedStats = { nodes: 0, components: 0 };
    const generatedNames = [];
    try {
        for (const piece of pieces) {
            if (!piece.prefabUuid)
                throw new Error(`${model_1.PIECE_CONFIG[piece.kind].label} chưa được gán Prefab.`);
            const prefabAsset = await loadPrefab(piece.prefabUuid);
            const node = instantiate(prefabAsset);
            if (!node)
                throw new Error(`Không instantiate được ${model_1.PIECE_CONFIG[piece.kind].label}.`);
            bakePrefabTree(node, bakedStats);
            const sourceName = String(prefabAsset.name || model_1.PIECE_CONFIG[piece.kind].label).trim();
            node.name = `${sourceName}_${piece.id}`;
            generatedNames.push(node.name);
            node.parent = root;
            node.setPosition(piece.anchor.x, piece.anchor.y, piece.anchor.z);
            if (model_1.PIECE_CONFIG[piece.kind].rotatable) {
                if (piece.axis === 'X')
                    node.setRotationFromEuler(piece.angle, 0, 0);
                else
                    node.setRotationFromEuler(0, 0, piece.angle);
            }
        }
        const prefab = new Prefab();
        // Cocos Prefab Editor requires the asset root to own a PrefabInfo that
        // points back to the asset. Assigning only prefab.data serializes a file
        // that can instantiate at runtime but crashes when opened in Prefab mode.
        prefab.initDefault();
        const rootPrefabInfo = prefab.data._prefab;
        prefab.data = root;
        prefab.name = 'Level_001';
        rootPrefabInfo.root = root;
        rootPrefabInfo.asset = prefab;
        rootPrefabInfo.fileId = 'levelEditorRoot001';
        root._prefab = rootPrefabInfo;
        const serialized = EditorExtends.serialize(prefab);
        // Fail before AssetDB writes anything if Creator's serialized root is not
        // a real prefab root. This prevents Generate Prefab from replacing a good
        // file with one that Prefab Editor cannot open.
        const objects = JSON.parse(serialized);
        const serializedRoot = objects[(_b = (_a = objects[0]) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.__id__];
        const serializedInfo = objects[(_c = serializedRoot === null || serializedRoot === void 0 ? void 0 : serializedRoot._prefab) === null || _c === void 0 ? void 0 : _c.__id__];
        const validRoot = (serializedInfo === null || serializedInfo === void 0 ? void 0 : serializedInfo.__type__) === 'cc.PrefabInfo'
            && ((_d = serializedInfo.root) === null || _d === void 0 ? void 0 : _d.__id__) === ((_f = (_e = objects[0]) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.__id__)
            && ((_g = serializedInfo.asset) === null || _g === void 0 ? void 0 : _g.__id__) === 0;
        if (!validRoot) {
            throw new Error('Generate bị chặn: Prefab root thiếu cc.PrefabInfo hợp lệ.');
        }
        if (!Array.isArray(serializedRoot._children) || serializedRoot._children.length !== pieces.length) {
            throw new Error('Generate bị chặn: số Piece trong Prefab không khớp level đang dựng.');
        }
        const serializedStats = { nodes: 0, components: 0 };
        serializedRoot._children.forEach((ref, index) => {
            const pieceNode = objects[ref.__id__];
            const piece = pieces[index];
            const expectedName = generatedNames[index];
            if ((pieceNode === null || pieceNode === void 0 ? void 0 : pieceNode._name) !== expectedName || pieceNode._prefab !== null) {
                throw new Error(`Generate bị chặn: Piece #${piece.id} vẫn là nested-prefab rỗng.`);
            }
            if (!(pieceNode === null || pieceNode === void 0 ? void 0 : pieceNode._lpos) || !(pieceNode === null || pieceNode === void 0 ? void 0 : pieceNode._lrot)
                || pieceNode._lpos.x !== piece.anchor.x
                || pieceNode._lpos.y !== piece.anchor.y
                || pieceNode._lpos.z !== piece.anchor.z) {
                throw new Error(`Generate bị chặn: Position Piece #${piece.id} bị sai khi serialize.`);
            }
            const expectedX = model_1.PIECE_CONFIG[piece.kind].rotatable && piece.axis === 'X' ? piece.angle : 0;
            const expectedZ = model_1.PIECE_CONFIG[piece.kind].rotatable && piece.axis === 'Z' ? piece.angle : 0;
            if (!pieceNode._euler
                || !sameAngle(pieceNode._euler.x, expectedX)
                || !sameAngle(pieceNode._euler.y, 0)
                || !sameAngle(pieceNode._euler.z, expectedZ)) {
                throw new Error(`Generate bị chặn: Rotation Piece #${piece.id} bị sai khi serialize.`);
            }
            const stats = countSerializedTree(objects, ref.__id__);
            serializedStats.nodes += stats.nodes;
            serializedStats.components += stats.components;
        });
        if (serializedStats.nodes !== bakedStats.nodes || serializedStats.components !== bakedStats.components) {
            throw new Error(`Generate bị chặn: hierarchy bị thiếu (Node ${serializedStats.nodes}/${bakedStats.nodes}, Component ${serializedStats.components}/${bakedStats.components}).`);
        }
        return serialized;
    }
    finally {
        root._destroyImmediate();
    }
}
exports.methods = {
    syncPreview(payload) {
        var _a;
        buildPreview(payload.grids, payload.pieces, (_a = payload.focusLayer) !== null && _a !== void 0 ? _a : null);
        return true;
    },
    clearPreview() {
        destroyPreview();
        return true;
    },
    async serializeLevel(payload) {
        return serializeLevel(payload.pieces);
    },
};
