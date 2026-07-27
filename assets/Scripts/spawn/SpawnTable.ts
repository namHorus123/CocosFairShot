import { _decorator, Node, Prefab, instantiate, Vec3, Quat } from 'cc';
import { SpawnBase } from './SpawnBase';
import { MapSpawner } from './MapSpawner';
import { SpawnObjectIngame } from './SpawnObjectIngame';

const { ccclass, property } = _decorator;

/**
 * Cấu hình sinh Bàn trực tiếp trên Editor (Dùng cho Playable thay vì nạp từ Data/Registry)
 */
@ccclass('TableSpawnConfig')
export class TableSpawnConfig {
    @property({ type: Prefab, tooltip: 'Prefab của loại bàn cần spawn' })
    public tablePrefab: Prefab | null = null;

    @property({ type: Vec3, tooltip: 'Vị trí của bàn (Local space)' })
    public position: Vec3 = new Vec3();

    @property({ tooltip: 'Góc xoay ban đầu của bàn quanh trục Y (độ)' })
    public rotationY: number = 0;

    // (Tùy chọn) Nếu bạn muốn cấu hình riêng Width/Length cho từng bàn ngay tại đây thay vì trong Prefab:
    // @property public width: number = 1;
    // @property public length: number = 1;
}

@ccclass('SpawnTable')
export class SpawnTable extends SpawnBase {

    // --- TỐI ƯU CHO PLAYABLE ---
    @property({ type: [TableSpawnConfig], tooltip: 'Danh sách các bàn sẽ được spawn. Cấu hình trực tiếp trên Editor.' })
    public tableConfigs: TableSpawnConfig[] = [];

    // Danh sách lưu trữ các bàn đã spawn để quản lý/dọn dẹp
    private _spawnedTables: Node[] = [];

    // Lưu kích thước mặc định ban đầu để reset khi chuyển map
    private _defaultWidths: number[] = [];
    private _defaultLengths: number[] = [];

    private _tempQuat: Quat = new Quat();

    /**
     * Khởi tạo và sinh ra các bàn theo danh sách cấu hình.
     * @param gameplayData Dữ liệu cấu hình phụ trợ (thường Playable không cần)
     */
    public spawn(gameplayData?: any): void {
        this.clearAll();

        if (this.tableConfigs.length === 0) {
            console.warn('[SpawnTable] Danh sách tableConfigs đang trống. Hãy cấu hình ít nhất 1 bàn trong Inspector!');
            return;
        }

        this._defaultWidths = [];
        this._defaultLengths = [];

        for (let i = 0; i < this.tableConfigs.length; i++) {
            const config = this.tableConfigs[i];

            if (!config || !config.tablePrefab) {
                console.warn(`[SpawnTable] Bàn thứ ${i} bị thiếu cấu hình Prefab! Bỏ qua.`);
                continue;
            }

            // Spawn từ Prefab
            const tableNode = instantiate(config.tablePrefab);

            // Gắn vào hệ thống (làm con của node chứa SpawnTable)
            this.node.addChild(tableNode);

            // Cập nhật vị trí
            tableNode.setPosition(config.position);

            // Cập nhật góc xoay trục Y
            Quat.fromEuler(this._tempQuat, 0, config.rotationY, 0);
            tableNode.setRotation(this._tempQuat);

            // Cache lại kích thước gốc từ Prefab
            const tableScript = tableNode.getComponent('Table') as any;
            if (tableScript) {
                this._defaultWidths.push(tableScript.tableWidth);
                this._defaultLengths.push(tableScript.tableLength);
            } else {
                this._defaultWidths.push(1.0);
                this._defaultLengths.push(1.0);
            }

            // Thêm vào danh sách quản lý
            this._spawnedTables.push(tableNode);
        }

        // TỐI ƯU TIMING: Áp dụng cấu hình bàn từ map hiện đang active nếu có
        if (MapSpawner.instance && MapSpawner.instance.currentMapNode) {
            const soi = MapSpawner.instance.currentMapNode.getComponent(SpawnObjectIngame);
            if (soi) {
                this.syncTableSettingsFromMap(soi);
            }
        }

        console.log(`[SpawnTable] Đã spawn thành công ${this._spawnedTables.length} bàn.`);
    }

    /**
     * Cập nhật kích thước (Width / Length) cho toàn bộ bàn đã spawn.
     * Nếu giá trị truyền vào <= 0, sẽ tự động khôi phục về kích thước mặc định ban đầu.
     */
    public updateTablesSize(width: number, length: number): void {
        for (let i = 0; i < this._spawnedTables.length; i++) {
            const tableNode = this._spawnedTables[i];
            if (tableNode && tableNode.isValid) {
                const tableScript = tableNode.getComponent('Table') as any;
                if (tableScript) {
                    tableScript.tableWidth = width > 0 ? width : (this._defaultWidths[i] || 1.0);
                    tableScript.tableLength = length > 0 ? length : (this._defaultLengths[i] || 1.0);

                    if (typeof tableScript.updateVisual === 'function') {
                        tableScript.updateVisual();
                    }
                }
            }
        }
    }

    /**
     * Đồng bộ cấu hình bàn (kích thước, trạng thái xoay) từ thông tin map.
     */
    public syncTableSettingsFromMap(soi: SpawnObjectIngame): void {
        for (let i = 0; i < this._spawnedTables.length; i++) {
            const tableNode = this._spawnedTables[i];
            if (tableNode && tableNode.isValid) {
                const tableScript = tableNode.getComponent('Table') as any;
                if (tableScript) {
                    // Cập nhật kích thước
                    tableScript.tableWidth = soi.tableWidth > 0 ? soi.tableWidth : (this._defaultWidths[i] || 1.0);
                    tableScript.tableLength = soi.tableLength > 0 ? soi.tableLength : (this._defaultLengths[i] || 1.0);

                    // Cập nhật trạng thái xoay
                    if (typeof tableScript.configureTable === 'function') {
                        tableScript.configureTable(soi.tableState, soi.rotationSpeed, soi.rotationDirection);
                    } else {
                        tableScript.state = soi.tableState;
                        tableScript.rotationSpeed = soi.rotationSpeed;
                        tableScript.rotationDirection = soi.rotationDirection;
                    }

                    if (typeof tableScript.updateVisual === 'function') {
                        tableScript.updateVisual();
                    }
                }
            }
        }
    }

    /**
     * Xóa sạch các bàn đã spawn. 
     * Phù hợp khi Reset Playable Ad.
     */
    public clearAll(): void {
        for (let i = 0; i < this._spawnedTables.length; i++) {
            const table = this._spawnedTables[i];
            if (table && table.isValid) {
                // Với Playable, bàn sinh ra 1 lần đầu game, khi end game/reset thì destroy là đủ tối ưu,
                // Không cần Pool cho Table trừ khi đó là game vô tận sinh bàn liên tục.
                table.destroy();
            }
        }
        this._spawnedTables = [];
        this._defaultWidths = [];
        this._defaultLengths = [];
    }
}
