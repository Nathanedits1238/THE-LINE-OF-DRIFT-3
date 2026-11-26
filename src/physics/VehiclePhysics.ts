import * as THREE from 'three';
import { PlayerControls, VehicleConfig } from '../types';

export class VehiclePhysics {
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public heading: number = 0; // Yaw angle in radians
  public angularVelocity: number = 0;

  // Visual tilt dynamics
  public roll: number = 0;
  public pitch: number = 0;
  public steerAngle: number = 0;

  // Jump ramps & vertical dynamics
  public isAirborne: boolean = false;
  public targetGroundY: number = 0;

  // Car stats
  public speedKmh: number = 0;
  public rpm: number = 0.2;
  public gear: number = 1;
  public driftSlip: number = 0;
  public isDrifting: boolean = false;
  public driftScore: number = 0;
  public nitroReserve: number = 100; // 0 to 100%
  public health: number = 100; // 0 to maxHealth
  public maxHealth: number = 100;
  public damageTakenMultiplier: number = 1.0;
  public nitroRegenMultiplier: number = 1.0;
  public driftScoreMultiplier: number = 1.0;
  // Wheel integrity [Front-X, Front+X, Rear-X, Rear+X]
  public missingWheels: [boolean, boolean, boolean, boolean] = [false, false, false, false];

  // Career character stat multipliers
  private careerMods = {
    speedMult: 1.0,
    accelMult: 1.0,
    gripMult: 1.0,
    turnMult: 1.0,
    brakeMult: 1.0,
    nitroRegenMult: 1.0,
    healthMult: 1.0,
    damageTakenMult: 1.0,
    driftScoreMult: 1.0,
  };

  // Config parameters
  private maxSpeedMs: number = 65; // ~234 km/h
  private accelForce: number = 18.0;
  private brakeForce: number = 28.0;
  private reverseMaxMs: number = 14;
  private dragCoeff: number = 0.0018;
  private gripLateral: number = 14.0;
  private gripDrift: number = 4.5;
  private turnSpeed: number = 2.4;

  constructor(public config: VehicleConfig, initialPos: THREE.Vector3 = new THREE.Vector3(0, 0, 0)) {
    this.position.copy(initialPos);
    this.applyUpgrades();
  }

  public setCareerStatModifiers(mods?: Partial<VehiclePhysics['careerMods']>) {
    this.careerMods = {
      speedMult: mods?.speedMult ?? 1.0,
      accelMult: mods?.accelMult ?? 1.0,
      gripMult: mods?.gripMult ?? 1.0,
      turnMult: mods?.turnMult ?? 1.0,
      brakeMult: mods?.brakeMult ?? 1.0,
      nitroRegenMult: mods?.nitroRegenMult ?? 1.0,
      healthMult: mods?.healthMult ?? 1.0,
      damageTakenMult: mods?.damageTakenMult ?? 1.0,
      driftScoreMult: mods?.driftScoreMult ?? 1.0,
    };
    this.applyUpgrades();
  }

  public applyUpgrades() {
    const engineBoost = 1 + (this.config.levelEngine - 1) * 0.12;
    const handlingBoost = 1 + (this.config.levelHandling - 1) * 0.1;
    const armorBoost = 1 + (this.config.levelArmor - 1) * 0.2;

    this.maxSpeedMs = (this.config.topSpeed / 3.6) * engineBoost * this.careerMods.speedMult;
    this.accelForce = this.config.acceleration * 0.28 * engineBoost * this.careerMods.accelMult;
    this.gripLateral = 12.0 * this.config.handling * 0.18 * handlingBoost * this.careerMods.gripMult;
    this.brakeForce = 28.0 * this.careerMods.brakeMult;
    this.turnSpeed = 2.4 * this.careerMods.turnMult;
    this.nitroRegenMultiplier = this.careerMods.nitroRegenMult;
    this.damageTakenMultiplier = this.careerMods.damageTakenMult;
    this.driftScoreMultiplier = this.careerMods.driftScoreMult;
    this.maxHealth = Math.round(100 * armorBoost * this.careerMods.healthMult);
    this.health = this.maxHealth;
  }

