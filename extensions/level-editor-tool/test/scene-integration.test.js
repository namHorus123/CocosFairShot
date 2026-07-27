'use strict';

const assert = require('assert');
const Module = require('module');

class Node {
  constructor(name = '') {
    this.name = name;
    this.children = [];
    this.components = [];
    this.active = true;
    this._objFlags = 0;
    this.position = { x: 0, y: 0, z: 0 };
  }
  set parent(value) {
    if (this._parent) this._parent.children = this._parent.children.filter((child) => child !== this);
    this._parent = value;
    if (value) value.children.push(this);
  }
  get parent() { return this._parent; }
  getChildByName(name) { return this.children.find((child) => child.name === name) || null; }
  setPosition(x, y, z) { this.position = { x, y, z }; }
  setScale(x, y, z) { this.scale = { x, y, z }; }
  setRotationFromEuler(x, y, z) { this.rotation = { x, y, z }; }
  addComponent(Type) { const component = new Type(); this.components.push(component); return component; }
  _destroyImmediate() { this.destroyed = true; this.parent = null; }
}

class MeshRenderer {
  setMaterial(material, index) { this.material = material; this.materialIndex = index; }
}
class MockComponent {}
class Material { initialize(options) { this.options = options; } setProperty(name, value) { this[name] = value; } }
class Color { constructor(hex) { this.hex = hex; } }
class Prefab {
  constructor() { this.data = null; }
  initDefault() {
    this.data = new Node('(Missing Node)');
    this.data._prefab = { root: this.data, asset: this, fileId: '', instance: null };
  }
}

const sceneRoot = new Node('EditorMap');
const ccMock = {
  director: { getScene: () => sceneRoot },
  Node, MeshRenderer, Material, Color, Prefab,
  primitives: { box: (options) => options },
  utils: { createMesh: (geometry) => ({ geometry }) },
  assetManager: { loadAny: (request, callback) => callback(null, { prefab: true, name: `Dragged_${request}` }) },
  instantiate: () => {
    const instance = new Node('PrefabInstance');
    instance._prefab = { asset: { uuid: 'source' }, instance: {} };
    instance.addComponent(MockComponent).__prefab = { fileId: 'source-component' };
    const visual = new Node('VisualChild');
    visual._prefab = { asset: { uuid: 'source' } };
    visual.addComponent(MockComponent).__prefab = { fileId: 'visual-component' };
    visual.parent = instance;
    return instance;
  },
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'cc') return ccMock;
  return originalLoad.call(this, request, parent, isMain);
};

let serializedSnapshot;
global.EditorExtends = {
  serialize(prefab) {
    serializedSnapshot = {
      name: prefab.data.name,
      children: prefab.data.children.map((node) => ({
        name: node.name,
        position: node.position,
        rotation: node.rotation,
        prefab: node._prefab,
        componentPrefab: node.components[0]?.__prefab,
        childPrefab: node.children[0]?._prefab,
        childComponentPrefab: node.children[0]?.components[0]?.__prefab,
      })),
      rootPrefabInfo: prefab.data._prefab,
    };
    const objects = [
      { __type__: 'cc.Prefab', data: { __id__: 1 } },
      null,
    ];
    function serializeNode(node) {
      const id = objects.length;
      objects.push(null);
      const childRefs = node.children.map((child) => ({ __id__: serializeNode(child) }));
      const componentRefs = node.components.map(() => {
        const componentId = objects.length;
        objects.push({ __type__: 'MockComponent', __prefab: null });
        return { __id__: componentId };
      });
      const rotation = node.rotation || { x: 0, y: 0, z: 0 };
      objects[id] = {
        __type__: 'cc.Node', _name: node.name, _children: childRefs, _components: componentRefs,
        _prefab: null, _lpos: node.position, _lrot: rotation, _euler: rotation,
      };
      return id;
    }
    const rootChildren = prefab.data.children.map((child) => ({ __id__: serializeNode(child) }));
    const prefabInfoId = objects.length;
    objects.push({ __type__: 'cc.PrefabInfo', root: { __id__: 1 }, asset: { __id__: 0 }, instance: null });
    objects[1] = { __type__: 'cc.Node', _children: rootChildren, _components: [], _prefab: { __id__: prefabInfoId } };
    return JSON.stringify(objects);
  },
};

