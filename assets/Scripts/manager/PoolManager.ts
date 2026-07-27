import { _decorator, Component, Node, Prefab, instantiate, NodePool, Vec3, Quat } from 'cc';
const { ccclass } = _decorator;

/**
 * Tối ưu hóa cho Playable Ads:
 * - KHÔNG cần interface IPoolable (Cocos tự động gọi hàm `reuse()` và `unuse()` trên component).
 * - KHÔNG cần Dictionary phức tạp để track từng instance (Dùng luôn node.name làm ID).
 * - Tận dụng class NodePool có sẵn của Cocos (viết bằng C++ ở tầng dưới, cực nhanh và không rác bộ nhớ).
 */
@ccclass('PoolManager')
export class PoolManager extends Component {
    public static instance: PoolManager;

    // Dùng Map để lưu các NodePool, key chính là tên của Prefab
    private _pools: Map<string, NodePool> = new Map();

    onLoad() {
        if (!PoolManager.instance) {
            PoolManager.instance = this;
        } else {
            this.node.destroy();
        }
    }

    /**
     * Lấy Node từ Pool. Nếu Pool rỗng sẽ tự động sinh thêm.
     * @param prefab Prefab cần spawn
     * @param parent Node cha chứa object
     * @param position Vị trí
     * @param rotation Góc xoay
     */
    public static spawn(prefab: Prefab, parent?: Node, position?: Vec3, rotation?: Quat): Node {
        const manager = PoolManager.instance;
        if (!manager) {
            console.warn("PoolManager chưa được gán vào Scene!");
            return instantiate(prefab); // Fallback
        }

        const key = prefab.name;

        // Tạo pool mới nếu chưa có
        if (!manager._pools.has(key)) {
            manager._pools.set(key, new NodePool()); 
        }

        const pool = manager._pools.get(key)!;
        
        let node: Node;
        if (pool.size() > 0) {
            // Khi lấy ra, Cocos sẽ TỰ ĐỘNG gọi hàm `reuse()` (nếu có) trên các component của Node này.
            node = pool.get()!; 
        } else {
            node = instantiate(prefab);
            node.name = key; // Đảm bảo tên trùng với prefab để lúc thu hồi biết đường tìm về
        }

        if (parent) {
            node.setParent(parent);
        }
        if (position) {
            node.setPosition(position);
        }
        if (rotation) {
            node.setRotation(rotation);
        }

        node.active = true;
        return node;
    }

    /**
     * Thu hồi Node về Pool thay vì Destroy để tái sử dụng.
     */
    public static despawn(node: Node) {
        if (!node || !node.isValid) return;

        const manager = PoolManager.instance;
        if (!manager) {
            node.destroy();
            return;
        }

        const key = node.name; // Tên node chính là key của Pool

        if (manager._pools.has(key)) {
            // Khi đưa vào, Cocos TỰ ĐỘNG:
            // 1. Gọi hàm `unuse()` trên component.
            // 2. Remove node khỏi parent (giảm drawcall).
            manager._pools.get(key)!.put(node);
        } else {
            // Nếu Node này được tạo tay (không qua Pool), thì hủy luôn
            node.destroy();
        }
    }

    /**
     * Dọn dẹp toàn bộ rác (Hữu ích khi reset ván game trong Playable Ads)
     */
    public static clearAll() {
        if (!PoolManager.instance) return;
        
        PoolManager.instance._pools.forEach(pool => {
            pool.clear(); // Hủy hoàn toàn các node đang nằm trong kho
        });
        PoolManager.instance._pools.clear();
    }
}