  public reset(pos: THREE.Vector3, heading: number = 0) {
    this.position.copy(pos);
    this.velocity.set(0, 0, 0);
    this.heading = heading;
    this.angularVelocity = 0;
    this.speedKmh = 0;
    this.roll = 0;
    this.pitch = 0;
    this.steerAngle = 0;
    this.isDrifting = false;
    this.isAirborne = false;
    this.targetGroundY = pos.y;
    this.health = this.maxHealth;
    this.missingWheels = [false, false, false, false];
  }

  /**
   * Detaches a wheel at preferredIndex (0: Front-X, 1: Front+X, 2: Rear-X, 3: Rear+X).
   * Capped at max 2 missing wheels so the vehicle always remains playable.
   */
  public triggerWheelLoss(preferredIndex?: number): number {
    const missingCount = this.missingWheels.filter(Boolean).length;
    if (missingCount >= 2) return -1;

    if (
      preferredIndex !== undefined &&
      preferredIndex >= 0 &&
      preferredIndex < 4 &&
      !this.missingWheels[preferredIndex]
    ) {
      this.missingWheels[preferredIndex] = true;
      return preferredIndex;
    }

    const intactIndices = [0, 1, 2, 3].filter((i) => !this.missingWheels[i]);
    if (intactIndices.length === 0) return -1;
    const chosen = intactIndices[Math.floor(Math.random() * intactIndices.length)];
    this.missingWheels[chosen] = true;
    return chosen;
  }

  public launchRamp(jumpSpeedY: number, launchPitch: number = 0.22) {
    if (!this.isAirborne && this.velocity.length() > 5.0) {
      this.isAirborne = true;
      this.velocity.y = Math.max(7.0, jumpSpeedY);
      this.pitch = launchPitch;
    }
  }

