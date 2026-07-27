"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeGrid = exports.nextPieceId = exports.findPieceAt = exports.validatePiece = exports.cellKey = exports.occupiedCells = exports.normalizeAngle = exports.PIECE_CONFIG = void 0;
exports.PIECE_CONFIG = {
    cube1: { label: 'Cube_1', length: 1, color: '#2684ff', rotatable: false },
    cube3: { label: 'Cube_3', length: 3, color: '#36b37e', rotatable: true },
    cube4: { label: 'Cube_4', length: 4, color: '#ff66b3', rotatable: true },
    cube5: { label: 'Cube_5', length: 5, color: '#ff4d4f', rotatable: true },
    special: { label: 'Special', length: 1, color: '#ffc400', rotatable: false },
};
function normalizeAngle(angle) {
    if (angle === -180)
        return -180;
    const value = ((angle % 360) + 360) % 360;
    if (value === 90)
        return 90;
    if (value === 180)
        return 180;
    if (value === 270)
        return -90;
    return 0;
}
exports.normalizeAngle = normalizeAngle;
// Logical layout follows the requested tool behavior: Z rotates inside one grid,
// X turns a horizontal piece into the depth direction across grid layers.
function occupiedCells(piece) {
    const length = exports.PIECE_CONFIG[piece.kind].length;
    if (length === 1)
        return [Object.assign({}, piece.anchor)];
    const angle = normalizeAngle(piece.angle);
    let step = { x: 1, y: 0, z: 0 };
    if (piece.axis === 'Z') {
        if (angle === 90)
            step = { x: 0, y: 1, z: 0 };
        if (angle === 180 || angle === -180)
            step = { x: -1, y: 0, z: 0 };
        if (angle === -90)
            step = { x: 0, y: -1, z: 0 };
    }
    else {
        if (angle === 90)
            step = { x: 0, y: 0, z: 1 };
        if (angle === -90)
            step = { x: 0, y: 0, z: -1 };
        if (angle === 180 || angle === -180)
            step = { x: -1, y: 0, z: 0 };
    }
    return Array.from({ length }, (_, index) => ({
        x: piece.anchor.x + step.x * index,
        y: piece.anchor.y + step.y * index,
        z: piece.anchor.z + step.z * index,
    }));
}
exports.occupiedCells = occupiedCells;
function cellKey(cell) {
    return `${cell.x},${cell.y},${cell.z}`;
}
exports.cellKey = cellKey;
function validatePiece(piece, grids, pieces, ignorePieceId) {
    const occupied = new Set();
    for (const other of pieces) {
        if (other.id === ignorePieceId)
            continue;
        for (const cell of occupiedCells(other))
            occupied.add(cellKey(cell));
    }
    for (const cell of occupiedCells(piece)) {
        const grid = grids[cell.z];
        if (!grid)
            return `Piece vượt khỏi số layer tại Z=${cell.z}.`;
        if (!grid.visible)
            return `G${cell.z + 1} đang ẩn và bị khóa.`;
        if (cell.x < 0 || cell.y < 0 || cell.x >= grid.width || cell.y >= grid.height) {
            return `Piece vượt khỏi G${cell.z + 1} tại (${cell.x}, ${cell.y}).`;
        }
        if (occupied.has(cellKey(cell)))
            return `Cell (${cell.x}, ${cell.y}, ${cell.z}) đã có Piece.`;
    }
    return null;
}
exports.validatePiece = validatePiece;
function findPieceAt(pieces, cell) {
    const key = cellKey(cell);
    return pieces.find((piece) => occupiedCells(piece).some((occupied) => cellKey(occupied) === key));
}
exports.findPieceAt = findPieceAt;
function nextPieceId(pieces) {
    return pieces.reduce((max, piece) => Math.max(max, piece.id), 0) + 1;
}
exports.nextPieceId = nextPieceId;
function removeGrid(grids, pieces, layer) {
    if (layer < 0 || layer >= grids.length)
        return { grids: [...grids], pieces: [...pieces], removedPieceCount: 0 };
    const impactedIds = new Set(pieces
        .filter((piece) => occupiedCells(piece).some((cell) => cell.z === layer))
        .map((piece) => piece.id));
    const remainingPieces = pieces
        .filter((piece) => !impactedIds.has(piece.id))
        .map((piece) => piece.anchor.z > layer
        ? Object.assign(Object.assign({}, piece), { anchor: Object.assign(Object.assign({}, piece.anchor), { z: piece.anchor.z - 1 }) }) : piece);
    return {
        grids: grids.filter((_, index) => index !== layer),
        pieces: remainingPieces,
        removedPieceCount: impactedIds.size,
    };
}
exports.removeGrid = removeGrid;
