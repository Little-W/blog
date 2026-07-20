//var baseModelPath = window.location.protocol+'//cdn.'+ window.location.host+"/Resource/live2d/";
var baseModelPath = "/live2d/live2dv3/assets/" ;
var modelNames = ["yikesi"];
var modelPath;
var app;
var tag_target = '.waifu';
var click_part = 1;
var idle_motion_int ;
var action_timer;
var motion_return_timer;
var motion_watchdog;
var motion_generation = 0;
var current_motion_index = -1;
var drag_live2d = false;
var canvas = document.querySelector(tag_target);
var view = canvas.querySelector('canvas');
var waifu = document.getElementById('waifu');
var waifutips = document.getElementById('waifu-tips');

var Index_a = new Array(30);
var Index_b = new Array(30);
var Index_c = new Array(30);
var cnt_a = 0;
var cnt_b = 0;
var cnt_c = 0;
var homeIndex;
var touch_bodyIndex = new Array(10);
var touch_headIndex = new Array(10);
var touch_specialIndex = new Array(10);
var touch_skirtIndex = new Array(10);
var mainIndex = new Array(20);
var cnt_body = 0;
var cnt_head = 0;
var cnt_sp = 0;
var cnt_main = 0;
var cnt_skirt = 0;

var idleIndex_a;
var loginIndex_a;
var homeIndex_a;


var idleIndex_b;
var loginIndex_b;
var homeIndex_b;

var idleIndex_c;
var loginIndex_c;
var homeIndex_c;

var modelWidth = Math.max(170, Math.min(240, window.innerWidth/7));
var modelHight = modelWidth*1.3;
var scale = modelHight;
//var scale = 25;
var model_x = 0;
var model_y = -50 + (350-modelWidth)/10;
//var model_y = 0;
var startTime;
var live2dFrameRequest = 0;
var live2dLastFrame = 0;
var live2dRenderPaused = document.hidden;
var live2dEnvironmentPaused = false;
var live2dContextPaused = false;
var live2dScrollPaused = false;
var live2dInViewport = true;
var live2dLowPowerDevice = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4);
var live2dActiveFps = live2dLowPowerDevice ? 24 : 30;
var live2dFrameCost = 0;
var live2dFrameSamples = 0;
var live2dSlowSamples = 0;
var live2dFastSamples = 0;
var live2dControlState = window.YusenLive2DControls
    ? window.YusenLive2DControls.getState()
    : {scale: 1, mouseTracking: true, idleMotion: true};
var live2dMouseTrackingEnabled = live2dControlState.mouseTracking !== false;
var live2dIdleMotionEnabled = live2dControlState.idleMotion !== false;
var live2dDisplayScale = Number(live2dControlState.scale) || 1;
var live2dCurrentModel = null;
var live2dCurrentMotions = null;

function getLive2dFrameRateLimit() {
    var effects = window.YusenEffects || {};
    var frameRate = Number(
        typeof effects.getLive2DFrameRate === "function"
            ? effects.getLive2DFrameRate()
            : (typeof effects.getFrameRate === "function" ? effects.getFrameRate() : 0)
    );
    return [15, 24, 30, 45, 60].indexOf(frameRate) !== -1 ? frameRate : 0;
}

function getLive2dFrameInterval() {
    var frameRateLimit = getLive2dFrameRateLimit();
    var targetFps = live2dActiveFps;
    if (frameRateLimit) targetFps = Math.min(targetFps, frameRateLimit);
    return 1000 / targetFps;
}

window.__live2dPerformance = {
    activeFps: live2dActiveFps,
    maxWidth: 240,
    motionCount: 0,
    averageFrameCost: 0,
    renderedFrames: 0,
    renderer: "initializing",
    webgpuAvailable: !!navigator.gpu,
    lowPowerProfile: !!live2dLowPowerDevice,
    frameRateLimit: getLive2dFrameRateLimit(),
    recoveredMotions: 0
};

function markLive2dInteraction() {
    // 兼容控制接口：交互不再改变渲染帧率。
}

