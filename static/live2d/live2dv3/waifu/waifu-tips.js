var host = window.location.origin + window.location.port;
var waifu_target = '.waifu-tips';
var userAgent = window.navigator.userAgent.toLowerCase();
var norunAI = [ "android", "iphone", "ipod", "ipad", "windows phone", "mqqbrowser" ,"msie","trident/7.0"];
var norunFlag = false;
var modelWidth = window.innerWidth/5;
var Hitokoto;
var sleepTimer_ = null;
var live2dTipsStarted = false;
var text_next = 0;
var agentMessageVisibleUntil = 0;
function renderTipText(template, context){
	return String(template == null ? '' : template).replace(/(\\)?\{([^\{\}\\]+)(\\)?\}/g, function(word, slash1, token, slash2){
		if(slash1 || slash2) return word.replace('\\', '');
		var variables = token.replace(/\s/g, '').split('.');
		var currentObject = context;
		for(var index = 0; index < variables.length; index++){
			if(currentObject == null) return '';
			currentObject = currentObject[variables[index]];
		}
		return currentObject == null ? '' : currentObject;
	});
}
function live2dTipsEnabled(){
	return !window.YusenLive2DControls || window.YusenLive2DControls.getState().tips !== false;
}
function live2dAgentModeEnabled(){
	return !!(window.YusenLive2DControls && window.YusenLive2DControls.getState().agentMode === true);
}
for(var i=0;i<norunAI.length;i++){
	if(userAgent.indexOf(norunAI[i]) > -1){
		norunFlag = true;
		break;
	}
}

function hideMessage(timeout){
	if(!live2dTipsEnabled()){
		$(waifu_target).stop(true, true).css('opacity', 0);
		return;
	}
	$(waifu_target).stop().css('opacity',1);
	if (timeout === null) timeout = 5000;
	$(waifu_target).delay(timeout).fadeTo(200, 0);
}	
function showMessage(text, timeout, options){
	if(!live2dTipsEnabled()) return;
	var isAgentMessage = options && options.agent === true;
	if(!isAgentMessage && Date.now() < agentMessageVisibleUntil) return;
	if(Array.isArray(text)) text = text[Math.floor(Math.random() * text.length + 1)-1];
	// console.log(text);
	$(waifu_target).stop();
	$(waifu_target).html(text).fadeTo(200, 1);
	if (timeout === null) timeout = 5000;
	if(isAgentMessage) agentMessageVisibleUntil = Date.now() + Math.max(1500, Number(timeout) || 5000);
	hideMessage(timeout);
}
window.showAgentMessage = function(text, timeout){
	showMessage(text, timeout, {agent: true});
};
function showQueuedWaifuTip(detail){
	if(!detail || typeof detail.text !== 'string' || !detail.text) return;
	showMessage(detail.text, typeof detail.timeout === 'number' ? detail.timeout : 3600);
}
window.addEventListener('yusen:waifu-tip', function(event){
	showQueuedWaifuTip(event && event.detail);
});
if(Array.isArray(window.__yusenWaifuTipQueue)){
	var queuedWaifuTips = window.__yusenWaifuTipQueue.splice(0);
	if(queuedWaifuTips.length) showQueuedWaifuTip(queuedWaifuTips[queuedWaifuTips.length - 1]);
}
function showHitokoto(){
	if(!live2dTipsEnabled()) return;
	if(live2dAgentModeEnabled()){
		if(window.__yusenWaifuChat && typeof window.__yusenWaifuChat.proactive === 'function'){
			window.__yusenWaifuChat.proactive();
		}else if(window.YusenLive2DControls && typeof window.YusenLive2DControls.ensureAgentRuntime === 'function'){
			window.YusenLive2DControls.ensureAgentRuntime().then(function(agent){
				if(agent && typeof agent.proactive === 'function') agent.proactive();
			}).catch(function(){});
		}
		return;
	}
	if(sessionStorage.getItem("Onblur")!=="1"){
		$.getJSON('https://v1.hitokoto.cn/',function(result){
			showMessage(result.hitokoto, 4000);
		});
	}else{
		hideMessage(0);
		if(sleepTimer_==null){
			sleepTimer_ = setInterval(function(){
				checkSleep();
			},200);
		}
		console.log(sleepTimer_);
	}
}
function checkSleep(){
	var sleepStatu = sessionStorage.getItem("Onblur");
	if(sleepStatu!=='1'){
		showMessage('你回来啦~', 5000);
		clearInterval(sleepTimer_);
		sleepTimer_= null;
	}
}
	
function click_message()
{
	if(!live2dTipsEnabled()) return;
	$.ajax({
			url: "/live2d/live2dv3/waifu/waifu-tips.json",
			dataType: "json",
			success: function (result){
				if(click_part == 1)
				{
					$.each(result.click_head, function (index, tips){	
							var text = tips.text;
							if(Array.isArray(tips.text)) text = tips.text[Math.floor(Math.random() * tips.text.length + 1)-1];
							text = renderTipText(text, {text: $(this).text()});
		
							showMessage(text, 3000);
					});
				}
				else if(click_part == 2)
				{
					$.each(result.click_body, function (index, tips){	
							var text = tips.text;
							if(Array.isArray(tips.text)) text = tips.text[Math.floor(Math.random() * tips.text.length + 1)-1];
							text = renderTipText(text, {text: $(this).text()});
							
							showMessage(text, 3000);
					});
				}else if(click_part == 3)
				{
					$.each(result.click_skirt, function (index, tips){	
							var text = tips.text;
							if(Array.isArray(tips.text)) text = tips.text[Math.floor(Math.random() * tips.text.length + 1)-1];
							text = renderTipText(text, {text: $(this).text()});
							showMessage(text, 3000);
					});
				}else if(click_part == 4)
				{
					$.each(result.click_special, function (index, tips){	
							var text = tips.text;
							if(Array.isArray(tips.text)) text = tips.text[Math.floor(Math.random() * tips.text.length + 1)-1];
							text = renderTipText(text, {text: $(this).text()});
							showMessage(text, 3000);
					});
				}
			}
		});
}

