import { _decorator, Node, Prefab, instantiate, Vec3 } from 'cc';
import { SpawnBase } from './SpawnBase';

const { ccclass, property } = _decorator;

@ccclass('SpawnGun')
export class SpawnGun extends SpawnBase {
    
    // --- Tối ưu cho Playable: Dùng cấu hình trực tiếp trên Editor thay vì Registry phức tạp ---
    
    @property({ type: Prefab, tooltip: 'Prefab súng sẽ được spawn' })
    public gunPrefab: Prefab | null = null;

    @property({ type: Vec3, tooltip: 'Vị trí khởi tạo của súng (Local position)' })
    public spawnPosition: Vec3 = new Vec3(0, 0, 0);

    private _spawnedGun: Node | null = null;

    /**
     * Lấy tham chiếu đến súng đang được spawn trên scene
     */
    public get spawnedGun(): Node | null {
        return this._spawnedGun;
    }

    /**
     * Hàm gọi từ GameManager hoặc khi bắt đầu game
     * @param gameplayData Dữ liệu truyền vào (tùy chọn)
     */
    public spawn(gameplayData?: any): void {
        this.clearAll();

        if (!this.gunPrefab) {
            console.error('[SpawnGun] gunPrefab bị thiếu! Vui lòng kéo Prefab súng vào component này trong Editor.');
            return;
        }

        // Spawn súng
        this._spawnedGun = instantiate(this.gunPrefab);
        
        // Đưa súng làm con của node chứa SpawnGun (hoặc một node gốc nào đó)
        this.node.addChild(this._spawnedGun);
        
        // Đặt vị trí cấu hình sẵn
        this._spawnedGun.setPosition(this.spawnPosition);

        // TODO: Nếu súng có GunController, gọi hàm Initialize tại đây
        // VD: 
        // const gunCtrl = this._spawnedGun.getComponent('Dual_Gun');
        // if (gunCtrl) {
        //     gunCtrl.initialize(gameplayData);
        // }

        console.log('[SpawnGun] Đã spawn thành công súng.');
    }

    /**
     * Dọn dẹp súng hiện tại
     */
    public clearAll(): void {
        if (this._spawnedGun && this._spawnedGun.isValid) {
            // Đối với Playable, súng thường chỉ spawn 1 lần, không cần thiết phải dùng Pool cho Súng.
            // Pool chủ yếu dùng cho đạn (bullets/balls).
            // Nếu bạn có PoolManager, có thể gọi PoolManager.despawn(this._spawnedGun);
            this._spawnedGun.destroy();
        }
        
        this._spawnedGun = null;
    }
}