function resetLive2dTickerClock(timestamp) {
    live2dLastFrame = timestamp || performance.now();
    if (!app || !app.ticker) return;
    app.ticker.lastTime = live2dLastFrame;
    if (typeof app.ticker._lastFrame === "number") app.ticker._lastFrame = live2dLastFrame;
}

function updateLive2dPerformanceProfile(frameCost) {
    live2dFrameCost += frameCost;
    live2dFrameSamples++;
    window.__live2dPerformance.renderedFrames++;
    if (live2dFrameSamples < 60) return;

    var average = live2dFrameCost / live2dFrameSamples;
    window.__live2dPerformance.averageFrameCost = Math.round(average * 100) / 100;
    live2dFrameCost = 0;
    live2dFrameSamples = 0;

    if (average > 12) {
        live2dSlowSamples++;
        live2dFastSamples = 0;
    } else if (average < 7) {
        live2dFastSamples++;
        live2dSlowSamples = 0;
    } else {
        live2dSlowSamples = 0;
        live2dFastSamples = 0;
    }

    if (live2dSlowSamples >= 2 && live2dActiveFps > 24) {
        live2dActiveFps = 24;
        live2dSlowSamples = 0;
    } else if (live2dFastSamples >= 4 && !live2dLowPowerDevice && live2dActiveFps < 30) {
        live2dActiveFps = 30;
        live2dFastSamples = 0;
    }
    window.__live2dPerformance.activeFps = live2dActiveFps;
}

window.__setLive2dRenderingEnabled = function (enabled) {
    live2dEnvironmentPaused = !enabled;
    resetLive2dTickerClock();
    if (enabled) resumeLive2dRenderLoop();
    else stopLive2dRenderLoop();
};

function stopLive2dRenderLoop() {
    if (!live2dFrameRequest) return;
    window.cancelAnimationFrame(live2dFrameRequest);
    live2dFrameRequest = 0;
}

function resumeLive2dRenderLoop() {
    if (!app || live2dRenderPaused || live2dEnvironmentPaused || live2dContextPaused || !live2dInViewport) return;
    resetLive2dTickerClock();
    startLive2dRenderLoop();
}

function startLive2dRenderLoop() {
    if (live2dFrameRequest) return;
    function renderLive2dFrame(timestamp) {
        live2dFrameRequest = window.requestAnimationFrame(renderLive2dFrame);
        if (!app || live2dRenderPaused || live2dEnvironmentPaused || live2dContextPaused || live2dScrollPaused || !live2dInViewport) {
            live2dLastFrame = timestamp;
            return;
        }
        var frameInterval = getLive2dFrameInterval();
        var elapsed = timestamp - live2dLastFrame;
        if (elapsed + 0.5 < frameInterval) return;
        live2dLastFrame = elapsed > frameInterval * 2
            ? timestamp
            : live2dLastFrame + frameInterval;
        var frameStarted = performance.now();
        app.ticker.update(timestamp);
        updateLive2dPerformanceProfile(performance.now() - frameStarted);
        window.__live2dPerformance.frameRateLimit = getLive2dFrameRateLimit();
    }
    live2dFrameRequest = window.requestAnimationFrame(renderLive2dFrame);
}

document.addEventListener('visibilitychange', function () {
    live2dRenderPaused = document.hidden;
    resetLive2dTickerClock();
    if (live2dRenderPaused) stopLive2dRenderLoop();
    else resumeLive2dRenderLoop();
});

var live2dScrollTimer;
window.addEventListener('scroll', function () {
    live2dScrollPaused = true;
    window.clearTimeout(live2dScrollTimer);
    live2dScrollTimer = window.setTimeout(function () {
        live2dScrollPaused = false;
        resetLive2dTickerClock();
    }, 100);
}, {passive: true});

