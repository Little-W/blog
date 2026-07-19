$(function() {
    var width, height, canvas, ctx, circles, target, animateHeader = true;
    var requestFrame = window.YusenEffects && window.YusenEffects.requestAnimationFrame || window.requestAnimationFrame;
    // Main
    initHeader();
    addListeners();
    function initHeader() {
        width = window.innerWidth;
        height = window.innerHeight; //调整为自己div的高度
        target = {x: 0, y: height};
        canvas = document.getElementById('paopao'); // 这个是canvas标签的id
        if (!canvas) return;
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext('2d');
        // create particles
        circles = [];
        var circleCount = Math.min(140, Math.max(50, Math.round(width * 0.08)));
        if (window.YusenEffects && typeof window.YusenEffects.getEffectComplexity === 'function') {
            circleCount = window.YusenEffects.getEffectComplexity('bubbles', circleCount, 20);
        }
        for(var x = 0; x < circleCount; x++) {
            var c = new Circle();
            circles.push(c);
        }
        requestFrame(animate);
    }
    // Event handling
    function addListeners() {
        window.addEventListener('scroll', scrollCheck, {passive: true});
        window.addEventListener('resize', resize);
    }
    function scrollCheck() {
        if(window.pageYOffset > height) animateHeader = false;
        else animateHeader = true;
    }
    function resize() {
        width = window.innerWidth;
        height = window.innerHeight; //调整为自己div的高度
        canvas.width = width;
        canvas.height = height;
    }
    function animate(timestamp) {
        requestFrame(animate);
        if(document.hidden || !animateHeader) return;
        if(animateHeader) {
            ctx.clearRect(0,0,width,height);
            for(var i in circles) {
                circles[i].draw();
            }
        }
    }
    // Canvas manipulation
    function Circle() {
        var _this = this;
        // constructor
        (function() {
            _this.pos = {};
            init();
            //console.log(_this);
        })();
        function init() {
            _this.pos.x = Math.random()*width;
            _this.pos.y = height+Math.random()*100;
            _this.alpha = 0.1+Math.random()*0.3;
            _this.scale = 0.1+Math.random()*0.3;
            _this.velocity = Math.random();
        }
        this.draw = function() {
            if(_this.alpha <= 0) {
                init();
            }
            _this.pos.y -= _this.velocity;
            _this.alpha -= 0.003;
            ctx.beginPath();
            ctx.arc(_this.pos.x, _this.pos.y, _this.scale*25, 0, 2 * Math.PI, false);
            ctx.fillStyle = 'rgba(0,165,235,'+ _this.alpha+')';
            ctx.fill();
        };
    }
});