  public update(
    dt: number,
    controls: PlayerControls,
    groundY: number = 0,
    weatherGripMultiplier: number = 1.0,
    weatherBrakingMultiplier: number = 1.0
  ): {
    collisionDamage: number;
    driftPointsAwarded: number;
  } {
    dt = Math.min(dt, 0.05); // Frame clamp to avoid physics explosion
    this.targetGroundY = groundY;

    // Missing wheel imbalance calculation (keeps car playable with ~2.8x counter-steer authority)
    let missingCount = 0;
    let wheelPullBias = 0; // negative pulls toward -X, positive pulls toward +X
    let missingRollBias = 0; // positive dips -X down, negative dips +X down
    if (this.missingWheels[0]) {
      missingCount++;
      wheelPullBias -= 1.0;
      missingRollBias += 0.055;
    }
    if (this.missingWheels[1]) {
      missingCount++;
      wheelPullBias += 1.0;
      missingRollBias -= 0.055;
    }
    if (this.missingWheels[2]) {
      missingCount++;
      wheelPullBias -= 0.75;
      missingRollBias += 0.045;
    }
    if (this.missingWheels[3]) {
      missingCount++;
      wheelPullBias += 0.75;
      missingRollBias -= 0.045;
    }
    wheelPullBias = THREE.MathUtils.clamp(wheelPullBias, -1.2, 1.2);

    const effectiveMaxSpeedMs = this.maxSpeedMs * (1 - missingCount * 0.085);
    const gripMultiplier = Math.max(0.68, 1 - missingCount * 0.14) * weatherGripMultiplier;

    // Forward and Right unit vectors in world space
    const forwardX = Math.sin(this.heading);
    const forwardZ = Math.cos(this.heading);
    const rightX = Math.cos(this.heading);
    const rightZ = -Math.sin(this.heading);

    // Current velocities along local car axes
    const forwardSpeed = this.velocity.x * forwardX + this.velocity.z * forwardZ;
    const lateralSpeed = this.velocity.x * rightX + this.velocity.z * rightZ;

    // Steering input damping
    const targetSteer = controls.steer * 0.65; // max ~37 degrees
    if (Math.abs(controls.steer) < 0.01) {
      // Fast zero-snap when no steering key/button is pressed to ensure razor-sharp straight-line acceleration
      this.steerAngle = THREE.MathUtils.damp(this.steerAngle, 0, 24, dt);
      if (Math.abs(this.steerAngle) < 0.001) this.steerAngle = 0;
    } else {
      this.steerAngle = THREE.MathUtils.damp(this.steerAngle, targetSteer, 14, dt);
    }

    // Nitro consumption and recharge
    let currentAccel = this.accelForce * (1 - missingCount * 0.09);
    if (controls.nitro && this.nitroReserve > 2 && controls.throttle > 0) {
      this.nitroReserve = Math.max(0, this.nitroReserve - dt * 28);
      currentAccel *= 1.7;
    } else {
      this.nitroReserve = Math.min(100, this.nitroReserve + dt * 6 * this.nitroRegenMultiplier);
    }

    // Drive Forces
    let longitudinalForce = 0;
    if (controls.throttle > 0) {
      if (forwardSpeed >= 0) {
        // Accelerate forward
        const speedRatio = Math.max(0, 1 - forwardSpeed / effectiveMaxSpeedMs);
        longitudinalForce += controls.throttle * currentAccel * (0.35 + 0.65 * speedRatio);
      } else {
        // Braking while in reverse
        longitudinalForce += controls.throttle * (this.brakeForce / weatherBrakingMultiplier);
      }
    }

    if (controls.brake > 0) {
      if (forwardSpeed > 0.8) {
        // Regular foot brake (weather increases braking distance)
        longitudinalForce -= controls.brake * (this.brakeForce / weatherBrakingMultiplier);
      } else {
        // Reverse gear
        const revSpeedRatio = Math.max(0, 1 - Math.abs(forwardSpeed) / this.reverseMaxMs);
        longitudinalForce -= controls.brake * (this.accelForce * 0.55) * revSpeedRatio;
      }
    }

    // Aerodynamic Drag & Rolling Resistance (hub scraping adds moderate drag)
    const speed = this.velocity.length();
    const drag = this.dragCoeff * speed * speed;
    const rollingResistance = 0.8 + missingCount * 0.55;
    const resistanceForce = (drag + rollingResistance) * Math.sign(forwardSpeed);

    longitudinalForce -= resistanceForce;

    // Lateral grip and drift calculation (weather lowers lateral slip threshold for fluid drift in rain)
    const handbrakeActive = controls.handbrake;
    const slipThreshold = 2.5 * Math.min(1.0, weatherGripMultiplier);
    const isSlipping = Math.abs(lateralSpeed) > slipThreshold || (handbrakeActive && speed > 5);
    const currentGrip =
      (handbrakeActive
        ? this.gripDrift * 0.4
        : isSlipping
          ? this.gripDrift
          : this.gripLateral) * gripMultiplier;

    const lateralForce = -lateralSpeed * currentGrip;

    // Turning dynamics (Ackermann-like steering + missing-wheel pull)
    // Chase camera looks down +Z with +Y up, so screen right is -X (decreasing heading) and screen left is +X (increasing heading).
    const turnFactor = Math.min(1.0, Math.abs(forwardSpeed) / 4.0);
    const highSpeedStability = 1.0 / (1.0 + Math.max(0, speed - 25) * 0.02);
    const dirSign = forwardSpeed < -0.8 ? -1 : 1;
    let yawTorque =
      -this.steerAngle * this.turnSpeed * turnFactor * highSpeedStability * dirSign;

    // Pull smoothly toward the missing wheel's side while leaving ~2.8x counter-steer control
    const pullSpeedFactor = Math.min(1.0, Math.abs(forwardSpeed) / 7.5);
    const wheelPullTorque = wheelPullBias * 0.56 * pullSpeedFactor * dirSign;
    yawTorque += wheelPullTorque;

    if (handbrakeActive && speed > 8) {
      // Induce kick-out oversteer
      yawTorque *= 1.85;
      this.isDrifting = true;
    } else if (Math.abs(lateralSpeed) > 3.0 && speed > 10) {
      this.isDrifting = true;
    } else {
      this.isDrifting = false;
    }

    if (Math.abs(controls.steer) < 0.01 && !this.isDrifting && Math.abs(wheelPullBias) < 0.01) {
      // Strictly straight line lock when intact: cancels unwanted micro-rotations when accelerating
      this.angularVelocity = 0;
      yawTorque = 0;
    } else {
      this.angularVelocity = THREE.MathUtils.damp(this.angularVelocity, yawTorque, 12, dt);
    }

    this.heading += this.angularVelocity * dt;

    // Apply forces into acceleration
    const totalForwardAcc = longitudinalForce;
    const totalLateralAcc = lateralForce;

    this.velocity.x += (forwardX * totalForwardAcc + rightX * totalLateralAcc) * dt;
    this.velocity.z += (forwardZ * totalForwardAcc + rightZ * totalLateralAcc) * dt;

    // Prevent lateral drift creep during straight-line acceleration when wheels are intact
    if (
      Math.abs(controls.steer) < 0.01 &&
      !this.isDrifting &&
      Math.abs(wheelPullBias) < 0.01 &&
      speed > 0.5
    ) {
      const forwardOnlyVel = this.velocity.x * forwardX + this.velocity.z * forwardZ;
      this.velocity.x = forwardX * forwardOnlyVel;
      this.velocity.z = forwardZ * forwardOnlyVel;
    }

    // Clamp very small drift creep at rest
    if (controls.throttle === 0 && controls.brake === 0 && speed < 0.25) {
      this.velocity.set(0, 0, 0);
    }

    // Integrate horizontal position
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    // Vertical Dynamics (Jump ramps, bridges, ramps, gravity)
    const GRAVITY = -26.0;
    if (this.position.y > groundY + 0.04) {
      this.isAirborne = true;
      this.velocity.y += GRAVITY * dt;
      this.position.y += this.velocity.y * dt;

      // Pitch slightly tilts with jump trajectory
      this.pitch = THREE.MathUtils.damp(this.pitch, -this.velocity.y * 0.018, 8, dt);

      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.velocity.y = 0;
        this.isAirborne = false;
      }
    } else {
      // Smoothly stick to ground/bridge elevation
      this.position.y = THREE.MathUtils.damp(this.position.y, groundY, 18, dt);
      this.velocity.y = 0;
      this.isAirborne = false;
    }