if ('IntersectionObserver' in window && waifu) {
    new IntersectionObserver(function (entries) {
        live2dInViewport = entries[0].isIntersecting;
        resetLive2dTickerClock();
        if (live2dInViewport) resumeLive2dRenderLoop();
        else stopLive2dRenderLoop();
    }).observe(waifu);
}
function loadMotions(motions){
    var motionCount = 0 ;
    if(motions.length >0){
        for (var i = 0; i < motions.length; i++) {
            PIXI.loader.add('motion'+ ( motionCount + 1) , modelPath.substr(0, modelPath.lastIndexOf('/') + 1) + motions[i].File, { xhrType: PIXI.loaders.Resource.XHR_RESPONSE_TYPE.JSON });
			if(motions[i].File.indexOf('idle_a')!= -1){
                idleIndex_a = motionCount;
            }else if(motions[i].File.indexOf('login_a') != -1){
                loginIndex_a = motionCount;
            }else if(motions[i].File.indexOf('home_a') != -1){
                homeIndex_a = motionCount;
            }else if(motions[i].File.indexOf('idle_b')!= -1){
                idleIndex_b = motionCount;
            }else if(motions[i].File.indexOf('login_b') != -1){
                loginIndex_b = motionCount;
            }else if(motions[i].File.indexOf('home_b') != -1){
                homeIndex_b = motionCount;
            }else if(motions[i].File.indexOf('idle_c')!= -1){
                idleIndex_c = motionCount;
            }else if(motions[i].File.indexOf('login_c') != -1){
                loginIndex_c = motionCount;
            }else if(motions[i].File.indexOf('home_c') != -1){
                homeIndex_c = motionCount;
            }else if(motions[i].File.indexOf('touch_body') != -1){
				touch_bodyIndex[cnt_body] = motionCount;
				cnt_body++;
			}else if(motions[i].File.indexOf('touch_head') != -1){
				touch_headIndex[cnt_head] = motionCount;
				cnt_head++;
			}else if(motions[i].File.indexOf('touch_special') != -1){
				touch_specialIndex[cnt_sp] = motionCount;
				cnt_sp++;
			}else if(motions[i].File.indexOf('touch_skirt') != -1){
				touch_skirtIndex[cnt_skirt] = motionCount;
				cnt_skirt++;
			}else if(motions[i].File.indexOf('main') != -1){
				mainIndex[cnt_main] = motionCount;
				cnt_main++;
			}
			
			
			if(motions[i].File.indexOf('_b') != -1){
                Index_b[cnt_b] = motionCount;
				cnt_b++;
			}
			if(motions[i].File.indexOf('_a') != -1){
                Index_a[cnt_a] = motionCount;
				cnt_a++;
			}
			if(motions[i].File.indexOf('_c') != -1){
                Index_c[cnt_c] = motionCount;
				cnt_c++;
			}
			
			motionCount++;
        }
    }else{
        console.error('Not find motions')
    }
	// console.log(Index_a,Index_b,Index_c);
	// console.log(touch_bodyIndex,touch_headIndex,touch_specialIndex,mainIndex);
	
	// console.log(idleIndex_a,idleIndex_b,idleIndex_c);
	// console.log(loginIndex_a,loginIndex_b,loginIndex_c);
}
function loadModel(){
    var modelName =  modelNames[Math.floor(Math.random() * modelNames.length )];
    modelPath =  baseModelPath + modelName +"/"+ modelName + ".model3.json";
    var ajax = null;
    if(window.XMLHttpRequest){ajax = new XMLHttpRequest();}else if(window.ActiveObject){
        ajax = new ActiveXObject("Microsoft.XMLHTTP");
    }else{
        throw new Error('loadModelJsonError');
    }  
    ajax.open('GET', modelPath, true);
    ajax.send();
    ajax.onreadystatechange = function(){
        if(ajax.readyState == 4){  
            if(ajax.status == 200){ 
                var data = JSON.parse(ajax.responseText)
                initModel(data);
            }else{
                console.error('Response error,Code:' + ajax.status);
            }
        }
    };
}
function initModel(data){
    var model3Obj = {data:data,url: modelPath.substr(0, modelPath.lastIndexOf('/') + 1)};
    PIXI.loader.reset();
    PIXI.utils.destroyTextureCache();
    Index_a = new Array(30);
    Index_b = new Array(30);
    Index_c = new Array(30);
    touch_bodyIndex = new Array(10);
    touch_headIndex = new Array(10);
    touch_specialIndex = new Array(10);
    touch_skirtIndex = new Array(10);
    mainIndex = new Array(20);
    cnt_a = cnt_b = cnt_c = cnt_body = cnt_head = cnt_sp = cnt_main = cnt_skirt = 0;
    idleIndex_a = loginIndex_a = homeIndex_a = undefined;
    idleIndex_b = loginIndex_b = homeIndex_b = undefined;
    idleIndex_c = loginIndex_c = homeIndex_c = undefined;
    window.__live2dPerformance.motionCount = 0;
    var preferredMotions = {
        'motions/home_a.motion3.json': true,
        'motions/home_b.motion3.json': true,
        'motions/idle_a.motion3.json': true,
        'motions/idle_b.motion3.json': true,
        'motions/idle_c.motion3.json': true,
        'motions/login_b.motion3.json': true,
        'motions/main_a.motion3.json': true,
        'motions/main_b.motion3.json': true,
        'motions/main_c.motion3.json': true,
        'motions/touch_body_a.motion3.json': true,
        'motions/touch_body_b.motion3.json': true,
        'motions/touch_skirt_a.motion3.json': true,
        'motions/touch_skirt_c.motion3.json': true,
        'motions/touch_head_a.motion3.json': true,
        'motions/touch_head_b.motion3.json': true,
        'motions/touch_special_b.motion3.json': true
    };
    for (var key in data.FileReferences.Motions) {
        var availableMotions = data.FileReferences.Motions[key];
        var selectedMotions = availableMotions.filter(function (motion) {
            return preferredMotions[motion.File];
        });
        loadMotions(selectedMotions.length ? selectedMotions : availableMotions);
        window.__live2dPerformance.motionCount += (selectedMotions.length ? selectedMotions : availableMotions).length;
    }
    new LIVE2DCUBISMPIXI.ModelBuilder().buildFromModel3Json(
     PIXI.loader
       .on("start", loadStartHandler)
       //.on("progress", loadProgressHandler)
       .on("complete", loadCompleteHandler),
     model3Obj,
     setModel
    );
	
}

