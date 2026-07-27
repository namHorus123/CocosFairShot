'use strict';

const assert = require('assert');
const { occupiedCells, piecePosition, validatePiece, findPieceAt, removeGrid } = require('../dist/model');

const grids = [0, 1, 2].map(() => ({ width: 5, height: 5, visible: true }));
const piece = (overrides = {}) => ({
  id: 1,
  kind: 'cube3',
  prefabUuid: 'prefab-uuid',
  prefabUrl: 'db://assets/Cube_3.prefab',
  axis: 'Z',
  angle: 0,
  anchor: { x: 1, y: 1, z: 0 },
  ...overrides,
});

assert.deepStrictEqual(occupiedCells(piece()), [
  { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 1, y: 2, z: 0 },
]);
assert.deepStrictEqual(occupiedCells(piece({ angle: 90 })), [
  { x: 2, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 0, y: 1, z: 0 },
]);
assert.deepStrictEqual(occupiedCells(piece({ angle: -90 })), [
  { x: 0, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 },
]);
assert.deepStrictEqual(occupiedCells(piece({ angle: 180 })), [
  { x: 1, y: 2, z: 0 }, { x: 1, y: 1, z: 0 }, { x: 1, y: 0, z: 0 },
]);
assert.deepStrictEqual(occupiedCells(piece({ axis: 'X', angle: 90 })), [
  { x: 1, y: 1, z: -1 }, { x: 1, y: 1, z: 0 }, { x: 1, y: 1, z: 1 },
]);
assert.deepStrictEqual(occupiedCells(piece({ axis: 'X', angle: -90, anchor: { x: 1, y: 1, z: 1 } })), [
  { x: 1, y: 1, z: 2 }, { x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 0 },
]);

const cube4 = piece({ kind: 'cube4', anchor: { x: 2, y: 1, z: 0 } });
assert.deepStrictEqual(occupiedCells(cube4), [
  { x: 2, y: 0, z: 0 }, { x: 2, y: 1, z: 0 },
  { x: 2, y: 2, z: 0 }, { x: 2, y: 3, z: 0 },
]);
assert.deepStrictEqual(piecePosition(cube4), { x: 2, y: 1.5, z: 0 });
assert.deepStrictEqual(piecePosition({ ...cube4, angle: -90 }), { x: 2.5, y: 1, z: 0 });

const cube5 = piece({ kind: 'cube5', anchor: { x: 2, y: 2, z: 0 } });
assert.deepStrictEqual(occupiedCells(cube5), [
  { x: 2, y: 0, z: 0 }, { x: 2, y: 1, z: 0 }, { x: 2, y: 2, z: 0 },
  { x: 2, y: 3, z: 0 }, { x: 2, y: 4, z: 0 },
]);
assert.deepStrictEqual(piecePosition(cube5), { x: 2, y: 2, z: 0 });

assert.strictEqual(validatePiece(piece(), grids, []), null);
assert.match(validatePiece(piece({ anchor: { x: 1, y: 4, z: 0 } }), grids, []), /vượt khỏi/);
assert.match(validatePiece(piece({ axis: 'X', angle: 90, anchor: { x: 1, y: 1, z: 2 } }), grids, []), /số layer/);

const existing = piece();
assert.match(validatePiece(piece({ id: 2, anchor: { x: 1, y: 3, z: 0 } }), grids, [existing]), /đã có Piece/);
assert.strictEqual(validatePiece({ ...existing, angle: -90 }, grids, [existing], existing.id), null);

const hiddenGrids = grids.map((grid, index) => ({ ...grid, visible: index !== 1 }));
assert.match(validatePiece(piece({ axis: 'X', angle: 90, anchor: { x: 1, y: 1, z: 1 } }), hiddenGrids, []), /đang ẩn/);
assert.strictEqual(findPieceAt([existing], { x: 1, y: 2, z: 0 }).id, 1);
assert.strictEqual(findPieceAt([existing], { x: 2, y: 1, z: 0 }), undefined);

const crossLayer = piece({ id: 7, axis: 'X', angle: 90, anchor: { x: 1, y: 1, z: 1 } });
const afterCrossLayerDelete = removeGrid(grids, [crossLayer], 1);
assert.strictEqual(afterCrossLayerDelete.grids.length, 2);
assert.strictEqual(afterCrossLayerDelete.pieces.length, 0);
assert.strictEqual(afterCrossLayerDelete.removedPieceCount, 1);

const pieceBehind = piece({ id: 8, kind: 'cube1', anchor: { x: 0, y: 0, z: 2 } });
const afterEmptyLayerDelete = removeGrid(grids, [pieceBehind], 1);
assert.deepStrictEqual(afterEmptyLayerDelete.pieces[0].anchor, { x: 0, y: 0, z: 1 });

console.log('Level Editor model: 24 checks passed.');
