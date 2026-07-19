

var canvas_stars = '';
var context_stars  = '';
var timer = null;
var mountainArr = [];
var starArr = [];
var meteorArr = [];
var width = window.innerWidth;
var height = window.innerHeight;

var pathname = window.location.pathname;
var origin   = window.location.origin;
origin = origin + '/'
var starDensity = window.YusenEffects && typeof window.YusenEffects.getEffectComplexity === 'function'
    ? window.YusenEffects.getEffectComplexity('stars', 100, 35) / 100
    : 1;
function rand(min,max){
    var c = max - min + 1;
    return Math.floor(Math.random() * c + min);
}

$(function () {
	if(!(/Android|webOS|iPhone|iPod|iPad|BlackBerry/i.test(navigator.userAgent)))
	{
		console.log("star")
		StarrySky();
	}
});

function init(){
	
		canvas_stars = document.createElement('canvas'),
		canvas_stars.height = window.innerHeight;
		canvas_stars.width = window.innerWidth;
		canvas_stars.setAttribute('id', 'stars');
		canvas_stars.setAttribute('style', 'position: absolute;left: 0;top: 0;pointer-events: none;z-index: -1;');
		document.getElementsByTagName('body')[0].appendChild(canvas_stars);
		window.addEventListener('resize', resize);
    	canvas_stars.style.display = 'block';
		canvas_stars.style.opacity = 0;
    	context_stars = canvas_stars.getContext('2d');
    	
    		
    	var ladder = 0;
    	while(ladder < height-300){
		for(var i = 0 ; i < Math.max(1, Math.round((height-ladder)/100 * starDensity)) ; i++){
    			starArr.push([rand(0,width),rand(ladder,ladder+20),rand(0,10),0.1]);
    		}
    		ladder += 20;
    	}
		
		function resize() {
			width = window.innerWidth;
			height = window.innerHeight;
			canvas_stars.width = width;
			canvas_stars.height = height;
			starArr = [];
			var ladder = 0;
			while(ladder < height-300){
			for(var i = 0 ; i < Math.max(1, Math.round((height-ladder)/100 * starDensity)) ; i++){
					starArr.push([rand(0,width),rand(ladder,ladder+20),rand(0,10),0.1]);
				}
				ladder += 20;
			}
		}
	
}
function StarrySky(){

    	init();	
    	drawTimer();
} 

    	function drawSky(){
    		context_stars.beginPath();
    		var skyStyle = context_stars.createLinearGradient(0,0,0,canvas_stars.height);
			
    		skyStyle.addColorStop(0,"#000211");
  
			skyStyle.addColorStop(0.7,"#1e1c21");
			skyStyle.addColorStop(0.75,"#1f2744");
			
    		skyStyle.addColorStop(0.8,"#1a1a28");
    		skyStyle.addColorStop(1,"#1b1b1d");
    		context_stars.fillStyle = skyStyle;
    		context_stars.fillRect(0,0,width,height);
    		context_stars.closePath();
    	}
		function drawSky_2(){
    		context_stars.beginPath();
    		var skyStyle = context_stars.createLinearGradient(0,0,0,canvas_stars.height);
			
    		skyStyle.addColorStop(0,"#000211");
    		skyStyle.addColorStop(1,"#000211");
    		context_stars.fillStyle = skyStyle;
    		context_stars.fillRect(0,0,width,height);
    		context_stars.closePath();
    	}
    	function darwStar(){
    		starArr.forEach((v)=>{
    			context_stars.beginPath();
    			context_stars.fillStyle = "rgba(255,255,255,"+v[2]/10+")"; 
    			context_stars.arc(v[0],v[1],1,0,2*Math.PI);
    			context_stars.fill();
    			context_stars.closePath();
    		});
    	}
		function drawMeteor_2(){
    		var meteorNum = rand(-9,9);
    		if(meteorNum == 1){
    			meteorArr.push([rand(0,width+height),0,rand(1,3)]);
    		}
    		meteorArr.forEach((v)=>{
    			context_stars.beginPath();
    			context_stars.fillStyle = "rgba(255,255,255,1)";
    			if(v[0] > width){
    				context_stars.arc(v[0],v[1]+(v[0]-width),1,0,2*Math.PI);
    			}else{
    				context_stars.arc(v[0],v[1],1,0,2*Math.PI);
    			}
    			context_stars.fill();
    			if(v[0] > width){
    				var meteorStyle = context_stars.createLinearGradient(v[0],v[1],v[0]+v[2]*20,v[1]+(v[0]-width)-v[2]*20);
    				meteorStyle.addColorStop(0,"rgba(255,255,255,1)");
    				meteorStyle.addColorStop(1,"rgba(255,255,255,0)");
    				context_stars.strokeStyle = meteorStyle;
    				context_stars.lineTo(v[0],v[1]+(v[0]-width));
    				context_stars.lineTo(v[0]+v[2]*20,v[1]+(v[0]-width)-v[2]*20);
    			}else{
    				var meteorStyle = context_stars.createLinearGradient(v[0],v[1],v[0]+v[2]*20,v[1]-v[2]*20);
    				meteorStyle.addColorStop(0,"rgba(255,255,255,1)");
    				meteorStyle.addColorStop(1,"rgba(255,255,255,0)");
    				context_stars.strokeStyle = meteorStyle;
    				context_stars.lineTo(v[0],v[1]);
    				context_stars.lineTo(v[0]+v[2]*20,v[1]-v[2]*20);
    			}
    			context_stars.stroke();
    			context_stars.closePath();
    		})
    		meteorArr.forEach((v,index)=>{
    			v[0] -= v[2];
    			v[1] += v[2];
    			if(v[0] < -20 || v[1] > height ){
    				meteorArr.splice(index,1);
    			}
    		})
    	}
    	function drawMeteor(){
    		var meteorNum = rand(-9,9);
    		if(meteorNum == 1){
    			meteorArr.push([rand(0,width+height),0,rand(1,3)]);
    		}
    		meteorArr.forEach((v)=>{
    			context_stars.beginPath();
    			context_stars.fillStyle = "rgba(255,255,255,1)";
    			if(v[0] > width){
    				context_stars.arc(v[0],v[1]+(v[0]-width),1,0,2*Math.PI);
    			}else{
    				context_stars.arc(v[0],v[1],1,0,2*Math.PI);
    			}
    			context_stars.fill();
    			if(v[0] > width){
    				var meteorStyle = context_stars.createLinearGradient(v[0],v[1],v[0]+v[2]*20,v[1]+(v[0]-width)-v[2]*20);
    				meteorStyle.addColorStop(0,"rgba(255,255,255,1)");
    				meteorStyle.addColorStop(1,"rgba(255,255,255,0)");
    				context_stars.strokeStyle = meteorStyle;
    				context_stars.lineTo(v[0],v[1]+(v[0]-width));
    				context_stars.lineTo(v[0]+v[2]*20,v[1]+(v[0]-width)-v[2]*20);
    			}else{
    				var meteorStyle = context_stars.createLinearGradient(v[0],v[1],v[0]+v[2]*20,v[1]-v[2]*20);
    				meteorStyle.addColorStop(0,"rgba(255,255,255,1)");
    				meteorStyle.addColorStop(1,"rgba(255,255,255,0)");
    				context_stars.strokeStyle = meteorStyle;
    				context_stars.lineTo(v[0],v[1]);
    				context_stars.lineTo(v[0]+v[2]*20,v[1]-v[2]*20);
    			}
    			context_stars.stroke();
    			context_stars.closePath();
    		})
    		meteorArr.forEach((v,index)=>{
    			v[0] -= v[2];
    			v[1] += v[2];
    			if(v[0] < -20 || v[1] > height*0.72 ){
    				meteorArr.splice(index,1);
    			}
    		})
    	}
    	function drawTimer(){
			
			var url = window.location.href;
			console.log("origin url:" + origin);
			var datatheme=document.documentElement.getAttribute("data-theme");
				if(url == origin){
					drawSky();
					darwStar();
					drawMeteor();
					canvas_stars.style.position = "absolute"
				}
				else{
					canvas_stars.style.position = "fixed"
					drawSky_2();
					darwStar();
					drawMeteor_2();
				}
			var requestFrame = window.YusenEffects && window.YusenEffects.requestAnimationFrame || window.requestAnimationFrame;
			function renderFrame(timestamp) {
				if (!document.hidden) {
					var datatheme=document.documentElement.getAttribute("data-theme");
					if(datatheme=="dark")
					{
						starArr.forEach((v)=>{
							if(v[2] + v[3] < 0 || v[2] + v[3] > 10){
								v[3] *= -1;
							}
							v[2] += v[3];
						});
						var url = window.location.href;
						if(url == origin){
							drawSky();
							darwStar();
							drawMeteor();
							canvas_stars.style.position = "absolute";
							canvas_stars.style.opacity = 1;
						}
						else{
							canvas_stars.style.opacity = 0.3;
							canvas_stars.style.position = "fixed";
							drawSky_2();
							darwStar();
							drawMeteor_2();
						}
					}
					else{
						canvas_stars.style.opacity = 0;
					}
				}
				timer = requestFrame(renderFrame);
			}
			timer = requestFrame(renderFrame);
    	}