function installLive2dCompatibilityBridge(onResize) {
    window.YusenLive2DRenderer = {
        version: "compatibility",
        renderer: "Cubism Pixi compatibility renderer",
        setMouseTrackingEnabled: function (enabled) {
            live2dMouseTrackingEnabled = !!enabled;
            track_enabled = live2dMouseTrackingEnabled;
            markLive2dInteraction(1000);
        },
        setIdleMotionEnabled: function (enabled) {
            live2dIdleMotionEnabled = !!enabled;
            window.clearTimeout(motion_return_timer);
            if (live2dIdleMotionEnabled && live2dCurrentModel && live2dCurrentMotions) {
                restartLive2dIdleTimer(live2dCurrentModel, live2dCurrentMotions);
            } else {
                window.clearInterval(idle_motion_int);
            }
            markLive2dInteraction(1200);
        },
        setRenderingEnabled: function (enabled) {
            window.__setLive2dRenderingEnabled(enabled);
        },
        markInteraction: markLive2dInteraction,
        getStatus: function () {
            return window.__live2dPerformance;
        }
    };
    if (typeof onResize === "function") onResize();
    window.dispatchEvent(new CustomEvent("yusen:live2d-renderer-ready", {
        detail: {version: "compatibility", renderer: "Cubism Pixi compatibility renderer"}
    }));
}

