import { _decorator, Component, Node, Prefab, instantiate, director } from 'cc';
import { SpawnObjectIngame } from './SpawnObjectIngame';
import { GameManager } from '../manager/GameManager';
import { Block } from '../gameplay/Block';
import { SpawnTable } from './SpawnTable';

const { ccclass, property } = _decorator;

@ccclass('MapSpawner')
export class MapSpawner extends Component {

    public static instance: MapSpawner | null = null;

    @property({ type: [Prefab], tooltip: 'Danh sách Prefab map (Map_01, Map_02, ...)' })
    public mapPrefabs: Prefab[] = [];

    // Node map đang active
    private _currentMapNode: Node | null = null;
    private _currentMapIndex: number = -1;

    public get currentMapIndex(): number { return this._currentMapIndex; }
    public get currentMapNode(): Node | null { return this._currentMapNode; }

    /**
     * Kiểm tra còn map tiếp theo không (dựa vào danh sách mapPrefabs).
     */
    public hasNextMap(): boolean {
        return this._currentMapIndex + 1 < this.mapPrefabs.length;
    }

    onLoad() {
        MapSpawner.instance = this;
    }

    /**
     * Load map theo index. Tự động destroy map cũ trước khi spawn map mới.
     * Gọi từ GameManager.initializeGame() hoặc LevelController.
     */
    public loadMap(mapIndex: number): void {
        if (mapIndex < 0 || mapIndex >= this.mapPrefabs.length) {
            console.error(`[MapSpawner] mapIndex ${mapIndex} out of range!`);
            return;
        }

        // 1. Destroy map cũ (giải phóng hoàn toàn RigidBody + Collider)
        this.destroyCurrentMap();

        // 2. Instantiate map mới từ Prefab
        const prefab = this.mapPrefabs[mapIndex];
        this._currentMapNode = instantiate(prefab);

        // Khong tat Rigidbody/Collider va khong sua Kinematic. Chi khoa tam X/Z
        // de prefab roi thang theo Y, sau do khoi phuc constraint goc.
        const soi = this._currentMapNode.getComponent(SpawnObjectIngame);
        if (soi) {
            soi.preparePhysicsActivation();
        }

        this.node.addChild(this._currentMapNode);
        this._currentMapIndex = mapIndex;

        // 3. Đếm số Block trong map và đăng ký với GameManager
        //    (SpawnObjectIngame.start() sẽ tự chạy ổn định vật lý)
        const blocks = this._currentMapNode.getComponentsInChildren(Block);
        if (GameManager.instance) {
            GameManager.instance.registerObjectsSpawned(blocks.length);
        }

        // 4. Áp dụng cấu hình bàn từ map mới nếu có cấu hình
        if (soi && SpawnTable.instance) {
            SpawnTable.instance.syncTableSettingsFromMap(soi);
        }

        console.log(`[MapSpawner] Loaded Map ${mapIndex} with ${blocks.length} blocks.`);
    }

    /**
     * Destroy map hiện tại (giải phóng tất cả Node, RigidBody, Collider).
     */
    public destroyCurrentMap(): void {
        if (this._currentMapNode && this._currentMapNode.isValid) {
            // Gọi clearAll() của SpawnObjectIngame nếu có (cleanup pending bodies)
            const soi = this._currentMapNode.getComponent(SpawnObjectIngame);
            if (soi) soi.clearAll();

            this._currentMapNode.destroy();
            this._currentMapNode = null;
        }
    }
}
