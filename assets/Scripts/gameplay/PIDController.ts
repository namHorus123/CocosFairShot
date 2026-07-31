import { _decorator, math, PhysicsSystem } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('PIDController')
export class PIDController {
    @property
    public pCoeff: number = 0.8;

    @property
    public iCoeff: number = 0.0002;

    @property
    public dCoeff: number = 0.2;

    @property
    public minimum: number = 1;

    @property
    public maximum: number = 2;

    private integral: number = 0;
    private lastProportional: number = 0;

    public Seek(seekValue: number, currentValue: number): number {
        const deltaTime = PhysicsSystem.instance.fixedTimeStep;
        const proportional = seekValue - currentValue;

        const derivative = (proportional - this.lastProportional) / deltaTime;
        this.integral += proportional * deltaTime;
        this.lastProportional = proportional;

        let value = this.pCoeff * proportional
            + this.iCoeff * this.integral
            + this.dCoeff * derivative;
        value = math.clamp(value, this.minimum, this.maximum);

        return value;
    }
}
