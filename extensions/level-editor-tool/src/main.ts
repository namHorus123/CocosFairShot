export function load(): void {
  console.log('[Level Editor Tool] loaded');
}

export function unload(): void {}

export const methods = {
  openPanel(): void {
    Editor.Panel.open('level-editor-tool');
  },

  async savePrefab(serialized: string): Promise<string> {
    const { join } = require('path');
    const { mkdirSync, readFileSync } = require('fs');
    const levelsPath = join(Editor.Project.path, 'assets', 'Levels');
    mkdirSync(levelsPath, { recursive: true });

    const url = 'db://assets/Levels/Level_001.prefab';
    await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/Levels');
    const existing = await Editor.Message.request('asset-db', 'query-asset-info', url);
    if (existing) await Editor.Message.request('asset-db', 'save-asset', url, serialized);
    else await Editor.Message.request('asset-db', 'create-asset', url, serialized);

    // Verify the actual file written by AssetDB, not only the in-memory string.
    const savedObjects = JSON.parse(readFileSync(join(levelsPath, 'Level_001.prefab'), 'utf8'));
    const savedRoot = savedObjects[savedObjects[0]?.data?.__id__];
    const savedRootInfo = savedObjects[savedRoot?._prefab?.__id__];
    const savedPieces = (savedRoot?._children || []).map((ref: { __id__: number }) => savedObjects[ref.__id__]);
    const validDiskFile = savedRootInfo?.__type__ === 'cc.PrefabInfo'
      && savedPieces.length > 0
      && savedPieces.every((node: any) => node?._name && node._name !== 'New Node' && node._prefab === null && node._lpos && node._lrot);
    if (!validDiskFile) {
      throw new Error('AssetDB đã ghi Prefab không đầy đủ; file bị chặn và không được báo thành công.');
    }
    return url;
  },
};
