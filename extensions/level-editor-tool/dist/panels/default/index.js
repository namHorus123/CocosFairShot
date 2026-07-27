"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const model_1 = require("../../model");
const PACKAGE_NAME = 'level-editor-tool';
const KINDS = Object.keys(model_1.PIECE_CONFIG);
const template = /* html */ `
<div class="app">
  <header>
    <div><b>3D LEVEL EDITOR</b><small>Cocos Creator 3.8.4 · Editor only</small></div>
    <button id="demo">Level mẫu</button>
  </header>

  <section class="card grid-create">
    <label>Width <ui-num-input id="width" value="5" min="1" max="50" step="1"></ui-num-input></label>
    <label>Height <ui-num-input id="height" value="5" min="1" max="50" step="1"></ui-num-input></label>
    <button id="create-grid" class="primary">Create Grid</button>
  </section>

  <section class="card">
    <h3>1. Prefab Pieces</h3>
    <div id="prefabs" class="prefabs"></div>
  </section>

  <section class="card controls">
    <h3>2. Placement</h3>
    <div class="row">
      <label>Axis
        <select id="axis"><option value="Z">Z (trong Grid)</option><option value="X">X (qua Layer)</option></select>
      </label>
      <label>Angle
        <select id="angle"><option>0</option><option>90</option><option>180</option><option>-90</option><option>-180</option></select>
      </label>
    </div>
    <div class="row actions">
      <button id="rotate">Rotate selected</button>
      <button id="delete" class="danger">Delete selected</button>
      <button id="clear">Clear level</button>
    </div>
    <p id="selection" class="hint">Chọn Piece rồi click một Cell để đặt. Right-click Piece để xóa.</p>
  </section>

  <section class="card workspace">
    <div class="workspace-head">
      <h3>3. Grids</h3>
      <div class="view-tools">
        <select id="focus-grid" title="Grid đang thao tác"></select>
        <button id="view-mode" title="Đổi giữa xem tất cả và cô lập một Grid">View: 1 Grid</button>
        <button id="delete-grid" class="danger" title="Xóa Grid đang chọn">Delete Grid</button>
      </div>
    </div>
    <div id="grid-buttons" class="grid-buttons"></div>
    <div id="grids" class="grids empty">Chưa có Grid. Nhập Width/Height rồi bấm Create Grid.</div>
  </section>

  <section class="footer">
    <div id="status" class="status">Sẵn sàng.</div>
    <button id="generate" class="generate">Generate Prefab</button>
  </section>
</div>`;
const style = /* css */ `
:host { color: var(--color-normal-contrast-weakest); font-family: Arial, sans-serif; }
* { box-sizing: border-box; }
.app { padding: 12px; min-width: 400px; }
header, .row, .workspace-head, .footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
header { margin-bottom: 10px; }
header b { display: block; color: #fff; letter-spacing: .6px; }
header small { color: #9aa4b2; }
button { border: 1px solid #555d68; border-radius: 4px; background: #353b45; color: #e5e7eb; padding: 6px 10px; cursor: pointer; }
button:hover { filter: brightness(1.17); }
button:disabled { opacity: .4; cursor: default; }
.primary, .generate { background: #1677ff; border-color: #4096ff; }
.danger { color: #ff9c9c; }
.card { background: #282d35; border: 1px solid #414853; border-radius: 6px; padding: 10px; margin-bottom: 9px; }
.card h3 { font-size: 12px; margin: 0 0 9px; color: #cbd5e1; text-transform: uppercase; }
.grid-create { display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; align-items: end; }
label { display: grid; gap: 4px; font-size: 11px; color: #aeb7c4; }
select { height: 28px; color: #eee; background: #20242b; border: 1px solid #515966; border-radius: 3px; padding: 0 6px; }
.prefabs { display: grid; grid-template-columns: repeat(5, minmax(64px, 1fr)); gap: 6px; }
.piece-option { border: 2px solid transparent; border-radius: 5px; padding: 5px; background: #20242b; cursor: pointer; min-width: 0; }
.piece-option.selected { border-color: #66a6ff; background: #263951; }
.piece-option strong { display: block; font-size: 11px; margin-bottom: 5px; white-space: nowrap; }
.piece-option ui-asset { width: 100%; }
.drag-piece { margin-top: 5px; padding: 5px 3px; border: 1px dashed #667181; border-radius: 3px; color: #b8c4d3; text-align: center; font-size: 10px; cursor: grab; user-select: none; }
.drag-piece:hover { border-color: #8cbcff; color: white; background: #2d3d52; }
.drag-piece:active { cursor: grabbing; }
.swatch { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 4px; }
.controls .row { justify-content: flex-start; margin-bottom: 8px; }
.controls label { min-width: 145px; }
.actions { flex-wrap: wrap; }
.hint { margin: 5px 0 0; color: #929cab; font-size: 11px; }
.workspace { overflow: auto; max-height: 480px; }
.workspace-head { position: sticky; top: -10px; background: #282d35; z-index: 2; padding: 2px 0 8px; flex-wrap: wrap; }
.workspace-head h3 { margin: 0; }
.view-tools, .grid-buttons { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.view-tools select { height: 27px; min-width: 55px; }
.grid-buttons { padding-bottom: 8px; border-bottom: 1px solid #3c434d; margin-bottom: 8px; }
.grid-toggle { padding: 3px 7px; font-size: 10px; background: #2e6b45; border-color: #44935f; }
.grid-toggle.hidden { background: #3b3f46; color: #7d8794; text-decoration: line-through; }
.grids.empty { color: #8993a0; padding: 24px; text-align: center; }
.grid-panel { margin-bottom: 12px; }
.grid-title { font-size: 11px; color: #aeb7c4; margin-bottom: 5px; }
.grid { display: grid; gap: 3px; width: max-content; padding: 6px; background: #11151a; border: 2px solid var(--layer-color, #4a515c); box-shadow: 0 5px 14px #0008; }
.cell { width: 36px; height: 36px; border: 1px solid #66717f; background: #303741; color: #8f9aa8; font-size: 9px; display: grid; place-items: center; cursor: crosshair; border-radius: 2px; }
.cell.checker { background: #39414d; }
.cell:hover { border-color: #dbeafe; filter: brightness(1.15); }
.cell.drag-over { border: 2px solid white; background: #47617e; }
.cell.selected-piece { outline: 2px solid white; outline-offset: -3px; }
.cell.anchor::after { content: 'A'; font-weight: bold; text-shadow: 0 1px 2px #000; }
.footer { position: sticky; bottom: 0; background: #1f2329; padding-top: 7px; }
.status { flex: 1; min-height: 30px; font-size: 11px; color: #9fb0c4; }
.status.error { color: #ff8f8f; }
.status.ok { color: #6ee7a8; }
.generate { font-weight: bold; padding: 8px 14px; }
`;
function valueOf(element) {
    return Math.max(1, Math.floor(Number(element.value) || 1));
}
function currentAxis(panel) {
    return panel.$.axis.value === 'X' ? 'X' : 'Z';
}
function currentAngle(panel) {
    return Number(panel.$.angle.value);
}
function selectedPiece(panel) {
    return panel.pieces.find((piece) => piece.id === panel.selectedPieceId);
}
function createDemo(panel) {
    panel.grids = [0, 1, 2].map(() => ({ width: 5, height: 5, visible: true }));
    const ref = (kind) => panel.prefabRefs[kind] || { uuid: '', url: '' };
    panel.pieces = [
        Object.assign(Object.assign({ id: 1, kind: 'cube3' }, { prefabUuid: ref('cube3').uuid, prefabUrl: ref('cube3').url }), { axis: 'Z', angle: 0, anchor: { x: 0, y: 1, z: 0 } }),
        Object.assign(Object.assign({ id: 2, kind: 'cube4' }, { prefabUuid: ref('cube4').uuid, prefabUrl: ref('cube4').url }), { axis: 'Z', angle: 0, anchor: { x: 1, y: 1, z: 0 } }),
        Object.assign(Object.assign({ id: 3, kind: 'cube3' }, { prefabUuid: ref('cube3').uuid, prefabUrl: ref('cube3').url }), { axis: 'X', angle: 90, anchor: { x: 4, y: 4, z: 1 } }),
        Object.assign(Object.assign({ id: 4, kind: 'cube1' }, { prefabUuid: ref('cube1').uuid, prefabUrl: ref('cube1').url }), { axis: 'Z', angle: 0, anchor: { x: 2, y: 2, z: 1 } }),
        Object.assign(Object.assign({ id: 5, kind: 'special' }, { prefabUuid: ref('special').uuid, prefabUrl: ref('special').url }), { axis: 'Z', angle: 0, anchor: { x: 0, y: 4, z: 2 } }),
    ];
    panel.selectedPieceId = null;
    panel.focusedLayer = 0;
    panel.setStatus('Đã tạo level mẫu 5×5 với 3 Layer.', 'ok');
    panel.render();
}
module.exports = Editor.Panel.define({
    template,
    style,
    $: {
        width: '#width', height: '#height', createGrid: '#create-grid', prefabs: '#prefabs',
        axis: '#axis', angle: '#angle', rotate: '#rotate', delete: '#delete', clear: '#clear',
        selection: '#selection', gridButtons: '#grid-buttons', grids: '#grids', status: '#status',
        focusGrid: '#focus-grid', viewMode: '#view-mode', deleteGrid: '#delete-grid',
        generate: '#generate', demo: '#demo',
    },
    methods: {
        setStatus(message, type) {
            this.$.status.textContent = message;
            this.$.status.className = `status ${type || ''}`;
        },
        syncPreview() {
            window.clearTimeout(this.syncTimer);
            this.syncTimer = window.setTimeout(async () => {
                try {
                    await Editor.Message.request('scene', 'execute-scene-script', {
                        name: PACKAGE_NAME,
                        method: 'syncPreview',
                        args: [{
                                grids: this.grids,
                                pieces: this.pieces,
                                focusLayer: this.viewMode === 'focus' ? this.focusedLayer : null,
                            }],
                    });
                }
                catch (error) {
                    this.setStatus(`Scene preview: ${error.message}`, 'error');
                }
            }, 30);
        },
        place(kind, anchor) {
            const ref = this.prefabRefs[kind];
            if (!(ref === null || ref === void 0 ? void 0 : ref.uuid)) {
                this.setStatus(`Hãy kéo ${model_1.PIECE_CONFIG[kind].label} Prefab vào ô tương ứng trước.`, 'error');
                return;
            }
            const rotatable = model_1.PIECE_CONFIG[kind].rotatable;
            const piece = {
                id: (0, model_1.nextPieceId)(this.pieces), kind, prefabUuid: ref.uuid, prefabUrl: ref.url,
                axis: rotatable ? currentAxis(this) : 'Z', angle: rotatable ? currentAngle(this) : 0, anchor,
            };
            const error = (0, model_1.validatePiece)(piece, this.grids, this.pieces);
            if (error)
                return this.setStatus(error, 'error');
            this.pieces.push(piece);
            this.selectedPieceId = piece.id;
            this.setStatus(`Đã đặt ${model_1.PIECE_CONFIG[kind].label} tại (${anchor.x}, ${anchor.y}, ${anchor.z}).`, 'ok');
            this.render();
        },
        loadDemo() { createDemo(this); },
        render() {
            this.$.createGrid.textContent = this.grids.length ? 'Create New Grid' : 'Create Grid';
            this.focusedLayer = Math.min(Math.max(this.focusedLayer, 0), Math.max(this.grids.length - 1, 0));
            this.$.focusGrid.innerHTML = this.grids.map((_, index) => `<option value="${index}">G${index + 1}</option>`).join('');
            this.$.focusGrid.value = String(this.focusedLayer);
            this.$.focusGrid.disabled = !this.grids.length;
            this.$.viewMode.disabled = !this.grids.length;
            this.$.deleteGrid.disabled = !this.grids.length;
            this.$.viewMode.textContent = this.viewMode === 'focus' ? 'View: 1 Grid' : 'View: All';
            this.$.gridButtons.innerHTML = '';
            if (this.grids.length > 1) {
                this.grids.forEach((grid, index) => {
                    const button = document.createElement('button');
                    button.className = `grid-toggle ${grid.visible ? '' : 'hidden'}`;
                    button.textContent = `G${index + 1}`;
                    button.title = grid.visible ? `Ẩn và khóa G${index + 1}` : `Hiện và mở khóa G${index + 1}`;
                    button.onclick = () => { grid.visible = !grid.visible; this.render(); };
                    this.$.gridButtons.appendChild(button);
                });
            }
            this.$.grids.innerHTML = '';
            this.$.grids.className = this.grids.length ? 'grids' : 'grids empty';
            if (!this.grids.length)
                this.$.grids.textContent = 'Chưa có Grid. Nhập Width/Height rồi bấm Create Grid.';
            this.grids.forEach((grid, layer) => {
                if (!grid.visible || (this.viewMode === 'focus' && layer !== this.focusedLayer))
                    return;
                const panel = document.createElement('div');
                panel.className = 'grid-panel';
                const title = document.createElement('div');
                title.className = 'grid-title';
                title.textContent = `G${layer + 1} · ${grid.width}×${grid.height} · Z=${layer}`;
                panel.appendChild(title);
                const board = document.createElement('div');
                board.className = 'grid';
                board.style.gridTemplateColumns = `repeat(${grid.width}, 36px)`;
                board.style.setProperty('--layer-color', ['#5f8fc7', '#72a06e', '#b4779b', '#9479bd', '#b49362'][layer % 5]);
                for (let y = grid.height - 1; y >= 0; y -= 1) {
                    for (let x = 0; x < grid.width; x += 1) {
                        const cell = { x, y, z: layer };
                        const piece = (0, model_1.findPieceAt)(this.pieces, cell);
                        const element = document.createElement('button');
                        element.className = `cell ${(x + y) % 2 ? 'checker' : ''}`;
                        element.title = `(${x}, ${y}, ${layer})`;
                        if (piece) {
                            element.style.background = model_1.PIECE_CONFIG[piece.kind].color;
                            if (piece.id === this.selectedPieceId)
                                element.classList.add('selected-piece');
                            if (piece.anchor.x === x && piece.anchor.y === y && piece.anchor.z === layer)
                                element.classList.add('anchor');
                        }
                        if (!piece)
                            element.textContent = `${x},${y}`;
                        element.onclick = () => {
                            if (piece) {
                                this.selectedPieceId = piece.id;
                                this.render();
                            }
                            else
                                this.place(this.selectedKind, cell);
                        };
                        element.oncontextmenu = (event) => {
                            event.preventDefault();
                            if (piece) {
                                this.pieces = this.pieces.filter((item) => item.id !== piece.id);
                                this.selectedPieceId = null;
                                this.render();
                            }
                        };
                        element.ondragover = (event) => {
                            event.preventDefault();
                            element.classList.add('drag-over');
                        };
                        element.ondragleave = () => element.classList.remove('drag-over');
                        element.ondrop = (event) => {
                            var _a;
                            event.preventDefault();
                            element.classList.remove('drag-over');
                            const draggedKind = (_a = event.dataTransfer) === null || _a === void 0 ? void 0 : _a.getData('application/x-level-piece');
                            if (!KINDS.includes(draggedKind))
                                return this.setStatus('Chỉ kéo Piece từ thanh Prefab của tool vào Grid.', 'error');
                            if (piece)
                                return this.setStatus(`Cell (${x}, ${y}, ${layer}) đã có Piece.`, 'error');
                            this.selectedKind = draggedKind;
                            this.place(draggedKind, cell);
                        };
                        board.appendChild(element);
                    }
                }
                panel.appendChild(board);
                this.$.grids.appendChild(panel);
            });
            const selected = selectedPiece(this);
            this.$.selection.textContent = selected
                ? `${model_1.PIECE_CONFIG[selected.kind].label} #${selected.id} · Anchor (${selected.anchor.x}, ${selected.anchor.y}, ${selected.anchor.z}) · ${selected.axis} ${selected.angle}°`
                : `Đang chọn ${model_1.PIECE_CONFIG[this.selectedKind].label}. Click Cell để đặt; click Piece để chọn.`;
            this.$.rotate.disabled = !selected || !model_1.PIECE_CONFIG[selected.kind].rotatable;
            this.$.delete.disabled = !selected;
            this.syncPreview();
        },
    },
    ready() {
        this.grids = [];
        this.pieces = [];
        this.prefabRefs = {};
        this.selectedKind = 'cube1';
        this.selectedPieceId = null;
        this.viewMode = 'focus';
        this.focusedLayer = 0;
        for (const kind of KINDS) {
            this.prefabRefs[kind] = { uuid: '', url: '' };
            const option = document.createElement('div');
            option.className = `piece-option ${kind === this.selectedKind ? 'selected' : ''}`;
            option.dataset.kind = kind;
            option.innerHTML = `<strong><span class="swatch" style="background:${model_1.PIECE_CONFIG[kind].color}"></span>${model_1.PIECE_CONFIG[kind].label}</strong>`;
            const asset = document.createElement('ui-asset');
            asset.setAttribute('droppable', 'cc.Prefab');
            asset.addEventListener('confirm', async (event) => {
                const uuid = String(event.target.value || '');
                let url = '';
                if (uuid) {
                    const info = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
                    url = (info === null || info === void 0 ? void 0 : info.url) || '';
                    if (!url.toLowerCase().endsWith('.prefab')) {
                        asset.value = '';
                        return this.setStatus('Chỉ chấp nhận cc.Prefab.', 'error');
                    }
                }
                this.prefabRefs[kind] = { uuid, url };
                this.pieces.filter((piece) => piece.kind === kind).forEach((piece) => {
                    piece.prefabUuid = uuid;
                    piece.prefabUrl = url;
                });
                this.setStatus(uuid ? `Đã gán ${model_1.PIECE_CONFIG[kind].label}.` : `Đã bỏ gán ${model_1.PIECE_CONFIG[kind].label}.`, 'ok');
            });
            option.appendChild(asset);
            const dragPiece = document.createElement('div');
            dragPiece.className = 'drag-piece';
            dragPiece.draggable = true;
            dragPiece.textContent = '↕ Kéo vào Grid';
            dragPiece.addEventListener('dragstart', (event) => {
                var _a, _b;
                this.selectedKind = kind;
                (_a = event.dataTransfer) === null || _a === void 0 ? void 0 : _a.setData('application/x-level-piece', kind);
                (_b = event.dataTransfer) === null || _b === void 0 ? void 0 : _b.setData('text/plain', kind);
                if (event.dataTransfer)
                    event.dataTransfer.effectAllowed = 'copy';
            });
            option.appendChild(dragPiece);
            option.addEventListener('click', (event) => {
                if (event.target.tagName.toLowerCase() === 'ui-asset')
                    return;
                this.selectedKind = kind;
                this.$.prefabs.querySelectorAll('.piece-option').forEach((el) => el.classList.toggle('selected', el.dataset.kind === kind));
                this.render();
            });
            this.$.prefabs.appendChild(option);
        }
        this.$.createGrid.onclick = () => {
            this.grids.push({ width: valueOf(this.$.width), height: valueOf(this.$.height), visible: true });
            this.focusedLayer = this.grids.length - 1;
            this.setStatus(`Đã tạo G${this.grids.length}, Z=${this.grids.length - 1}.`, 'ok');
            this.render();
        };
        this.$.focusGrid.onchange = () => {
            this.focusedLayer = Number(this.$.focusGrid.value) || 0;
            this.render();
        };
        this.$.viewMode.onclick = () => {
            this.viewMode = this.viewMode === 'focus' ? 'all' : 'focus';
            this.render();
        };
        this.$.deleteGrid.onclick = () => {
            if (!this.grids.length)
                return;
            const layer = this.focusedLayer;
            const impacted = this.pieces.filter((piece) => (0, model_1.occupiedCells)(piece).some((cell) => cell.z === layer));
            const warning = impacted.length
                ? `G${layer + 1} có ${impacted.length} Piece liên quan. Xóa Grid sẽ xóa toàn bộ các Piece đó và dồn Layer phía sau xuống. Tiếp tục?`
                : `Xóa G${layer + 1} và dồn Layer phía sau xuống?`;
            if (!window.confirm(warning))
                return;
            const result = (0, model_1.removeGrid)(this.grids, this.pieces, layer);
            this.grids = result.grids;
            this.pieces = result.pieces;
            this.focusedLayer = Math.min(layer, Math.max(this.grids.length - 1, 0));
            this.selectedPieceId = null;
            this.setStatus(`Đã xóa G${layer + 1}${result.removedPieceCount ? ` và ${result.removedPieceCount} Piece liên quan` : ''}.`, 'ok');
            this.render();
        };
        this.$.demo.onclick = () => this.loadDemo();
        this.$.delete.onclick = () => {
            if (this.selectedPieceId === null)
                return;
            this.pieces = this.pieces.filter((piece) => piece.id !== this.selectedPieceId);
            this.selectedPieceId = null;
            this.setStatus('Đã xóa Piece.', 'ok');
            this.render();
        };
        this.$.rotate.onclick = () => {
            const piece = selectedPiece(this);
            if (!piece || !model_1.PIECE_CONFIG[piece.kind].rotatable)
                return;
            const candidate = Object.assign(Object.assign({}, piece), { axis: currentAxis(this), angle: currentAngle(this) });
            const error = (0, model_1.validatePiece)(candidate, this.grids, this.pieces, piece.id);
            if (error)
                return this.setStatus(error, 'error');
            piece.axis = candidate.axis;
            piece.angle = candidate.angle;
            this.setStatus(`Đã rotate ${model_1.PIECE_CONFIG[piece.kind].label}: ${piece.axis} ${piece.angle}°.`, 'ok');
            this.render();
        };
        this.$.clear.onclick = () => {
            this.pieces = [];
            this.selectedPieceId = null;
            this.setStatus('Đã xóa toàn bộ Piece; Grid được giữ nguyên.', 'ok');
            this.render();
        };
        this.$.generate.onclick = async () => {
            try {
                if (!this.pieces.length)
                    throw new Error('Level chưa có Piece nào.');
                for (const piece of this.pieces) {
                    const error = (0, model_1.validatePiece)(piece, this.grids, this.pieces, piece.id);
                    if (error)
                        throw new Error(error);
                    if (!piece.prefabUuid)
                        throw new Error(`${model_1.PIECE_CONFIG[piece.kind].label} chưa được gán Prefab.`);
                }
                this.$.generate.disabled = true;
                this.setStatus('Đang instantiate và serialize Prefab...');
                const serialized = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: PACKAGE_NAME, method: 'serializeLevel', args: [{ pieces: this.pieces }],
                });
                const url = await Editor.Message.request(PACKAGE_NAME, 'save-prefab', serialized);
                this.setStatus(`Đã generate ${url}`, 'ok');
                Editor.Message.send('asset-db', 'open-asset', url);
            }
            catch (error) {
                this.setStatus(error.message, 'error');
            }
            finally {
                this.$.generate.disabled = false;
            }
        };
        // Show a complete multi-layer example immediately; assigning the five prefab
        // slots upgrades these preview pieces into a level that can be generated.
        this.loadDemo();
    },
    beforeClose() { },
    close() {
        window.clearTimeout(this.syncTimer);
        Editor.Message.request('scene', 'execute-scene-script', {
            name: PACKAGE_NAME, method: 'clearPreview', args: [],
        }).catch(() => undefined);
    },
});