function setModel(model){
		live2dCurrentModel = model;
		if(app != null){app.stop();}
		if( modelWidth < 150 ) 
		{	
			modelWidth = 150;
			modelHight = modelWidth*1.3;;
			scale =  modelHight;
			model_y = -40 + (350-modelWidth)/10;
			
			console.log('Model too small');
		}
		if( modelWidth < 150 ) waifutips.style.visibility = "hidden";
		else waifutips.style.visibility = "inherit";
		app = new PIXI.Application(modelWidth, modelHight, {
			transparent: true,
			view: view,
			autoStart: false,
			antialias: false,
			resolution: 1,
			forceCanvas: false,
			preserveDrawingBuffer: false,
			clearBeforeRender: true,
			powerPreference: live2dLowPowerDevice ? "low-power" : "high-performance"
		});
		window.__live2dPerformance.renderer = app.renderer.type === PIXI.RENDERER_TYPE.WEBGL
			? "webgl"
			: "canvas";
		view.addEventListener("webglcontextlost", function (event) {
			event.preventDefault();
			live2dContextPaused = true;
			window.__live2dPerformance.renderer = "webgl-context-lost";
			stopLive2dRenderLoop();
		}, false);
		view.addEventListener("webglcontextrestored", function () {
			live2dContextPaused = false;
			window.__live2dPerformance.renderer = "webgl";
			window.__live2dPerformance.contextRestores = (window.__live2dPerformance.contextRestores || 0) + 1;
			resetLive2dTickerClock();
			resumeLive2dRenderLoop();
		}, false);
		app.stage.addChild(model);
		app.stage.addChild(model.masks);
		var live2d = document.getElementById("live2d");
		var motions = setMotions(model,PIXI.loader.resources);
		live2dCurrentMotions = motions;
		setMouseTrick(model,app,live2d,motions);
		app.stop();
		startLive2dRenderLoop();
		var onResize = function (event) {
			if (event === void 0) { event = null; }
				var width = modelWidth * live2dDisplayScale;
				var height = modelHight * live2dDisplayScale;
				app.view.style.width = width + "px";
				app.view.style.height = height + "px";
				app.renderer.resize(modelWidth, modelHight);
				model.position = new PIXI.Point(modelWidth/2 + model_x, modelHight/2 + model_y);
				model.scale = new PIXI.Point(scale, scale);
				model.masks.resize(app.view.width, app.view.height);
		};
		onResize();
		window.addEventListener('resize', onResize, {passive: true});
		restartLive2dIdleTimer(model, motions);

		
		//waifu.appendChild(click_div);
		waifu.style.visibility = "visible";
		waifu.style.width = modelWidth * live2dDisplayScale + "px";
		waifu.style.height = modelWidth * 1.3 * live2dDisplayScale + "px";
		waifutips.style.fontSize = modelWidth/400*16 + 'px';
		if(modelWidth/400*16 < 7)
			waifutips.style.fontSize = 7 + 'px';
		waifutips.style.width = Math.max(150, ((modelWidth-370)+350) * live2dDisplayScale) + 'px';
		installLive2dCompatibilityBridge(onResize);

}
var last_idle_motion = 0;
function isLive2dMotionIndexValid(motions, index) {
    return typeof index === "number" && isFinite(index) && index >= 0 &&
        index < motions.length && !!motions[index];
}

function motionFamilyContains(index, family, count) {
    for (var i = 0; i < count; i++) {
        if (family[i] === index) return true;
    }
    return false;
}

function getIdleMotionIndex(motions, sourceIndex) {
    var candidates;
    if (motionFamilyContains(sourceIndex, Index_a, cnt_a)) {
        candidates = [idleIndex_a, idleIndex_b, idleIndex_c, 0];
    } else if (motionFamilyContains(sourceIndex, Index_c, cnt_c)) {
        candidates = [idleIndex_c, idleIndex_b, idleIndex_a, 0];
    } else {
        candidates = [idleIndex_b, idleIndex_a, idleIndex_c, 0];
    }
    for (var i = 0; i < candidates.length; i++) {
        if (isLive2dMotionIndexValid(motions, candidates[i])) return candidates[i];
    }
    for (var j = 0; j < motions.length; j++) {
        if (isLive2dMotionIndexValid(motions, j)) return j;
    }
    return -1;
}