(async () => {
  const sceneScript = require('../dist/scene');
  const grids = [
    { width: 2, height: 1, visible: true },
    { width: 2, height: 1, visible: false },
    { width: 2, height: 1, visible: true },
  ];
  const multiLayerPiece = {
    id: 1, kind: 'cube3', prefabUuid: 'uuid-3', prefabUrl: 'db://assets/Cube_3.prefab',
    axis: 'X', angle: 90, anchor: { x: 0, y: 0, z: 0 },
  };

  assert.strictEqual(sceneScript.methods.syncPreview({ grids, pieces: [multiLayerPiece] }), true);
  const preview = sceneRoot.getChildByName('__LevelEditorPreview');
  assert.ok(preview, 'preview root is created');
  assert.strictEqual(preview._objFlags & 24, 24, 'preview is DontSave and EditorOnly');
  assert.strictEqual(preview.getChildByName('Grid_2').active, false, 'hidden grid root is inactive');
  assert.strictEqual(preview.getChildByName('Grid_1').children.length, 3, 'visible piece segment is on Grid 1');
  assert.strictEqual(preview.getChildByName('Grid_2').children.length, 3, 'hidden layer keeps only its own segment');
  assert.strictEqual(preview.getChildByName('Grid_3').children.length, 3, 'visible piece segment is on Grid 3');
  sceneScript.methods.syncPreview({ grids, pieces: [multiLayerPiece], focusLayer: 2 });
  const focusedPreview = sceneRoot.getChildByName('__LevelEditorPreview');
  assert.strictEqual(focusedPreview.getChildByName('Grid_1').active, false, 'focus mode isolates other visible layers');
  assert.strictEqual(focusedPreview.getChildByName('Grid_3').active, true, 'focus mode keeps selected layer visible');

  const result = await sceneScript.methods.serializeLevel({
    pieces: [{ ...multiLayerPiece, anchor: { x: 2, y: 1, z: 1 } }],
  });
  assert.ok(JSON.parse(result).some((object) => object?.__type__ === 'cc.PrefabInfo'));
  assert.deepStrictEqual(serializedSnapshot.children[0].position, { x: 2, y: 1, z: 1 });
  assert.deepStrictEqual(serializedSnapshot.children[0].rotation, { x: 90, y: 0, z: 0 });
  assert.ok(serializedSnapshot.rootPrefabInfo, 'generated root has cc.PrefabInfo');
  assert.strictEqual(serializedSnapshot.rootPrefabInfo.root.name, 'Level_001');
  assert.strictEqual(serializedSnapshot.rootPrefabInfo.fileId, 'levelEditorRoot001');
  assert.strictEqual(serializedSnapshot.children[0].prefab, null, 'source PrefabInfo is removed from Piece root');
  assert.strictEqual(serializedSnapshot.children[0].componentPrefab, null, 'source CompPrefabInfo is removed');
  assert.strictEqual(serializedSnapshot.children[0].childPrefab, null, 'source PrefabInfo is removed recursively');
  assert.strictEqual(serializedSnapshot.children[0].childComponentPrefab, null, 'source CompPrefabInfo is removed recursively');

  const allKinds = [
    { id: 11, kind: 'cube1', prefabUuid: 'u1', prefabUrl: 'p1', axis: 'Z', angle: 0, anchor: { x: 0, y: 0, z: 0 } },
    { id: 12, kind: 'cube3', prefabUuid: 'u3', prefabUrl: 'p3', axis: 'X', angle: 90, anchor: { x: 1, y: 1, z: 1 } },
    { id: 13, kind: 'cube4', prefabUuid: 'u4', prefabUrl: 'p4', axis: 'Z', angle: -90, anchor: { x: 2, y: 2, z: 2 } },
    { id: 14, kind: 'cube5', prefabUuid: 'u5', prefabUrl: 'p5', axis: 'Z', angle: 180, anchor: { x: 3, y: 3, z: 3 } },
    { id: 15, kind: 'special', prefabUuid: 'us', prefabUrl: 'ps', axis: 'Z', angle: 0, anchor: { x: 4, y: 4, z: 4 } },
  ];
  const allKindsResult = JSON.parse(await sceneScript.methods.serializeLevel({ pieces: allKinds }));
  const allKindsRoot = allKindsResult[allKindsResult[0].data.__id__];
  assert.strictEqual(allKindsRoot._children.length, 5, 'all five placed Piece types are serialized');
  assert.deepStrictEqual(
    allKindsRoot._children.map((ref) => allKindsResult[ref.__id__]._name),
    ['Dragged_u1_11', 'Dragged_u3_12', 'Dragged_u4_13', 'Dragged_u5_14', 'Dragged_us_15'],
  );
  assert.ok(allKindsRoot._children.every((ref) => allKindsResult[ref.__id__]._children.length === 1));
  assert.ok(allKindsRoot._children.every((ref) => allKindsResult[ref.__id__]._components.length === 1));
  const validSerialize = global.EditorExtends.serialize;
  global.EditorExtends.serialize = () => JSON.stringify([
    { __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _prefab: null },
  ]);
  await assert.rejects(
    () => sceneScript.methods.serializeLevel({ pieces: [multiLayerPiece] }),
    /Prefab root thiếu cc\.PrefabInfo/,
  );
  global.EditorExtends.serialize = validSerialize;
  assert.strictEqual(sceneScript.methods.clearPreview(), true);
  assert.strictEqual(sceneRoot.getChildByName('__LevelEditorPreview'), null);

  Module._load = originalLoad;
  console.log('Level Editor scene integration: 25 checks passed.');
})().catch((error) => {
  Module._load = originalLoad;
  console.error(error);
  process.exitCode = 1;
});
