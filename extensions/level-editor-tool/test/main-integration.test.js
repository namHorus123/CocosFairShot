'use strict';

const assert = require('assert');
const Module = require('module');

let mkdirCall;
let diskContent = '';
let assetExists = false;
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'fs') return {
    mkdirSync: (path, options) => { mkdirCall = { path, options }; },
    readFileSync: () => diskContent,
  };
  return originalLoad.call(this, request, parent, isMain);
};

const requests = [];
global.Editor = {
  Project: { path: 'C:\\FairShot_H' },
  Panel: { open: (name) => requests.push(['panel-open', name]) },
  Message: {
    request: async (...args) => {
      requests.push(args);
      if (args[0] === 'asset-db' && args[1] === 'query-asset-info') return assetExists ? { url: args[2] } : null;
      return true;
    },
  },
};

(async () => {
  const extension = require('../dist/main');
  extension.methods.openPanel();
  assert.deepStrictEqual(requests.shift(), ['panel-open', 'level-editor-tool']);

  diskContent = JSON.stringify([
    { __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _children: [{ __id__: 2 }], _prefab: { __id__: 3 } },
    { __type__: 'cc.Node', _name: 'Cube_1_1', _prefab: null, _lpos: {}, _lrot: {} },
    { __type__: 'cc.PrefabInfo', root: { __id__: 1 }, asset: { __id__: 0 }, instance: null },
  ]);
  const url = await extension.methods.savePrefab(diskContent);
  assert.strictEqual(url, 'db://assets/Levels/Level_001.prefab');
  assert.ok(mkdirCall.path.endsWith('assets\\Levels'));
  assert.strictEqual(mkdirCall.options.recursive, true);
  assert.deepStrictEqual(requests[0], ['asset-db', 'refresh-asset', 'db://assets/Levels']);
  assert.deepStrictEqual(requests[1], ['asset-db', 'query-asset-info', url]);
  assert.deepStrictEqual(requests[2], ['asset-db', 'create-asset', url, diskContent]);

  assetExists = true;
  const beforeOverwrite = requests.length;
  await extension.methods.savePrefab(diskContent);
  assert.ok(requests.slice(beforeOverwrite).some((request) => request[0] === 'asset-db' && request[1] === 'save-asset'));

  diskContent = JSON.stringify([
    { __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _children: [{ __id__: 2 }], _prefab: { __id__: 3 } },
    { __type__: 'cc.Node', _name: 'New Node', _prefab: { __id__: 4 } },
    { __type__: 'cc.PrefabInfo', root: { __id__: 1 }, asset: { __id__: 0 } },
    { __type__: 'cc.PrefabInfo', asset: { __uuid__: 'source' } },
  ]);
  await assert.rejects(() => extension.methods.savePrefab(diskContent), /Prefab không đầy đủ/);

  Module._load = originalLoad;
  console.log('Level Editor main integration: 10 checks passed.');
})().catch((error) => {
  Module._load = originalLoad;
  console.error(error);
  process.exitCode = 1;
});
