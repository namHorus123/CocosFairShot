import { _decorator, Component, Label } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('FPSDisplay')
export class FPSDisplay extends Component {
    @property({ type: Label, tooltip: 'Label hien thi FPS tren man hinh.' })
    public fpsLabel: Label | null = null;

    @property({ tooltip: 'Khoang thoi gian lay mau FPS (giay).', min: 0.25 })
    public sampleSeconds: number = 1;

    private _frameCount: number = 0;
    private _sampleStartTime: number = 0;

    protected onEnable(): void {
        this._frameCount = 0;
        this._sampleStartTime = performance.now();

        if (this.fpsLabel) {
            this.fpsLabel.string = 'FPS: --';
        }
    }

    update(): void {
        this._frameCount++;

        const currentTime = performance.now();
        const elapsedSeconds = (currentTime - this._sampleStartTime) / 1000;
        if (elapsedSeconds < Math.max(0.25, this.sampleSeconds)) return;

        const fps = this._frameCount / elapsedSeconds;
        const fpsText = `FPS: ${fps.toFixed(1)}`;

        if (this.fpsLabel) {
            this.fpsLabel.string = fpsText;
        }

        console.log(`[FPSDisplay] ${fpsText}`);
        this._frameCount = 0;
        this._sampleStartTime = currentTime;
    }
}
