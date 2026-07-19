var LIVE2DCUBISMCORE = Live2DCubismCore
//var baseModelPath = window.location.protocol+'//cdn.'+ window.location.host+"/Resource/live2d/";
var baseModelPath = "/live2d/live2dv3/assets/" ;
var modelNames = ["yikesi"];
var modelPath;
var app;
var tag_target = '.waifu';
var click_part = 1;
var click_wait = 0;
var idle_motion_int ;

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

var modelWidth = window.innerWidth/7;
var modelHight = modelWidth*1.3;
var scale = modelHight;
//var scale = 25;
var model_x = 0;
var model_y = -50 + (350-modelWidth)/10;
var canvas_x;
//var model_y = 0;
var startTime;
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
    for (var key in data.FileReferences.Motions) {
        loadMotions(data.FileReferences.Motions[key]);
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
function setModel(model){
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
		app = new PIXI.Application(modelWidth, modelHight, {transparent: true ,view:view});
		app.stage.addChild(model);
		app.stage.addChild(model.masks);
		var click_div = document.createElement("div");
		var motions = setMotions(model,PIXI.loader.resources);
		setMouseTrick(model,app,click_div,motions);
		var onResize = function (event) {
			if (event === void 0) { event = null; }
				var width = modelWidth;
				var height = modelHight;
				app.view.style.width = width + "px";
				app.view.style.height = height + "px";
				app.renderer.resize(width, height);
				model.position = new PIXI.Point(modelWidth/2 + model_x, modelHight/2 + model_y);
				model.scale = new PIXI.Point(scale, scale);
				model.masks.resize(app.view.width, app.view.height);
		};
		onResize();
		window.onresize = onResize;
		idle_motion_int = setInterval(function() {
			Set_idle_motions(model,motions);
		}, 15000);

		
		click_div.setAttribute("class","click_div");
		click_div.style.width = modelWidth*0.46 + "px";
		click_div.style.height = modelWidth * 1.17 + "px";
		click_div.style.position = "absolute";
		click_div.style.zIndex = 1;
		waifu.appendChild(click_div);
		waifu.style.visibility = "visible";
		waifu.style.width = modelWidth + "px";
		waifu.style.height = modelWidth * 1.3 + "px";
		waifutips.style.fontSize = modelWidth/400*16 + 'px';
		if(modelWidth/400*16 < 7)
			waifutips.style.fontSize = 7 + 'px';
		waifutips.style.width = (modelWidth-370)+350 + 'px';

}
var last_idle_motion = 0;
function Set_idle_motions(model,motions)
{
			if(last_idle_motion >= cnt_main)	last_idle_motion = 0;
			var idle_index = mainIndex[last_idle_motion];
			last_idle_motion++;
            //model.animator.getLayer("motion").stop();
			console.log('motion num:' + idle_index);
			var is_a = 0;
			var is_b = 0;
			var is_c = 0;
            if(null != idleIndex_a){
				for(var i = 0;i<cnt_a;i++)
				{
					if(idle_index==Index_a[i])
					{
						is_a = 1;
						console.log('is a');
						timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_a]);}, motions[idle_index].duration * 1000 );
						break;
					}
				}
				if(!is_a && null != idleIndex_b)
				{
					for(var i = 0;i<cnt_b;i++)
					{
						if(idle_index==Index_b[i])
						{
							is_b = 1;
							console.log('is b');
							timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_b]);}, motions[idle_index].duration * 1000 );
							break;
						}
					}
				}	

					if(!is_b && !is_a && null != idleIndex_c)
					{
						for(var i = 0;i<cnt_c;i++)
						{
							if(idle_index==Index_c[i])
							{
								console.log('is c');
								is_c = 1;
								timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_c]);}, motions[idle_index].duration * 1000 );
								break;
							}
						}
					}
				
				if(!(is_c || is_b || is_a))
				{
					model.animator.getLayer("motion").play(motions[0]);
				}
            }
	
}
function setMotions(model,resources){
    var motions = [];
    for (var key in resources) {
        if(key.indexOf('motion') != -1){
            motions.push(LIVE2DCUBISMFRAMEWORK.Animation.fromMotion3Json(resources[key].data)); 
        }
    }
    var timeOut;
    if(motions.length > 0){
        window.clearTimeout(timeOut);
        model.animator.addLayer("motion", LIVE2DCUBISMFRAMEWORK.BuiltinAnimationBlenders.OVERRIDE, 1.0);
        if(null != loginIndex_b && null != idleIndex_b){
            model.animator.getLayer("motion").play(motions[loginIndex_b]);
            timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_b]);}, motions[loginIndex_b].duration * 1000 );
        }else{
			console.error('no longin');
            model.animator.getLayer("motion").play(motions[0]);
        }
    }
	
    return motions;
}
var mouse_move_init = 0;
var center_x,center_y;
function setMouseTrick(model,app,canvas,motions){
    var rect = canvas.getBoundingClientRect();
    var angle_x = model.parameters.ids.indexOf("ParamAngleX");
    if(angle_x < 0){ angle_x = model.parameters.ids.indexOf("PARAM_ANGLE_X"); }
    var angle_y = model.parameters.ids.indexOf("ParamAngleY");
    if(angle_y < 0){ angle_y = model.parameters.ids.indexOf("PARAM_ANGLE_Y"); }
	if(angle_x < 0){ angle_x = model.parameters.ids.indexOf("PARAM_ANGLE_X"); }
    var angle_y = model.parameters.ids.indexOf("ParamAngleY");
    if(angle_y < 0){ angle_y = model.parameters.ids.indexOf("PARAM_ANGLE_Y"); }
	var eye_x = model.parameters.ids.indexOf("ParamEyeBallX");
    if(eye_x < 0){ eye_x = model.parameters.ids.indexOf("PARAM_EYE_BALL_X"); }
    var eye_y = model.parameters.ids.indexOf("ParamEyeBallY");
    if(eye_y < 0){ eye_y = model.parameters.ids.indexOf("PARAM_EYE_BALL_Y"); }
	
	var body_x = model.parameters.ids.indexOf("ParamBodyAngleX");
    if( body_x < 0){ body_x = model.parameters.ids.indexOf("Param_BodyAngle_X"); }
    var body_y = model.parameters.ids.indexOf("ParamAngleY");
    if(body_y < 0){ body_y = model.parameters.ids.indexOf("Param_BodyAngle_Y"); }
    app.ticker.add(function (deltaTime) {
        rect = canvas.getBoundingClientRect();
        center_x = modelWidth*0.23 + rect.left, center_y = modelWidth*1.3/2 + rect.top;
		if(!mouse_move_init){
			mouse_x = center_x, mouse_y = center_y;
			mouse_move_init = 1;
		}
        var x = mouse_x - center_x;
        var y = mouse_y - center_y;
        model.parameters.values[angle_x] = x * 0.05;
        model.parameters.values[angle_y] = -y * 0.05;
        model.parameters.values[eye_x] = x * 0.002;
        model.parameters.values[eye_y] = -y * 0.002;
		model.parameters.values[body_x] = x * 0.02;
        model.parameters.values[body_y] = -y * 0.05;
        model.update(deltaTime);
        model.masks.update(app.renderer);
    });
    var scrollElm = bodyOrHtml();
    var mouseMove;
    document.body.addEventListener("mousemove", function(e){
        window.clearTimeout(mouseMove);
		mouse_x = e.pageX - scrollElm.scrollLeft;
		mouse_y = e.pageY - scrollElm.scrollTop;
        mouseMove =  window.setTimeout(function(){mouse_x = center_x , mouse_y = center_y} , 5000);
    });
    var timeOut;

    canvas.addEventListener("click", function(e){
		is_reload = 1 ;
        window.clearTimeout(timeOut);
		clearInterval(idle_motion_int);
		clearInterval(Hitokoto);
        if( motions.length == 0){ return; }
        if((rect.left + rect.width*0.38) < mouse_x && mouse_x < (rect.left + rect.width *0.65) && rect.top  < mouse_y && mouse_y < (rect.top + rect.height*0.2)){
            var rand = touch_headIndex[Math.floor(Math.random() * cnt_head)];
			console.log('is head');
			click_part = 1;
			click_message();
			//loadTips();
            model.animator.getLayer("motion").stop();
            model.animator.getLayer("motion").play(motions[rand]);
			console.log('motion num:' + rand);
			var is_a = 0;
			var is_b = 0;
			var is_c = 0;
			
            if(null != idleIndex_a){
				for(var i = 0;i<cnt_a;i++)
				{
					if(rand==Index_a[i])
					{
						is_a = 1;
						console.log('is a');
						timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_a]);}, motions[rand].duration * 1000 );
						break;
					}
				}
				if(!is_a && null != idleIndex_b)
				{
					for(var i = 0;i<cnt_b;i++)
					{
						if(rand==Index_b[i])
						{
							is_b = 1;
							console.log('is b');
							timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_b]);}, motions[rand].duration * 1000 );
							break;
						}
					}
					if(!is_b && null != idleIndex_c)
					{
						for(var i = 0;i<cnt_c;i++)
						{
							if(rand==Index_c[i])
							{
								console.log('is c');
								is_c = 1;
								timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_c]);}, motions[rand].duration * 1000 );
								break;
							}
						}
					}
				}	

            }
				if(!(is_c || is_b || is_a))
				{
					model.animator.getLayer("motion").play(motions[0]);
				}

        }
		else if((rect.left + rect.width*0.35) < mouse_x && mouse_x < (rect.left + rect.width *0.7) && rect.top + rect.height*0.2 < mouse_y && mouse_y < (rect.top + rect.height*0.6)){
            var rand = touch_bodyIndex[Math.floor(Math.random() * cnt_body)];
			console.log('is body');
			click_part = 2;
			//loadTips();
			click_message();
            model.animator.getLayer("motion").stop();
            model.animator.getLayer("motion").play(motions[rand]);
			console.log('motion num:' + rand);
			var is_a = 0;
			var is_b = 0;
			var is_c = 0;
            if(null != idleIndex_a){
				for(var i = 0;i<cnt_a;i++)
				{
					if(rand==Index_a[i])
					{
						is_a = 1;
						console.log('is a');
						timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_a]);}, motions[rand].duration * 1000 );
						break;
					}
				}
				if(!is_a && null != idleIndex_b)
				{
					for(var i = 0;i<cnt_b;i++)
					{
						if(rand==Index_b[i])
						{
							is_b = 1;
							console.log('is b');
							timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_b]);}, motions[rand].duration * 1000 );
							break;
						}
					}
				}	

					if(!is_b && !is_a && null != idleIndex_c)
					{
						for(var i = 0;i<cnt_c;i++)
						{
							if(rand==Index_c[i])
							{
								console.log('is c');
								is_c = 1;
								timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_c]);}, motions[rand].duration * 1000 );
								break;
							}
						}
					}
				
				if(!(is_c || is_b || is_a))
				{
					model.animator.getLayer("motion").play(motions[0]);
				}
            }
        }else if((rect.left + rect.width*0.35) < mouse_x && mouse_x < (rect.left + rect.width *0.7) && rect.top + rect.height*0.6 < mouse_y && mouse_y < (rect.top + rect.height*0.8)){
            var rand = touch_skirtIndex[Math.floor(Math.random() * cnt_skirt)];
			console.log('is skirt');
			click_part = 3;
			//loadTips();
			click_message();
            model.animator.getLayer("motion").stop();
            model.animator.getLayer("motion").play(motions[rand]);
			console.log('motion num:' + rand);
			var is_a = 0;
			var is_b = 0;
			var is_c = 0;
            if(null != idleIndex_a){
				for(var i = 0;i<cnt_a;i++)
				{
					if(rand==Index_a[i])
					{
						is_a = 1;
						console.log('is a');
						timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_a]);}, motions[rand].duration * 1000 );
						break;
					}
				}
				if(!is_a && null != idleIndex_b)
				{
					for(var i = 0;i<cnt_b;i++)
					{
						if(rand==Index_b[i])
						{
							is_b = 1;
							console.log('is b');
							timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_b]);}, motions[rand].duration * 1000 );
							break;
						}
					}
				}	

					if(!is_b && !is_a && null != idleIndex_c)
					{
						for(var i = 0;i<cnt_c;i++)
						{
							if(rand==Index_c[i])
							{
								console.log('is c');
								is_c = 1;
								timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_c]);}, motions[rand].duration * 1000 );
								break;
							}
						}
					}
				
				if(!(is_c || is_b || is_a))
				{
					model.animator.getLayer("motion").play(motions[0]);
				}
            }
        }else if((rect.left + rect.width*0.05) < mouse_x && mouse_x < (rect.left + rect.width *0.4) && rect.top + rect.height*0.18 < mouse_y && mouse_y < (rect.top + rect.height*0.6)){
            var rand = touch_specialIndex[Math.floor(Math.random() * cnt_sp)];
			console.log('is special');
			click_part = 4;
			//loadTips();
			click_message();
            model.animator.getLayer("motion").stop();
            model.animator.getLayer("motion").play(motions[rand]);
			console.log('motion num:' + rand);
			var is_a = 0;
			var is_b = 0;
			var is_c = 0;
            if(null != idleIndex_a){
				for(var i = 0;i<cnt_a;i++)
				{
					if(rand==Index_a[i])
					{
						is_a = 1;
						console.log('is a');
						timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_a]);}, motions[rand].duration * 1000 );
						break;
					}
				}
				if(!is_a && null != idleIndex_b)
				{
					for(var i = 0;i<cnt_b;i++)
					{
						if(rand==Index_b[i])
						{
							is_b = 1;
							console.log('is b');
							timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_b]);}, motions[rand].duration * 1000 );
							break;
						}
					}
				}	

					if(!is_b && !is_a && null != idleIndex_c)
					{
						for(var i = 0;i<cnt_c;i++)
						{
							if(rand==Index_c[i])
							{
								console.log('is c');
								is_c = 1;
								timeOut = setTimeout( function(){model.animator.getLayer("motion").play(motions[idleIndex_c]);}, motions[rand].duration * 1000 );
								break;
							}
						}
					}
				
				if(!(is_c || is_b || is_a))
				{
					model.animator.getLayer("motion").play(motions[0]);
				}
            }
        }
			idle_motion_int = setInterval(function() {
			Set_idle_motions(model,motions);
				}, 15000);
			Hitokoto = setInterval(function() {
			showHitokoto();
				}, 15000);
    });
	

	
    var onfocusTime;
    sessionStorage.setItem('Onblur', '0');
    window.onblur = function(e){
        if('0' == sessionStorage.getItem('Onblur')){
            onfocusTime = setTimeout(function(){sessionStorage.setItem('Onblur','1');},30000);
        }
    };
    window.onfocus = function(e){
        window.clearTimeout(onfocusTime);
        if(motions.length > 0){
			clearInterval(idle_motion_int);
            if('1' == sessionStorage.getItem('Onblur')){
                model.animator.getLayer("motion").stop();
                if (null != idleIndex_a && null != idleIndex_b) {
                    if (homeIndex == homeIndex_a) {
                        if (null != homeIndex_b) {
                            homeIndex = homeIndex_b;
                            model.animator.getLayer("motion").play(motions[homeIndex]);
                            onfocusTime = setTimeout(function () { model.animator.getLayer("motion").play(motions[idleIndex_b]); sessionStorage.setItem('Onblur', '0'); }, motions[homeIndex].duration * 1000);
                        } else {
                            model.animator.getLayer("motion").play(motions[homeIndex]);
                            onfocusTime = setTimeout(function () { model.animator.getLayer("motion").play(motions[idleIndex_a]); sessionStorage.setItem('Onblur', '0'); }, motions[homeIndex].duration * 1000);
                        }
                    }
                    else {
                        if (null != homeIndex_a) {
                            homeIndex = homeIndex_a;
                            model.animator.getLayer("motion").play(motions[homeIndex]);
                            onfocusTime = setTimeout(function () { model.animator.getLayer("motion").play(motions[idleIndex_a]); sessionStorage.setItem('Onblur', '0'); }, motions[homeIndex].duration * 1000);
                        }
                        else {
                            model.animator.getLayer("motion").play(motions[homeIndex]);
                            onfocusTime = setTimeout(function () { model.animator.getLayer("motion").play(motions[idleIndex_b]); sessionStorage.setItem('Onblur', '0'); }, motions[homeIndex].duration * 1000);
                        }
                    }
                }
                else {
                    model.animator.getLayer("motion").play(motions[0]);
                }
			}
			
			idle_motion_int = setInterval(function() {
			Set_idle_motions(model,motions);
				}, 15000);
        }
    };
}
function bodyOrHtml(){
    if('scrollingElement' in document){ return document.scrollingElement; }
    if(navigator.userAgent.indexOf('WebKit') != -1){ return document.body; }
    return document.documentElement;
}
function loadStartHandler() {
    startTime = new Date();
}
function loadProgressHandler(loader) {
    console.log("progress: " + Math.round(loader.progress) + "%");
}
function loadCompleteHandler(){
    var loadTime = new Date().getTime() - startTime.getTime();
    console.log('Model initialized in '+ loadTime/1000 + ' second');
    loadTips();
    PIXI.loader.off("start", loadStartHandler);
    PIXI.loader.off("progress", loadProgressHandler);
    PIXI.loader.off("complete", loadCompleteHandler);
}