window.addEventListener('yusen:live2d-settings-change', function(event){
	var enabled = !event.detail || event.detail.tips !== false;
	clearInterval(Hitokoto);
	Hitokoto = null;
	if(!enabled){
		$(waifu_target).stop(true, true).css('opacity', 0);
		return;
	}
	Hitokoto = setInterval(showHitokoto, 15000);
});
var last_text,same = 0;
function loadTips(){
	if(live2dTipsStarted) return;
	live2dTipsStarted = true;
	if(!norunFlag){
		

		function getRandText(text) {return Array.isArray(text) ? text[Math.floor(Math.random() * text.length + 1)-1] : text}

		var re = new Date();
		console.log(re);
		re.toString = function() {
			showMessage('你打开了控制台，是想要看看我裙子下的秘密吗？', 5000);
			console.log('查看源码请也要慎重哦，有些代码是有license的，还请小心粘贴使用^_^');
			return '';
		};

		$(document).on('copy', function (){
			showMessage('你都复制了些什么呀，转载要记得加上出处哦', 5000);
		});

		$.ajax({
			cache: true,
			url: "/live2d/live2dv3/waifu/waifu-tips.json",
			dataType: "json",
			success: function (result){
				welcomeMessage();
				$.each(result.mouseover, function (index, tips){
					$(document).on("mouseenter", tips.selector, function (e){
							var text = tips.text;
							
							if(last_text != text || text.length > 1 || same > 1)
							{
								if(Array.isArray(tips.text)) text = tips.text[Math.floor(Math.random() * tips.text.length + 1)-1];
								text = renderTipText(text, {text: $(this).text()});
								clearInterval(Hitokoto);
								showMessage(text, 3000);
								Hitokoto = setInterval(function() {
								showHitokoto();
									}, 15000);
								same = 0;
							}
							else same++;
							last_text = text;		
					});
				});
				$.each(result.seasons, function (index, tips){
				var now = new Date();
				var after = tips.date.split('-')[0];
				var before = tips.date.split('-')[1] || after;
				
				if((after.split('/')[0] <= now.getMonth()+1 && now.getMonth()+1 <= before.split('/')[0]) && 
				(after.split('/')[1] <= now.getDate() && now.getDate() <= before.split('/')[1])){
					var text = getRandText(tips.text);
					text = renderTipText(text, {year: now.getFullYear()});
					showMessage(text, 6000);
				}
				});
			}
		});


		function welcomeMessage(){
			var text;
			if(document.referrer !== ''){
				var referrer = document.createElement('a');
				referrer.href = document.referrer;
				text = 'Hello! 来自 <span style="color:#0099cc;">' + referrer.hostname + '</span> 的朋友';
				var domain = referrer.hostname.split('.')[1];
				if (domain == 'baidu') {
					text = 'Hello! 来自 百度搜索 的朋友<br>你是搜索 <span style="color:#0099cc;">' + referrer.search.split('&wd=')[1].split('&')[0] + '</span> 找到的我吗？';
				}else if (domain == 'so') {
					text = 'Hello! 来自 so 的朋友<br>你是搜索 <span style="color:#0099cc;">' + referrer.search.split('&q=')[1].split('&')[0] + '</span> 找到的我吗？';
				}else if (domain == 'google') {
					text = 'Hello! 来自 谷歌搜索 的朋友<br>欢迎阅读<span style="color:#0099cc;">『' + document.title.split(' - ')[0] + '』</span>';
				}
			}else {
				if (window.location.href == 'https://yusen.netlify.app/' || window.location.href == 'https://blog.yusen.best/') { //如果是主页
					var now = (new Date()).getHours();
					if (now > 23 || now <= 5) {
						text = '你是夜猫子呀？这么晚还不睡觉，明天起的来嘛';
					} else if (now > 5 && now <= 7) {
						if(text_next)
						{
							text = '早上好！一日之计在于晨，美好的一天就要开始了';
							text_next = 0;
						}
						else{
							text = '呜～～伊珂丝，还想睡的说……';
							text_next = 1;
						}
					} else if (now > 7 && now <= 11) {
						text = '上午好！工作顺利嘛，不要久坐，多起来走动走动哦！';
					} else if (now > 11 && now <= 14) {
						text = '中午了，工作了一个上午，现在是午餐时间！';
					} else if (now > 14 && now <= 17) {
						text = '午后很容易犯困呢，今天的运动目标完成了吗？';
					} else if (now > 17 && now <= 19) {
						text = '傍晚了！窗外夕阳的景色很美丽呢，最美不过夕阳红~';
					} else if (now > 19 && now <= 21) {
						text = '晚上好，今天过得怎么样？';
					} else if (now > 21 && now <= 23) {
						text = '已经这么晚了呀，早点休息吧，晚安~';
					} else {
						text = '嗨~ 快来逗我玩吧！';
					}
				}else {
					text = '欢迎阅读<span style="color:#0099cc;">『' + document.title.split(' - ')[0] + '』</span>';
				}
			}
			showMessage(text, 6000);
		}

		Hitokoto = setInterval(function() {
			showHitokoto();
				}, 15000);

	}
}

loadTips();
