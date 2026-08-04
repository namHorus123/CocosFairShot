import { _decorator, Component, Node, RigidBody, Vec3, math, PhysicsSystem, Quat, tween, Tween, MeshRenderer, Color } from 'cc';
const { ccclass, property } = _decorator;

interface ShardInfo {
    node: Node;
    rigidbody: RigidBody | null;
}

@ccclass('ShatterHitBehavior')
export class ShatterHitBehavior extends Component {
    @property({ type: Node, tooltip: 'Object con chứa các mảnh vỡ' })
    public shatteredVisual: Node | null = null;

    @property({ tooltip: 'Kích hoạt lực làm văng các mảnh vỡ khi vỡ' })
    public flingShards: boolean = false;

    @property({ tooltip: 'Lực làm văng các mảnh vỡ' })
    public flingForce: number = 3;

    @property({ tooltip: 'Hệ số trọng lực áp dụng riêng cho các mảnh vỡ' })
    public shardGravityScale: number = 10;

    private _shards: ShardInfo[] = [];

    // Cache các biến tạm để tránh tạo object mới liên tục (GC allocation), cực kỳ quan trọng cho Playable Ads
    private _tempVec3: Vec3 = new Vec3();
    private _tempTorque: Vec3 = new Vec3();
    private _customGravity: Vec3 = new Vec3();

    onLoad() {
        this.cacheShards();
    }

