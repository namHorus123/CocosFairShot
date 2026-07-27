import { _decorator, Enum } from 'cc';

const { ccclass, property } = _decorator;

export enum BulletImpactForceType {
    Forward = 0,
    Explosion = 1
}
Enum(BulletImpactForceType);

@ccclass('LayerVelocityRetention')
export class LayerVelocityRetention {
    @property({ displayName: 'Layer', tooltip: 'Dùng Bit Mask (1 << layer) để so sánh' })
    public layerValue: number = 0;

    @property({ displayName: 'Velocity Retention' })
    public velocityRetention: number = 1.0;
}

@ccclass('LayerSoundMapping')
export class LayerSoundMapping {
    @property({ displayName: 'Layer', tooltip: 'Dùng Bit Mask (1 << layer) để so sánh' })
    public layerValue: number = 0;

    @property({ displayName: 'Sound', tooltip: 'ID hoặc Enum của âm thanh' })
    public soundId: number = 0;
}
