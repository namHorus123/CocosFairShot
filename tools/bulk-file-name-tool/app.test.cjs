const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function element() {
  return {
    value: '',
    disabled: false,
    files: [],
    className: '',
    textContent: '',
    innerHTML: '',
    classList: { add() {}, remove() {} },
    addEventListener() {},
    click() {},
  };
}

const selectors = Object.fromEntries([
  '#dropZone', '#fileInput', '#fileInfo', '#suffixes', '#separator', '#position',
  '#preview', '#counter', '#saveFolder', '#downloadZip', '#status',
].map((selector) => [selector, element()]));

const sandbox = {
  Blob,
  TextEncoder,
  Uint8Array,
  Uint32Array,
  ArrayBuffer,
  DataView,
  Date,
  Math,
  Set,
  URL,
  setTimeout,
  document: {
    querySelector: (selector) => selectors[selector],
    createElement: element,
  },
  window: {},
};

vm.runInNewContext(fs.readFileSync(`${__dirname}/app.js`, 'utf8'), sandbox);
const tool = sandbox.window.BulkNameTool;

assert.deepEqual(
  Array.from(tool.buildNames('game.min.html', 'facebook\ntiktok,FACEBOOK\nbad:name', '_', 'suffix')),
  ['game.min_facebook.html', 'game.min_tiktok.html', 'game.min_bad-name.html'],
);
assert.deepEqual(
  Array.from(tool.buildNames('game.html', 'one\ntwo', '-', 'prefix')),
  ['one-game.html', 'two-game.html'],
);
assert.deepEqual({ ...tool.splitFileName('.env') }, { stem: '.env', extension: '' });

(async () => {
  const names = ['game_one.html', 'game_two.html'];
  const zip = tool.makeZip(names, new TextEncoder().encode('<html>ok</html>').buffer);
  const bytes = new Uint8Array(await zip.arrayBuffer());
  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4B, 0x03, 0x04]);
  assert.equal(new TextDecoder().decode(bytes).includes('game_one.html'), true);
  assert.equal(new TextDecoder().decode(bytes).includes('game_two.html'), true);
  console.log('bulk-file-name-tool: all tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
