/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismDefaultParameterId } from '@framework/cubismdefaultparameterid';
import { CubismModelSettingJson } from '@framework/cubismmodelsettingjson';
import {
  BreathParameterData,
  CubismBreath
} from '@framework/effect/cubismbreath';
import { LookParameterData, CubismLook } from '@framework/effect/cubismlook';
import { CubismEyeBlink } from '@framework/effect/cubismeyeblink';
import { ICubismModelSetting } from '@framework/icubismmodelsetting';
import { CubismIdHandle } from '@framework/id/cubismid';
import { CubismFramework } from '@framework/live2dcubismframework';
import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { CubismUserModel } from '@framework/model/cubismusermodel';
import {
  ACubismMotion,
  BeganMotionCallback,
  FinishedMotionCallback
} from '@framework/motion/acubismmotion';
import { CubismMotion } from '@framework/motion/cubismmotion';
import {
  CubismMotionQueueEntryHandle,
  InvalidMotionQueueEntryHandleValue
} from '@framework/motion/cubismmotionqueuemanager';
import { CubismUpdateScheduler } from '@framework/motion/cubismupdatescheduler';
import { CubismBreathUpdater } from '@framework/motion/cubismbreathupdater';
import { CubismLookUpdater } from '@framework/motion/cubismlookupdater';
import { CubismEyeBlinkUpdater } from '@framework/motion/cubismeyeblinkupdater';
import { CubismExpressionUpdater } from '@framework/motion/cubismexpressionupdater';
import { CubismPhysicsUpdater } from '@framework/motion/cubismphysicsupdater';
import { CubismPoseUpdater } from '@framework/motion/cubismposeupdater';
import { CubismLipSyncUpdater } from '@framework/motion/cubismlipsyncupdater';
import { csmRect } from '@framework/type/csmrectf';
import {
  CSM_ASSERT,
  CubismLogError,
  CubismLogInfo
} from '@framework/utils/cubismdebug';

import * as LAppDefine from './lappdefine';
import { LAppPal } from './lapppal';
import { TextureInfo } from './lapptexturemanager';
import { LAppWavFileHandler } from './lappwavfilehandler';
import { CubismMoc } from '@framework/model/cubismmoc';
import { LAppDelegate } from './lappdelegate';
import { LAppSubdelegate } from './lappsubdelegate';

enum LoadStep {
  LoadAssets,
  LoadModel,
  WaitLoadModel,
  LoadExpression,
  WaitLoadExpression,
  LoadPhysics,
  WaitLoadPhysics,
  LoadPose,
  WaitLoadPose,
  SetupEyeBlink,
  SetupBreath,
  LoadUserData,
  WaitLoadUserData,
  SetupEyeBlinkIds,
  SetupLipSyncIds,
  SetupLook,
  SetupLayout,
  LoadMotion,
  WaitLoadMotion,
  CompleteInitialize,
  CompleteSetupModel,
  LoadTexture,
  WaitLoadTexture,
  CompleteSetup
}

interface MotionReference {
  group: string;
  index: number;
  file: string;
}

interface NeutralModelTransition {
  sourceParameters: number[];
  sourcePartOpacities: number[];
  sourceModelOpacity: number;
  elapsed: number;
  duration: number;
}

const NeutralTransitionDurationSeconds = 0.46;

// The legacy Pixi page deliberately used this compatibility-tested subset.
// Several alternate exports contain mutually exclusive hand/eye layers and
// were never part of the old page's playback pool.
const LegacyStableMotionFiles = new Set<string>([
  'home_a.motion3.json',
  'home_b.motion3.json',
  'idle_a.motion3.json',
  'idle_b.motion3.json',
  'idle_c.motion3.json',
  'login_b.motion3.json',
  'main_a.motion3.json',
  'main_b.motion3.json',
  'main_c.motion3.json',
  'touch_body_a.motion3.json',
  'touch_body_b.motion3.json',
  'touch_skirt_a.motion3.json',
  'touch_skirt_c.motion3.json',
  'touch_head_a.motion3.json',
  'touch_head_b.motion3.json',
  'touch_special_b.motion3.json'
]);

type MotionPlaybackKind = 'intro' | 'idle' | 'showcase' | 'interaction';

interface LegacyMotionCurve {
  Segments?: number[];
}

interface LegacyMotionJson {
  Meta?: Record<string, number | boolean>;
  Curves?: LegacyMotionCurve[];
}

/**
 * Some of the archived Yikesi motions were exported with Cubism 3 metadata
 * that omits the first point of every curve (except the first one). Older
 * runtimes silently over-allocated those arrays; Cubism R5 correctly trusts
 * the metadata. Recalculate only the allocation counters in memory so the
 * original model assets remain untouched and portable.
 */
function normalizeLegacyMotionBuffer(buffer: ArrayBuffer): ArrayBuffer {
  let motion: LegacyMotionJson;

  try {
    motion = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer))
    ) as LegacyMotionJson;
  } catch (_error) {
    return buffer;
  }

  if (!motion.Meta || !Array.isArray(motion.Curves)) return buffer;

  let totalSegmentCount = 0;
  let totalPointCount = 0;

  for (const curve of motion.Curves) {
    const segments = curve.Segments;
    if (!Array.isArray(segments) || segments.length < 2) return buffer;

    totalPointCount += 1;
    let position = 2;
    while (position < segments.length) {
      const segmentType = segments[position];
      totalSegmentCount += 1;

      if (segmentType === 1) {
        if (position + 6 >= segments.length) return buffer;
        totalPointCount += 3;
        position += 7;
      } else if (
        segmentType === 0 ||
        segmentType === 2 ||
        segmentType === 3
      ) {
        if (position + 2 >= segments.length) return buffer;
        totalPointCount += 1;
        position += 3;
      } else {
        return buffer;
      }
    }
  }

  if (
    motion.Meta.CurveCount === motion.Curves.length &&
    motion.Meta.TotalSegmentCount === totalSegmentCount &&
    motion.Meta.TotalPointCount === totalPointCount
  ) {
    return buffer;
  }

  motion.Meta.CurveCount = motion.Curves.length;
  motion.Meta.TotalSegmentCount = totalSegmentCount;
  motion.Meta.TotalPointCount = totalPointCount;

  const encoded = new TextEncoder().encode(JSON.stringify(motion));
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength
  ) as ArrayBuffer;
}

/**
 * ユーザーが実際に使用するモデルの実装クラス<br>
 * モデル生成、機能コンポーネント生成、更新処理とレンダリングの呼び出しを行う。
 */