    // Speeds & Telemetry
    this.speedKmh = Math.round(speed * 3.6);
    this.driftSlip = Math.min(1.0, Math.abs(lateralSpeed) / 12.0);

    // Engine RPM calculation
    const speedPerGear = this.maxSpeedMs / 5.5;
    this.gear = Math.min(6, Math.max(1, Math.floor(speed / speedPerGear) + 1));
    const speedInGear = (speed % speedPerGear) / speedPerGear;
    this.rpm = THREE.MathUtils.damp(
      this.rpm,
      0.15 + (controls.throttle > 0 ? 0.35 + speedInGear * 0.5 : speedInGear * 0.3),
      10,
      dt
    );

    // Visual Chassis Suspension Roll & Pitch (includes subtle dip toward missing wheel side)
    const targetRoll = -lateralSpeed * 0.025 + missingRollBias;
    const targetPitch = this.isAirborne ? this.pitch : totalForwardAcc * 0.015;
    this.roll = THREE.MathUtils.damp(this.roll, targetRoll, 8, dt);
    this.pitch = THREE.MathUtils.damp(this.pitch, targetPitch, 8, dt);

    // Drift scoring
    let driftPointsAwarded = 0;
    if (this.isDrifting && this.speedKmh > 30) {
      const addedPoints = Math.round(
        this.driftSlip * this.speedKmh * dt * 8 * this.driftScoreMultiplier
      );
      this.driftScore += addedPoints;
      driftPointsAwarded = addedPoints;
    }

    return {
      collisionDamage: 0,
      driftPointsAwarded,
    };
  }

  public applyCollisionImpulse(normal: THREE.Vector3, impactSpeed: number) {
    // Rebound impulse
    this.velocity.addScaledVector(normal, impactSpeed * 0.85);
    const damage = Math.round(
      Math.min(35, Math.max(4, impactSpeed * 1.4)) * this.damageTakenMultiplier
    );
    this.health = Math.max(0, this.health - damage);
    return damage;
  }
}
