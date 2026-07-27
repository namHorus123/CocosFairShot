import { _decorator, Component, Node, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('VisualTableFake')
export class VisualTableFake extends Component {

    @property({ type: Node, tooltip: 'Node cần scale theo Width và Length. Nếu để trống sẽ tự lấy Node chứa script này.' })
    public targetNode: Node | null = null;

    // Cache biến để tránh rác GC
    private _tempScale: Vec3 = new Vec3();

    /**
     * Hàm dùng để update logic hiển thị (Scale) của bàn giả
     */
    public updateVisual(width: number, length: number): void {
        const nodeToScale = this.targetNode ? this.targetNode : this.node;

        const w = width > 0 ? width : 1.0;
        const l = length > 0 ? length : 1.0;

        // Giữ nguyên scale hiện tại ở trục Y, chỉ thay đổi X (width) và Z (length)
        this._tempScale.set(w, nodeToScale.scale.y, l);

        nodeToScale.setScale(this._tempScale);
    }
}
