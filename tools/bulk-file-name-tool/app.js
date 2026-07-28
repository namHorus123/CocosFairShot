(() => {
  'use strict';

  const elements = {
    dropZone: document.querySelector('#dropZone'),
    fileInput: document.querySelector('#fileInput'),
    fileInfo: document.querySelector('#fileInfo'),
    suffixes: document.querySelector('#suffixes'),
    separator: document.querySelector('#separator'),
    position: document.querySelector('#position'),
    preview: document.querySelector('#preview'),
    counter: document.querySelector('#counter'),
    saveFolder: document.querySelector('#saveFolder'),
    downloadZip: document.querySelector('#downloadZip'),
    status: document.querySelector('#status'),
  };

  let sourceFile = null;

  function splitFileName(name) {
    const lastDot = name.lastIndexOf('.');
    if (lastDot <= 0) return { stem: name, extension: '' };
    return { stem: name.slice(0, lastDot), extension: name.slice(lastDot) };
  }

  function sanitizePart(value) {
    return value
      .trim()
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
      .replace(/[. ]+$/g, '')
      .slice(0, 180);
  }

  function parseNames(value) {
    const seen = new Set();
    return value
      .split(/[\n,]+/)
      .map(sanitizePart)
      .filter((name) => name && !seen.has(name.toLocaleLowerCase()) && seen.add(name.toLocaleLowerCase()));
  }

  function buildNames(fileName, rawNames, separator, position) {
    if (!fileName) return [];
    const { stem, extension } = splitFileName(fileName);
    return parseNames(rawNames).map((part) => position === 'prefix'
      ? `${part}${separator}${stem}${extension}`
      : `${stem}${separator}${part}${extension}`);
  }

  function currentNames() {
    return buildNames(sourceFile?.name || '', elements.suffixes.value, elements.separator.value, elements.position.value);
  }

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
  }

  function updatePreview() {
    const names = currentNames();
    elements.counter.textContent = `${names.length} file`;
    elements.preview.innerHTML = names.length
      ? names.map((name) => `<li>${escapeHtml(name)}</li>`).join('')
      : '<li class="empty">Chưa có tên để xem trước.</li>';
    elements.saveFolder.disabled = !sourceFile || !names.length;
    elements.downloadZip.disabled = !sourceFile || !names.length;
  }

  function setStatus(message, kind = '') {
    elements.status.textContent = message;
    elements.status.className = kind;
  }

  function setFile(file) {
    if (!file) return;
    sourceFile = file;
    elements.fileInfo.textContent = `${file.name} — ${formatBytes(file.size)}`;
    setStatus('Đã nhận file nguồn.', 'ok');
    updatePreview();
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / (1024 ** unit)).toFixed(unit ? 1 : 0)} ${units[unit]}`;
  }

  elements.dropZone.addEventListener('click', () => elements.fileInput.click());
  elements.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') elements.fileInput.click();
  });
  elements.fileInput.addEventListener('change', () => setFile(elements.fileInput.files[0]));
  ['dragenter', 'dragover'].forEach((type) => elements.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add('dragging');
  }));
  ['dragleave', 'drop'].forEach((type) => elements.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove('dragging');
  }));
  elements.dropZone.addEventListener('drop', (event) => setFile(event.dataTransfer.files[0]));
  [elements.suffixes, elements.separator, elements.position].forEach((element) => element.addEventListener('input', updatePreview));

  elements.saveFolder.addEventListener('click', async () => {
    if (!sourceFile) return;
    if (!window.showDirectoryPicker) {
      setStatus('Trình duyệt này không hỗ trợ chọn thư mục. Hãy dùng nút tải ZIP.', 'error');
      return;
    }
    try {
      const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
      const bytes = await sourceFile.arrayBuffer();
      const names = currentNames();
      for (let index = 0; index < names.length; index += 1) {
        setStatus(`Đang lưu ${index + 1}/${names.length}: ${names[index]}`);
        const handle = await directory.getFileHandle(names[index], { create: true });
        const writable = await handle.createWritable();
        await writable.write(bytes);
        await writable.close();
      }
      setStatus(`Đã lưu xong ${names.length} file.`, 'ok');
    } catch (error) {
      if (error?.name !== 'AbortError') setStatus(`Không thể lưu file: ${error.message}`, 'error');
    }
  });

  // ZIP "store" implementation: offline, dependency-free, and preserves the source bytes exactly.
  const crcTable = new Uint32Array(256).map((_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
    return value >>> 0;
  });

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zipDateTime(date = new Date()) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
  }

  function makeZip(fileNames, content) {
    const encoder = new TextEncoder();
    const data = new Uint8Array(content);
    const checksum = crc32(data);
    const stamp = zipDateTime();
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const fileName of fileNames) {
      const name = encoder.encode(fileName);
      const local = new ArrayBuffer(30 + name.length);
      const localView = new DataView(local);
      localView.setUint32(0, 0x04034B50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0x0800, true);
      localView.setUint16(10, stamp.time, true);
      localView.setUint16(12, stamp.date, true);
      localView.setUint32(14, checksum, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, name.length, true);
      new Uint8Array(local, 30).set(name);
      localParts.push(local, data);

      const central = new ArrayBuffer(46 + name.length);
      const centralView = new DataView(central);
      centralView.setUint32(0, 0x02014B50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0x0800, true);
      centralView.setUint16(12, stamp.time, true);
      centralView.setUint16(14, stamp.date, true);
      centralView.setUint32(16, checksum, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, name.length, true);
      centralView.setUint32(42, offset, true);
      new Uint8Array(central, 46).set(name);
      centralParts.push(central);
      offset += local.byteLength + data.length;
    }

    const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0);
    const end = new ArrayBuffer(22);
    const endView = new DataView(end);
    endView.setUint32(0, 0x06054B50, true);
    endView.setUint16(8, fileNames.length, true);
    endView.setUint16(10, fileNames.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  }

  elements.downloadZip.addEventListener('click', async () => {
    if (!sourceFile) return;
    try {
      const names = currentNames();
      setStatus(`Đang đóng gói ${names.length} file...`);
      const zip = makeZip(names, await sourceFile.arrayBuffer());
      const url = URL.createObjectURL(zip);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${splitFileName(sourceFile.name).stem}_renamed_${names.length}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`Đã tạo ZIP chứa ${names.length} file.`, 'ok');
    } catch (error) {
      setStatus(`Không thể tạo ZIP: ${error.message}`, 'error');
    }
  });

  updatePreview();

  // Small public surface for automated checks without affecting normal use.
  window.BulkNameTool = { splitFileName, sanitizePart, parseNames, buildNames, makeZip };
})();