function playLive2dMotion(model, motions, index, options) {
    options = options || {};
    if (!model || !model.animator || !motions || !motions.length) return false;
    var layer = model.animator.getLayer("motion");
    if (!layer) return false;

    if (!isLive2dMotionIndexValid(motions, index)) {
        index = getIdleMotionIndex(motions, index);
    }
    if (!isLive2dMotionIndexValid(motions, index)) return false;

    motion_generation++;
    var generation = motion_generation;
    window.clearTimeout(motion_return_timer);
    window.clearTimeout(action_timer);

    var motion = motions[index];
    var duration = Math.max(0.25, Math.min(30, Number(motion.duration) || 2));
    if (layer.isPlaying) layer.stop();
    layer._goalAnimation = null;
    layer.play(motion);
    track_enabled = options.fullBody ? false : live2dMouseTrackingEnabled;
    current_motion_index = index;
    window.__live2dPerformance.currentMotion = index;
    window.__live2dPerformance.motionPlaying = true;

    if (options.fullBody) {
        markLive2dInteraction(duration * 1000 + 1000);
        action_timer = window.setTimeout(function () {
            if (generation === motion_generation) track_enabled = live2dMouseTrackingEnabled;
        }, duration * 1000 + 120);
    }

    if (options.returnToIdle !== false && live2dIdleMotionEnabled) {
        var idleIndex = getIdleMotionIndex(motions, index);
        if (isLive2dMotionIndexValid(motions, idleIndex) && idleIndex !== index) {
            motion_return_timer = window.setTimeout(function () {
                if (generation !== motion_generation) return;
                playLive2dMotion(model, motions, idleIndex, {
                    fullBody: false,
                    returnToIdle: false
                });
            }, duration * 1000 + 40);
        }
    }
    return true;
}

function restartLive2dIdleTimer(model, motions) {
    window.clearInterval(idle_motion_int);
    if (!live2dIdleMotionEnabled || !motions || !motions.length) return;
    idle_motion_int = window.setInterval(function () {
        Set_idle_motions(model, motions);
    }, 15000);
}

function startLive2dMotionWatchdog(model, motions) {
    window.clearInterval(motion_watchdog);
    var lastTime = -1;
    var stalledChecks = 0;
    motion_watchdog = window.setInterval(function () {
        if (!live2dIdleMotionEnabled) return;
        if (live2dRenderPaused || live2dEnvironmentPaused || live2dContextPaused || !live2dInViewport) {
            lastTime = -1;
            stalledChecks = 0;
            return;
        }
        var layer = model && model.animator && model.animator.getLayer("motion");
        var motionStopped = !layer || !layer.isPlaying || !layer.currentAnimation || !isFinite(layer.currentTime);
        if (!motionStopped && lastTime >= 0 && Math.abs(layer.currentTime - lastTime) < 0.001) {
            stalledChecks++;
        } else {
            stalledChecks = 0;
        }
        if (motionStopped || stalledChecks >= 2) {
            window.__live2dPerformance.recoveredMotions++;
            playLive2dMotion(model, motions, getIdleMotionIndex(motions, current_motion_index), {
                fullBody: false,
                returnToIdle: false
            });
            resetLive2dTickerClock();
            stalledChecks = 0;
        }
        lastTime = layer && isFinite(layer.currentTime) ? layer.currentTime : -1;
    }, 4000);
}

function Set_idle_motions(model, motions) {
    if (!live2dIdleMotionEnabled) return;
    var motionIndex = -1;
    if (cnt_main > 0) {
        if (last_idle_motion >= cnt_main) last_idle_motion = 0;
        motionIndex = mainIndex[last_idle_motion++];
    }
    if (!isLive2dMotionIndexValid(motions, motionIndex)) {
        motionIndex = getIdleMotionIndex(motions, current_motion_index);
    }
    playLive2dMotion(model, motions, motionIndex, {
        fullBody: motionFamilyContains(motionIndex, mainIndex, cnt_main),
        returnToIdle: true
    });
}