    private cacheShards() {
        if (!this.shatteredVisual) return;

        this._shards = [];
        const children = this.shatteredVisual.children;

        // Dùng vòng lặp for thay vì forEach để tối ưu performance
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            this._shards.push({
                node: child,
                rigidbody: child.getComponent(RigidBody)
            });
        }
    }

    public playEffect(allowShardRotation: boolean = true) {
        if (!this.shatteredVisual) return;

        this.shatteredVisual.active = true;

        if (!allowShardRotation) {
            this.scheduleOnce(() => {
                for (let i = 0; i < this._shards.length; i++) {
                    const rigidbody = this._shards[i].rigidbody;
                    if (!rigidbody) continue;

                    rigidbody.angularFactor = Vec3.ZERO;
                    rigidbody.setAngularVelocity(Vec3.ZERO);
                }
            }, 0);
        }

        if (this.flingShards) {
            // Chờ 1 frame (0s) để Engine kịp gọi onLoad() khởi tạo RigidBody cho các Node vừa được active
            this.scheduleOnce(() => {
                for (let i = 0; i < this._shards.length; i++) {
                    const shard = this._shards[i];
                    if (shard.rigidbody) {
                        shard.rigidbody.useGravity = false;
                        shard.rigidbody.setLinearVelocity(Vec3.ZERO);
                        shard.rigidbody.setAngularVelocity(Vec3.ZERO);
                        shard.rigidbody.clearState(); // Đảm bảo triệt tiêu các lực cũ

                        // Vector3 direction = new Vector3(Random.Range(-1f, 1f), Random.Range(0.8f, 1.5f), Random.Range(-1f, 1f)).normalized;
                        this._tempVec3.set(
                            math.randomRange(-1, 1),
                            math.randomRange(0.8, 1.5),
                            math.randomRange(-1, 1)
                        );
                        this._tempVec3.normalize().multiplyScalar(this.flingForce * 1.1);
                        // AddForce(..., ForceMode.Impulse) -> applyImpulse
                        shard.rigidbody.applyImpulse(this._tempVec3);

                        // Vector3 torque = new Vector3(Random.Range(-10f, 10f), ...);
                        // AddTorque(..., ForceMode.Impulse) tương đương với việc gán trực tiếp Angular Velocity trong Cocos vì applyTorque của Cocos là ForceMode.Force
                        if (allowShardRotation) {
                            this._tempTorque.set(
                                math.randomRange(-10, 10),
                                math.randomRange(-10, 10),
                                math.randomRange(-10, 10)
                            );
                            shard.rigidbody.setAngularVelocity(this._tempTorque);
                        }
                    }
                }
            }, 0);
        }
    }

    update(deltaTime: number) {
        if (this.shatteredVisual && this.shatteredVisual.active) {
            // Lấy gravity hiện tại của hệ thống để đồng bộ
            this._customGravity.set(PhysicsSystem.instance.gravity).multiplyScalar(this.shardGravityScale);

            for (let i = 0; i < this._shards.length; i++) {
                const shard = this._shards[i];
                if (shard.rigidbody && !shard.rigidbody.isKinematic) {
                    try {
                        // ForceMode.Acceleration trong Unity bỏ qua khối lượng (F = a)
                        // Trong Cocos, applyForce là F = m * a, nên ta cần nhân thêm khối lượng
                        this._tempVec3.set(this._customGravity).multiplyScalar(shard.rigidbody.mass);
                        shard.rigidbody.applyForce(this._tempVec3);
                    } catch (err) {
                        // Bỏ qua lỗi ở frame đầu tiên nếu RigidBody chưa kịp khởi tạo
                    }
                }
            }
        }
    }

    public meltShards(duration: number, delayTime: number = 0) {
        if (!this.shatteredVisual) return;

        for (let i = 0; i < this._shards.length; i++) {
            const shard = this._shards[i];
            if (shard.node) {
                // Tween scale nhỏ dần để tạo cảm giác tan chảy
                tween(shard.node)
                    .delay(delayTime)
                    .to(duration, { scale: new Vec3(0.01, 0.01, 0.01) })
                    .start();

                // Tween alpha để mờ dần
                const renderer = shard.node.getComponent(MeshRenderer);
                if (renderer && renderer.material) {
                    const mat = renderer.material;
                    const pass = mat.passes[0];

                    let hasOpacityProp = false;
                    let startOpacity = 1.0;

                    let startColor = new Color(255, 255, 255, 255);
                    let hasColorProp = false;

                    if (pass) {
                        // Check custom opacity property first (float)
                        const opacityHandle = pass.getHandle('opacity');
                        if (opacityHandle) {
                            hasOpacityProp = true;
                            // uniform float is returned as number or Float32Array depending on engine version, 
                            // but we can just assume starting at 1.0 or get the property directly
                            const currentOpacity = mat.getProperty('opacity');
                            if (currentOpacity !== null && currentOpacity !== undefined) {
                                startOpacity = currentOpacity as number;
                            }
                        }

                        // Check standard color properties
                        let colorHandle = pass.getHandle('albedo');
                        if (!colorHandle) colorHandle = pass.getHandle('mainColor');

                        if (colorHandle) {
                            hasColorProp = true;
                            pass.getUniform(colorHandle, startColor);
                        }
                    }

                    // Dùng chung 1 object để tween
                    const tweenObj = {
                        alphaColor: startColor.a,
                        opacityFloat: startOpacity
                    };

                    // Chỉ log thông tin của mảnh vỡ đầu tiên để tránh làm quá tải (spam) console
                    const isFirstShard = (i === 0);

                    if (isFirstShard) {
                        // console.log(`[Ice Melt Start] hasOpacityProp: ${hasOpacityProp}, initialOpacityFloat: ${startOpacity}`);
                    }

                    tween(tweenObj)
                        .delay(delayTime)
                        .to(duration, { alphaColor: 0, opacityFloat: 0 }, {
                            onUpdate: (target: any) => {
                                if (hasColorProp) {
                                    startColor.a = target.alphaColor;
                                    mat.setProperty('albedo', startColor);
                                    mat.setProperty('mainColor', startColor);
                                }
                                if (hasOpacityProp) {
                                    mat.setProperty('opacity', target.opacityFloat);
                                }

                                // In log ở mỗi khung hình để theo dõi
                                if (isFirstShard) {
                                    // console.log(`[Ice Melt Update] Opacity: ${target.opacityFloat.toFixed(3)} | Scale: ${shard.node.scale.x.toFixed(3)}`);
                                }
                            }
                        })
                        .start();
                }
            }
        }
    }

    public resetBehavior() {
        if (!this.shatteredVisual) return;

        if (this._shards.length === 0) {
            this.cacheShards();
        }

        const isVisualActive = this.shatteredVisual.active;

        // Đưa các mảnh vỡ về trạng thái ban đầu
        for (let i = 0; i < this._shards.length; i++) {
            const shard = this._shards[i];
            if (!shard.node) continue;

            Tween.stopAllByTarget(shard.node);
            shard.node.setPosition(Vec3.ZERO);
            shard.node.setRotation(Quat.IDENTITY);
            shard.node.setScale(Vec3.ONE);

            // Chỉ can thiệp vào vật lý nếu Node đã từng active (RigidBody đã onLoad)
            if (isVisualActive && shard.rigidbody) {
                try {
                    shard.rigidbody.setLinearVelocity(Vec3.ZERO);
                    shard.rigidbody.setAngularVelocity(Vec3.ZERO);
                    shard.rigidbody.clearState();
                    if (typeof shard.rigidbody.sleep === 'function') {
                        shard.rigidbody.sleep();
                    }
                } catch (err) {
                    // Bỏ qua nếu có lỗi chưa khởi tạo
                }
            }
        }

        // Tắt node sau khi đã xử lý xong vật lý
        this.shatteredVisual.active = false;
    }
}