export class LAppModel extends CubismUserModel {
  /**
   * model3.jsonが置かれたディレクトリとファイルパスからモデルを生成する
   * @param dir
   * @param fileName
   */
  public loadAssets(dir: string, fileName: string): void {
    this._modelHomeDir = dir;

    fetch(`${this._modelHomeDir}${fileName}`)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => {
        const setting: ICubismModelSetting = new CubismModelSettingJson(
          arrayBuffer,
          arrayBuffer.byteLength
        );

        // ステートを更新
        this._state = LoadStep.LoadModel;

        // 結果を保存
        this.setupModel(setting);
      })
      .catch(error => {
        // model3.json読み込みでエラーが発生した時点で描画は不可能なので、setupせずエラーをcatchして何もしない
        CubismLogError(`Failed to load file ${this._modelHomeDir}${fileName}`);
      });
  }

  /**
   * model3.jsonからモデルを生成する。
   * model3.jsonの記述に従ってモデル生成、モーション、物理演算などのコンポーネント生成を行う。
   *
   * @param setting ICubismModelSettingのインスタンス
   */
  private setupModel(setting: ICubismModelSetting): void {
    this._updating = true;
    this._initialized = false;

    this._modelSetting = setting;

    // CubismModel
    if (this._modelSetting.getModelFileName() != '') {
      const modelFileName = this._modelSetting.getModelFileName();

      fetch(`${this._modelHomeDir}${modelFileName}`)
        .then(response => {
          if (response.ok) {
            return response.arrayBuffer();
          } else if (response.status >= 400) {
            CubismLogError(
              `Failed to load file ${this._modelHomeDir}${modelFileName}`
            );
            return new ArrayBuffer(0);
          }
        })
        .then(arrayBuffer => {
          this.loadModel(arrayBuffer, this._mocConsistency);
          this.resolveModelParameterIds();
          this.captureNeutralModelState();
          this._state = LoadStep.LoadExpression;

          // callback
          loadCubismExpression();
        });

      this._state = LoadStep.WaitLoadModel;
    } else {
      LAppPal.printMessage('Model data does not exist.');
    }

    // Expression
    const loadCubismExpression = (): void => {
      if (this._modelSetting.getExpressionCount() > 0) {
        const count: number = this._modelSetting.getExpressionCount();

        for (let i = 0; i < count; i++) {
          const expressionName = this._modelSetting.getExpressionName(i);
          const expressionFileName =
            this._modelSetting.getExpressionFileName(i);

          fetch(`${this._modelHomeDir}${expressionFileName}`)
            .then(response => {
              if (response.ok) {
                return response.arrayBuffer();
              } else if (response.status >= 400) {
                CubismLogError(
                  `Failed to load file ${this._modelHomeDir}${expressionFileName}`
                );
                // ファイルが存在しなくてもresponseはnullを返却しないため、空のArrayBufferで対応する
                return new ArrayBuffer(0);
              }
            })
            .then(arrayBuffer => {
              const motion: ACubismMotion = this.loadExpression(
                arrayBuffer,
                arrayBuffer.byteLength,
                expressionName
              );

              if (this._expressions.get(expressionName) != null) {
                ACubismMotion.delete(this._expressions.get(expressionName));
                this._expressions.set(expressionName, null);
              }

              this._expressions.set(expressionName, motion);

              this._expressionCount++;

              if (this._expressionCount >= count) {
                // Expression Updaterの追加
                if (this._expressionManager != null) {
                  const expressionUpdater = new CubismExpressionUpdater(
                    this._expressionManager
                  );
                  this._updateScheduler.addUpdatableList(expressionUpdater);
                }

                this._state = LoadStep.LoadPhysics;

                // callback
                loadCubismPhysics();
              }
            });
        }
        this._state = LoadStep.WaitLoadExpression;
      } else {
        this._state = LoadStep.LoadPhysics;

        // callback
        loadCubismPhysics();
      }
    };

    // Physics
    const loadCubismPhysics = (): void => {
      if (this._modelSetting.getPhysicsFileName() != '') {
        const physicsFileName = this._modelSetting.getPhysicsFileName();

        fetch(`${this._modelHomeDir}${physicsFileName}`)
          .then(response => {
            if (response.ok) {
              return response.arrayBuffer();
            } else if (response.status >= 400) {
              CubismLogError(
                `Failed to load file ${this._modelHomeDir}${physicsFileName}`
              );
              return new ArrayBuffer(0);
            }
          })
          .then(arrayBuffer => {
            this.loadPhysics(arrayBuffer, arrayBuffer.byteLength);

            // Physics Updaterの追加
            if (this._physics) {
              const physicsUpdater = new CubismPhysicsUpdater(this._physics);
              this._updateScheduler.addUpdatableList(physicsUpdater);
            }

            this._state = LoadStep.LoadPose;

            // callback
            loadCubismPose();
          });
        this._state = LoadStep.WaitLoadPhysics;
      } else {
        this._state = LoadStep.LoadPose;

        // callback
        loadCubismPose();
      }
    };

    // Pose
    const loadCubismPose = (): void => {
      if (this._modelSetting.getPoseFileName() != '') {
        const poseFileName = this._modelSetting.getPoseFileName();

        fetch(`${this._modelHomeDir}${poseFileName}`)
          .then(response => {
            if (response.ok) {
              return response.arrayBuffer();
            } else if (response.status >= 400) {
              CubismLogError(
                `Failed to load file ${this._modelHomeDir}${poseFileName}`
              );
              return new ArrayBuffer(0);
            }
          })
          .then(arrayBuffer => {
            this.loadPose(arrayBuffer, arrayBuffer.byteLength);

            // Pose Updaterの追加
            if (this._pose) {
              const poseUpdater = new CubismPoseUpdater(this._pose);
              this._updateScheduler.addUpdatableList(poseUpdater);
            }

            this._state = LoadStep.SetupEyeBlink;

            // callback
            setupEyeBlink();
          });
        this._state = LoadStep.WaitLoadPose;
      } else {
        this._state = LoadStep.SetupEyeBlink;

        // callback
        setupEyeBlink();
      }
    };

    // EyeBlink
    const setupEyeBlink = (): void => {
      if (this._modelSetting.getEyeBlinkParameterCount() > 0) {
        this._eyeBlink = CubismEyeBlink.create(this._modelSetting);
        const eyeBlinkUpdater = new CubismEyeBlinkUpdater(
          () => this._motionUpdated,
          this._eyeBlink
        );
        this._updateScheduler.addUpdatableList(eyeBlinkUpdater);
      }

      this._state = LoadStep.SetupBreath;

      // callback
      setupBreath();
    };

    // Breath
    const setupBreath = (): void => {
      this._breath = CubismBreath.create();

      const breathParameters: Array<BreathParameterData> = [
        new BreathParameterData(this._idParamAngleX, 0.0, 15.0, 6.5345, 0.5),
        new BreathParameterData(this._idParamAngleY, 0.0, 8.0, 3.5345, 0.5),
        new BreathParameterData(this._idParamAngleZ, 0.0, 10.0, 5.5345, 0.5),
        new BreathParameterData(
          this._idParamBodyAngleX,
          0.0,
          4.0,
          15.5345,
          0.5
        ),
        new BreathParameterData(
          this._idParamBreath,
          0.5,
          0.5,
          3.2345,
          1
        )
      ];

      this._breath.setParameters(breathParameters);

      const breathUpdater = new CubismBreathUpdater(this._breath);
      this._updateScheduler.addUpdatableList(breathUpdater);

      this._state = LoadStep.LoadUserData;

      // callback
      loadUserData();
    };

    // UserData
    const loadUserData = (): void => {
      if (this._modelSetting.getUserDataFile() != '') {
        const userDataFile = this._modelSetting.getUserDataFile();

        fetch(`${this._modelHomeDir}${userDataFile}`)
          .then(response => {
            if (response.ok) {
              return response.arrayBuffer();
            } else if (response.status >= 400) {
              CubismLogError(
                `Failed to load file ${this._modelHomeDir}${userDataFile}`
              );
              return new ArrayBuffer(0);
            }
          })
          .then(arrayBuffer => {
            this.loadUserData(arrayBuffer, arrayBuffer.byteLength);

            this._state = LoadStep.SetupEyeBlinkIds;

            // callback
            setupEyeBlinkIds();
          });

        this._state = LoadStep.WaitLoadUserData;
      } else {
        this._state = LoadStep.SetupEyeBlinkIds;

        // callback
        setupEyeBlinkIds();
      }
    };

    // EyeBlinkIds
    const setupEyeBlinkIds = (): void => {
      const eyeBlinkIdCount: number =
        this._modelSetting.getEyeBlinkParameterCount();

      this._eyeBlinkIds.length = eyeBlinkIdCount;
      for (let i = 0; i < eyeBlinkIdCount; ++i) {
        this._eyeBlinkIds[i] = this._modelSetting.getEyeBlinkParameterId(i);
      }

      this._state = LoadStep.SetupLipSyncIds;

      // callback
      setupLipSyncIds();
    };

    // LipSyncIds
    const setupLipSyncIds = (): void => {
      const lipSyncIdCount = this._modelSetting.getLipSyncParameterCount();

      this._lipSyncIds.length = lipSyncIdCount;
      for (let i = 0; i < lipSyncIdCount; ++i) {
        this._lipSyncIds[i] = this._modelSetting.getLipSyncParameterId(i);
      }

      // LipSync Updaterの追加
      if (this._lipSyncIds.length > 0) {
        const lipSyncUpdater = new CubismLipSyncUpdater(
          this._lipSyncIds,
          this._wavFileHandler
        );
        this._updateScheduler.addUpdatableList(lipSyncUpdater);
      }

      this._state = LoadStep.SetupLook;

      // callback
      setupLook();
    };

    // Look
    const setupLook = (): void => {
      this._look = CubismLook.create();

      const lookParameters: Array<LookParameterData> = [
        new LookParameterData(this._idParamAngleX, 30.0, 0.0, 0.0),
        new LookParameterData(this._idParamAngleY, 0.0, 30.0, 0.0),
        new LookParameterData(this._idParamAngleZ, 0.0, 0.0, -30.0),
        new LookParameterData(this._idParamBodyAngleX, 10.0, 0.0, 0.0),
        new LookParameterData(
          this._idParamEyeBallX,
          1.0,
          0.0,
          0.0
        ),
        new LookParameterData(
          this._idParamEyeBallY,
          0.0,
          1.0,
          0.0
        )
      ];

      this._look.setParameters(lookParameters);

      const lookUpdater = new CubismLookUpdater(this._look, this._dragManager);
      this._updateScheduler.addUpdatableList(lookUpdater);

      // callback
      finalizeUpdaters();
    };

    // UpdateScheduler最終化処理
    const finalizeUpdaters = (): void => {
      // 全てのUpdaterが追加されたのでUpdateSchedulerを最終ソート
      this._updateScheduler.sortUpdatableList();

      this._state = LoadStep.SetupLayout;

      // callback
      setupLayout();
    };

    // Layout
    const setupLayout = (): void => {
      const layout: Map<string, number> = new Map<string, number>();

      if (this._modelSetting == null || this._modelMatrix == null) {
        CubismLogError('Failed to setupLayout().');
        return;
      }

      this._modelSetting.getLayoutMap(layout);
      this._modelMatrix.setupFromLayout(layout);
      // The archived model was positioned upward by the legacy Pixi renderer.
      // Preserve that composition while using more of the compact canvas.
      this._modelMatrix.translateY(this._modelMatrix.getTranslateY() + 0.12);
      this._state = LoadStep.LoadMotion;

      // callback
      loadCubismMotion();
    };

    // Motion
    const loadCubismMotion = (): void => {
      this._state = LoadStep.WaitLoadMotion;
      this._model.saveParameters();
      this._allMotionCount = 0;
      this._motionCount = 0;
      const group: string[] = [];

      const motionGroupCount: number = this._modelSetting.getMotionGroupCount();

      // モーションの総数を求める
      for (let i = 0; i < motionGroupCount; i++) {
        group[i] = this._modelSetting.getMotionGroupName(i);
        for (
          let motionIndex = 0;
          motionIndex < this._modelSetting.getMotionCount(group[i]);
          motionIndex++
        ) {
          const file = this._modelSetting.getMotionFileName(
            group[i],
            motionIndex
          );
          if (this.shouldLoadMotion(file)) this._allMotionCount++;
        }
      }

      // モーションの読み込み
      for (let i = 0; i < motionGroupCount; i++) {
        this.preLoadMotionGroup(group[i]);
      }

      if (this._allMotionCount === 0) this.completeMotionPreloadIfReady();
    };
  }

  /**
   * テクスチャユニットにテクスチャをロードする
   */
  private setupTextures(): void {
    // iPhoneでのアルファ品質向上のためTypescriptではpremultipliedAlphaを採用
    const usePremultiply = true;

    if (this._state == LoadStep.LoadTexture) {
      // テクスチャ読み込み用
      const textureCount: number = this._modelSetting.getTextureCount();

      for (
        let modelTextureNumber = 0;
        modelTextureNumber < textureCount;
        modelTextureNumber++
      ) {
        // テクスチャ名が空文字だった場合はロード・バインド処理をスキップ
        if (this._modelSetting.getTextureFileName(modelTextureNumber) == '') {
          console.log('getTextureFileName null');
          continue;
        }

        // WebGLのテクスチャユニットにテクスチャをロードする
        let texturePath =
          this._modelSetting.getTextureFileName(modelTextureNumber);
        texturePath = this._modelHomeDir + texturePath;

        // ロード完了時に呼び出すコールバック関数
        const onLoad = (textureInfo: TextureInfo): void => {
          this.getRenderer().bindTexture(modelTextureNumber, textureInfo.id);

          this._textureCount++;

          if (this._textureCount >= textureCount) {
            // ロード完了
            this._state = LoadStep.CompleteSetup;
            this.onSetupComplete();
          }
        };

        // 読み込み
        this._subdelegate
          .getTextureManager()
          .createTextureFromPngFile(texturePath, usePremultiply, onLoad);
        this.getRenderer().setIsPremultipliedAlpha(usePremultiply);
      }

      this._state = LoadStep.WaitLoadTexture;
    }
  }

  /**
   * レンダラを再構築する
   */
  public reloadRenderer(): void {
    this.deleteRenderer();
    this.createRenderer(
      this._subdelegate.getCanvas().width,
      this._subdelegate.getCanvas().height
    );
    this.setupTextures();
  }

  /**
   * 更新
   */
  public update(): void {
    if (this._state != LoadStep.CompleteSetup) return;

    const deltaTimeSeconds: number = LAppPal.getDeltaTime();
    this._userTimeSeconds += deltaTimeSeconds;

    //--------------------------------------------------------------------------
    this._model.loadParameters(); // 前回セーブされた状態をロード
    const transitionWasActive = this._neutralTransition != null;
    if (transitionWasActive) this.prepareNeutralTransitionTarget();

    // Reset motion updated flag each frame
    this._motionUpdated = false;

    if (!this._motionManager.isFinished()) {
      this._motionUpdated = this._motionManager.updateMotion(
        this._model,
        deltaTimeSeconds
      ); // モーションを更新
    }

    if (this._motionManager.isFinished() && this._activeMotionKind != null) {
      const completedKind = this._activeMotionKind;
      this._activeMotionKind = null;
      this._activeMotionFile = null;
      if (this._idleMotionEnabled) {
        this.playIdleMotion();
      } else if (completedKind !== 'idle') {
        this.beginNeutralModelTransition();
      }
    } else if (
      this._idleMotionEnabled &&
      this._activeMotionKind === 'idle' &&
      this._userTimeSeconds >= this._nextShowcaseMotionAt
    ) {
      this.playTimedShowcaseMotion();
    }
    if (transitionWasActive && this._neutralTransition) {
      this.applyNeutralModelTransition(deltaTimeSeconds);
    }
    this._model.saveParameters(); // 状態を保存
    //--------------------------------------------------------------------------

    // UpdateSchedulerによる一括エフェクト更新
    this._updateScheduler.onLateUpdate(this._model, deltaTimeSeconds);

    this._model.update();
  }

  /**
   * 引数で指定したモーションの再生を開始する
   * @param group モーショングループ名
   * @param no グループ内の番号
   * @param priority 優先度
   * @param onFinishedMotionHandler モーション再生終了時に呼び出されるコールバック関数
   * @return 開始したモーションの識別番号を返す。個別のモーションが終了したか否かを判定するisFinished()の引数で使用する。開始できない時は[-1]
   */
  public startMotion(
    group: string,
    no: number,
    priority: number,
    onFinishedMotionHandler?: FinishedMotionCallback,
    onBeganMotionHandler?: BeganMotionCallback
  ): CubismMotionQueueEntryHandle {
    if (priority == LAppDefine.PriorityForce) {
      this._motionManager.setReservePriority(priority);
    } else if (!this._motionManager.reserveMotion(priority)) {
      if (this._debugMode) {
        LAppPal.printMessage("[APP]can't start motion.");
      }
      return InvalidMotionQueueEntryHandleValue;
    }

    const motionFileName = this._modelSetting.getMotionFileName(group, no);

    // ex) idle_0
    const name = `${group}_${no}`;
    let motion: CubismMotion = this._motions.get(name) as CubismMotion;
    let autoDelete = false;

    if (motion == null) {
      fetch(`${this._modelHomeDir}${motionFileName}`)
        .then(response => {
          if (response.ok) {
            return response.arrayBuffer();
          } else if (response.status >= 400) {
            CubismLogError(
              `Failed to load file ${this._modelHomeDir}${motionFileName}`
            );
            return new ArrayBuffer(0);
          }
        })
        .then(arrayBuffer => {
          motion = this.loadMotion(
            arrayBuffer,
            arrayBuffer.byteLength,
            null,
            onFinishedMotionHandler,
            onBeganMotionHandler,
            this._modelSetting,
            group,
            no,
            this._motionConsistency
          );
        });

      if (motion) {
        motion.setEffectIds(this._eyeBlinkIds, this._lipSyncIds);
        autoDelete = true; // 終了時にメモリから削除
      } else {
        CubismLogError("Can't start motion {0} .", motionFileName);
        // ロードできなかったモーションのReservePriorityをリセットする
        this._motionManager.setReservePriority(LAppDefine.PriorityNone);
        return InvalidMotionQueueEntryHandleValue;
      }
    } else {
      motion.setBeganMotionHandler(onBeganMotionHandler);
      motion.setFinishedMotionHandler(onFinishedMotionHandler);
    }

    //voice
    const voice = this._modelSetting.getMotionSoundFileName(group, no);
    if (voice.localeCompare('') != 0) {
      let path = voice;
      path = this._modelHomeDir + path;
      this._wavFileHandler.start(path);
    }

    if (this._debugMode) {
      LAppPal.printMessage(`[APP]start motion: [${group}_${no}]`);
    }
    return this._motionManager.startMotionPriority(
      motion,
      autoDelete,
      priority
    );
  }

  /**
   * ランダムに選ばれたモーションの再生を開始する。
   * @param group モーショングループ名
   * @param priority 優先度
   * @param onFinishedMotionHandler モーション再生終了時に呼び出されるコールバック関数
   * @return 開始したモーションの識別番号を返す。個別のモーションが終了したか否かを判定するisFinished()の引数で使用する。開始できない時は[-1]
   */
  public startRandomMotion(
    group: string,
    priority: number,
    onFinishedMotionHandler?: FinishedMotionCallback,
    onBeganMotionHandler?: BeganMotionCallback
  ): CubismMotionQueueEntryHandle {
    if (this._modelSetting.getMotionCount(group) == 0) {
      return InvalidMotionQueueEntryHandleValue;
    }

    const no: number = Math.floor(
      Math.random() * this._modelSetting.getMotionCount(group)
    );

    return this.startMotion(
      group,
      no,
      priority,
      onFinishedMotionHandler,
      onBeganMotionHandler
    );
  }

  /**
   * 引数で指定した表情モーションをセットする
   *
   * @param expressionId 表情モーションのID
   */
  public setExpression(expressionId: string): void {
    const motion: ACubismMotion = this._expressions.get(expressionId);

    if (this._debugMode) {
      LAppPal.printMessage(`[APP]expression: [${expressionId}]`);
    }

    if (motion != null) {
      this._expressionManager.startMotion(motion, false);
    } else {
      if (this._debugMode) {
        LAppPal.printMessage(`[APP]expression[${expressionId}] is null`);
      }
    }
  }

  /**
   * ランダムに選ばれた表情モーションをセットする
   */
  public setRandomExpression(): void {
    if (this._expressions.size == 0) {
      return;
    }

    const no: number = Math.floor(Math.random() * this._expressions.size);

    for (let i = 0; i < this._expressions.size; i++) {
      if (i == no) {
        // const name: string = this._expressions._keyValues[i].first;
        const expressionsArray = [...this._expressions.entries()];
        const name: string = expressionsArray[i][0];
        this.setExpression(name);
        return;
      }
    }
  }

  /**
   * イベントの発火を受け取る
   */
  public motionEventFired(eventValue: string): void {
    CubismLogInfo('{0} is fired on LAppModel!!', eventValue);
  }

  /**
   * 当たり判定テスト
   * 指定ＩＤの頂点リストから矩形を計算し、座標をが矩形範囲内か判定する。
   *
   * @param hitArenaName  当たり判定をテストする対象のID
   * @param x             判定を行うX座標
   * @param y             判定を行うY座標
   */
  public hitTest(hitArenaName: string, x: number, y: number): boolean {
    // 透明時は当たり判定無し。
    if (this._opacity < 1) {
      return false;
    }

    const count: number = this._modelSetting.getHitAreasCount();

    for (let i = 0; i < count; i++) {
      if (this._modelSetting.getHitAreaName(i) == hitArenaName) {
        const drawId: CubismIdHandle = this._modelSetting.getHitAreaId(i);
        return this.isHit(drawId, x, y);
      }
    }

    return false;
  }

  /**
   * モーションデータをグループ名から一括でロードする。
   * モーションデータの名前は内部でModelSettingから取得する。
   *
   * @param group モーションデータのグループ名
   */
  public preLoadMotionGroup(group: string): void {
    for (let i = 0; i < this._modelSetting.getMotionCount(group); i++) {
      const motionFileName = this._modelSetting.getMotionFileName(group, i);
      if (!this.shouldLoadMotion(motionFileName)) continue;
      this.registerMotion(group, i, motionFileName);

      // ex) idle_0
      const name = `${group}_${i}`;
      if (this._debugMode) {
        LAppPal.printMessage(
          `[APP]load motion: ${motionFileName} => [${name}]`
        );
      }

      fetch(`${this._modelHomeDir}${motionFileName}`)
        .then(response => {
          if (response.ok) {
            return response.arrayBuffer();
          } else if (response.status >= 400) {
            CubismLogError(
              `Failed to load file ${this._modelHomeDir}${motionFileName}`
            );
            return new ArrayBuffer(0);
          }
        })
        .then(arrayBuffer => {
          const normalizedBuffer = normalizeLegacyMotionBuffer(arrayBuffer);
          const tmpMotion: CubismMotion = this.loadMotion(
            normalizedBuffer,
            normalizedBuffer.byteLength,
            name,
            null,
            null,
            this._modelSetting,
            group,
            i,
            this._motionConsistency
          );

          if (tmpMotion != null) {
            tmpMotion.setEffectIds(this._eyeBlinkIds, this._lipSyncIds);
            const isIdleMotion = motionFileName.toLowerCase().includes('idle_');
            // Standby return uses the full-state parameter transition below.
            // Entry into an action still crossfades smoothly from standby.
            tmpMotion.setFadeInTime(isIdleMotion ? 0.0 : 0.24);
            tmpMotion.setFadeOutTime(isIdleMotion ? 0.18 : 0.0);
            if (isIdleMotion) {
              // The archived model marks every motion as Loop. Only the true
              // standby motions should loop continuously in the R5 runtime.
              tmpMotion.setLoop(true);
              tmpMotion.setLoopFadeIn(false);
            } else {
              tmpMotion.setLoop(false);
            }

            if (this._motions.get(name) != null) {
              ACubismMotion.delete(this._motions.get(name));
            }

            this._motions.set(name, tmpMotion);

            this._motionCount++;
          } else {
            // loadMotionできなかった場合はモーションの総数がずれるので1つ減らす
            this._allMotionCount--;
          }

          this.completeMotionPreloadIfReady();
        })
        .catch(error => {
          this._allMotionCount--;
          CubismLogError(
            `Failed to parse motion ${motionFileName}: ${String(error)}`
          );
          this.completeMotionPreloadIfReady();
        });
    }
  }

  private completeMotionPreloadIfReady(): void {
    if (
      this._state !== LoadStep.WaitLoadMotion ||
      this._motionCount < this._allMotionCount
    ) {
      return;
    }

    this._state = LoadStep.LoadTexture;
    this._motionManager.stopAllMotions();
    this._updating = false;
    this._initialized = true;

    this.createRenderer(
      this._subdelegate.getCanvas().width,
      this._subdelegate.getCanvas().height
    );
    this.setupTextures();
    this.getRenderer().startUp(this._subdelegate.getGlManager().getGl());
    this.getRenderer().loadShaders(LAppDefine.ShaderPath);
  }

  /**
   * すべてのモーションデータを解放する。
   */
  public releaseMotions(): void {
    this._motions.clear();
  }

  /**
   * 全ての表情データを解放する。
   */
  public releaseExpressions(): void {
    this._expressions.clear();
  }

  /**
   * モデルを描画する処理。モデルを描画する空間のView-Projection行列を渡す。
   */
  public doDraw(): void {
    if (this._model == null) return;

    // キャンバスサイズを渡す
    const canvas = this._subdelegate.getCanvas();
    const viewport: number[] = [0, 0, canvas.width, canvas.height];

    this.getRenderer().setRenderState(
      this._subdelegate.getFrameBuffer(),
      viewport
    );
    this.getRenderer().drawModel(LAppDefine.ShaderPath);
  }

  /**
   * モデルを描画する処理。モデルを描画する空間のView-Projection行列を渡す。
   */
  public draw(matrix: CubismMatrix44): void {
    if (this._model == null) {
      return;
    }

    // 各読み込み終了後
    if (this._state == LoadStep.CompleteSetup) {
      matrix.multiplyByMatrix(this._modelMatrix);

      this.getRenderer().setMvpMatrix(matrix);

      this.doDraw();
    }
  }

  public async hasMocConsistencyFromFile() {
    CSM_ASSERT(this._modelSetting.getModelFileName().localeCompare(``));

    // CubismModel
    if (this._modelSetting.getModelFileName() != '') {
      const modelFileName = this._modelSetting.getModelFileName();

      const response = await fetch(`${this._modelHomeDir}${modelFileName}`);
      const arrayBuffer = await response.arrayBuffer();

      this._consistency = CubismMoc.hasMocConsistency(arrayBuffer);

      if (!this._consistency) {
        CubismLogInfo('Inconsistent MOC3.');
      } else {
        CubismLogInfo('Consistent MOC3.');
      }

      return this._consistency;
    } else {
      LAppPal.printMessage('Model data does not exist.');
    }
  }

  public setSubdelegate(subdelegate: LAppSubdelegate): void {
    this._subdelegate = subdelegate;
  }

  /** Resolve the Cubism 2-style IDs used by the archived model. */
  private resolveModelParameterIds(): void {
    this._idParamAngleX = this.resolveParameterId([
      'PARAM_ANGLE_X',
      CubismDefaultParameterId.ParamAngleX
    ]);
    this._idParamAngleY = this.resolveParameterId([
      'PARAM_ANGLE_Y',
      CubismDefaultParameterId.ParamAngleY
    ]);
    this._idParamAngleZ = this.resolveParameterId([
      'PARAM_ANGLE_Z',
      CubismDefaultParameterId.ParamAngleZ
    ]);
    this._idParamBodyAngleX = this.resolveParameterId([
      'PARAM_BODY_ANGLE_X',
      CubismDefaultParameterId.ParamBodyAngleX
    ]);
    this._idParamEyeBallX = this.resolveParameterId([
      'PARAM_EYE_BALL_X',
      CubismDefaultParameterId.ParamEyeBallX
    ]);
    this._idParamEyeBallY = this.resolveParameterId([
      'PARAM_EYE_BALL_Y',
      CubismDefaultParameterId.ParamEyeBallY
    ]);
    this._idParamBreath = this.resolveParameterId([
      'PARAM_BREATH',
      CubismDefaultParameterId.ParamBreath
    ]);
  }

  private shouldLoadMotion(file: string): boolean {
    if (!this._modelHomeDir?.toLowerCase().includes('/yikesi/')) return true;
    const normalized = file.toLowerCase().split('/').pop() || '';
    return LegacyStableMotionFiles.has(normalized);
  }

  /** Capture the untouched MOC state used by the legacy override animator. */
  private captureNeutralModelState(): void {
    this._neutralParameterValues = [];
    this._neutralPartOpacities = [];
    for (let i = 0; i < this._model.getParameterCount(); i++) {
      this._neutralParameterValues.push(
        this._model.getParameterValueByIndex(i)
      );
    }
    for (let i = 0; i < this._model.getPartCount(); i++) {
      this._neutralPartOpacities.push(this._model.getPartOpacityByIndex(i));
    }
  }

  private applyNeutralBaseState(): void {
    const parameterCount = Math.min(
      this._model.getParameterCount(),
      this._neutralParameterValues.length
    );
    for (let i = 0; i < parameterCount; i++) {
      this._model.setParameterValueByIndex(i, this._neutralParameterValues[i]);
    }
    const partCount = Math.min(
      this._model.getPartCount(),
      this._neutralPartOpacities.length
    );
    for (let i = 0; i < partCount; i++) {
      this._model.setPartOpacityByIndex(i, this._neutralPartOpacities[i]);
    }
    this._model.setModelOapcity(1.0);
  }

  private applyModelSnapshot(transition: NeutralModelTransition): void {
    const parameterCount = Math.min(
      this._model.getParameterCount(),
      transition.sourceParameters.length
    );
    for (let i = 0; i < parameterCount; i++) {
      this._model.setParameterValueByIndex(i, transition.sourceParameters[i]);
    }
    const partCount = Math.min(
      this._model.getPartCount(),
      transition.sourcePartOpacities.length
    );
    for (let i = 0; i < partCount; i++) {
      this._model.setPartOpacityByIndex(
        i,
        transition.sourcePartOpacities[i]
      );
    }
    this._model.setModelOapcity(transition.sourceModelOpacity);
  }

  /**
   * Capture every visible model value at the end of a full-body motion. The
   * next standby frame becomes the target of a parameter-by-parameter eased
   * transition, so no stale hand, eye, clothing or accessory state survives.
   */
  private beginNeutralModelTransition(): void {
    if (!this._model || !this._neutralParameterValues.length) return;
    const transition: NeutralModelTransition = {
      sourceParameters: [],
      sourcePartOpacities: [],
      sourceModelOpacity: this._model.getModelOapcity(),
      elapsed: 0,
      duration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 0
        : NeutralTransitionDurationSeconds
    };
    for (let i = 0; i < this._model.getParameterCount(); i++) {
      transition.sourceParameters.push(this._model.getParameterValueByIndex(i));
    }
    for (let i = 0; i < this._model.getPartCount(); i++) {
      transition.sourcePartOpacities.push(
        this._model.getPartOpacityByIndex(i)
      );
    }

    this._expressionManager?.stopAllMotions();
    this.applyNeutralBaseState();
    this._pose?.reset(this._model);
    // Stabilize physical particles at the neutral pose, then put the source
    // values back for this rendered frame. Subsequent frames interpolate into
    // the newly stabilized hair/clothing/accessory state.
    this._physics?.stabilization(this._model);
    this.applyModelSnapshot(transition);
    this._neutralTransition = transition;
    this._neutralRestoreCount++;
  }

  private prepareNeutralTransitionTarget(): void {
    if (!this._neutralTransition) return;
    this.applyNeutralBaseState();
  }

  private applyNeutralModelTransition(deltaTimeSeconds: number): void {
    const transition = this._neutralTransition;
    if (!transition) return;
    transition.elapsed += Math.max(0, deltaTimeSeconds);
    const progress = transition.duration <= 0
      ? 1
      : Math.min(1, transition.elapsed / transition.duration);
    // Smoothstep gives zero velocity at both ends and avoids a visible snap.
    const weight = progress * progress * (3 - 2 * progress);

    const parameterCount = Math.min(
      this._model.getParameterCount(),
      transition.sourceParameters.length
    );
    for (let i = 0; i < parameterCount; i++) {
      const target = this._model.getParameterValueByIndex(i);
      const source = transition.sourceParameters[i];
      this._model.setParameterValueByIndex(
        i,
        source + (target - source) * weight
      );
    }
    const partCount = Math.min(
      this._model.getPartCount(),
      transition.sourcePartOpacities.length
    );
    for (let i = 0; i < partCount; i++) {
      const target = this._model.getPartOpacityByIndex(i);
      const source = transition.sourcePartOpacities[i];
      this._model.setPartOpacityByIndex(
        i,
        source + (target - source) * weight
      );
    }
    const targetOpacity = this._model.getModelOapcity();
    this._model.setModelOapcity(
      transition.sourceModelOpacity +
        (targetOpacity - transition.sourceModelOpacity) * weight
    );

    if (progress >= 1) this._neutralTransition = null;
  }

  private resolveParameterId(candidates: string[]): CubismIdHandle {
    const parameterCount = this._model.getParameterCount();
    for (const candidate of candidates) {
      const id = CubismFramework.getIdManager().getId(candidate);
      if (this._model.getParameterIndex(id) < parameterCount) return id;
    }
    return CubismFramework.getIdManager().getId(candidates[0]);
  }

  public setIdleMotionEnabled(enabled: boolean): void {
    this._idleMotionEnabled = !!enabled;
    if (this._idleMotionEnabled) {
      this._nextShowcaseMotionAt = this._userTimeSeconds + 15;
      if (
        this._state === LoadStep.CompleteSetup &&
        this._motionManager.isFinished()
      ) {
        this.playIdleMotion();
      }
    } else if (this._activeMotionKind === 'idle') {
      this._motionManager.stopAllMotions();
      this.beginNeutralModelTransition();
      this._activeMotionKind = null;
      this._activeMotionFile = null;
    }
  }

  /** Whether the current motion benefits from the active (30/24 FPS) profile. */
  public isMotionActive(): boolean {
    return this._state == LoadStep.CompleteSetup && (
      this._neutralTransition != null || (
        !this._motionManager.isFinished() &&
        this._activeMotionKind !== 'idle'
      )
    );
  }

  public getMotionStatus(): Record<string, unknown> {
    return {
      active: this._state === LoadStep.CompleteSetup &&
        !this._motionManager.isFinished(),
      kind: this._activeMotionKind || 'none',
      file: this._activeMotionFile,
      loadedMotionCount: this._motionReferences.length,
      neutralRestoreCount: this._neutralRestoreCount,
      transition: this._neutralTransition
        ? {
            duration: this._neutralTransition.duration,
            progress: this._neutralTransition.duration <= 0
              ? 1
              : Math.min(
                  1,
                  Math.round(
                    this._neutralTransition.elapsed /
                      this._neutralTransition.duration * 100
                  ) / 100
                )
          }
        : null,
      nextShowcaseIn: this._idleMotionEnabled
        ? Math.max(
            0,
            Math.round((this._nextShowcaseMotionAt - this._userTimeSeconds) * 10) / 10
          )
        : null,
      look: {
        x: Math.round(this._dragManager.getX() * 100) / 100,
        y: Math.round(this._dragManager.getY() * 100) / 100,
        parameterId: this._idParamAngleX?.getString?.() || null
      }
    };
  }

  public playTapMotion(normalizedX: number, normalizedY: number): number {
    if (this._state != LoadStep.CompleteSetup) return 0;

    let part = 0;
    let pool: MotionReference[] = [];
    if (
      normalizedX > 0.34 && normalizedX < 0.66 &&
      normalizedY > 0.02 && normalizedY < 0.3
    ) {
      part = 1;
      pool = this._touchHeadMotions;
    } else if (
      normalizedX > 0.32 && normalizedX < 0.68 &&
      normalizedY >= 0.27 && normalizedY < 0.66
    ) {
      part = 2;
      pool = this._touchBodyMotions;
    } else if (
      normalizedX > 0.3 && normalizedX < 0.7 &&
      normalizedY >= 0.62 && normalizedY < 0.84
    ) {
      part = 3;
      pool = this._touchSkirtMotions;
    } else if (
      normalizedX > 0.16 && normalizedX < 0.46 &&
      normalizedY > 0.18 && normalizedY < 0.58
    ) {
      part = 4;
      pool = this._touchSpecialMotions;
    }

    if (!part || !this.playFromPool(
      pool,
      LAppDefine.PriorityForce,
      'interaction'
    )) return 0;
    this._nextShowcaseMotionAt = this._userTimeSeconds + 15;
    return part;
  }

  private onSetupComplete(): void {
    this._ready = true;
    this._nextShowcaseMotionAt = this._userTimeSeconds + 15;
    if (this._idleMotionEnabled) {
      const loginMotion = this._loginMotions.find(motion =>
        motion.file.toLowerCase().includes('login_b')
      ) || this._loginMotions[0];
      if (!loginMotion || !this.playMotionReference(
        loginMotion,
        LAppDefine.PriorityForce,
        'intro'
      )) {
        this.playIdleMotion();
      }
    }

    window.dispatchEvent(new CustomEvent('yusen:live2d-ready', {
      detail: {
        renderer: 'Cubism Web SDK R5',
        motionCount: this._motionReferences.length
      }
    }));
  }

  private registerMotion(group: string, index: number, file: string): void {
    const motion = { group, index, file };
    const normalized = file.toLowerCase();
    this._motionReferences.push(motion);
    if (normalized.includes('touch_head')) this._touchHeadMotions.push(motion);
    else if (normalized.includes('touch_body')) this._touchBodyMotions.push(motion);
    else if (normalized.includes('touch_skirt')) this._touchSkirtMotions.push(motion);
    else if (normalized.includes('touch_special')) this._touchSpecialMotions.push(motion);
    else if (normalized.includes('login_')) this._loginMotions.push(motion);
    else if (normalized.includes('home_')) this._homeMotions.push(motion);
    else if (normalized.includes('main_')) this._mainMotions.push(motion);
    else if (normalized.includes('idle_')) this._idleMotions.push(motion);
  }

  private playMotionReference(
    motion: MotionReference,
    priority: number,
    kind: MotionPlaybackKind
  ): boolean {
    if (!motion) return false;
    if (kind === 'idle' && this._activeMotionKind !== 'idle') {
      this.beginNeutralModelTransition();
    } else if (kind !== 'idle') {
      // If the visitor starts another action while the return transition is
      // still running, use the currently blended pose as that action's source.
      this._neutralTransition = null;
    }
    const started = this.startMotion(motion.group, motion.index, priority) !==
      InvalidMotionQueueEntryHandleValue;
    if (started) {
      this._activeMotionKind = kind;
      this._activeMotionFile = motion.file;
      if (kind !== 'idle') {
        const family = this.getMotionFamily(motion.file);
        if (family) this._preferredIdleFamily = family;
      }
    }
    return started;
  }

  private playFromPool(
    pool: MotionReference[],
    priority: number,
    kind: MotionPlaybackKind
  ): boolean {
    if (!pool.length) return false;
    const motion = pool[Math.floor(Math.random() * pool.length)];
    return this.playMotionReference(motion, priority, kind);
  }

  private getMotionFamily(file: string): string | null {
    const match = file.toLowerCase().match(/_([abc])(?:_|\.)/);
    return match ? match[1] : null;
  }

  private playIdleMotion(): boolean {
    if (!this._idleMotionEnabled) return false;
    const preferred = this._idleMotions.find(motion =>
      this.getMotionFamily(motion.file) === this._preferredIdleFamily
    );
    if (preferred && this.playMotionReference(
      preferred,
      LAppDefine.PriorityIdle,
      'idle'
    )) {
      return true;
    }
    if (this.playFromPool(
      this._idleMotions,
      LAppDefine.PriorityIdle,
      'idle'
    )) {
      return true;
    }
    return this.playFromPool(
      this._homeMotions,
      LAppDefine.PriorityIdle,
      'idle'
    );
  }

  private playTimedShowcaseMotion(): void {
    let started = false;
    if (this._mainMotions.length) {
      const motion = this._mainMotions[
        this._automaticMotionCount++ % this._mainMotions.length
      ];
      started = this.playMotionReference(
        motion,
        LAppDefine.PriorityForce,
        'showcase'
      );
    }
    if (!started) {
      started = this.playFromPool(
        this._homeMotions,
        LAppDefine.PriorityForce,
        'showcase'
      );
    }
    this._nextShowcaseMotionAt = this._userTimeSeconds + 15;
    if (!started && this._motionManager.isFinished()) this.playIdleMotion();
  }

  /**
   * デストラクタに相当する処理のオーバーライド
   */
  public release(): void {
    if (this._look) {
      CubismLook.delete(this._look);
      this._look = null;
    }
    if (this._updateScheduler) {
      this._updateScheduler.release();
    }
    super.release();
  }

  /**
   * コンストラクタ
   */
  public constructor() {
    super();

    this._modelSetting = null;
    this._modelHomeDir = null;
    this._userTimeSeconds = 0.0;

    this._eyeBlinkIds = new Array<CubismIdHandle>();
    this._lipSyncIds = new Array<CubismIdHandle>();

    this._motions = new Map<string, ACubismMotion>();
    this._expressions = new Map<string, ACubismMotion>();

    this._hitArea = new Array<csmRect>();
    this._userArea = new Array<csmRect>();

    this._idParamAngleX = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamAngleX
    );
    this._idParamAngleY = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamAngleY
    );
    this._idParamAngleZ = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamAngleZ
    );
    this._idParamBodyAngleX = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamBodyAngleX
    );
    this._idParamEyeBallX = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamEyeBallX
    );
    this._idParamEyeBallY = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamEyeBallY
    );
    this._idParamBreath = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamBreath
    );

    if (LAppDefine.MOCConsistencyValidationEnable) {
      this._mocConsistency = true;
    }

    if (LAppDefine.MotionConsistencyValidationEnable) {
      this._motionConsistency = true;
    }

    this._state = LoadStep.LoadAssets;
    this._expressionCount = 0;
    this._textureCount = 0;
    this._motionCount = 0;
    this._allMotionCount = 0;
    this._wavFileHandler = new LAppWavFileHandler();
    this._consistency = false;
    this._look = null;
    this._updateScheduler = new CubismUpdateScheduler();
    this._motionUpdated = false;
    this._idleMotionEnabled = true;
    this._ready = false;
    this._nextShowcaseMotionAt = 0;
    this._automaticMotionCount = 0;
    this._activeMotionKind = null;
    this._activeMotionFile = null;
    this._preferredIdleFamily = 'b';
    this._motionReferences = [];
    this._idleMotions = [];
    this._mainMotions = [];
    this._loginMotions = [];
    this._homeMotions = [];
    this._touchHeadMotions = [];
    this._touchBodyMotions = [];
    this._touchSkirtMotions = [];
    this._touchSpecialMotions = [];
    this._neutralParameterValues = [];
    this._neutralPartOpacities = [];
    this._neutralRestoreCount = 0;
    this._neutralTransition = null;
  }

  private _updateScheduler: CubismUpdateScheduler; // アップデートスケジューラー
  private _motionUpdated: boolean; // モーション更新フラグ
  private _subdelegate: LAppSubdelegate; // サブデリゲート

  _modelSetting: ICubismModelSetting; // モデルセッティング情報
  _modelHomeDir: string; // モデルセッティングが置かれたディレクトリ
  _userTimeSeconds: number; // デルタ時間の積算値[秒]

  _eyeBlinkIds: Array<CubismIdHandle>; // モデルに設定された瞬き機能用パラメータID
  _lipSyncIds: Array<CubismIdHandle>; // モデルに設定されたリップシンク機能用パラメータID

  _motions: Map<string, ACubismMotion>; // 読み込まれているモーションのリスト
  _expressions: Map<string, ACubismMotion>; // 読み込まれている表情のリスト

  _hitArea: Array<csmRect>;
  _userArea: Array<csmRect>;

  _idParamAngleX: CubismIdHandle; // パラメータID: ParamAngleX
  _idParamAngleY: CubismIdHandle; // パラメータID: ParamAngleY
  _idParamAngleZ: CubismIdHandle; // パラメータID: ParamAngleZ
  _idParamBodyAngleX: CubismIdHandle; // パラメータID: ParamBodyAngleX
  _idParamEyeBallX: CubismIdHandle;
  _idParamEyeBallY: CubismIdHandle;
  _idParamBreath: CubismIdHandle;

  _look: CubismLook; // ドラッグ追従

  _state: LoadStep; // 現在のステータス管理用
  _expressionCount: number; // 表情データカウント
  _textureCount: number; // テクスチャカウント
  _motionCount: number; // モーションデータカウント
  _allMotionCount: number; // モーション総数
  _wavFileHandler: LAppWavFileHandler; //wavファイルハンドラ
  _consistency: boolean; // MOC3整合性チェック管理用
  private _idleMotionEnabled: boolean;
  private _ready: boolean;
  private _nextShowcaseMotionAt: number;
  private _automaticMotionCount: number;
  private _activeMotionKind: MotionPlaybackKind | null;
  private _activeMotionFile: string | null;
  private _preferredIdleFamily: string;
  private _motionReferences: MotionReference[];
  private _idleMotions: MotionReference[];
  private _mainMotions: MotionReference[];
  private _loginMotions: MotionReference[];
  private _homeMotions: MotionReference[];
  private _touchHeadMotions: MotionReference[];
  private _touchBodyMotions: MotionReference[];
  private _touchSkirtMotions: MotionReference[];
  private _touchSpecialMotions: MotionReference[];
  private _neutralParameterValues: number[];
  private _neutralPartOpacities: number[];
  private _neutralRestoreCount: number;
  private _neutralTransition: NeutralModelTransition | null;
}