function setMotions(model,resources){
    var motions = [];
    Object.keys(resources).filter(function (key) {
        return /^motion\d+$/.test(key);
    }).sort(function (a, b) {
        return Number(a.slice(6)) - Number(b.slice(6));
    }).forEach(function (key) {
        motions.push(LIVE2DCUBISMFRAMEWORK.Animation.fromMotion3Json(resources[key].data));
    });
    if(motions.length > 0){
        model.animator.addLayer("motion", LIVE2DCUBISMFRAMEWORK.BuiltinAnimationBlenders.OVERRIDE, 1.0);
        var initialIndex = isLive2dMotionIndexValid(motions, loginIndex_b)
            ? loginIndex_b
            : getIdleMotionIndex(motions, 0);
        playLive2dMotion(model, motions, initialIndex, {
            fullBody: initialIndex === loginIndex_b,
            returnToIdle: true
        });
        startLive2dMotionWatchdog(model, motions);
    }
    return motions;
}
function setMouseTrick(model, pixiApp, live2dCanvas, motions) {
    var rect;
    var pointerX;
    var pointerY;
    var centerX;
    var centerY;
    var pendingPointer;
    var pointerFrame = 0;
    var pointerResetTimer;
    var blurTimer;
    var lastHomeIndex = homeIndex_b;

    function parameterIndex(primary, legacy) {
        var index = model.parameters.ids.indexOf(primary);
        return index >= 0 ? index : model.parameters.ids.indexOf(legacy);
    }

    var angleX = parameterIndex("ParamAngleX", "PARAM_ANGLE_X");
    var angleY = parameterIndex("ParamAngleY", "PARAM_ANGLE_Y");
    var eyeX = parameterIndex("ParamEyeBallX", "PARAM_EYE_BALL_X");
    var eyeY = parameterIndex("ParamEyeBallY", "PARAM_EYE_BALL_Y");
    var bodyX = parameterIndex("ParamBodyAngleX", "PARAM_BODY_ANGLE_X");
    var bodyY = parameterIndex("ParamBodyAngleY", "PARAM_BODY_ANGLE_Y");
    var bodyZ = parameterIndex("ParamAngleZ", "PARAM_BODY_ANGLE_Z");

    function setParameter(index, value) {
        if (index >= 0) model.parameters.values[index] = value;
    }

    function updateCanvasBounds() {
        rect = live2dCanvas.getBoundingClientRect();
        centerX = rect.left + rect.width * 0.23;
        centerY = rect.top + rect.height * 0.5;
        if (pointerX == null || pointerY == null) {
            pointerX = centerX;
            pointerY = centerY;
        }
    }

    function chooseMotion(indices, count) {
        var valid = [];
        for (var i = 0; i < count; i++) {
            if (isLive2dMotionIndexValid(motions, indices[i])) valid.push(indices[i]);
        }
        return valid.length ? valid[Math.floor(Math.random() * valid.length)] : -1;
    }

    function restartTipsTimer() {
        if (typeof Hitokoto === "undefined") return;
        window.clearInterval(Hitokoto);
        if (typeof showHitokoto === "function") {
            Hitokoto = window.setInterval(showHitokoto, 15000);
        }
    }

    updateCanvasBounds();
    window.addEventListener("resize", updateCanvasBounds, {passive: true});

    pixiApp.ticker.add(function (deltaTime) {
        if (live2dMouseTrackingEnabled) {
            var x = pointerX - centerX;
            var y = pointerY - centerY;
            setParameter(angleX, x * 0.1);
            setParameter(angleY, -y * 0.1);
            setParameter(eyeX, x * 0.002);
            setParameter(eyeY, -y * 0.002);
            setParameter(bodyX, x * 0.005);
            setParameter(bodyY, -y * 0.01);
        }
        model.update(deltaTime);
        model.masks.update(pixiApp.renderer);
    });

    window.addEventListener("pointermove", function (event) {
        if (!live2dMouseTrackingEnabled && !drag_live2d) return;
        pendingPointer = {x: event.clientX, y: event.clientY};
        if (pointerFrame) return;
        pointerFrame = window.requestAnimationFrame(function () {
            pointerFrame = 0;
            if (!pendingPointer) return;
            pointerX = pendingPointer.x;
            pointerY = pendingPointer.y;
            pendingPointer = null;
            markLive2dInteraction(2500);
            window.clearTimeout(pointerResetTimer);
            pointerResetTimer = window.setTimeout(function () {
                pointerX = centerX;
                pointerY = centerY;
            }, 5000);
            if (drag_live2d) {
                setParameter(bodyZ, (pointerX - rect.left - rect.width * 0.5) * 0.1);
            }
        });
    }, {passive: true});

    live2dCanvas.addEventListener("pointerdown", function () {
        if (window.YusenLive2DControls && window.YusenLive2DControls.isMoveMode()) return;
        drag_live2d = true;
        markLive2dInteraction();
    });
    window.addEventListener("pointerup", function () {
        if (!drag_live2d) return;
        drag_live2d = false;
        setParameter(bodyZ, 0);
    }, {passive: true});

    live2dCanvas.addEventListener("pointerup", function (event) {
        if (window.YusenLive2DControls && window.YusenLive2DControls.isMoveMode()) return;
        updateCanvasBounds();
        if (!rect.width || !rect.height || !motions.length) return;
        var x = (event.clientX - rect.left) / rect.width;
        var y = (event.clientY - rect.top) / rect.height;
        var motionIndex = -1;

        if (x > 0.4448 && x < 0.569 && y > 0 && y < 0.22) {
            click_part = 1;
            motionIndex = chooseMotion(touch_headIndex, cnt_head);
        } else if (x > 0.431 && x < 0.592 && y > 0.22 && y < 0.65) {
            click_part = 2;
            motionIndex = chooseMotion(touch_bodyIndex, cnt_body);
        } else if (x > 0.4 && x < 0.592 && y > 0.65 && y < 0.72) {
            click_part = 3;
            motionIndex = chooseMotion(touch_skirtIndex, cnt_skirt);
        } else if (x > 0.293 && x < 0.454 && y > 0.165 && y < 0.54) {
            click_part = 4;
            motionIndex = chooseMotion(touch_specialIndex, cnt_sp);
        }

        if (!isLive2dMotionIndexValid(motions, motionIndex)) return;
        if (typeof click_message === "function") click_message();
        playLive2dMotion(model, motions, motionIndex, {
            fullBody: true,
            returnToIdle: true
        });
        restartLive2dIdleTimer(model, motions);
        restartTipsTimer();
    });

    sessionStorage.setItem("Onblur", "0");
    window.addEventListener("blur", function () {
        window.clearTimeout(blurTimer);
        blurTimer = window.setTimeout(function () {
            sessionStorage.setItem("Onblur", "1");
        }, 30000);
    });
    window.addEventListener("focus", function () {
        window.clearTimeout(blurTimer);
        resetLive2dTickerClock();
        if (sessionStorage.getItem("Onblur") === "1") {
            var homeMotion = lastHomeIndex === homeIndex_a ? homeIndex_b : homeIndex_a;
            if (!isLive2dMotionIndexValid(motions, homeMotion)) {
                homeMotion = isLive2dMotionIndexValid(motions, homeIndex_b) ? homeIndex_b : homeIndex_a;
            }
            lastHomeIndex = homeMotion;
            playLive2dMotion(model, motions, homeMotion, {
                fullBody: true,
                returnToIdle: true
            });
        }
        sessionStorage.setItem("Onblur", "0");
        restartLive2dIdleTimer(model, motions);
    });
}

function loadStartHandler() {
    startTime = new Date();
}
function loadCompleteHandler(){
    var loadTime = new Date().getTime() - startTime.getTime();
    console.log('Model initialized in '+ loadTime/1000 + ' second');
    loadTips();
    PIXI.loader.off("start", loadStartHandler);
    PIXI.loader.off("complete", loadCompleteHandler);
}
