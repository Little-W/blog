!function (e, t) { "object" == typeof exports && "object" == typeof module ? module.exports = t() : "function" == typeof define && define.amd ? define("APlayer", [], t) : "object" == typeof exports ? exports.APlayer = t() : e.APlayer = t() }(window, function () { return function (e) { var t = {}; function n (i) { if (t[i]) return t[i].exports; var a = t[i] = { i: i, l: !1, exports: {} }; return e[i].call(a.exports, a, a.exports, n), a.l = !0, a.exports } return n.m = e, n.c = t, n.d = function (e, t, i) { n.o(e, t) || Object.defineProperty(e, t, { configurable: !1, enumerable: !0, get: i }) }, n.r = function (e) { Object.defineProperty(e, "__esModule", { value: !0 }) }, n.n = function (e) { var t = e && e.__esModule ? function () { return e.default } : function () { return e }; return n.d(t, "a", t), t }, n.o = function (e, t) { return Object.prototype.hasOwnProperty.call(e, t) }, n.p = "/", n(n.s = 41) }([function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }); var i = /mobile/i.test(window.navigator.userAgent), a = { secondToTime: function (e) { var t = Math.floor(e / 3600), n = Math.floor((e - 3600 * t) / 60), i = Math.floor(e - 3600 * t - 60 * n); return (t > 0 ? [t, n, i] : [n, i]).map(function (e) { return e < 10 ? "0" + e : "" + e }).join(":") }, getElementViewLeft: function (e) { var t = e.offsetLeft, n = e.offsetParent, i = document.body.scrollLeft + document.documentElement.scrollLeft; if (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement) for (; null !== n && n !== e;)t += n.offsetLeft, n = n.offsetParent; else for (; null !== n;)t += n.offsetLeft, n = n.offsetParent; return t - i }, getElementViewTop: function (e, t) { for (var n, i = e.offsetTop, a = e.offsetParent; null !== a;)i += a.offsetTop, a = a.offsetParent; return n = document.body.scrollTop + document.documentElement.scrollTop, t ? i : i - n }, isMobile: i, storage: { set: function (e, t) { localStorage.setItem(e, t) }, get: function (e) { return localStorage.getItem(e) } }, nameMap: { dragStart: i ? "touchstart" : "mousedown", dragMove: i ? "touchmove" : "mousemove", dragEnd: i ? "touchend" : "mouseup" }, randomOrder: function (e) { return function (e) { for (var t = e.length - 1; t >= 0; t--) { var n = Math.floor(Math.random() * (t + 1)), i = e[n]; e[n] = e[t], e[t] = i } return e }([].concat(function (e) { if (Array.isArray(e)) { for (var t = 0, n = Array(e.length); t < e.length; t++)n[t] = e[t]; return n } return Array.from(e) }(Array(e))).map(function (e, t) { return t })) } }; t.default = a }, function (e, t, n) { var i = n(2); e.exports = function (e) { "use strict"; e = e || {}; var t = "", n = i.$each, a = e.audio, r = (e.$value, e.$index, i.$escape), o = e.theme, s = e.index; return n(a, function (e, n) { t += '\n<li>\n    <span class="aplayer-list-cur" style="background-color: ', t += r(e.theme || o), t += ';"></span>\n    <span class="aplayer-list-index">', t += r(n + s), t += '</span>\n    <span class="aplayer-list-title">', t += r(e.name), t += '</span>\n    <span class="aplayer-list-author">', t += r(e.artist), t += "</span>\n</li>\n" }), t } }, function (e, t, n) { "use strict"; e.exports = n(15) }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }); var i = g(n(33)), a = g(n(32)), r = g(n(31)), o = g(n(30)), s = g(n(29)), l = g(n(28)), u = g(n(27)), c = g(n(26)), p = g(n(25)), d = g(n(24)), h = g(n(23)), y = g(n(22)), f = g(n(21)), v = g(n(20)), m = g(n(19)); function g (e) { return e && e.__esModule ? e : { default: e } } var w = { play: i.default, pause: a.default, volumeUp: r.default, volumeDown: o.default, volumeOff: s.default, orderRandom: l.default, orderList: u.default, menu: c.default, loopAll: p.default, loopOne: d.default, loopNone: h.default, loading: y.default, right: f.default, skip: v.default, lrc: m.default }; t.default = w }, function (e, t, n) { "use strict"; var i, a = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (e) { return typeof e } : function (e) { return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e }; i = function () { return this }(); try { i = i || Function("return this")() || (0, eval)("this") } catch (e) { "object" === ("undefined" == typeof window ? "undefined" : a(window)) && (i = window) } e.exports = i }, function (e, t, n) { "use strict"; var i, a, r = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (e) { return typeof e } : function (e) { return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e }; void 0 === (a = "function" == typeof (i = function () { if ("object" === ("undefined" == typeof window ? "undefined" : r(window)) && void 0 !== document.querySelectorAll && void 0 !== window.pageYOffset && void 0 !== history.pushState) { var e = function (e, t, n, i) { return n > i ? t : e + (t - e) * ((a = n / i) < .5 ? 4 * a * a * a : (a - 1) * (2 * a - 2) * (2 * a - 2) + 1) }, t = function (t, n, i, a) { n = n || 500; var r = (a = a || window).scrollTop || window.pageYOffset; if ("number" == typeof t) var o = parseInt(t); else var o = function (e, t) { return "HTML" === e.nodeName ? -t : e.getBoundingClientRect().top + t }(t, r); var s = Date.now(), l = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || function (e) { window.setTimeout(e, 15) }; !function u () { var c = Date.now() - s; a !== window ? a.scrollTop = e(r, o, c, n) : window.scroll(0, e(r, o, c, n)), c > n ? "function" == typeof i && i(t) : l(u) }() }, n = function (e) { if (!e.defaultPrevented) { e.preventDefault(), location.hash !== this.hash && window.history.pushState(null, null, this.hash); var n = document.getElementById(this.hash.substring(1)); if (!n) return; t(n, 500, function (e) { location.replace("#" + e.id) }) } }; return document.addEventListener("DOMContentLoaded", function () { for (var e, t = document.querySelectorAll('a[href^="#"]:not([href="#"])'), i = t.length; e = t[--i];)e.addEventListener("click", n, !1) }), t } }) ? i.call(t, n, t, e) : i) || (e.exports = a) }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }); var i = function () { function e (e, t) { for (var n = 0; n < t.length; n++) { var i = t[n]; i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, i.key, i) } } return function (t, n, i) { return n && e(t.prototype, n), i && e(t, i), t } }(), a = s(n(1)), r = s(n(0)), o = s(n(5)); function s (e) { return e && e.__esModule ? e : { default: e } } var l = function () { function e (t) { !function (e, t) { if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function") }(this, e), this.player = t, this.index = 0, this.audios = this.player.options.audio, this.bindEvents() } return i(e, [{ key: "bindEvents", value: function () { var e = this; this.player.template.list.addEventListener("click", function (t) { var n = void 0; n = "LI" === t.target.tagName.toUpperCase() ? t.target : t.target.parentElement; var i = parseInt(n.getElementsByClassName("aplayer-list-index")[0].innerHTML) - 1; i !== e.index ? (e.switch(i), e.player.play()) : e.player.toggle() }) } }, { key: "show", value: function () { this.player.events.trigger("listshow"), this.player.template.list.classList.remove("aplayer-list-hide"), this.player.template.listOl.scrollTop = 33 * this.index } }, { key: "hide", value: function () { this.player.events.trigger("listhide"), this.player.template.list.classList.add("aplayer-list-hide") } }, { key: "toggle", value: function () { this.player.template.list.classList.contains("aplayer-list-hide") ? this.show() : this.hide() } }, { key: "add", value: function (e) { this.player.events.trigger("listadd", { audios: e }), "[object Array]" !== Object.prototype.toString.call(e) && (e = [e]), e.map(function (e) { return e.name = e.name || e.title || "Audio name", e.artist = e.artist || e.author || "Audio artist", e.cover = e.cover || e.pic, e.type = e.type || "normal", e }); var t = !(this.audios.length > 1), n = 0 === this.audios.length; this.player.template.listOl.innerHTML += (0, a.default)({ theme: this.player.options.theme, audio: e, index: this.audios.length + 1 }), this.audios = this.audios.concat(e), t && this.audios.length > 1 && this.player.container.classList.add("aplayer-withlist"), this.player.randomOrder = r.default.randomOrder(this.audios.length), this.player.template.listCurs = this.player.container.querySelectorAll(".aplayer-list-cur"), this.player.template.listCurs[this.audios.length - 1].style.backgroundColor = e.theme || this.player.options.theme, n && ("random" === this.player.options.order ? this.switch(this.player.randomOrder[0]) : this.switch(0)) } }, { key: "remove", value: function (e) { if (this.player.events.trigger("listremove", { index: e }), this.audios[e]) if (this.audios.length > 1) { var t = this.player.container.querySelectorAll(".aplayer-list li"); t[e].remove(), this.audios.splice(e, 1), this.player.lrc && this.player.lrc.remove(e), e === this.index && (this.audios[e] ? this.switch(e) : this.switch(e - 1)), this.index > e && this.index--; for (var n = e; n < t.length; n++)t[n].getElementsByClassName("aplayer-list-index")[0].textContent = n; 1 === this.audios.length && this.player.container.classList.remove("aplayer-withlist"), this.player.template.listCurs = this.player.container.querySelectorAll(".aplayer-list-cur") } else this.clear() } }, { key: "switch", value: function (e) { if (this.player.events.trigger("listswitch", { index: e }), void 0 !== e && this.audios[e]) { this.index = e; var t = this.audios[this.index]; this.player.template.pic.style.backgroundImage = t.cover ? "url('" + t.cover + "')" : "", this.player.theme(this.audios[this.index].theme || this.player.options.theme, this.index, !1), this.player.template.title.innerHTML = t.name, this.player.template.author.innerHTML = t.artist ? " - " + t.artist : ""; var n = this.player.container.getElementsByClassName("aplayer-list-light")[0]; n && n.classList.remove("aplayer-list-light"), this.player.container.querySelectorAll(".aplayer-list li")[this.index].classList.add("aplayer-list-light"), (0, o.default)(33 * this.index, 500, null, this.player.template.listOl), this.player.setAudio(t), this.player.lrc && this.player.lrc.switch(this.index), this.player.lrc && this.player.lrc.update(0), 1 !== this.player.duration && (this.player.template.dtime.innerHTML = r.default.secondToTime(this.player.duration)) } } }, { key: "clear", value: function () { this.player.events.trigger("listclear"), this.index = 0, this.player.container.classList.remove("aplayer-withlist"), this.player.pause(), this.audios = [], this.player.lrc && this.player.lrc.clear(), this.player.audio.src = "", this.player.template.listOl.innerHTML = "", this.player.template.pic.style.backgroundImage = "", this.player.theme(this.player.options.theme, this.index, !1), this.player.template.title.innerHTML = "No audio", this.player.template.author.innerHTML = "", this.player.bar.set("loaded", 0, "width"), this.player.template.dtime.innerHTML = r.default.secondToTime(0) } }]), e }(); t.default = l }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }); var i = function () { function e (e, t) { for (var n = 0; n < t.length; n++) { var i = t[n]; i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, i.key, i) } } return function (t, n, i) { return n && e(t.prototype, n), i && e(t, i), t } }(); var a = function () { function e () { !function (e, t) { if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function") }(this, e), this.events = {}, this.audioEvents = ["abort", "canplay", "canplaythrough", "durationchange", "emptied", "ended", "error", "loadeddata", "loadedmetadata", "loadstart", "mozaudioavailable", "pause", "play", "playing", "progress", "ratechange", "seeked", "seeking", "stalled", "suspend", "timeupdate", "volumechange", "waiting"], this.playerEvents = ["destroy", "listshow", "listhide", "listadd", "listremove", "listswitch", "listclear", "noticeshow", "noticehide", "lrcshow", "lrchide"] } return i(e, [{ key: "on", value: function (e, t) { this.type(e) && "function" == typeof t && (this.events[e] || (this.events[e] = []), this.events[e].push(t)) } }, { key: "trigger", value: function (e, t) { if (this.events[e] && this.events[e].length) for (var n = 0; n < this.events[e].length; n++)this.events[e][n](t) } }, { key: "type", value: function (e) { return -1 !== this.playerEvents.indexOf(e) ? "player" : -1 !== this.audioEvents.indexOf(e) ? "audio" : (console.error("Unknown event name: " + e), null) } }]), e }(); t.default = a }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }); var i = function () { function e (e, t) { for (var n = 0; n < t.length; n++) { var i = t[n]; i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, i.key, i) } } return function (t, n, i) { return n && e(t.prototype, n), i && e(t, i), t } }(); var a = function () { function e (t) { !function (e, t) { if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function") }(this, e), this.player = t, window.requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (e) { window.setTimeout(e, 1e3 / 60) }, this.types = ["loading"], this.init() } return i(e, [{ key: "init", value: function () { var e = this; this.types.forEach(function (t) { e["init" + t + "Checker"]() }) } }, { key: "initloadingChecker", value: function () { var e = this, t = 0, n = 0, i = !1; this.loadingChecker = setInterval(function () { e.enableloadingChecker && (n = e.player.audio.currentTime, i || n !== t || e.player.audio.paused || (e.player.container.classList.add("aplayer-loading"), i = !0), i && n > t && !e.player.audio.paused && (e.player.container.classList.remove("aplayer-loading"), i = !1), t = n) }, 100) } }, { key: "enable", value: function (e) { this["enable" + e + "Checker"] = !0, "fps" === e && this.initfpsChecker() } }, { key: "disable", value: function (e) { this["enable" + e + "Checker"] = !1 } }, { key: "destroy", value: function () { var e = this; this.types.forEach(function (t) { e["enable" + t + "Checker"] = !1, e[t + "Checker"] && clearInterval(e[t + "Checker"]) }) } }]), e }(); t.default = a }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }); var i = function () { function e (e, t) { for (var n = 0; n < t.length; n++) { var i = t[n]; i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, i.key, i) } } return function (t, n, i) { return n && e(t.prototype, n), i && e(t, i), t } }(), a = o(n(0)), r = o(n(3)); function o (e) { return e && e.__esModule ? e : { default: e } } var s = function () { function e (t) { !function (e, t) { if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function") }(this, e), this.player = t, this.initPlayButton(), this.initPlayBar(), this.initOrderButton(), this.initLoopButton(), this.initMenuButton(), a.default.isMobile || this.initVolumeButton(), this.initMiniSwitcher(), this.initSkipButton(), this.initLrcButton() } return i(e, [{ key: "initPlayButton", value: function () { var e = this; this.player.template.pic.addEventListener("click", function () { e.player.toggle() }) } }, { key: "initPlayBar", value: function () { var e = this, t = function (t) { var n = ((t.clientX || t.changedTouches[0].clientX) - a.default.getElementViewLeft(e.player.template.barWrap)) / e.player.template.barWrap.clientWidth; n = Math.max(n, 0), n = Math.min(n, 1), e.player.bar.set("played", n, "width"), e.player.lrc && e.player.lrc.update(n * e.player.duration), e.player.template.ptime.innerHTML = a.default.secondToTime(n * e.player.duration) }, n = function n (i) { document.removeEventListener(a.default.nameMap.dragEnd, n), document.removeEventListener(a.default.nameMap.dragMove, t); var r = ((i.clientX || i.changedTouches[0].clientX) - a.default.getElementViewLeft(e.player.template.barWrap)) / e.player.template.barWrap.clientWidth; r = Math.max(r, 0), r = Math.min(r, 1), e.player.bar.set("played", r, "width"), e.player.seek(e.player.bar.get("played", "width") * e.player.duration), e.player.disableTimeupdate = !1 }; this.player.template.barWrap.addEventListener(a.default.nameMap.dragStart, function () { e.player.disableTimeupdate = !0, document.addEventListener(a.default.nameMap.dragMove, t), document.addEventListener(a.default.nameMap.dragEnd, n) }) } }, { key: "initVolumeButton", value: function () { var e = this; this.player.template.volumeButton.addEventListener("click", function () { e.player.audio.muted ? (e.player.audio.muted = !1, e.player.switchVolumeIcon(), e.player.bar.set("volume", e.player.volume(), "height")) : (e.player.audio.muted = !0, e.player.switchVolumeIcon(), e.player.bar.set("volume", 0, "height")) }); var t = function (t) { var n = 1 - ((t.clientY || t.changedTouches[0].clientY) - a.default.getElementViewTop(e.player.template.volumeBar, e.player.options.fixed)) / e.player.template.volumeBar.clientHeight; n = Math.max(n, 0), n = Math.min(n, 1), e.player.volume(n) }, n = function n (i) { e.player.template.volumeBarWrap.classList.remove("aplayer-volume-bar-wrap-active"), document.removeEventListener(a.default.nameMap.dragEnd, n), document.removeEventListener(a.default.nameMap.dragMove, t); var r = 1 - ((i.clientY || i.changedTouches[0].clientY) - a.default.getElementViewTop(e.player.template.volumeBar, e.player.options.fixed)) / e.player.template.volumeBar.clientHeight; r = Math.max(r, 0), r = Math.min(r, 1), e.player.volume(r) }; this.player.template.volumeBarWrap.addEventListener(a.default.nameMap.dragStart, function () { e.player.template.volumeBarWrap.classList.add("aplayer-volume-bar-wrap-active"), document.addEventListener(a.default.nameMap.dragMove, t), document.addEventListener(a.default.nameMap.dragEnd, n) }) } }, { key: "initOrderButton", value: function () { var e = this; this.player.template.order.addEventListener("click", function () { "list" === e.player.options.order ? (e.player.options.order = "random", e.player.template.order.innerHTML = r.default.orderRandom) : "random" === e.player.options.order && (e.player.options.order = "list", e.player.template.order.innerHTML = r.default.orderList) }) } }, { key: "initLoopButton", value: function () { var e = this; this.player.template.loop.addEventListener("click", function () { e.player.list.audios.length > 1 ? "one" === e.player.options.loop ? (e.player.options.loop = "none", e.player.template.loop.innerHTML = r.default.loopNone) : "none" === e.player.options.loop ? (e.player.options.loop = "all", e.player.template.loop.innerHTML = r.default.loopAll) : "all" === e.player.options.loop && (e.player.options.loop = "one", e.player.template.loop.innerHTML = r.default.loopOne) : "one" === e.player.options.loop || "all" === e.player.options.loop ? (e.player.options.loop = "none", e.player.template.loop.innerHTML = r.default.loopNone) : "none" === e.player.options.loop && (e.player.options.loop = "all", e.player.template.loop.innerHTML = r.default.loopAll) }) } }, { key: "initMenuButton", value: function () { var e = this; this.player.template.menu.addEventListener("click", function () { e.player.list.toggle() }) } }, { key: "initMiniSwitcher", value: function () { var e = this; this.player.template.miniSwitcher.addEventListener("click", function () { e.player.setMode("mini" === e.player.mode ? "normal" : "mini") }) } }, { key: "initSkipButton", value: function () { var e = this; this.player.template.skipBackButton.addEventListener("click", function () { e.player.skipBack() }), this.player.template.skipForwardButton.addEventListener("click", function () { e.player.skipForward() }), this.player.template.skipPlayButton.addEventListener("click", function () { e.player.toggle() }) } }, { key: "initLrcButton", value: function () { var e = this; this.player.template.lrcButton.addEventListener("click", function () { e.player.template.lrcButton.classList.contains("aplayer-icon-lrc-inactivity") ? (e.player.template.lrcButton.classList.remove("aplayer-icon-lrc-inactivity"), e.player.lrc && e.player.lrc.show()) : (e.player.template.lrcButton.classList.add("aplayer-icon-lrc-inactivity"), e.player.lrc && e.player.lrc.hide()) }) } }]), e }(); t.default = s }, function (e, t, n) { var i = n(2); e.exports = function (e) { "use strict"; e = e || {}; var t = "", n = i.$each, a = e.lyrics, r = (e.$value, e.$index, i.$escape); return n(a, function (e, n) { t += "\n    <p", 0 === n && (t += ' class="aplayer-lrc-current"'), t += ">", t += r(e[1]), t += "</p>\n" }), t } }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }); var i, a = function () { function e (e, t) { for (var n = 0; n < t.length; n++) { var i = t[n]; i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, i.key, i) } } return function (t, n, i) { return n && e(t.prototype, n), i && e(t, i), t } }(), r = n(10), o = (i = r) && i.__esModule ? i : { default: i }; var s = function () { function e (t) { !function (e, t) { if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function") }(this, e), this.container = t.container, this.async = t.async, this.player = t.player, this.parsed = [], this.index = 0, this.current = [] } return a(e, [{ key: "show", value: function () { this.player.events.trigger("lrcshow"), this.player.template.lrcWrap.classList.remove("aplayer-lrc-hide") } }, { key: "hide", value: function () { this.player.events.trigger("lrchide"), this.player.template.lrcWrap.classList.add("aplayer-lrc-hide") } }, { key: "toggle", value: function () { this.player.template.lrcWrap.classList.contains("aplayer-lrc-hide") ? this.show() : this.hide() } }, { key: "update", value: function () { var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : this.player.audio.currentTime; if (this.index > this.current.length - 1 || e < this.current[this.index][0] || !this.current[this.index + 1] || e >= this.current[this.index + 1][0]) for (var t = 0; t < this.current.length; t++)e >= this.current[t][0] && (!this.current[t + 1] || e < this.current[t + 1][0]) && (this.index = t, this.container.style.transform = "translateY(" + 16 * -this.index + "px)", this.container.style.webkitTransform = "translateY(" + 16 * -this.index + "px)", this.container.getElementsByClassName("aplayer-lrc-current")[0].classList.remove("aplayer-lrc-current"), this.container.getElementsByTagName("p")[t].classList.add("aplayer-lrc-current")) } }, { key: "switch", value: function (e) { var t = this; if (!this.parsed[e]) if (this.async) { this.parsed[e] = [["00:00", "Loading"]]; var n = new XMLHttpRequest; n.onreadystatechange = function () { e === t.player.list.index && 4 === n.readyState && (n.status >= 200 && n.status < 300 || 304 === n.status ? t.parsed[e] = t.parse(n.responseText) : (t.player.notice("LRC file request fails: status " + n.status), t.parsed[e] = [["00:00", "Not available"]]), t.container.innerHTML = (0, o.default)({ lyrics: t.parsed[e] }), t.update(0), t.current = t.parsed[e]) }; var i = this.player.list.audios[e].lrc; n.open("get", i, !0), n.send(null) } else this.player.list.audios[e].lrc ? this.parsed[e] = this.parse(this.player.list.audios[e].lrc) : this.parsed[e] = [["00:00", "Not available"]]; this.container.innerHTML = (0, o.default)({ lyrics: this.parsed[e] }), this.update(0), this.current = this.parsed[e] } }, { key: "parse", value: function (e) { if (e) { for (var t = (e = e.replace(/([^\]^\n])\[/g, function (e, t) { return t + "\n[" })).split("\n"), n = [], i = t.length, a = 0; a < i; a++) { var r = t[a].match(/\[(\d{2}):(\d{2})(\.(\d{2,3}))?]/g), o = t[a].replace(/.*\[(\d{2}):(\d{2})(\.(\d{2,3}))?]/g, "").replace(/<(\d{2}):(\d{2})(\.(\d{2,3}))?>/g, "").replace(/^\s+|\s+$/g, ""); if (r) for (var s = r.length, l = 0; l < s; l++) { var u = /\[(\d{2}):(\d{2})(\.(\d{2,3}))?]/.exec(r[l]), c = 60 * u[1] + parseInt(u[2]) + (u[4] ? parseInt(u[4]) / (2 === (u[4] + "").length ? 100 : 1e3) : 0); n.push([c, o]) } } return (n = n.filter(function (e) { return e[1] })).sort(function (e, t) { return e[0] - t[0] }), n } return [] } }, { key: "remove", value: function (e) { this.parsed.splice(e, 1) } }, { key: "clear", value: function () { this.parsed = [], this.container.innerHTML = "" } }]), e }(); t.default = s }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }); var i, a = function () { function e (e, t) { for (var n = 0; n < t.length; n++) { var i = t[n]; i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, i.key, i) } } return function (t, n, i) { return n && e(t.prototype, n), i && e(t, i), t } }(), r = n(0), o = (i = r) && i.__esModule ? i : { default: i }; var s = function () { function e (t) { !function (e, t) { if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function") }(this, e), this.storageName = t.options.storageName, this.data = JSON.parse(o.default.storage.get(this.storageName)), this.data || (this.data = {}), this.data.volume = this.data.volume || t.options.volume } return a(e, [{ key: "get", value: function (e) { return this.data[e] } }, { key: "set", value: function (e, t) { this.data[e] = t, o.default.storage.set(this.storageName, JSON.stringify(this.data)) } }]), e }(); t.default = s }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }); var i = function () { function e (e, t) { for (var n = 0; n < t.length; n++) { var i = t[n]; i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, i.key, i) } } return function (t, n, i) { return n && e(t.prototype, n), i && e(t, i), t } }(); var a = function () { function e (t) { !function (e, t) { if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function") }(this, e), this.elements = {}, this.elements.volume = t.volume, this.elements.played = t.played, this.elements.loaded = t.loaded } return i(e, [{ key: "set", value: function (e, t, n) { t = Math.max(t, 0), t = Math.min(t, 1), this.elements[e].style[n] = 100 * t + "%" } }, { key: "get", value: function (e, t) { return parseFloat(this.elements[e].style[t]) / 100 } }]), e }(); t.default = a }, function (e, t, n) { "use strict"; (function (t) { e.exports = !1; try { e.exports = "[object process]" === Object.prototype.toString.call(t.process) } catch (e) { } }).call(this, n(4)) }, function (e, t, n) { "use strict"; (function (t) { var i = n(14), a = Object.create(i ? t : window), r = /["&'<>]/; a.$escape = function (e) { return function (e) { var t = "" + e, n = r.exec(t); if (!n) return e; var i = "", a = void 0, o = void 0, s = void 0; for (a = n.index, o = 0; a < t.length; a++) { switch (t.charCodeAt(a)) { case 34: s = "&#34;"; break; case 38: s = "&#38;"; break; case 39: s = "&#39;"; break; case 60: s = "&#60;"; break; case 62: s = "&#62;"; break; default: continue }o !== a && (i += t.substring(o, a)), o = a + 1, i += s } return o !== a ? i + t.substring(o, a) : i }(function e (t) { "string" != typeof t && (t = void 0 === t || null === t ? "" : "function" == typeof t ? e(t.call(t)) : JSON.stringify(t)); return t }(e)) }, a.$each = function (e, t) { if (Array.isArray(e)) for (var n = 0, i = e.length; n < i; n++)t(e[n], n); else for (var a in e) t(e[a], a) }, e.exports = a }).call(this, n(4)) }, function (e, t, n) { var i = n(2); e.exports = function (e) { "use strict"; var t = "", a = (e = e || {}).options, r = e.cover, o = i.$escape, s = e.icons, l = (arguments[1], function (e) { return t += e }), u = e.getObject; e.theme, e.audio, e.index; return a.fixed ? (t += '\n<div class="aplayer-list', a.listFolded && (t += " aplayer-list-hide"), t += '"', a.listMaxHeight && (t += ' style="max-height: ', t += o(a.listMaxHeight), t += '"'), t += ">\n    <ol", a.listMaxHeight && (t += ' style="max-height: ', t += o(a.listMaxHeight), t += '"'), t += ">\n        ", l(n(1)(u({ theme: a.theme, audio: a.audio, index: 1 }))), t += '\n    </ol>\n</div>\n<div class="aplayer-body">\n    <div class="aplayer-pic" style="', r && (t += "background-image: url(&quot;", t += o(r), t += "&quot;);"), t += "background-color: ", t += o(a.theme), t += ';">\n        <div class="aplayer-button aplayer-play">', t += s.play, t += '</div>\n    </div>\n    <div class="aplayer-info" style="display: none;">\n        <div class="aplayer-music">\n            <span class="aplayer-title">No audio</span>\n            <span class="aplayer-author"></span>\n        </div>\n        <div class="aplayer-controller">\n            <div class="aplayer-bar-wrap">\n                <div class="aplayer-bar">\n                    <div class="aplayer-loaded" style="width: 0"></div>\n                    <div class="aplayer-played" style="width: 0; background: ', t += o(a.theme), t += ';">\n                        <span class="aplayer-thumb" style="background: ', t += o(a.theme), t += ';">\n                            <span class="aplayer-loading-icon">', t += s.loading, t += '</span>\n                        </span>\n                    </div>\n                </div>\n            </div>\n            <div class="aplayer-time">\n                <span class="aplayer-time-inner">\n                    <span class="aplayer-ptime">00:00</span> / <span class="aplayer-dtime">00:00</span>\n                </span>\n                <span class="aplayer-icon aplayer-icon-back">\n                    ', t += s.skip, t += '\n                </span>\n                <span class="aplayer-icon aplayer-icon-play">\n                    ', t += s.play, t += '\n                </span>\n                <span class="aplayer-icon aplayer-icon-forward">\n                    ', t += s.skip, t += '\n                </span>\n                <div class="aplayer-volume-wrap">\n                    <button type="button" class="aplayer-icon aplayer-icon-volume-down">\n                        ', t += s.volumeDown, t += '\n                    </button>\n                    <div class="aplayer-volume-bar-wrap">\n                        <div class="aplayer-volume-bar">\n                            <div class="aplayer-volume" style="height: 80%; background: ', t += o(a.theme), t += ';"></div>\n                        </div>\n                    </div>\n                </div>\n                <button type="button" class="aplayer-icon aplayer-icon-order">\n                    ', "list" === a.order ? t += s.orderList : "random" === a.order && (t += s.orderRandom), t += '\n                </button>\n                <button type="button" class="aplayer-icon aplayer-icon-loop">\n                    ', "one" === a.loop ? t += s.loopOne : "all" === a.loop ? t += s.loopAll : "none" === a.loop && (t += s.loopNone), t += '\n                </button>\n                <button type="button" class="aplayer-icon aplayer-icon-menu">\n                    ', t += s.menu, t += '\n                </button>\n                <button type="button" class="aplayer-icon aplayer-icon-lrc">\n                    ', t += s.lrc, t += '\n                </button>\n            </div>\n        </div>\n    </div>\n    <div class="aplayer-notice"></div>\n    <div class="aplayer-miniswitcher"><button class="aplayer-icon">', t += s.right, t += '</button></div>\n</div>\n<div class="aplayer-lrc">\n    <div class="aplayer-lrc-contents" style="transform: translateY(0); -webkit-transform: translateY(0);"></div>\n</div>\n') : (t += '\n<div class="aplayer-body">\n    <div class="aplayer-pic" style="', r && (t += "background-image: url(&quot;", t += o(r), t += "&quot;);"), t += "background-color: ", t += o(a.theme), t += ';">\n        <div class="aplayer-button aplayer-play">', t += s.play, t += '</div>\n    </div>\n    <div class="aplayer-info">\n        <div class="aplayer-music">\n            <span class="aplayer-title">No audio</span>\n            <span class="aplayer-author"></span>\n        </div>\n        <div class="aplayer-lrc">\n            <div class="aplayer-lrc-contents" style="transform: translateY(0); -webkit-transform: translateY(0);"></div>\n        </div>\n        <div class="aplayer-controller">\n            <div class="aplayer-bar-wrap">\n                <div class="aplayer-bar">\n                    <div class="aplayer-loaded" style="width: 0"></div>\n                    <div class="aplayer-played" style="width: 0; background: ', t += o(a.theme), t += ';">\n                        <span class="aplayer-thumb" style="background: ', t += o(a.theme), t += ';">\n                            <span class="aplayer-loading-icon">', t += s.loading, t += '</span>\n                        </span>\n                    </div>\n                </div>\n            </div>\n            <div class="aplayer-time">\n                <span class="aplayer-time-inner">\n                    <span class="aplayer-ptime">00:00</span> / <span class="aplayer-dtime">00:00</span>\n                </span>\n                <span class="aplayer-icon aplayer-icon-back">\n                    ', t += s.skip, t += '\n                </span>\n                <span class="aplayer-icon aplayer-icon-play">\n                    ', t += s.play, t += '\n                </span>\n                <span class="aplayer-icon aplayer-icon-forward">\n                    ', t += s.skip, t += '\n                </span>\n                <div class="aplayer-volume-wrap">\n                    <button type="button" class="aplayer-icon aplayer-icon-volume-down">\n                        ', t += s.volumeDown, t += '\n                    </button>\n                    <div class="aplayer-volume-bar-wrap">\n                        <div class="aplayer-volume-bar">\n                            <div class="aplayer-volume" style="height: 80%; background: ', t += o(a.theme), t += ';"></div>\n                        </div>\n                    </div>\n                </div>\n                <button type="button" class="aplayer-icon aplayer-icon-order">\n                    ', "list" === a.order ? t += s.orderList : "random" === a.order && (t += s.orderRandom), t += '\n                </button>\n                <button type="button" class="aplayer-icon aplayer-icon-loop">\n                    ', "one" === a.loop ? t += s.loopOne : "all" === a.loop ? t += s.loopAll : "none" === a.loop && (t += s.loopNone), t += '\n                </button>\n                <button type="button" class="aplayer-icon aplayer-icon-menu">\n                    ', t += s.menu, t += '\n                </button>\n                <button type="button" class="aplayer-icon aplayer-icon-lrc">\n                    ', t += s.lrc, t += '\n                </button>\n            </div>\n        </div>\n    </div>\n    <div class="aplayer-notice"></div>\n    <div class="aplayer-miniswitcher"><button class="aplayer-icon">', t += s.right, t += '</button></div>\n</div>\n<div class="aplayer-list', a.listFolded && (t += " aplayer-list-hide"), t += '"', a.listMaxHeight && (t += ' style="max-height: ', t += o(a.listMaxHeight), t += '"'), t += ">\n    <ol", a.listMaxHeight && (t += ' style="max-height: ', t += o(a.listMaxHeight), t += '"'), t += ">\n        ", l(n(1)(u({ theme: a.theme, audio: a.audio, index: 1 }))), t += "\n    </ol>\n</div>\n"), t } }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }); var i = function () { function e (e, t) { for (var n = 0; n < t.length; n++) { var i = t[n]; i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, i.key, i) } } return function (t, n, i) { return n && e(t.prototype, n), i && e(t, i), t } }(), a = o(n(3)), r = o(n(16)); function o (e) { return e && e.__esModule ? e : { default: e } } var s = function () { function e (t) { !function (e, t) { if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function") }(this, e), this.container = t.container, this.options = t.options, this.randomOrder = t.randomOrder, this.init() } return i(e, [{ key: "init", value: function () { var e = ""; this.options.audio.length && (e = "random" === this.options.order ? this.options.audio[this.randomOrder[0]].cover : this.options.audio[0].cover), this.container.innerHTML = (0, r.default)({ options: this.options, icons: a.default, cover: e, getObject: function (e) { return e } }), this.lrc = this.container.querySelector(".aplayer-lrc-contents"), this.lrcWrap = this.container.querySelector(".aplayer-lrc"), this.ptime = this.container.querySelector(".aplayer-ptime"), this.info = this.container.querySelector(".aplayer-info"), this.time = this.container.querySelector(".aplayer-time"), this.barWrap = this.container.querySelector(".aplayer-bar-wrap"), this.button = this.container.querySelector(".aplayer-button"), this.body = this.container.querySelector(".aplayer-body"), this.list = this.container.querySelector(".aplayer-list"), this.listOl = this.container.querySelector(".aplayer-list ol"), this.listCurs = this.container.querySelectorAll(".aplayer-list-cur"), this.played = this.container.querySelector(".aplayer-played"), this.loaded = this.container.querySelector(".aplayer-loaded"), this.thumb = this.container.querySelector(".aplayer-thumb"), this.volume = this.container.querySelector(".aplayer-volume"), this.volumeBar = this.container.querySelector(".aplayer-volume-bar"), this.volumeButton = this.container.querySelector(".aplayer-time button"), this.volumeBarWrap = this.container.querySelector(".aplayer-volume-bar-wrap"), this.loop = this.container.querySelector(".aplayer-icon-loop"), this.order = this.container.querySelector(".aplayer-icon-order"), this.menu = this.container.querySelector(".aplayer-icon-menu"), this.pic = this.container.querySelector(".aplayer-pic"), this.title = this.container.querySelector(".aplayer-title"), this.author = this.container.querySelector(".aplayer-author"), this.dtime = this.container.querySelector(".aplayer-dtime"), this.notice = this.container.querySelector(".aplayer-notice"), this.miniSwitcher = this.container.querySelector(".aplayer-miniswitcher"), this.skipBackButton = this.container.querySelector(".aplayer-icon-back"), this.skipForwardButton = this.container.querySelector(".aplayer-icon-forward"), this.skipPlayButton = this.container.querySelector(".aplayer-icon-play"), this.lrcButton = this.container.querySelector(".aplayer-icon-lrc") } }]), e }(); t.default = s }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }), t.default = function (e) { var t = { container: e.element || document.getElementsByClassName("aplayer")[0], mini: e.narrow || e.fixed || !1, fixed: !1, autoplay: !1, mutex: !0, lrcType: e.showlrc || e.lrc || 0, preload: "auto", theme: "#b7daff", loop: "all", order: "list", volume: .7, listFolded: e.fixed, listMaxHeight: e.listmaxheight || "250px", audio: e.music || [], storageName: "aplayer-setting" }; for (var n in t) t.hasOwnProperty(n) && !e.hasOwnProperty(n) && (e[n] = t[n]); return "[object Array]" !== Object.prototype.toString.call(e.audio) && (e.audio = [e.audio]), e.audio.map(function (e) { return e.name = e.name || e.title || "Audio name", e.artist = e.artist || e.author || "Audio artist", e.cover = e.cover || e.pic, e.type = e.type || "normal", e }), e.audio.length <= 1 && "one" === e.loop && (e.loop = "all"), e } }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M26.667 5.333h-21.333c-0 0-0.001 0-0.001 0-1.472 0-2.666 1.194-2.666 2.666 0 0 0 0.001 0 0.001v-0 16c0 0 0 0.001 0 0.001 0 1.472 1.194 2.666 2.666 2.666 0 0 0.001 0 0.001 0h21.333c0 0 0.001 0 0.001 0 1.472 0 2.666-1.194 2.666-2.666 0-0 0-0.001 0-0.001v0-16c0-0 0-0.001 0-0.001 0-1.472-1.194-2.666-2.666-2.666-0 0-0.001 0-0.001 0h0zM5.333 16h5.333v2.667h-5.333v-2.667zM18.667 24h-13.333v-2.667h13.333v2.667zM26.667 24h-5.333v-2.667h5.333v2.667zM26.667 18.667h-13.333v-2.667h13.333v2.667z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M25.468 6.947c-0.326-0.172-0.724-0.151-1.030 0.057l-6.438 4.38v-3.553c0-0.371-0.205-0.71-0.532-0.884-0.326-0.172-0.724-0.151-1.030 0.057l-12 8.164c-0.274 0.186-0.438 0.496-0.438 0.827s0.164 0.641 0.438 0.827l12 8.168c0.169 0.115 0.365 0.174 0.562 0.174 0.16 0 0.321-0.038 0.468-0.116 0.327-0.173 0.532-0.514 0.532-0.884v-3.556l6.438 4.382c0.169 0.115 0.365 0.174 0.562 0.174 0.16 0 0.321-0.038 0.468-0.116 0.327-0.173 0.532-0.514 0.532-0.884v-16.333c0-0.371-0.205-0.71-0.532-0.884z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M22 16l-10.105-10.6-1.895 1.987 8.211 8.613-8.211 8.612 1.895 1.988 8.211-8.613z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M4 16c0-6.6 5.4-12 12-12s12 5.4 12 12c0 1.2-0.8 2-2 2s-2-0.8-2-2c0-4.4-3.6-8-8-8s-8 3.6-8 8 3.6 8 8 8c1.2 0 2 0.8 2 2s-0.8 2-2 2c-6.6 0-12-5.4-12-12z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 29 32"><path d="M2.667 7.027l1.707-1.693 22.293 22.293-1.693 1.707-4-4h-11.64v4l-5.333-5.333 5.333-5.333v4h8.973l-8.973-8.973v0.973h-2.667v-3.64l-4-4zM22.667 17.333h2.667v5.573l-2.667-2.667v-2.907zM22.667 6.667v-4l5.333 5.333-5.333 5.333v-4h-10.907l-2.667-2.667h13.573z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 33 32"><path d="M9.333 9.333h13.333v4l5.333-5.333-5.333-5.333v4h-16v8h2.667v-5.333zM22.667 22.667h-13.333v-4l-5.333 5.333 5.333 5.333v-4h16v-8h-2.667v5.333zM17.333 20v-8h-1.333l-2.667 1.333v1.333h2v5.333h2z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 29 32"><path d="M9.333 9.333h13.333v4l5.333-5.333-5.333-5.333v4h-16v8h2.667v-5.333zM22.667 22.667h-13.333v-4l-5.333 5.333 5.333 5.333v-4h16v-8h-2.667v5.333z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 22 32"><path d="M20.8 14.4q0.704 0 1.152 0.48t0.448 1.12-0.48 1.12-1.12 0.48h-19.2q-0.64 0-1.12-0.48t-0.48-1.12 0.448-1.12 1.152-0.48h19.2zM1.6 11.2q-0.64 0-1.12-0.48t-0.48-1.12 0.448-1.12 1.152-0.48h19.2q0.704 0 1.152 0.48t0.448 1.12-0.48 1.12-1.12 0.48h-19.2zM20.8 20.8q0.704 0 1.152 0.48t0.448 1.12-0.48 1.12-1.12 0.48h-19.2q-0.64 0-1.12-0.48t-0.48-1.12 0.448-1.12 1.152-0.48h19.2z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M0.622 18.334h19.54v7.55l11.052-9.412-11.052-9.413v7.549h-19.54v3.725z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 32 32"><path d="M22.667 4l7 6-7 6 7 6-7 6v-4h-3.653l-3.76-3.76 2.827-2.827 2.587 2.587h2v-8h-2l-12 12h-6v-4h4.347l12-12h3.653v-4zM2.667 8h6l3.76 3.76-2.827 2.827-2.587-2.587h-4.347v-4z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 28 32"><path d="M13.728 6.272v19.456q0 0.448-0.352 0.8t-0.8 0.32-0.8-0.32l-5.952-5.952h-4.672q-0.48 0-0.8-0.352t-0.352-0.8v-6.848q0-0.48 0.352-0.8t0.8-0.352h4.672l5.952-5.952q0.32-0.32 0.8-0.32t0.8 0.32 0.352 0.8z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 28 32"><path d="M13.728 6.272v19.456q0 0.448-0.352 0.8t-0.8 0.32-0.8-0.32l-5.952-5.952h-4.672q-0.48 0-0.8-0.352t-0.352-0.8v-6.848q0-0.48 0.352-0.8t0.8-0.352h4.672l5.952-5.952q0.32-0.32 0.8-0.32t0.8 0.32 0.352 0.8zM20.576 16q0 1.344-0.768 2.528t-2.016 1.664q-0.16 0.096-0.448 0.096-0.448 0-0.8-0.32t-0.32-0.832q0-0.384 0.192-0.64t0.544-0.448 0.608-0.384 0.512-0.64 0.192-1.024-0.192-1.024-0.512-0.64-0.608-0.384-0.544-0.448-0.192-0.64q0-0.48 0.32-0.832t0.8-0.32q0.288 0 0.448 0.096 1.248 0.48 2.016 1.664t0.768 2.528z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 28 32"><path d="M13.728 6.272v19.456q0 0.448-0.352 0.8t-0.8 0.32-0.8-0.32l-5.952-5.952h-4.672q-0.48 0-0.8-0.352t-0.352-0.8v-6.848q0-0.48 0.352-0.8t0.8-0.352h4.672l5.952-5.952q0.32-0.32 0.8-0.32t0.8 0.32 0.352 0.8zM20.576 16q0 1.344-0.768 2.528t-2.016 1.664q-0.16 0.096-0.448 0.096-0.448 0-0.8-0.32t-0.32-0.832q0-0.384 0.192-0.64t0.544-0.448 0.608-0.384 0.512-0.64 0.192-1.024-0.192-1.024-0.512-0.64-0.608-0.384-0.544-0.448-0.192-0.64q0-0.48 0.32-0.832t0.8-0.32q0.288 0 0.448 0.096 1.248 0.48 2.016 1.664t0.768 2.528zM25.152 16q0 2.72-1.536 5.056t-4 3.36q-0.256 0.096-0.448 0.096-0.48 0-0.832-0.352t-0.32-0.8q0-0.704 0.672-1.056 1.024-0.512 1.376-0.8 1.312-0.96 2.048-2.4t0.736-3.104-0.736-3.104-2.048-2.4q-0.352-0.288-1.376-0.8-0.672-0.352-0.672-1.056 0-0.448 0.32-0.8t0.8-0.352q0.224 0 0.48 0.096 2.496 1.056 4 3.36t1.536 5.056zM29.728 16q0 4.096-2.272 7.552t-6.048 5.056q-0.224 0.096-0.448 0.096-0.48 0-0.832-0.352t-0.32-0.8q0-0.64 0.704-1.056 0.128-0.064 0.384-0.192t0.416-0.192q0.8-0.448 1.44-0.896 2.208-1.632 3.456-4.064t1.216-5.152-1.216-5.152-3.456-4.064q-0.64-0.448-1.44-0.896-0.128-0.096-0.416-0.192t-0.384-0.192q-0.704-0.416-0.704-1.056 0-0.448 0.32-0.8t0.832-0.352q0.224 0 0.448 0.096 3.776 1.632 6.048 5.056t2.272 7.552z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 17 32"><path d="M14.080 4.8q2.88 0 2.88 2.048v18.24q0 2.112-2.88 2.112t-2.88-2.112v-18.24q0-2.048 2.88-2.048zM2.88 4.8q2.88 0 2.88 2.048v18.24q0 2.112-2.88 2.112t-2.88-2.112v-18.24q0-2.048 2.88-2.048z"></path></svg>' }, function (e, t) { e.exports = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 16 31"><path d="M15.552 15.168q0.448 0.32 0.448 0.832 0 0.448-0.448 0.768l-13.696 8.512q-0.768 0.512-1.312 0.192t-0.544-1.28v-16.448q0-0.96 0.544-1.28t1.312 0.192z"></path></svg>' }, function (e, t, n) { "use strict"; var i, a, r = e.exports = {}; function o () { throw new Error("setTimeout has not been defined") } function s () { throw new Error("clearTimeout has not been defined") } function l (e) { if (i === setTimeout) return setTimeout(e, 0); if ((i === o || !i) && setTimeout) return i = setTimeout, setTimeout(e, 0); try { return i(e, 0) } catch (t) { try { return i.call(null, e, 0) } catch (t) { return i.call(this, e, 0) } } } !function () { try { i = "function" == typeof setTimeout ? setTimeout : o } catch (e) { i = o } try { a = "function" == typeof clearTimeout ? clearTimeout : s } catch (e) { a = s } }(); var u, c = [], p = !1, d = -1; function h () { p && u && (p = !1, u.length ? c = u.concat(c) : d = -1, c.length && y()) } function y () { if (!p) { var e = l(h); p = !0; for (var t = c.length; t;) { for (u = c, c = []; ++d < t;)u && u[d].run(); d = -1, t = c.length } u = null, p = !1, function (e) { if (a === clearTimeout) return clearTimeout(e); if ((a === s || !a) && clearTimeout) return a = clearTimeout, clearTimeout(e); try { a(e) } catch (t) { try { return a.call(null, e) } catch (t) { return a.call(this, e) } } }(e) } } function f (e, t) { this.fun = e, this.array = t } function v () { } r.nextTick = function (e) { var t = new Array(arguments.length - 1); if (arguments.length > 1) for (var n = 1; n < arguments.length; n++)t[n - 1] = arguments[n]; c.push(new f(e, t)), 1 !== c.length || p || l(y) }, f.prototype.run = function () { this.fun.apply(null, this.array) }, r.title = "browser", r.browser = !0, r.env = {}, r.argv = [], r.version = "", r.versions = {}, r.on = v, r.addListener = v, r.once = v, r.off = v, r.removeListener = v, r.removeAllListeners = v, r.emit = v, r.prependListener = v, r.prependOnceListener = v, r.listeners = function (e) { return [] }, r.binding = function (e) { throw new Error("process.binding is not supported") }, r.cwd = function () { return "/" }, r.chdir = function (e) { throw new Error("process.chdir is not supported") }, r.umask = function () { return 0 } }, function (e, t, n) { "use strict"; (function (e, t) { !function (e, n) { if (!e.setImmediate) { var i, a, r, o, s, l = 1, u = {}, c = !1, p = e.document, d = Object.getPrototypeOf && Object.getPrototypeOf(e); d = d && d.setTimeout ? d : e, "[object process]" === {}.toString.call(e.process) ? i = function (e) { t.nextTick(function () { y(e) }) } : !function () { if (e.postMessage && !e.importScripts) { var t = !0, n = e.onmessage; return e.onmessage = function () { t = !1 }, e.postMessage("", "*"), e.onmessage = n, t } }() ? e.MessageChannel ? ((r = new MessageChannel).port1.onmessage = function (e) { y(e.data) }, i = function (e) { r.port2.postMessage(e) }) : p && "onreadystatechange" in p.createElement("script") ? (a = p.documentElement, i = function (e) { var t = p.createElement("script"); t.onreadystatechange = function () { y(e), t.onreadystatechange = null, a.removeChild(t), t = null }, a.appendChild(t) }) : i = function (e) { setTimeout(y, 0, e) } : (o = "setImmediate$" + Math.random() + "$", s = function (t) { t.source === e && "string" == typeof t.data && 0 === t.data.indexOf(o) && y(+t.data.slice(o.length)) }, e.addEventListener ? e.addEventListener("message", s, !1) : e.attachEvent("onmessage", s), i = function (t) { e.postMessage(o + t, "*") }), d.setImmediate = function (e) { "function" != typeof e && (e = new Function("" + e)); for (var t = new Array(arguments.length - 1), n = 0; n < t.length; n++)t[n] = arguments[n + 1]; var a = { callback: e, args: t }; return u[l] = a, i(l), l++ }, d.clearImmediate = h } function h (e) { delete u[e] } function y (e) { if (c) setTimeout(y, 0, e); else { var t = u[e]; if (t) { c = !0; try { !function (e) { var t = e.callback, i = e.args; switch (i.length) { case 0: t(); break; case 1: t(i[0]); break; case 2: t(i[0], i[1]); break; case 3: t(i[0], i[1], i[2]); break; default: t.apply(n, i) } }(t) } finally { h(e), c = !1 } } } } }("undefined" == typeof self ? void 0 === e ? void 0 : e : self) }).call(this, n(4), n(34)) }, function (e, t, n) { "use strict"; var i = Function.prototype.apply; function a (e, t) { this._id = e, this._clearFn = t } t.setTimeout = function () { return new a(i.call(setTimeout, window, arguments), clearTimeout) }, t.setInterval = function () { return new a(i.call(setInterval, window, arguments), clearInterval) }, t.clearTimeout = t.clearInterval = function (e) { e && e.close() }, a.prototype.unref = a.prototype.ref = function () { }, a.prototype.close = function () { this._clearFn.call(window, this._id) }, t.enroll = function (e, t) { clearTimeout(e._idleTimeoutId), e._idleTimeout = t }, t.unenroll = function (e) { clearTimeout(e._idleTimeoutId), e._idleTimeout = -1 }, t._unrefActive = t.active = function (e) { clearTimeout(e._idleTimeoutId); var t = e._idleTimeout; t >= 0 && (e._idleTimeoutId = setTimeout(function () { e._onTimeout && e._onTimeout() }, t)) }, n(35), t.setImmediate = setImmediate, t.clearImmediate = clearImmediate }, function (e, t, n) { "use strict"; (function (t) { var n = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (e) { return typeof e } : function (e) { return e && "function" == typeof Symbol && e.constructor === Symbol && e !== Symbol.prototype ? "symbol" : typeof e }, i = setTimeout; function a () { } function r (e) { if (!(this instanceof r)) throw new TypeError("Promises must be constructed via new"); if ("function" != typeof e) throw new TypeError("not a function"); this._state = 0, this._handled = !1, this._value = void 0, this._deferreds = [], c(e, this) } function o (e, t) { for (; 3 === e._state;)e = e._value; 0 !== e._state ? (e._handled = !0, r._immediateFn(function () { var n = 1 === e._state ? t.onFulfilled : t.onRejected; if (null !== n) { var i; try { i = n(e._value) } catch (e) { return void l(t.promise, e) } s(t.promise, i) } else (1 === e._state ? s : l)(t.promise, e._value) })) : e._deferreds.push(t) } function s (e, t) { try { if (t === e) throw new TypeError("A promise cannot be resolved with itself."); if (t && ("object" === (void 0 === t ? "undefined" : n(t)) || "function" == typeof t)) { var i = t.then; if (t instanceof r) return e._state = 3, e._value = t, void u(e); if ("function" == typeof i) return void c((a = i, o = t, function () { a.apply(o, arguments) }), e) } e._state = 1, e._value = t, u(e) } catch (t) { l(e, t) } var a, o } function l (e, t) { e._state = 2, e._value = t, u(e) } function u (e) { 2 === e._state && 0 === e._deferreds.length && r._immediateFn(function () { e._handled || r._unhandledRejectionFn(e._value) }); for (var t = 0, n = e._deferreds.length; t < n; t++)o(e, e._deferreds[t]); e._deferreds = null } function c (e, t) { var n = !1; try { e(function (e) { n || (n = !0, s(t, e)) }, function (e) { n || (n = !0, l(t, e)) }) } catch (e) { if (n) return; n = !0, l(t, e) } } r.prototype.catch = function (e) { return this.then(null, e) }, r.prototype.then = function (e, t) { var n = new this.constructor(a); return o(this, new function (e, t, n) { this.onFulfilled = "function" == typeof e ? e : null, this.onRejected = "function" == typeof t ? t : null, this.promise = n }(e, t, n)), n }, r.prototype.finally = function (e) { var t = this.constructor; return this.then(function (n) { return t.resolve(e()).then(function () { return n }) }, function (n) { return t.resolve(e()).then(function () { return t.reject(n) }) }) }, r.all = function (e) { return new r(function (t, i) { if (!e || void 0 === e.length) throw new TypeError("Promise.all accepts an array"); var a = Array.prototype.slice.call(e); if (0 === a.length) return t([]); var r = a.length; function o (e, s) { try { if (s && ("object" === (void 0 === s ? "undefined" : n(s)) || "function" == typeof s)) { var l = s.then; if ("function" == typeof l) return void l.call(s, function (t) { o(e, t) }, i) } a[e] = s, 0 == --r && t(a) } catch (e) { i(e) } } for (var s = 0; s < a.length; s++)o(s, a[s]) }) }, r.resolve = function (e) { return e && "object" === (void 0 === e ? "undefined" : n(e)) && e.constructor === r ? e : new r(function (t) { t(e) }) }, r.reject = function (e) { return new r(function (t, n) { n(e) }) }, r.race = function (e) { return new r(function (t, n) { for (var i = 0, a = e.length; i < a; i++)e[i].then(t, n) }) }, r._immediateFn = "function" == typeof t && function (e) { t(e) } || function (e) { i(e, 0) }, r._unhandledRejectionFn = function (e) { "undefined" != typeof console && console && console.warn("Possible Unhandled Promise Rejection:", e) }, e.exports = r }).call(this, n(36).setImmediate) }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }); var i = function () { function e (e, t) { for (var n = 0; n < t.length; n++) { var i = t[n]; i.enumerable = i.enumerable || !1, i.configurable = !0, "value" in i && (i.writable = !0), Object.defineProperty(e, i.key, i) } } return function (t, n, i) { return n && e(t.prototype, n), i && e(t, i), t } }(), a = v(n(37)), r = v(n(0)), o = v(n(3)), s = v(n(18)), l = v(n(17)), u = v(n(13)), c = v(n(12)), p = v(n(11)), d = v(n(9)), h = v(n(8)), y = v(n(7)), f = v(n(6)); function v (e) { return e && e.__esModule ? e : { default: e } } var m = [], g = function () { function e (t) { if (function (e, t) { if (!(e instanceof t)) throw new TypeError("Cannot call a class as a function") }(this, e), this.options = (0, s.default)(t), this.container = this.options.container, this.paused = !0, this.playedPromise = a.default.resolve(), this.mode = "normal", this.randomOrder = r.default.randomOrder(this.options.audio.length), this.container.classList.add("aplayer"), this.options.lrcType && !this.options.fixed && this.container.classList.add("aplayer-withlrc"), this.options.audio.length > 1 && this.container.classList.add("aplayer-withlist"), r.default.isMobile && this.container.classList.add("aplayer-mobile"), this.arrow = this.container.offsetWidth <= 300, this.arrow && this.container.classList.add("aplayer-arrow"), this.container = this.options.container, 2 === this.options.lrcType || !0 === this.options.lrcType) for (var n = this.container.getElementsByClassName("aplayer-lrc-content"), i = 0; i < n.length; i++)this.options.audio[i] && (this.options.audio[i].lrc = n[i].innerHTML); this.template = new l.default({ container: this.container, options: this.options, randomOrder: this.randomOrder }), this.options.fixed && (this.container.classList.add("aplayer-fixed"), this.template.body.style.width = this.template.body.offsetWidth - 18 + "px"), this.options.mini && (this.setMode("mini"), this.template.info.style.display = "block"), this.template.info.offsetWidth < 200 && this.template.time.classList.add("aplayer-time-narrow"), this.options.lrcType && (this.lrc = new p.default({ container: this.template.lrc, async: 3 === this.options.lrcType, player: this })), this.events = new y.default, this.storage = new c.default(this), this.bar = new u.default(this.template), this.controller = new d.default(this), this.timer = new h.default(this), this.list = new f.default(this), this.initAudio(), this.bindEvents(), "random" === this.options.order ? this.list.switch(this.randomOrder[0]) : this.list.switch(0), this.options.autoplay && this.play(), m.push(this) } return i(e, [{ key: "initAudio", value: function () { var e = this; this.audio = document.createElement("audio"), this.audio.preload = this.options.preload; for (var t = function (t) { e.audio.addEventListener(e.events.audioEvents[t], function (n) { e.events.trigger(e.events.audioEvents[t], n) }) }, n = 0; n < this.events.audioEvents.length; n++)t(n); this.volume(this.storage.get("volume"), !0) } }, { key: "bindEvents", value: function () { var e = this; this.on("play", function () { e.paused && e.setUIPlaying() }), this.on("pause", function () { e.paused || e.setUIPaused() }), this.on("timeupdate", function () { if (!e.disableTimeupdate) { e.bar.set("played", e.audio.currentTime / e.duration, "width"), e.lrc && e.lrc.update(); var t = r.default.secondToTime(e.audio.currentTime); e.template.ptime.innerHTML !== t && (e.template.ptime.innerHTML = t) } }), this.on("durationchange", function () { 1 !== e.duration && (e.template.dtime.innerHTML = r.default.secondToTime(e.duration)) }), this.on("progress", function () { var t = e.audio.buffered.length ? e.audio.buffered.end(e.audio.buffered.length - 1) / e.duration : 0; e.bar.set("loaded", t, "width") }); var t = void 0; this.on("error", function () { e.list.audios.length > 1 ? (e.notice("An audio error has occurred, player will skip forward in 2 seconds."), t = setTimeout(function () { e.skipForward(), e.paused || e.play() }, 2e3)) : 1 === e.list.audios.length && e.notice("An audio error has occurred.") }), this.events.on("listswitch", function () { t && clearTimeout(t) }), this.on("ended", function () { "none" === e.options.loop ? "list" === e.options.order ? e.list.index < e.list.audios.length - 1 ? (e.list.switch((e.list.index + 1) % e.list.audios.length), e.play()) : (e.list.switch((e.list.index + 1) % e.list.audios.length), e.pause()) : "random" === e.options.order && (e.randomOrder.indexOf(e.list.index) < e.randomOrder.length - 1 ? (e.list.switch(e.nextIndex()), e.play()) : (e.list.switch(e.nextIndex()), e.pause())) : "one" === e.options.loop ? (e.list.switch(e.list.index), e.play()) : "all" === e.options.loop && (e.skipForward(), e.play()) }) } }, { key: "setAudio", value: function (e) { this.hls && (this.hls.destroy(), this.hls = null); var t = e.type; this.options.customAudioType && this.options.customAudioType[t] ? "[object Function]" === Object.prototype.toString.call(this.options.customAudioType[t]) ? this.options.customAudioType[t](this.audio, e, this) : console.error("Illegal customType: " + t) : (t && "auto" !== t || (t = /m3u8(#|\?|$)/i.exec(e.url) ? "hls" : "normal"), "hls" === t ? Hls.isSupported() ? (this.hls = new Hls, this.hls.loadSource(e.url), this.hls.attachMedia(this.audio)) : this.audio.canPlayType("application/x-mpegURL") || this.audio.canPlayType("application/vnd.apple.mpegURL") ? this.audio.src = e.url : this.notice("Error: HLS is not supported.") : "normal" === t && (this.audio.src = e.url)), this.seek(0), this.paused || this.audio.play() } }, { key: "theme", value: function () { var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : this.list.audios[this.list.index].theme || this.options.theme, t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : this.list.index; (!(arguments.length > 2 && void 0 !== arguments[2]) || arguments[2]) && this.list.audios[t] && (this.list.audios[t].theme = e), this.template.listCurs[t] && (this.template.listCurs[t].style.backgroundColor = e), t === this.list.index && (this.template.pic.style.backgroundColor = e, this.template.played.style.background = e, this.template.thumb.style.background = e, this.template.volume.style.background = e) } }, { key: "seek", value: function (e) { e = Math.max(e, 0), e = Math.min(e, this.duration), this.audio.currentTime = e, this.bar.set("played", e / this.duration, "width"), this.template.ptime.innerHTML = r.default.secondToTime(e) } }, { key: "setUIPlaying", value: function () { var e = this; if (this.paused && (this.paused = !1, this.template.button.classList.remove("aplayer-play"), this.template.button.classList.add("aplayer-pause"), this.template.button.innerHTML = "", setTimeout(function () { e.template.button.innerHTML = o.default.pause }, 100), this.template.skipPlayButton.innerHTML = o.default.pause), this.timer.enable("loading"), this.options.mutex) for (var t = 0; t < m.length; t++)this !== m[t] && m[t].pause() } }, { key: "play", value: function () { var e = this; this.setUIPlaying(); var t = this.audio.play(); t && t.catch(function (t) { console.warn(t), "NotAllowedError" === t.name && e.setUIPaused() }) } }, { key: "setUIPaused", value: function () { var e = this; this.paused || (this.paused = !0, this.template.button.classList.remove("aplayer-pause"), this.template.button.classList.add("aplayer-play"), this.template.button.innerHTML = "", setTimeout(function () { e.template.button.innerHTML = o.default.play }, 100), this.template.skipPlayButton.innerHTML = o.default.play), this.container.classList.remove("aplayer-loading"), this.timer.disable("loading") } }, { key: "pause", value: function () { this.setUIPaused(), this.audio.pause() } }, { key: "switchVolumeIcon", value: function () { this.volume() >= .95 ? this.template.volumeButton.innerHTML = o.default.volumeUp : this.volume() > 0 ? this.template.volumeButton.innerHTML = o.default.volumeDown : this.template.volumeButton.innerHTML = o.default.volumeOff } }, { key: "volume", value: function (e, t) { return e = parseFloat(e), isNaN(e) || (e = Math.max(e, 0), e = Math.min(e, 1), this.bar.set("volume", e, "height"), t || this.storage.set("volume", e), this.audio.volume = e, this.audio.muted && (this.audio.muted = !1), this.switchVolumeIcon()), this.audio.muted ? 0 : this.audio.volume } }, { key: "on", value: function (e, t) { this.events.on(e, t) } }, { key: "toggle", value: function () { this.template.button.classList.contains("aplayer-play") ? this.play() : this.template.button.classList.contains("aplayer-pause") && this.pause() } }, { key: "switchAudio", value: function (e) { this.list.switch(e) } }, { key: "addAudio", value: function (e) { this.list.add(e) } }, { key: "removeAudio", value: function (e) { this.list.remove(e) } }, { key: "destroy", value: function () { m.splice(m.indexOf(this), 1), this.pause(), this.container.innerHTML = "", this.audio.src = "", this.timer.destroy(), this.events.trigger("destroy") } }, { key: "setMode", value: function () { var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "normal"; this.mode = e, "mini" === e ? this.container.classList.add("aplayer-narrow") : "normal" === e && this.container.classList.remove("aplayer-narrow") } }, { key: "notice", value: function (e) { var t = this, n = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 2e3, i = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : .8; this.template.notice.innerHTML = e, this.template.notice.style.opacity = i, this.noticeTime && clearTimeout(this.noticeTime), this.events.trigger("noticeshow", { text: e }), n && (this.noticeTime = setTimeout(function () { t.template.notice.style.opacity = 0, t.events.trigger("noticehide") }, n)) } }, { key: "prevIndex", value: function () { if (!(this.list.audios.length > 1)) return 0; if ("list" === this.options.order) return this.list.index - 1 < 0 ? this.list.audios.length - 1 : this.list.index - 1; if ("random" === this.options.order) { var e = this.randomOrder.indexOf(this.list.index); return 0 === e ? this.randomOrder[this.randomOrder.length - 1] : this.randomOrder[e - 1] } } }, { key: "nextIndex", value: function () { if (!(this.list.audios.length > 1)) return 0; if ("list" === this.options.order) return (this.list.index + 1) % this.list.audios.length; if ("random" === this.options.order) { var e = this.randomOrder.indexOf(this.list.index); return e === this.randomOrder.length - 1 ? this.randomOrder[0] : this.randomOrder[e + 1] } } }, { key: "skipBack", value: function () { this.list.switch(this.prevIndex()) } }, { key: "skipForward", value: function () { this.list.switch(this.nextIndex()) } }, { key: "duration", get: function () { return isNaN(this.audio.duration) ? 0 : this.audio.duration } }], [{ key: "version", get: function () { return "1.10.1" } }]), e }(); t.default = g }, , function (e, t, n) { }, function (e, t, n) { "use strict"; Object.defineProperty(t, "__esModule", { value: !0 }), n(40); var i, a = n(38), r = (i = a) && i.__esModule ? i : { default: i }; console.log("\n %c APlayer v1.10.1 af84efb %c http://aplayer.js.org \n", "color: #fadfa3; background: #030307; padding:5px 0;", "background: #fadfa3; padding:5px 0;"), t.default = r.default }]).default })
//# sourceMappingURL=APlayer.min.js.map


//mark_lists

let music_list_all = new Array();
music_list_all[0] = new Array();
music_list_all[1] = new Array();
let music_all = new Array();
let mv_list = new Array();
let music_tags = new Array();
let music_all_hq = new Array();
let music_all_sq = new Array();
let music_all_hq_sql = new Array();
let music_all_sq_sql = new Array();
var static_data_promises = {};
var music_quality_promises = {};
// 静态资料曾以 stale-while-revalidate 缓存，数据表发布后浏览器仍可能先拿到
// 上一版歌单。此版本参数只用于淘汰该旧缓存；后续由 Netlify 的 ETag 重新校验。
var MUSIC_DATA_CACHE_VERSION = '20260719-acg101';
var music_quality_switching = false;
var music_tag_overrides = {};
var music_admin_state = { authenticated: false, checked: false, loading: false, promise: null };
var music_tag_editor_state = null;
var mv_player_runtime_promise = null;
let SQ_button;
let HQ_button;
let active_list = new Array();
let sq_list_init_ok = false;
let hq_list_init_ok = false;
let default_list_init_ok = false;
let mv_ok = false;
var PLAYER_SETTINGS_KEY = 'yusen-player-settings-v1';
var DEFAULT_PLAYER_SETTINGS = {
  music: { quality: 0, volume: 0.5, loop: 'all', order: 'list', currentList: 2 },
  mv: { theme: 'sea', volume: 0.6, view: 'grid', group: '全部', qualityCode: 'dash-64' }
};

function read_player_settings() {
  try {
    var stored = JSON.parse(localStorage.getItem(PLAYER_SETTINGS_KEY) || '{}');
    return {
      music: Object.assign({}, DEFAULT_PLAYER_SETTINGS.music, stored.music || {}),
      mv: Object.assign({}, DEFAULT_PLAYER_SETTINGS.mv, stored.mv || {})
    };
  } catch (error) {
    return {
      music: Object.assign({}, DEFAULT_PLAYER_SETTINGS.music),
      mv: Object.assign({}, DEFAULT_PLAYER_SETTINGS.mv)
    };
  }
}

function update_player_settings(section, patch) {
  var settings = read_player_settings();
  settings[section] = Object.assign({}, settings[section], patch || {});
  try {
    localStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {}
  return settings[section];
}

var music_player_settings = read_player_settings().music;
let quality = Number(music_player_settings.quality) === 1 ? 1 : 0;
var origin = window.location.origin;
var target = origin + "/music";
var target2 = origin + "/music/";
let page_loaded = false;
let is_playing = false;
let ap_list_ptr = new Array();
let current_list = Number.isInteger(Number(music_player_settings.currentList)) && Number(music_player_settings.currentList) > 0
  ? Number(music_player_settings.currentList) : 2;
let list_count = 2;
let mv_player = null;
var target_x_list = new Array();
var current_page = 0;
var is_mobile = false;
var subdiv;
var rendered_playlist_width = 0;
var music_list_display_limit = parseInt(localStorage.getItem('music-list-display-limit') || '12', 10);

function apply_music_list_display_limit(value) {
  music_list_display_limit = Number.isFinite(value) && value >= 0 ? value : 12;
  var row = document.querySelector('.music-list');
  var rowHeight = row ? Math.ceil(row.getBoundingClientRect().height) : 32;
  var collapsed = music_list_display_limit === 0 ? 'none' : (music_list_display_limit * rowHeight + 2) + 'px';
  document.documentElement.style.setProperty('--music-list-collapsed-height', collapsed);
  document.documentElement.style.removeProperty('--music-list-expanded-height');
  var selector = document.getElementById('ap_list_display_limit');
  if (selector) selector.value = String(music_list_display_limit);
}

$(function () {
  if((/Android|webOS|iPhone|iPod|iPad|BlackBerry/i.test(navigator.userAgent)))
  {
      is_mobile = true;
  }
  
  jQuery.fn.isChildAndSelfOf = function(b){
    return (this.closest(b).length > 0);
  };
  apply_music_list_display_limit(music_list_display_limit);
  $(document).on('change', '#ap_list_display_limit', function(e) {
    var value = parseInt(e.target.value, 10);
    localStorage.setItem('music-list-display-limit', String(value));
    apply_music_list_display_limit(value);
  });
  init_with_database();
});

function objectSort(property) {
  return function (Obj1,Obj2) {
        return Obj1[property]-Obj2[property]
  }
}

function init_with_database()
{
  // 首屏只下载当前选中的音质。另一份约 1.5 MB 的曲库在用户真正切换音质时
  // 才读取；歌单和 MV 资料仍和当前曲库并行加载，页面功能不会等待无用数据。
  Promise.all([ensure_music_quality(quality), load_static_data('music_tag'), load_static_data('mv_bilibili')]).then(function (sets) {
    var activeLibrary = sets[0];
    mv_list = sets[2].sort(objectSort('mv_id'));
    music_tags = sets[1].sort(objectSort('tag_order'));
    var libraryCount = document.getElementById('music-library-count');
    if (libraryCount) libraryCount.innerText = activeLibrary.length;
    music_list_all[2] = activeLibrary.filter(function(song) {
      return song.list && song.list.indexOf(2) !== -1;
    }).map(function(song) { return song.mid; });
    music_list_all[1] = [];
    hq_list_init_ok = sq_list_init_ok = default_list_init_ok = mv_ok = true;
    init_aplayer();
    // 登录状态由控制台的 HttpOnly Cookie 决定；仅确认仓库所有者后才渲染
    // 曲目行中的标签编辑入口。普通访客不会获得任何编辑控件。
    refresh_music_admin_session();
  }).catch(function(err) { console.error('Unable to load local music data', err); });
}

function load_static_data(name) {
  if (static_data_promises[name]) return static_data_promises[name];
  var dataUrl = '/data/' + name + '.0.jsonl?revision=' + encodeURIComponent(MUSIC_DATA_CACHE_VERSION);
  var request = fetch(dataUrl, {cache: 'no-store'}).then(function(response) {
    if (!response.ok) throw new Error(response.status + ' ' + name);
    return response.text();
  }).then(function(text) {
    return text.split('\n').filter(function(line) { return line && line.charAt(0) === '{'; })
      .map(function(line) { return JSON.parse(line); });
  });
  static_data_promises[name] = request.catch(function(error) {
    delete static_data_promises[name];
    throw error;
  });
  return static_data_promises[name];
}

// Hugging Face 在国内网络中的可用性会随网络和地区变化。播放器始终先尝试
// Sufy CDN、AI 快站、hf-mirror，再在媒体加载失败时切换到官方地址。音频和封面
// 流量由资料源直接发给
// 浏览器，不经过博客的 Netlify Function。
var MUSIC_HF_SOURCE_HOSTS = ['hf-cdn.sufy.com', 'aifasthub.com', 'hf-mirror.com', 'huggingface.co'];
var music_hf_host_priority = MUSIC_HF_SOURCE_HOSTS.slice();
var music_hf_probe_promise = null;
var music_hf_cover_host_priority = MUSIC_HF_SOURCE_HOSTS.slice();
var music_hf_cover_probe_promise = null;
var MUSIC_HF_DATASET_PREFIX = '/datasets/Yusen/music/resolve/main/';
var MUSIC_AUDIO_FILE_RE = /\.(mp3|flac|m4a|aac|ogg|opus|wav)$/i;
var MUSIC_COVER_FILE_RE = /\.(avif|bmp|gif|jpe?g|png|webp)$/i;
var MUSIC_SOURCE_TIMEOUT_MS = 5 * 1000;
var MUSIC_SOURCE_RETRIES_PER_MIRROR = 1;
var MUSIC_SOURCE_PROBE_TIMEOUT_MS = 3500;
var MUSIC_COVER_PROBE_TIMEOUT_MS = 2500;
var MUSIC_COVER_TIMEOUT_MS = 12 * 1000;

function music_hf_dataset_path(value, filePattern) {
  try {
    var source = new URL(String(value || ''), window.location.origin);
    var host = source.hostname.toLowerCase();
    var pathname = decodeURIComponent(source.pathname);
    if (source.protocol !== 'https:' || MUSIC_HF_SOURCE_HOSTS.indexOf(host) === -1) return null;
    if (pathname.indexOf(MUSIC_HF_DATASET_PREFIX) !== 0 || /\/\.\.\//.test(pathname)) return null;
    if (!filePattern.test(pathname)) return null;
    return {
      pathname: source.pathname,
      search: source.search,
    };
  } catch (error) {
    return null;
  }
}

function music_hf_source_path(value) {
  return music_hf_dataset_path(value, MUSIC_AUDIO_FILE_RE);
}

function music_hf_cover_path(value) {
  return music_hf_dataset_path(value, MUSIC_COVER_FILE_RE);
}

function music_hf_urls(path, download, priority) {
  if (!path) return null;
  return (priority || music_hf_host_priority).map(function(host) {
    var url = new URL('https://' + host + path.pathname + path.search);
    if (download) url.searchParams.set('download', 'true');
    return url.toString();
  });
}

function music_hf_url_host(url) {
  try { return new URL(url).hostname.toLowerCase(); } catch (error) { return ''; }
}

function prioritise_music_hf_urls(urls, preferredHost, priority) {
  var hostPriority = priority || music_hf_host_priority;
  return (Array.isArray(urls) ? urls : []).slice().sort(function(left, right) {
    var leftHost = music_hf_url_host(left);
    var rightHost = music_hf_url_host(right);
    if (preferredHost) {
      if (leftHost === preferredHost && rightHost !== preferredHost) return -1;
      if (rightHost === preferredHost && leftHost !== preferredHost) return 1;
    }
    var leftIndex = hostPriority.indexOf(leftHost);
    var rightIndex = hostPriority.indexOf(rightHost);
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
      (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
}

function prime_music_hf_mirrors(sampleSource) {
  if (music_hf_probe_promise) return music_hf_probe_promise;
  var samplePath = music_hf_source_path(sampleSource);
  var candidates = music_hf_urls(samplePath, false);
  if (!candidates || !candidates.length || typeof window.fetch !== 'function') return Promise.resolve();

  // no-cors HEAD 不读取跨域响应内容，只测量连接、重定向与首个响应的耗时；四个
  // 请求同时启动，不会下载整首音乐。测试使用曲库中真实存在的音频路径，因此
  // 能反映当前网络到实际媒体节点的可达性。
  var probes = candidates.map(function(url) {
    var controller = typeof window.AbortController === 'function' ? new window.AbortController() : null;
    var startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    var timeoutId = controller ? window.setTimeout(function() { controller.abort(); }, MUSIC_SOURCE_PROBE_TIMEOUT_MS) : 0;
    var options = {
      method: 'HEAD',
      mode: 'no-cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
    };
    if (controller) options.signal = controller.signal;
    return window.fetch(url, options).then(function() {
      if (timeoutId) window.clearTimeout(timeoutId);
      return {host: music_hf_url_host(url), elapsed: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt};
    }, function() {
      if (timeoutId) window.clearTimeout(timeoutId);
      return null;
    });
  });

  music_hf_probe_promise = Promise.all(probes).then(function(results) {
    var reachable = results.filter(Boolean).sort(function(left, right) { return left.elapsed - right.elapsed; });
    if (reachable.length) {
      var nextPriority = reachable.map(function(result) { return result.host; });
      MUSIC_HF_SOURCE_HOSTS.forEach(function(host) {
        if (nextPriority.indexOf(host) === -1) nextPriority.push(host);
      });
      music_hf_host_priority = nextPriority;
    }
    return music_hf_host_priority.slice();
  }).catch(function() {
    return music_hf_host_priority.slice();
  });
  return music_hf_probe_promise;
}

function prime_music_hf_cover_mirrors(sampleCover) {
  if (music_hf_cover_probe_promise) return music_hf_cover_probe_promise;
  var samplePath = music_hf_cover_path(sampleCover);
  var candidates = music_hf_urls(samplePath, false, music_hf_cover_host_priority);
  if (!candidates || !candidates.length || typeof window.fetch !== 'function') return Promise.resolve();

  // 封面与音频采用独立测速。四个 HEAD 请求并发发出，图片正文不会被下载。
  // 测速结果仅供后续创建的封面节点排序使用；不重置已经显示的图片，以免打断
  // 切歌时播放器封面的淡入淡出动画。
  var probes = candidates.map(function(url) {
    var controller = typeof window.AbortController === 'function' ? new window.AbortController() : null;
    var startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    var timeoutId = controller ? window.setTimeout(function() { controller.abort(); }, MUSIC_COVER_PROBE_TIMEOUT_MS) : 0;
    var options = {
      method: 'HEAD',
      mode: 'no-cors',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'follow',
    };
    if (controller) options.signal = controller.signal;
    return window.fetch(url, options).then(function() {
      if (timeoutId) window.clearTimeout(timeoutId);
      return {host: music_hf_url_host(url), elapsed: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt};
    }, function() {
      if (timeoutId) window.clearTimeout(timeoutId);
      return null;
    });
  });

  music_hf_cover_probe_promise = Promise.all(probes).then(function(results) {
    var reachable = results.filter(Boolean).sort(function(left, right) { return left.elapsed - right.elapsed; });
    if (reachable.length) {
      var nextPriority = reachable.map(function(result) { return result.host; });
      MUSIC_HF_SOURCE_HOSTS.forEach(function(host) {
        if (nextPriority.indexOf(host) === -1) nextPriority.push(host);
      });
      music_hf_cover_host_priority = nextPriority;
    }
    return music_hf_cover_host_priority.slice();
  }).catch(function() {
    return music_hf_cover_host_priority.slice();
  });
  return music_hf_cover_probe_promise;
}

function music_source_urls(value, download) {
  return music_hf_urls(music_hf_source_path(value), download);
}

function music_cover_urls(value) {
  return music_hf_urls(music_hf_cover_path(value), false, music_hf_cover_host_priority);
}

function apply_music_source_urls(library) {
  if (!Array.isArray(library)) return library;
  library.forEach(function(song) {
    if (!song || typeof song.url !== 'string') return;
    var original = song.source_url || song.url;
    var candidates = music_source_urls(original, false);
    if (!candidates || !candidates.length) return;
    song.source_url = original;
    song.source_candidates = candidates;
    song.url = candidates[0];

    var originalCover = song.cover_source || song.pic_source || song.cover || song.pic;
    var coverCandidates = music_cover_urls(originalCover);
    if (coverCandidates && coverCandidates.length) {
      song.cover_source = originalCover;
      song.pic_source = originalCover;
      song.cover_candidates = coverCandidates;
      song.pic_candidates = coverCandidates;
      song.cover = coverCandidates[0];
      song.pic = coverCandidates[0];
    }
  });
  return library;
}

function music_source_candidates(song) {
  if (!song) return [];
  if (Array.isArray(song.source_candidates) && song.source_candidates.length) {
    return prioritise_music_hf_urls(song.source_candidates);
  }
  return music_source_urls(song.source_url || song.url, false) || [];
}

function music_cover_candidates(song) {
  if (!song) return [];
  var preferredHost = song.__musicSourceHost || '';
  if (Array.isArray(song.cover_candidates) && song.cover_candidates.length) return prioritise_music_hf_urls(song.cover_candidates, preferredHost, music_hf_cover_host_priority);
  if (Array.isArray(song.pic_candidates) && song.pic_candidates.length) return prioritise_music_hf_urls(song.pic_candidates, preferredHost, music_hf_cover_host_priority);
  var source = song.cover_source || song.pic_source || song.cover || song.pic;
  return music_cover_urls(source) || (source ? [source] : []);
}

function load_music_cover(candidates, onSuccess, onFailure) {
  var sources = (Array.isArray(candidates) ? candidates : []).filter(Boolean);
  var sourceIndex = 0;
  var attemptId = 0;
  var timeoutId = 0;
  var image = new Image();

  function clearAttemptTimeout() {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutId = 0;
    }
  }
  function loadNext() {
    clearAttemptTimeout();
    if (sourceIndex >= sources.length) {
      if (typeof onFailure === 'function') onFailure();
      return;
    }
    var source = sources[sourceIndex++];
    var currentAttempt = ++attemptId;
    image.onload = function() {
      if (currentAttempt !== attemptId) return;
      clearAttemptTimeout();
      if (typeof onSuccess === 'function') onSuccess(source);
    };
    image.onerror = function() {
      if (currentAttempt !== attemptId) return;
      loadNext();
    };
    timeoutId = window.setTimeout(function() {
      if (currentAttempt !== attemptId) return;
      loadNext();
    }, MUSIC_COVER_TIMEOUT_MS);
    image.src = source;
  }
  loadNext();
}

function set_music_track_cover_image(image, song) {
  var candidates = music_cover_candidates(song);
  var sourceIndex = 0;
  var attemptId = 0;
  function loadNext() {
    if (sourceIndex >= candidates.length) {
      image.removeAttribute('src');
      return;
    }
    var source = candidates[sourceIndex++];
    var currentAttempt = ++attemptId;
    image.onload = function() {
      if (currentAttempt !== attemptId) return;
    };
    image.onerror = function() {
      if (currentAttempt === attemptId) loadNext();
    };
    image.src = source;
  }
  loadNext();
}

function install_music_source_fallback(player) {
  if (!player || !player.audio || player.__yusenMusicSourceFallback) return;
  player.__yusenMusicSourceFallback = true;
  player.__yusenMusicSourceRetryId = 0;
  player.__yusenMusicSourceTimeout = null;

  function clearSourceTimeout() {
    if (player.__yusenMusicSourceTimeout) {
      window.clearTimeout(player.__yusenMusicSourceTimeout);
      player.__yusenMusicSourceTimeout = null;
    }
  }

  function activeSong() {
    return player.list && player.list.audios && player.list.audios[player.list.index];
  }

  function retryURL(url, retryCount) {
    if (!retryCount) return url;
    try {
      var parsed = new URL(url);
      parsed.searchParams.set('__music_retry', String(retryCount));
      parsed.searchParams.set('__music_retry_at', String(Date.now()));
      return parsed.toString();
    } catch (error) {
      return url;
    }
  }

  function resetCurrentSource() {
    clearSourceTimeout();
    var song = activeSong();
    var candidates = music_source_candidates(song);
    if (!song || !candidates.length) return;
    song.__musicSourceIndex = 0;
    song.__musicSourceRetries = 0;
    song.url = candidates[0];
    song.__musicSourceHost = music_hf_url_host(candidates[0]);
  }

  function retryOrSwitchSource(reason) {
    var song = activeSong();
    var candidates = music_source_candidates(song);
    var sourceIndex = Number(song && song.__musicSourceIndex) || 0;
    if (!song || !candidates.length || sourceIndex >= candidates.length) return false;

    var retries = Number(song.__musicSourceRetries) || 0;
    // 已在进入音乐页时并发测速并动态排列镜像。发生错误时先立即跳到下一个
    // 已测速来源，不再对同一故障来源连续等待两次；全部来源都试过后才重试。
    if (sourceIndex + 1 < candidates.length) {
      sourceIndex += 1;
      song.__musicSourceIndex = sourceIndex;
      song.__musicSourceRetries = 0;
      player.notice(reason === 'timeout' ? '音乐源响应较慢，正在切换最快备用源…' : '音乐源不可用，正在切换备用源…', 2200);
    } else if (retries < MUSIC_SOURCE_RETRIES_PER_MIRROR) {
      sourceIndex = 0;
      song.__musicSourceIndex = sourceIndex;
      song.__musicSourceRetries = retries + 1;
      player.notice('正在重新测试音乐源…', 2200);
    } else {
      return false;
    }

    clearSourceTimeout();
    var retryId = ++player.__yusenMusicSourceRetryId;
    var resumeAt = Number(player.audio.currentTime) || 0;
    var wasPlaying = !player.audio.paused;
    var sourceURL = retryURL(candidates[sourceIndex], Number(song.__musicSourceRetries) || 0);
    song.url = sourceURL;
    song.__musicSourceHost = music_hf_url_host(sourceURL);
    // 音频已切到新的镜像时，封面也必须切到同一主机，不能继续等待另一套
    // 独立的封面回退策略。
    set_player_cover(player, song);

    function resumeFromFallback() {
      if (player.__yusenMusicSourceRetryId !== retryId) return;
      if (resumeAt > 0 && Number.isFinite(player.audio.duration)) {
        try { player.audio.currentTime = Math.min(resumeAt, Math.max(0, player.audio.duration - 0.1)); } catch (error) {}
      }
      if (wasPlaying) player.play();
    }
    player.audio.addEventListener('loadedmetadata', resumeFromFallback, {once: true});
    player.audio.src = sourceURL;
    player.audio.load();
    if (wasPlaying) player.play();
    return true;
  }

  function scheduleSourceTimeout() {
    clearSourceTimeout();
    var song = activeSong();
    if (!song || !music_source_candidates(song).length || player.audio.readyState >= 1 || player.audio.paused) return;
    var retryId = player.__yusenMusicSourceRetryId;
    player.__yusenMusicSourceTimeout = window.setTimeout(function() {
      player.__yusenMusicSourceTimeout = null;
      if (retryId !== player.__yusenMusicSourceRetryId || player.audio.readyState >= 1 || player.audio.paused) return;
      retryOrSwitchSource('timeout');
    }, MUSIC_SOURCE_TIMEOUT_MS);
  }

  player.on('listswitch', resetCurrentSource);
  resetCurrentSource();

  // 使用捕获阶段拦截 audio 的原生错误事件。每个镜像最多重新请求两次，随后
  // 才切换到下一个镜像；全部来源失败时再交给 APlayer 的默认处理逻辑。
  player.audio.addEventListener('error', function(event) {
    if (!retryOrSwitchSource('error')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  player.audio.addEventListener('loadstart', scheduleSourceTimeout);
  player.audio.addEventListener('waiting', scheduleSourceTimeout);
  player.audio.addEventListener('stalled', scheduleSourceTimeout);
  player.audio.addEventListener('loadedmetadata', clearSourceTimeout);
  player.audio.addEventListener('canplay', clearSourceTimeout);
  player.audio.addEventListener('playing', clearSourceTimeout);
  player.audio.addEventListener('pause', function() {
    if (player.audio.paused) clearSourceTimeout();
  });
}

function ensure_mv_player_runtime() {
  if (typeof window.videojs === 'function' && window.videojsQualityselector) return Promise.resolve();
  if (mv_player_runtime_promise) return mv_player_runtime_promise;
  function loadRuntimeScript(src) {
    return new Promise(function(resolve, reject) {
      var existing = document.querySelector('script[data-mv-runtime="' + src + '"]');
      if (existing) {
        existing.addEventListener('load', resolve, {once: true});
        existing.addEventListener('error', reject, {once: true});
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.mvRuntime = src;
      script.onload = resolve;
      script.onerror = function() { reject(new Error('无法加载 MV 播放器组件。')); };
      document.head.appendChild(script);
    });
  }
  // Video.js 与画质菜单只在真正打开 MV 时下载；解析请求会和这两个脚本并行进行。
  mv_player_runtime_promise = loadRuntimeScript('/custom/js/video.min.js').then(function() {
    return loadRuntimeScript('/custom/js/videojs-qualityselector.min.js');
  }).catch(function(error) {
    mv_player_runtime_promise = null;
    throw error;
  });
  return mv_player_runtime_promise;
}

function ensure_music_quality(nextQuality) {
  var normalizedQuality = Number(nextQuality) === 1 ? 1 : 0;
  if (music_all[normalizedQuality] && music_all[normalizedQuality].length) {
    return Promise.resolve(music_all[normalizedQuality]);
  }
  if (music_quality_promises[normalizedQuality]) return music_quality_promises[normalizedQuality];
  var dataName = normalizedQuality === 1 ? 'music_sq' : 'music_hq';
  music_quality_promises[normalizedQuality] = load_static_data(dataName).then(function(records) {
    var library = records.sort(objectSort('mid'));
    var hfSample = library.find(function(song) {
      return song && music_hf_source_path(song.url);
    });
    if (hfSample) prime_music_hf_mirrors(hfSample.url);
    var hfCoverSample = library.find(function(song) {
      return song && music_hf_cover_path(song.cover || song.pic);
    });
    if (hfCoverSample) prime_music_hf_cover_mirrors(hfCoverSample.cover || hfCoverSample.pic);
    apply_music_tag_overrides(library);
    apply_music_source_urls(library);
    if (normalizedQuality === 0) music_all_hq = library;
    else music_all_sq = library;
    music_all[normalizedQuality] = library;
    return library;
  }).catch(function(error) {
    delete music_quality_promises[normalizedQuality];
    throw error;
  });
  return music_quality_promises[normalizedQuality];
}

/* Kept as no-op compatibility shims for the older player code. */
function fetch_music_hq() {}
function fetch_music_sq() {}
function get_mv_list() {}

function get_music_list(k,is_switch)
{
  if (!music_list_all[k]) {
    var activeLibrary = music_all[quality] || [];
    music_list_all[k] = activeLibrary.filter(function(song) {
      return song.list && song.list.indexOf(k) !== -1;
    }).map(function(song) { return song.mid; });
  }
  if (is_switch && music_list_all[k]) switch_list();
}

/* The data is now build-time static; no LeanCloud client is required. */
function legacy_database_functions_removed() {

  }
/* Legacy LeanCloud implementation retained below for reference only. */
/*
  var query = new AV.Query('mv_out');
  query.greaterThanOrEqualTo('mv_id', skip_num);
  query.ascending('author');
  query.limit(1000);
  query.find().then((results) => {
  // console.log(results);
  if(results.length > 0)
  {
      for(var i = 0; i < results.length;i++ )
      {
        mv_list.push(results[i]._serverData)
      }
      if(results.length == 1000)
      {
        get_mv_list(skip_num + 1000);
        return;
      }
      mv_ok = true;
      if(sq_list_init_ok && hq_list_init_ok && default_list_init_ok && mv_ok)
      {
        init_aplayer();
      }
    }  
  }).catch(function (err) {
    get_mv_list(skip_num);
    //console.log(err)
  });
}

  function fetch_music_hq(skip_num)
  {
    const music_hq_sql = new AV.Query('music_hq');
    music_hq_sql.limit(1000);
    music_hq_sql.ascending('mid');
    music_hq_sql.greaterThanOrEqualTo('mid', skip_num);
    music_hq_sql.find().then((fetch_hq) => {
      for(var i = 0;i<fetch_hq.length;i++)
      {
        music_all_hq.push(fetch_hq[i]._serverData);
        music_all_hq_sql.push(fetch_hq[i])
        //console.log(fetch_hq[i]._serverData);
      }
      if(fetch_hq.length == 1000)
      {
        fetch_music_hq(skip_num + 1000);
      }
      else
      {
        hq_list_init_ok = true;
        if(sq_list_init_ok && hq_list_init_ok && default_list_init_ok && mv_ok)
        {
          init_aplayer();
        }
      }
    });
  }
  
  function fetch_music_sq(skip_num)
  {
    const music_sq_sql = new AV.Query('music_sq');
    music_sq_sql.limit(1000);
    music_sq_sql.ascending('mid');
    music_sq_sql.greaterThanOrEqualTo('mid', skip_num);
    music_sq_sql.find().then((fetch_sq) => {
      for(var i = 0;i<fetch_sq.length;i++)
      {
        music_all_sq.push(fetch_sq[i]._serverData);
        music_all_sq_sql.push(fetch_sq[i])
        //console.log(fetch_sq[i]._serverData);
      }
      if(fetch_sq.length == 1000)
      {
        fetch_music_sq(skip_num + 1000);
      }
      else{
        sq_list_init_ok = true;
        if(sq_list_init_ok && hq_list_init_ok && default_list_init_ok && mv_ok)
        {
          init_aplayer();
        }
        
      }
    });

}

function get_music_list(k,is_switch)
{
  if(k<=list_count && music_list_all[k] == null)
  {
    
    var query = new AV.SearchQuery("music_sq");
    query.queryString("list:" + k);
    query.ascending('mid');
    query.limit(1000);
    do_search();
    function do_search()
    {
      query.find().then((results) => {
        //console.log(results);
        music_list_all[k] = new Array();
        for(var i = 0; i < results.length;i++ )
        {
          music_list_all[k].push(results[i]._serverData.mid)
        }
        if(query.hits() == 1000)
        {
           do_search();
        }
        else if(is_switch)
        {
          // music_list_all[k].sort(function (a,b) {
          //   return a-b
          // })
          switch_list();
        }
        else{
          default_list_init_ok = true;
          if(sq_list_init_ok && hq_list_init_ok && default_list_init_ok && mv_ok)
          {
            //music_list_all[k].sort(objectSort("mid"));
            init_aplayer();
          }
        }
      }).catch(function (err) {
        get_music_list(k,is_switch);
      });
    }
  }
  else if(k<=list_count && is_switch)
  {
    switch_list();
  }
}

*/
function normalize_music_id(value) {
  var musicId = Number(value);
  return Number.isInteger(musicId) && musicId >= 0 ? musicId : null;
}

function get_music_record(musicId) {
  musicId = normalize_music_id(musicId);
  if (musicId === null) return null;
  var library = music_all[quality] || [];
  var directMatch = library[musicId];
  if (directMatch && Number(directMatch.mid) === musicId) return directMatch;
  for (var i = 0; i < library.length; i++) {
    if (library[i] && Number(library[i].mid) === musicId) return library[i];
  }
  return null;
}

function apply_music_tag_overrides(library) {
  if (!Array.isArray(library)) return library;
  library.forEach(function(song) {
    if (!song) return;
    var override = music_tag_overrides[Number(song.mid)];
    if (Array.isArray(override)) song.list = override.slice();
  });
  return library;
}

function refresh_music_admin_session() {
  if (music_admin_state.loading) return music_admin_state.promise || Promise.resolve(music_admin_state);
  music_admin_state.loading = true;
  music_admin_state.promise = fetch('/api/console/auth', {
    credentials: 'same-origin',
    headers: {accept: 'application/json'},
  }).then(function(response) {
    return response.json().catch(function() { return {}; }).then(function(payload) {
      music_admin_state.authenticated = Boolean(response.ok && payload && payload.success && payload.data && payload.data.authenticated);
      music_admin_state.checked = true;
      return music_admin_state;
    });
  }).catch(function() {
    music_admin_state.authenticated = false;
    music_admin_state.checked = true;
    return music_admin_state;
  }).then(function(state) {
    music_admin_state.loading = false;
    var listDiv = document.getElementById('aplayer_list_active');
    if (listDiv && Array.isArray(active_list) && music_all[quality]) init_custom_list();
    return state;
  });
  return music_admin_state.promise;
}

function safe_music_download_url(song) {
  if (!song || !song.url) return '';
  // 下载直接交给资料源；音乐播放不会经过本站的 Netlify Function。
  var downloadCandidates = music_source_urls(song.source_url || song.url, true);
  if (downloadCandidates && downloadCandidates.length) return downloadCandidates[0];
  try {
    var source = new URL(String(song.url), window.location.href);
    if (source.protocol !== 'https:' && source.protocol !== 'http:') return '';
    // Hugging Face 的 resolve 地址支持 download 参数，会以附件方式返回，避免
    // 浏览器将 MP3 直接导航到新页面。其他旧资源地址保持原样。
    if (source.hostname === 'hf-mirror.com' && source.pathname.indexOf('/resolve/') !== -1) {
      source.searchParams.set('download', 'true');
    }
    return source.href;
  } catch (error) {
    return '';
  }
}

function music_download_name(song) {
  var name = [song && song.author, song && song.title].filter(Boolean).join(' - ') || 'music';
  return name.replace(/[\\/:*?"<>|]+/g, '_') + '.mp3';
}

function create_music_action_icon(path) {
  var icon = _createSvg('svg', {
    version: '1.1',
    xmlns: 'http://www.w3.org/2000/svg',
    width: '16',
    height: '16',
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
  });
  icon.appendChild(_createSvg('path', {fill: 'currentColor', d: path}));
  return icon;
}

function create_music_download_action(song) {
  var download = document.createElement('a');
  download.setAttribute('class', 'music-track-action music-track-download');
  download.setAttribute('aria-label', '下载 ' + (song.title || '音乐'));
  download.setAttribute('title', '下载音乐');
  download.setAttribute('rel', 'noopener noreferrer');
  download.setAttribute('target', '_blank');
  var url = safe_music_download_url(song);
  if (url) {
    download.href = url;
    download.download = music_download_name(song);
  } else {
    download.setAttribute('aria-disabled', 'true');
    download.setAttribute('tabindex', '-1');
  }
  download.appendChild(create_music_action_icon('M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17V3Zm-6 16h14v2H5v-2Z'));
  var label = document.createElement('span');
  label.setAttribute('class', 'music-track-action__label');
  label.innerText = '下载';
  download.appendChild(label);
  download.addEventListener('click', function(event) {
    event.stopPropagation();
    if (!url) event.preventDefault();
  });
  return download;
}

function set_music_tag_editor_busy(busy, message) {
  if (!music_tag_editor_state) return;
  music_tag_editor_state.saving = Boolean(busy);
  music_tag_editor_state.save.disabled = Boolean(busy);
  music_tag_editor_state.cancel.disabled = Boolean(busy);
  Array.prototype.forEach.call(music_tag_editor_state.chips.querySelectorAll('button'), function(chip) {
    chip.disabled = Boolean(busy);
  });
  music_tag_editor_state.status.innerText = message || '';
  music_tag_editor_state.status.classList.toggle('is-error', Boolean(message && !busy));
}

function ensure_music_tag_editor() {
  if (music_tag_editor_state) return music_tag_editor_state;
  var dialog = document.createElement('dialog');
  dialog.setAttribute('class', 'music-tag-editor');
  dialog.setAttribute('aria-labelledby', 'music-tag-editor-title');

  var form = document.createElement('form');
  form.setAttribute('method', 'dialog');
  var header = document.createElement('div');
  header.setAttribute('class', 'music-tag-editor__header');
  var copy = document.createElement('div');
  var eyebrow = document.createElement('span');
  eyebrow.setAttribute('class', 'music-tag-editor__eyebrow');
  eyebrow.innerText = 'OWNER EDIT';
  var title = document.createElement('strong');
  title.setAttribute('id', 'music-tag-editor-title');
  copy.appendChild(eyebrow);
  copy.appendChild(title);
  var cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.setAttribute('class', 'music-tag-editor__close');
  cancel.setAttribute('aria-label', '关闭标签编辑');
  cancel.innerText = '×';
  cancel.addEventListener('click', function() { dialog.close(); });
  header.appendChild(copy);
  header.appendChild(cancel);
  form.appendChild(header);

  var help = document.createElement('p');
  help.setAttribute('class', 'music-tag-editor__help');
  help.innerText = '选择曲目应显示的歌单标签，保存后会同时更新 HQ 与 SQ 数据。';
  form.appendChild(help);
  var chips = document.createElement('div');
  chips.setAttribute('class', 'music-tag-editor__chips');
  form.appendChild(chips);
  var footer = document.createElement('div');
  footer.setAttribute('class', 'music-tag-editor__footer');
  var status = document.createElement('span');
  status.setAttribute('class', 'music-tag-editor__status');
  var save = document.createElement('button');
  save.type = 'button';
  save.setAttribute('class', 'music-tag-editor__save');
  save.innerText = '保存标签';
  footer.appendChild(status);
  footer.appendChild(save);
  form.appendChild(footer);
  dialog.appendChild(form);
  dialog.addEventListener('click', function(event) {
    if (event.target === dialog && !music_tag_editor_state.saving) dialog.close();
  });
  document.body.appendChild(dialog);

  music_tag_editor_state = {
    dialog: dialog,
    title: title,
    chips: chips,
    status: status,
    save: save,
    cancel: cancel,
    musicId: null,
    selected: new Set(),
    saving: false,
  };
  save.addEventListener('click', function() { save_music_tag_editor(); });
  return music_tag_editor_state;
}

function open_music_tag_editor(musicId) {
  if (!music_admin_state.authenticated) return;
  var song = get_music_record(musicId);
  if (!song) return;
  var editor = ensure_music_tag_editor();
  editor.musicId = Number(musicId);
  editor.selected = new Set((song.list || []).filter(function(tagId) { return Number(tagId) !== 1; }).map(Number));
  editor.title.innerText = [song.author, song.title].filter(Boolean).join(' - ') || '编辑曲目标签';
  editor.chips.innerHTML = '';
  music_tags.forEach(function(tag) {
    var tagId = Number(tag.tag_id);
    var chip = document.createElement('button');
    chip.type = 'button';
    chip.setAttribute('class', 'music-tag-editor__chip');
    chip.dataset.tagId = String(tagId);
    chip.setAttribute('aria-pressed', editor.selected.has(tagId) ? 'true' : 'false');
    chip.innerText = tag.tag_name;
    chip.addEventListener('click', function() {
      if (editor.saving) return;
      if (editor.selected.has(tagId)) editor.selected.delete(tagId);
      else editor.selected.add(tagId);
      chip.setAttribute('aria-pressed', editor.selected.has(tagId) ? 'true' : 'false');
    });
    editor.chips.appendChild(chip);
  });
  set_music_tag_editor_busy(false, '');
  if (typeof editor.dialog.showModal === 'function') editor.dialog.showModal();
  else editor.dialog.setAttribute('open', '');
}

function apply_saved_music_tags(musicId, tagIds) {
  musicId = Number(musicId);
  music_tag_overrides[musicId] = tagIds.slice();
  [0, 1].forEach(function(qualityIndex) {
    var library = music_all[qualityIndex];
    if (!Array.isArray(library)) return;
    library.forEach(function(song) {
      if (song && Number(song.mid) === musicId) song.list = tagIds.slice();
    });
  });
  music_tags.forEach(function(tag) { music_list_all[Number(tag.tag_id)] = null; });
  if (current_list !== 0) get_music_list(current_list, true);
  else init_custom_list();
}

function save_music_tag_editor() {
  var editor = music_tag_editor_state;
  if (!editor || editor.saving || editor.musicId === null) return;
  set_music_tag_editor_busy(true, '正在保存…');
  var tagIds = music_tags.filter(function(tag) { return editor.selected.has(Number(tag.tag_id)); })
    .map(function(tag) { return Number(tag.tag_id); });
  fetch('/api/console/music-tags', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {'content-type': 'application/json; charset=utf-8', accept: 'application/json'},
    body: JSON.stringify({mid: editor.musicId, tagIds: tagIds}),
  }).then(function(response) {
    return response.json().catch(function() { return {}; }).then(function(payload) {
      if (!response.ok || !payload || !payload.success) {
        throw new Error(payload && payload.message || '保存标签失败。');
      }
      return payload.data;
    });
  }).then(function(result) {
    apply_saved_music_tags(editor.musicId, result.tagIds || [1].concat(tagIds));
    editor.dialog.close();
  }).catch(function(error) {
    set_music_tag_editor_busy(false, error && error.message || '保存标签失败。');
  });
}

function create_music_tag_action(song, musicId) {
  var edit = document.createElement('button');
  edit.type = 'button';
  edit.setAttribute('class', 'music-track-action music-track-tag-editor');
  edit.setAttribute('aria-label', '编辑 ' + (song.title || '音乐') + ' 的标签');
  edit.setAttribute('title', '编辑歌单标签');
  edit.appendChild(create_music_action_icon('M20 13.5V19a1 1 0 0 1-1 1h-5.5l-7-7V7.5l7-7H19a1 1 0 0 1 1 1v5.5l-7 6.5 7 6.5v-6.5ZM8 8v4.17L13.83 18H18.5v-4.17L12.67 8H8Z'));
  var label = document.createElement('span');
  label.setAttribute('class', 'music-track-action__label');
  label.innerText = '标签';
  edit.appendChild(label);
  edit.addEventListener('click', function(event) {
    event.preventDefault();
    event.stopPropagation();
    open_music_tag_editor(musicId);
  });
  return edit;
}

function clone_music_record(song) {
  return JSON.parse(JSON.stringify(song));
}

function get_playlist_players() {
  return [window.ap1, window.ap0].filter(function(player, index, players) {
    return player && player.list && players.indexOf(player) === index;
  });
}

function find_selected_music_index(musicId) {
  musicId = normalize_music_id(musicId);
  if (musicId === null) return -1;
  for (var i = 0; i < ap_list_ptr[1].length; i++) {
    if (Number(ap_list_ptr[1][i]) === musicId) return i;
  }
  return -1;
}

function find_player_music_index(player, musicId, song) {
  if (!player || !player.list || !Array.isArray(player.list.audios)) return -1;
  for (var i = 0; i < player.list.audios.length; i++) {
    var playerSong = player.list.audios[i];
    if (!playerSong) continue;
    if (normalize_music_id(playerSong.mid) === musicId) return i;
    if (song && song.url && playerSong.url === song.url) return i;
  }
  return -1;
}

function sync_playlist_selection_ui() {
  music_list_all[0] = ap_list_ptr[1];
  var selected = {};
  ap_list_ptr[1].forEach(function(musicId) {
    selected[Number(musicId)] = true;
  });
  Array.prototype.forEach.call(document.querySelectorAll('.music-list-checkbox'), function(checkbox) {
    var musicId = normalize_music_id(checkbox.music !== undefined ? checkbox.music : checkbox.dataset.musicId);
    var isSelected = musicId !== null && selected[musicId] === true;
    checkbox.checked = isSelected;
    var row = checkbox.closest('.music-list');
    if (row) {
      row.classList.toggle('is-selected', isSelected);
      row.setAttribute('aria-selected', String(isSelected));
    }
  });
}

function add_music_to_playlist(musicId, deferUiSync) {
  musicId = normalize_music_id(musicId);
  var song = get_music_record(musicId);
  if (musicId === null || !song) return false;

  var wasSelected = find_selected_music_index(musicId) !== -1;
  if (!wasSelected) {
    ap_list_ptr[0].push(song);
    ap_list_ptr[1].push(musicId);
    music_list_all[0] = ap_list_ptr[1];
  }

  get_playlist_players().forEach(function(player) {
    if (find_player_music_index(player, musicId, song) !== -1) return;
    try {
      player.list.add(clone_music_record(song));
    } catch (err) {
      console.error('Unable to add music to APlayer', musicId, err);
    }
  });

  if (!deferUiSync) sync_playlist_selection_ui();
  return !wasSelected;
}

function remove_music_from_playlist(musicId, deferUiSync) {
  musicId = normalize_music_id(musicId);
  if (musicId === null) return false;
  var song = get_music_record(musicId);
  var removed = false;
  var selectedIndex = find_selected_music_index(musicId);
  while (selectedIndex !== -1) {
    ap_list_ptr[0].splice(selectedIndex, 1);
    ap_list_ptr[1].splice(selectedIndex, 1);
    removed = true;
    selectedIndex = find_selected_music_index(musicId);
  }
  music_list_all[0] = ap_list_ptr[1];

  get_playlist_players().forEach(function(player) {
    var remainingAttempts = player.list.audios && player.list.audios.length || 0;
    var playerIndex = find_player_music_index(player, musicId, song);
    while (playerIndex !== -1 && remainingAttempts-- > 0) {
      try {
        player.list.remove(playerIndex);
      } catch (err) {
        console.error('Unable to remove music from APlayer', musicId, err);
        break;
      }
      playerIndex = find_player_music_index(player, musicId, song);
    }
  });

  if (!deferUiSync) sync_playlist_selection_ui();
  return removed;
}

function clear_music_playlist() {
  ap_list_ptr[0].splice(0, ap_list_ptr[0].length);
  ap_list_ptr[1].splice(0, ap_list_ptr[1].length);
  music_list_all[0] = ap_list_ptr[1];
  get_playlist_players().forEach(function(player) {
    try {
      player.list.clear();
    } catch (err) {
      console.error('Unable to clear APlayer playlist', err);
    }
  });
  sync_playlist_selection_ui();
}

function init_aplayer() {
  //console.log("init player")
  // 当前音质已经由 ensure_music_quality 填充；避免为了未选择的音质再复制一整份
  // 2277 首曲目资料。
  music_all[quality] = JSON.parse(JSON.stringify(music_all[quality] || []));
  ap_list_ptr[0] = new Array();
  ap_list_ptr[1] = new Array();
  for (var i = 0; i < music_all[quality].length; i++) {
    music_list_all[1].push(i);
  }
  get_music_list(current_list, false);
  active_list = music_list_all[current_list].slice();
  for (var i = 0; i < active_list.length; i++) {
    ap_list_ptr[0][i] = music_all[quality][active_list[i]];
    ap_list_ptr[1][i] = active_list[i];
    
  }
  // console.log(music_all[0]);
  // console.log(music_all[1]);
  var link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  link.setAttribute("href", "/custom/css/aplayer.css");
  document.body.appendChild(link);

  var new_div = document.createElement("div");
  new_div.setAttribute("id", "aplayer");
  document.body.appendChild(new_div);

  var new_div = document.createElement("script");
  new_div.setAttribute("id", "aplayer");
  document.body.appendChild(new_div);
  try {
    aplayer1();
    if (window.ap1 && window.ap1.lrc) window.ap1.lrc.hide();
  } catch (err) {
    console.error('Unable to initialize the fixed APlayer instance', err);
  }
  music_list_all[0] = ap_list_ptr[1];

  $(document).on("click", "#last_song_div", function (e) {
    var list_obj = $(e.target);
    const { left, top } = list_obj[0].getBoundingClientRect();
    list_obj[0].style = `--x1:${e.clientX - left}px;--y1:${
      e.clientY - top
    }px;margin-top:0px;`;
    //console.log(list_obj[0]);
    //console.log("paly ctr");
    window.ap0.skipBack();
  });
  $(document).on("click", "#pause_or_paly_div", function (e) {
    var list_obj = $(e.target);
    const { left, top } = list_obj[0].getBoundingClientRect();
    list_obj[0].style = `--x2:${e.clientX - left}px;--y2:${
      e.clientY - top
    }px;margin-top:0px;`;
    if(is_playing)
    {
      window.ap0.pause();
    }
    else
    {
      window.ap0.play();
    }
  });
  $(document).on("click", "#next_song_div", function (e) {
    var list_obj = $(e.target);
    const { left, top } = list_obj[0].getBoundingClientRect();
    list_obj[0].style = `--x3:${e.clientX - left}px;--y3:${
      e.clientY - top
    }px;margin-top:0px;`;
    window.ap0.skipForward();
  });
  

  $(document).off("click.musicPlaylist", ".music-list");
  $(document).on("click.musicPlaylist", ".music-list", function (e) {
    var row = e.currentTarget;
    var rect = row.getBoundingClientRect();
    row.style.setProperty('--x', (e.clientX - rect.left) + 'px');
    row.style.setProperty('--y', (e.clientY - rect.top) + 'px');
    var musicId = normalize_music_id(row.music !== undefined ? row.music : row.dataset.musicId);
    if (musicId === null) return;
    if (find_selected_music_index(musicId) === -1) {
      add_music_to_playlist(musicId);
    } else {
      remove_music_from_playlist(musicId);
    }
  });

  setInterval(function () {
    init_page();
  }, 500);

  $(document).on("click", "#ap_list_select_all", function (e) {
    var all_checkbox = document.getElementsByClassName("music-list-checkbox");
    for (var i = 0; i < all_checkbox.length; i++) {
      add_music_to_playlist(all_checkbox[i].music, true);
    }
    sync_playlist_selection_ui();
  });
  $(document).on("click", "#ap_list_remove", function (e) {
    clear_music_playlist();
    is_playing = false;
    var pause_or_paly_div = document.getElementById("pause_or_paly_div");
    if (pause_or_paly_div) {
      var svg = pause_or_paly_div.querySelector("svg");
      if (svg) svg.remove();
      var childSVG = _createSvg("svg", {
        version: "1.1",
        xmlns: "http://www.w3.org/2000/svg",
        width: "20",
        height: "20",
        viewBox: "0 0 1024 1024",
      });
      var path1 = _createSvg("path", {
        fill: "currentColor",
        d: "M870.2 466.333333l-618.666667-373.28a53.333333 53.333333 0 0 0-80.866666 45.666667v746.56a53.206667 53.206667 0 0 0 80.886666 45.666667l618.666667-373.28a53.333333 53.333333 0 0 0 0-91.333334z",
      });
      childSVG.setAttribute("style", "margin-left: 3px;");
      childSVG.appendChild(path1);
      pause_or_paly_div.appendChild(childSVG);
    }
  });

  $(document).on("click", "#ap_list_random_select", function (e) {
    var candidates = active_list.filter(function(musicId, index, songs) {
      return songs.indexOf(musicId) === index && find_selected_music_index(musicId) === -1;
    });
    for (var i = candidates.length - 1; i > 0; i--) {
      var randomIndex = Math.floor(Math.random() * (i + 1));
      var temporary = candidates[i];
      candidates[i] = candidates[randomIndex];
      candidates[randomIndex] = temporary;
    }
    var song_num = Math.min(Math.floor(Math.random() * 5 + 3), candidates.length);
    for (var j = 0; j < song_num; j++) {
      add_music_to_playlist(candidates[j], true);
    }
    sync_playlist_selection_ui();
  });
  // $(document).on("click", "#ap_load.sytle-ap-button", function (e) {
  //   aplayer0();
  // });

  $(document).on("click", "#ap_qua1", function () { switch_music_quality(1); });
  $(document).on("click", "#ap_qua2", function () { switch_music_quality(0); });
  
}

function init_page() {
  if (window.location.pathname.replace(/\/$/, '') === '/music') {
    if (!page_loaded) {
      console.log("load page");
      //document.getElementById("ap_list2").className += " --activated";
      page_loaded = true;
      aplayer0();
      load_music_lists();
      SQ_button = document.getElementById("ap_qua1");
      HQ_button = document.getElementById("ap_qua2");
      sync_music_quality_buttons(false);
      active_list = music_list_all[current_list].slice();
      init_custom_list_mv();
      add_search_box();
      
    }
  } else {
    if(mv_player!= null)
    {
      mv_player.dispose();
      mv_player = null;
    }
    page_loaded = false;
  }
}

function init_custom_list_mv_legacy() {

  var list_div = document.getElementById("mv_player_div");
  var list_div_sel = document.querySelector("#mv_player_div");
  var ol = list_div.querySelector(".mv-list-ol");
  try {
    list_div_sel.removeChild(ol);
  } catch (err) {
    //console.error(err)
  }
  var ol_parent = document.createElement("div");
  ol_parent.setAttribute("id","mv-list-ol-parent");
  var ol = document.createElement("ol");
  ol.setAttribute("class", "mv-list-ol");
  //console.log("active_list.length",active_list.length);

  for (var i = 0; i < mv_list.length; i++) {
   // console.log(mv_list[i].author + " - " + mv_list[i].title);
    var text_div = document.createElement("div");
    text_div.setAttribute("class","mv_list_text_div");
    var main_div = document.createElement("div");
    main_div.setAttribute("class","mv_list_div");
    main_div.post_url = mv_list[i].post_url;
    main_div.video_url_1080 = mv_list[i].video_url_1080;
    main_div.video_url_720 = mv_list[i].video_url_720;
    main_div.video_url_360 = mv_list[i].video_url_360;
    main_div.author = mv_list[i].author;
    main_div.title = mv_list[i].title;
    main_div.list = mv_list[i].list;
    var mv_post = document.createElement("img");
    mv_post.src = mv_list[i].post_small_url;
    mv_post.setAttribute("class","mv_list_post");
    main_div.appendChild(mv_post);

    var li = document.createElement("li");
    li.setAttribute("style", "margin-top:0px;");
    li.setAttribute("class", "mv-list");
    li.setAttribute("id", "mv-id" + mv_list[i].mv_id);
    //li.setAttribute("name","music" + i);

    var list_author = document.createElement("p");
    list_author.setAttribute("id", "mv-list-author");
    list_author.setAttribute("class", "mv-list-text");
    list_author.setAttribute("name", "mv" + mv_list[i].mv_id);
    list_author.innerHTML = "【" + mv_list[i].author + "】";
    li.appendChild(list_author);


    var list_title = document.createElement("p");
    list_title.setAttribute("id", "mv-list-title");
    list_title.setAttribute("class", "mv-list-text");
    list_title.setAttribute("name", "mv" + mv_list[i].mv_id);
    list_title.innerText = mv_list[i].title;
    li.appendChild(list_title);
    text_div.appendChild(li);
    main_div.appendChild(text_div);
    ol.appendChild(main_div);
    
    
    main_div.addEventListener("click", function (e) {
      var list_obj = $(e.target);
      const { left, top } = list_obj[0].getBoundingClientRect();
      list_obj[0].style = `--x:${e.clientX - left}px;--y:${
        e.clientY - top
      }px;`;
      var player_div = document.getElementById("mv_player_div");
      if(mv_player == null)
      {
        var video_player_div = document.createElement("div");
        video_player_div.setAttribute("class", "mv_player_subdiv");
        if(!is_mobile) {
          video_player_div.style.left = "5%";
          video_player_div.style.width = "90%";
        }
        var mv_name_div = document.createElement("div");
        mv_name_div.setAttribute("class", "mv_name_div");
        var mv_name_sub_div = document.createElement("div");
        mv_name_sub_div.setAttribute("class", "mv_name_sub_div");
        if(!is_mobile)
        {
          video_player_div.style.left = "5%";
          video_player_div.style.width = "90%";
          video_player_div.style.position = "relative";
          var author_name = document.createElement("p");
          author_name.setAttribute("class", "author_name");
          author_name.innerText = "【" + list_obj[0].author + "】" 
          var title_name = document.createElement("p");
          title_name.setAttribute("class", "title_name");
          title_name.innerText = list_obj[0].title;
          mv_name_sub_div.appendChild(author_name);
          mv_name_sub_div.appendChild(title_name);
          var list_name = document.createElement("p");
          list_name.setAttribute("class", "list_name");
        }
        else
        {
          var author_name_mobile = document.createElement("p");
          author_name_mobile.setAttribute("class", "author_name mobile");
          author_name_mobile.innerText = "【" + list_obj[0].author + "】" 
          var title_name_mobile = document.createElement("p");
          title_name_mobile.setAttribute("class", "title_name mobile");
          title_name_mobile.innerText = list_obj[0].title;
          mv_name_sub_div.appendChild(author_name_mobile);
          mv_name_sub_div.appendChild(title_name_mobile);
          var list_name = document.createElement("p");
          list_name.setAttribute("class", "list_name mobile");

        }

        for(var i =0; i< list_obj[0].list.length;i++)
        {
          if(list_obj[0].list[i] != 1 && list_obj[0].list[i] != 2)
          {
            list_name.innerText = document.getElementById("ap_list" + list_obj[0].list[i]).innerText;
          }
        }
        mv_name_sub_div.appendChild(list_name);
        mv_name_div.appendChild(mv_name_sub_div);
        player_div.appendChild(mv_name_div);
        var video_player = document.createElement("video");
        video_player.setAttribute("id", "mv_player");
        video_player.setAttribute("class", "video-js vjs-theme-sea");
        video_player.setAttribute("poster", list_obj[0].post_url);
        video_player.setAttribute("data-setup",'{"controls": true, "autoplay": false, "preload": "false"}');
        var video_source = document.createElement("source");
        video_source.setAttribute("src",list_obj[0].video_url_1080);
        video_source.setAttribute("type","video/mp4");
        video_player.appendChild(video_source);
        video_player_div.appendChild(video_player);
        player_div.appendChild(video_player_div);
        
        mv_player = videojs('mv_player',{
          language: 'zh-CN'
        });
        mv_player.volume(0.6);
        mv_player.qualityselector({
          sources: [
            { format: '1080p', src: list_obj[0].video_url_1080 , type: 'video/mp4'},
            { format: '720p', src: list_obj[0].video_url_720, type: 'video/mp4'},
            { format: '360p', src: list_obj[0].video_url_360, type: 'video/mp4'},
          ],
          formats: [
            { code: '1080p', name: '1080p' },
            { code: '720p', name: '720p' },
            { code: '360p', name: '360p' },
          ],
   
          onFormatSelected: function(format) {
            // console.log(format);
          }
        });
        if(is_mobile)
        {
          var control_bar_sel = video_player_div.querySelector(".vjs-control-bar");
          var progress_bar = video_player_div.querySelector(".vjs-progress-control.vjs-control");
            control_bar_sel.removeChild(progress_bar);
            progress_bar.setAttribute("class","vjs-progress-control vjs-control vjs-control-bar vjs-mobile");
            control_bar_sel.before(progress_bar);
            mv_player.controlBar.volumePanel.volumeControl.el_.style.width = "10em";
            mv_player.controlBar.volumePanel.volumeControl.el_.style.opacity = "1";
            mv_player.controlBar.volumePanel.el_.style.width = "8em";
            mv_player.controlBar.setAttribute("class","vjs-control-bar vjs-mobile")
            mv_player.controlBar.durationDisplay.setAttribute("style","padding-left: 2px;padding-right: 0.2em;");
            mv_player.controlBar.currentTimeDisplay.setAttribute("style","padding-left: 0.2em;padding-right: 2px;");
            mv_player.controlBar.remainingTimeDisplay.hide()
        }
        // console.log(mv_player)
        // console.log(video_player)
      }
      else
      {
        if(!is_mobile)
        {
          document.getElementsByClassName("author_name")[0].innerText = "【" + list_obj[0].author + "】";
          document.getElementsByClassName("title_name")[0].innerText = list_obj[0].title;

        }
        else
        {
          document.getElementsByClassName("author_name mobile")[0].innerText = "【" + list_obj[0].author + "】";
          document.getElementsByClassName("title_name mobile")[0].innerText = list_obj[0].title;
        }
        for(var i =0; i< list_obj[0].list.length;i++)
        {
          if(list_obj[0].list[i] != 1 && list_obj[0].list[i] != 2)
          {
            document.getElementsByClassName("list_name")[0].innerText = document.getElementById("ap_list" + list_obj[0].list[i]).innerText;
          }
        }
        mv_player.poster(list_obj[0].post_url);
        var src_tmp = new Object();
        src_tmp.type = "video/webm";
        src_tmp.src = list_obj[0].video_url_1080;
        mv_player.src(src_tmp);
        mv_player.qualityselector({
          sources: [
            { format: '1080p', src: list_obj[0].video_url_1080 , type: 'video/mp4'},
            { format: '720p', src: list_obj[0].video_url_720, type: 'video/mp4'},
            { format: '360p', src: list_obj[0].video_url_360, type: 'video/mp4'},
          ],
          formats: [
            { code: '1080p', name: '1080p' },
            { code: '720p', name: '720p' },
            { code: '360p', name: '360p' },
          ]
        });
      }
    });

  }

  ol_parent.appendChild(ol);
  ol_parent.setAttribute("style","opacity: 1;")
  if(is_mobile)
  {
    ol_parent.style.width = "86%";
    ol_parent.style.left = "7%";
  }
  ol.setAttribute("style","opacity: 1;  margin-top:0;")
  list_div.appendChild(ol_parent);
  mv_ol = ol;
  $(document).on("touchstart", ".mv-list-ol", function(e) {
    ol.setAttribute("style","margin-top:0;opacity: 1;max-height: 500px;")
    //console.log(ol)
  });
  $(document).on("touchstart", function(e) {
    if(!$(e.target).isChildAndSelfOf(".mv-list-ol"))
      ol.setAttribute("style","margin-top:0;opacity: 1;max-height: 200px;")
    //console.log($(e.target).isChildAndSelfOf(".mv-list-ol"))
  });


}

function init_custom_list_mv_bilibili_v1() {
  var list_div = document.getElementById("mv_player_div");
  if (!list_div) return;

  if (mv_player && typeof mv_player.dispose === "function") {
    mv_player.dispose();
    mv_player = null;
  }

  var oldList = list_div.querySelector("#mv-list-ol-parent");
  if (oldList) oldList.remove();

  var ol_parent = document.createElement("div");
  ol_parent.setAttribute("id", "mv-list-ol-parent");
  var ol = document.createElement("ol");
  ol.setAttribute("class", "mv-list-ol");

  function renderMv(item) {
    if (mv_player && typeof mv_player.dispose === "function") {
      mv_player.dispose();
      mv_player = null;
    }

    var mv_name_div = document.createElement("div");
    mv_name_div.setAttribute("class", "mv_name_div");
    var mv_name_sub_div = document.createElement("div");
    mv_name_sub_div.setAttribute("class", "mv_name_sub_div");

    var author_name = document.createElement("p");
    author_name.setAttribute("class", "author_name");
    author_name.innerText = "【" + item.author + "】";
    var title_name = document.createElement("p");
    title_name.setAttribute("class", "title_name");
    title_name.innerText = item.title;
    var list_name = document.createElement("p");
    list_name.setAttribute("class", "list_name");

    (item.list || []).forEach(function(listId) {
      if (listId !== 1 && listId !== 2) {
        var listButton = document.getElementById("ap_list" + listId);
        if (listButton) list_name.innerText = listButton.innerText;
      }
    });

    mv_name_sub_div.appendChild(author_name);
    mv_name_sub_div.appendChild(title_name);
    mv_name_sub_div.appendChild(list_name);

    var sourceRow = document.createElement("div");
    sourceRow.setAttribute("class", "mv-source-row");
    var sourceLabel = document.createElement("span");
    sourceLabel.setAttribute("class", "mv-source-label");
    sourceLabel.innerText = "视频来源：" + (item.bilibili_owner || "哔哩哔哩");
    sourceRow.appendChild(sourceLabel);

    var bilibiliPage = item.bilibili_page || 1;
    mv_name_sub_div.appendChild(sourceRow);
    mv_name_div.appendChild(mv_name_sub_div);

    var video_player_div = document.createElement("div");
    video_player_div.setAttribute("class", "mv_player_subdiv");

    var frame = null;
    if (item.bilibili_bvid) {
      frame = document.createElement("iframe");
      frame.setAttribute("class", "bilibili-mv-frame");
      frame.setAttribute("title", item.title + " - 哔哩哔哩播放器");
      frame.setAttribute("loading", "lazy");
      frame.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
      frame.setAttribute("allowfullscreen", "true");
      frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
      frame.src = "https://player.bilibili.com/player.html?isOutside=true&bvid=" +
        encodeURIComponent(item.bilibili_bvid) + "&page=" + bilibiliPage + "&p=" +
        bilibiliPage + "&danmaku=0&autoplay=0";
      video_player_div.appendChild(frame);
    } else {
      frame = document.createElement("video");
      frame.setAttribute("class", "native-mv-player");
      frame.setAttribute("controls", "true");
      frame.setAttribute("preload", "metadata");
      frame.poster = item.post_url || "";
      frame.src = item.video_url_1080 || item.video_url_720 || item.video_url_360 || "";
      video_player_div.appendChild(frame);
    }

    list_div.appendChild(mv_name_div);
    list_div.appendChild(video_player_div);

    var disposed = false;
    mv_player = {
      dispose: function() {
        if (disposed) return;
        disposed = true;
        if (frame) {
          if (frame.tagName === "IFRAME") frame.src = "about:blank";
          if (frame.tagName === "VIDEO") frame.pause();
        }
        if (mv_name_div.parentNode) mv_name_div.parentNode.removeChild(mv_name_div);
        if (video_player_div.parentNode) video_player_div.parentNode.removeChild(video_player_div);
      }
    };

    window.requestAnimationFrame(function() {
      mv_name_div.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  mv_list.forEach(function(item) {
    var main_div = document.createElement("div");
    main_div.setAttribute("class", "mv_list_div");
    main_div.setAttribute("role", "button");
    main_div.setAttribute("tabindex", "0");
    main_div.setAttribute("aria-label", "播放 " + item.title);

    var mv_post = document.createElement("img");
    mv_post.src = item.post_small_url || item.bilibili_cover || "";
    mv_post.alt = item.title;
    mv_post.loading = "lazy";
    mv_post.setAttribute("class", "mv_list_post");
    var fallbackCover = item.bilibili_cover ||
      "https://i2.hdslb.com/bfs/archive/6672a015c20ae80d3f074c9f7955d7d69fbd34eb.jpg";
    mv_post.addEventListener("error", function() {
      mv_post.onerror = null;
      mv_post.src = fallbackCover;
    });
    main_div.appendChild(mv_post);

    var playBadge = document.createElement("span");
    playBadge.setAttribute("class", "mv-card-play");
    playBadge.setAttribute("aria-hidden", "true");
    playBadge.innerText = "▶";
    main_div.appendChild(playBadge);

    var text_div = document.createElement("div");
    text_div.setAttribute("class", "mv_list_text_div");
    var li = document.createElement("li");
    li.setAttribute("class", "mv-list");
    li.setAttribute("id", "mv-id" + item.mv_id);

    var list_author = document.createElement("p");
    list_author.setAttribute("id", "mv-list-author");
    list_author.setAttribute("class", "mv-list-text");
    list_author.innerText = "【" + item.author + "】";
    li.appendChild(list_author);

    var list_title = document.createElement("p");
    list_title.setAttribute("id", "mv-list-title");
    list_title.setAttribute("class", "mv-list-text");
    list_title.innerText = item.title;
    li.appendChild(list_title);

    var sourceBadge = document.createElement("span");
    sourceBadge.setAttribute("class", "mv-card-source");
    sourceBadge.innerText = "哔哩哔哩";
    li.appendChild(sourceBadge);
    text_div.appendChild(li);
    main_div.appendChild(text_div);

    main_div.addEventListener("click", function(e) {
      var rect = main_div.getBoundingClientRect();
      main_div.style.setProperty("--x", (e.clientX - rect.left) + "px");
      main_div.style.setProperty("--y", (e.clientY - rect.top) + "px");
      renderMv(item);
    });
    main_div.addEventListener("keydown", function(e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        renderMv(item);
      }
    });
    ol.appendChild(main_div);
  });

  ol_parent.appendChild(ol);
  list_div.appendChild(ol_parent);
  mv_ol = ol;
}

function init_custom_list_mv() {
  var listDiv = document.getElementById("mv_player_div");
  var playerStage = document.getElementById("mv-player-stage");
  var filterBar = document.getElementById("mv-group-filters");
  var searchInput = document.getElementById("mv-search-input");
  var gridButton = document.getElementById("mv-view-grid");
  var listButton = document.getElementById("mv-view-list");
  var resultCount = document.getElementById("mv-result-count");
  var currentFilterLabel = document.getElementById("mv-current-filter");
  var sourceBiliLink = document.getElementById("mv-source-bili-link");
  if (!listDiv) return;

  if (mv_player && typeof mv_player.dispose === "function") {
    mv_player.dispose();
    mv_player = null;
  }
  listDiv.innerHTML = "";
  if (playerStage) {
    playerStage.innerHTML = "";
    playerStage.hidden = true;
  }

  var groupOrder = [
    "Leo/need",
    "MORE MORE JUMP！",
    "Vivid BAD SQUAD",
    "ワンダーランズ×ショウタイム",
    "25時、ナイトコードで。",
    "VIRTUAL SINGER",
    "スペシャル"
  ];
  var mv_settings = read_player_settings().mv;
  var activeGroup = ["全部"].concat(groupOrder).indexOf(mv_settings.group) !== -1 ? mv_settings.group : "全部";
  var searchQuery = "";
  var viewMode = mv_settings.view === "list" || (!mv_settings.view && localStorage.getItem("mv-view-mode") === "list") ? "list" : "grid";
  var activeMvCleanup = function() {};
  var activePlayingCard = null;
  var mvResolveCache = new Map();
  var MV_RESOLVE_CACHE_TTL_MS = 2 * 60 * 1000;
  var mvFastSourceCache = new Map();
  var MV_FAST_SOURCE_CACHE_TTL_MS = 90 * 1000;
  // 网络错误不应被缓存或写入用户设置。这里的次数只存在于当前打开的 MV 中，
  // 用于应对国内 CDN 与函数网络的短暂抖动。
  var MV_API_REQUEST_RETRIES = 3;
  var MV_PLAYBACK_RECOVERY_RETRIES = 3;
  // 同一 DASH 清单的重复 setSource 不会改变浏览器已缓存的失败状态；一次短暂
  // 重试足够，随后应尽快切到 MP4、备用 CDN 或重新向 B 站取签名。
  var MV_SAME_LINK_RETRIES = 1;
  var MV_SOURCE_LOAD_TIMEOUT_MS = 9000;

  var listParent = document.createElement("div");
  listParent.setAttribute("id", "mv-list-ol-parent");
  var ol = document.createElement("ol");
  listParent.appendChild(ol);
  listDiv.appendChild(listParent);
  mv_ol = ol;

  function formatDuration(seconds) {
    var value = Number(seconds) || 0;
    var minutes = Math.floor(value / 60);
    var rest = Math.floor(value % 60);
    return minutes + ":" + (rest < 10 ? "0" : "") + rest;
  }

  function createTag(text, extraClass) {
    var tag = document.createElement("span");
    tag.setAttribute("class", "mv-tag" + (extraClass ? " " + extraClass : ""));
    tag.innerText = text;
    return tag;
  }

  function addTags(container, item) {
    container.appendChild(createTag(item.project_tag || "プロセカ", "mv-tag--project"));
    container.appendChild(createTag(item.group || "スペシャル", "mv-tag--group"));
    container.appendChild(createTag(item.mv_type || "MV", "mv-tag--type"));
  }

  function clearPlayingCard() {
    if (activePlayingCard) {
      activePlayingCard.classList.remove("is-playing");
      activePlayingCard.removeAttribute("aria-current");
      activePlayingCard = null;
    }
    listDiv.querySelectorAll(".mv_list_div.is-playing").forEach(function(card) {
      card.classList.remove("is-playing");
      card.removeAttribute("aria-current");
    });
  }

  // 可在构建时切换为同源或跨域的托管解析服务；无论哪一种，页面都只拿到
  // 短时 DASH 清单，B 站会话不会下发到浏览器。
  function getBiliParserMode() {
    var configured = String(window.MY_WEBSITE_BILI_PARSER_MODE || "").toLowerCase();
    return configured === "cloudflare" || configured === "netlify" || configured === "remote" ? "remote" : "local";
  }

  function getBiliParserApi() {
    var configured = window.MY_WEBSITE_BILI_PARSER_API || window.MY_WEBSITE_BILI_LOCAL_API || "http://127.0.0.1:19180/api";
    return String(configured).replace(/\/+$/, "");
  }

  function parserRetryDelay(attempt) {
    // 350ms、700ms、1400ms，并加入极小抖动，避免瞬时网络错误时的同步重试。
    return 350 * Math.pow(2, Math.max(0, attempt)) + Math.floor(Math.random() * 120);
  }

  function biliParserRequest(path, options) {
    var requestURL = getBiliParserApi() + path;
    function requestWithRetry(attempt) {
      return fetch(requestURL, options || {}).then(function(response) {
        // 只重试可能恢复的网关、限流和网络错误；业务性 4xx 不会浪费请求。
        if (attempt < MV_API_REQUEST_RETRIES && (response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500)) {
          return new Promise(function(resolve) { window.setTimeout(resolve, parserRetryDelay(attempt)); }).then(function() {
            return requestWithRetry(attempt + 1);
          });
        }
        return response;
      }, function(error) {
        if (attempt < MV_API_REQUEST_RETRIES) {
          return new Promise(function(resolve) { window.setTimeout(resolve, parserRetryDelay(attempt)); }).then(function() {
            return requestWithRetry(attempt + 1);
          });
        }
        throw error;
      });
    }
    return requestWithRetry(0).catch(function() {
      var remote = getBiliParserMode() === "remote";
      var connectionError = new Error(remote
        ? "无法连接云端解析服务，请确认部署和 /api 路由。"
        : "无法连接本地解析服务。请先启动 local-bili-parser，并确认页面来源已加入 allow-origin。");
      connectionError.code = remote ? "REMOTE_SERVICE_UNAVAILABLE" : "LOCAL_SERVICE_UNAVAILABLE";
      throw connectionError;
    }).then(function(response) {
      return response.json().catch(function() {
        var invalidResponse = new Error("解析服务返回了无效响应。");
        invalidResponse.code = "INVALID_RESPONSE";
        throw invalidResponse;
      });
    }).then(function(result) {
      if (!result || !result.success) {
        var requestError = new Error((result && result.message) || "本地解析失败。");
        requestError.code = result && result.code;
        throw requestError;
      }
      return result.data;
    });
  }

  function resolveMv(item, forceRefresh) {
    var key = String(item.bilibili_bvid || "") + ":" + String(Math.max(1, parseInt(item.bilibili_page, 10) || 1));
    var cached = mvResolveCache.get(key);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) return cached.promise;
    var entry = { expiresAt: Date.now() + MV_RESOLVE_CACHE_TTL_MS, promise: null };
    var requestPath = "/resolve?bvid=" + encodeURIComponent(item.bilibili_bvid) + "&p=" + encodeURIComponent(Math.max(1, parseInt(item.bilibili_page, 10) || 1));
    // DASH 的签名链接会随网络线路和登录会话变化。解析结果仅由页面内 Map 复用，
    // 不让浏览器 HTTP 缓存保存它；恢复播放时额外加随机参数，确保不会拿回刚才
    // 已失效的 90 秒旧响应（这正是刷新页面后偶尔才恢复的根因）。
    if (forceRefresh) requestPath += "&refresh=" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    entry.promise = biliParserRequest(requestPath, { cache: "no-store" }).catch(function(error) {
      // 失败永远不进入解析缓存，也不影响下次打开或手动重试。
      if (mvResolveCache.get(key) === entry) mvResolveCache.delete(key);
      throw error;
    });
    mvResolveCache.set(key, entry);
    return entry.promise;
  }

  function prefetchMv(item) {
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!item.bilibili_bvid || connection?.saveData || /(^|-)2g$/.test(String(connection?.effectiveType || ""))) return;
    resolveMv(item).catch(function() {});
  }

  function mvPreloadMode() {
    // DASH 的首帧需要先取视频、音频两个轨道。非省流网络在打开 MV 时就开始缓冲，
    // 不必等用户再按一次播放；弱网/省流时仍只读取媒体元数据。
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.saveData || /(^|-)2g$/.test(String(connection?.effectiveType || "")) ? "metadata" : "auto";
  }

  function renderMv(item, card) {
    if (!item.bilibili_bvid) return;
    var playerRuntime = ensure_mv_player_runtime();
    if (sourceBiliLink) {
      sourceBiliLink.href = "https://www.bilibili.com/video/" + encodeURIComponent(item.bilibili_bvid) + (Number(item.bilibili_page || 1) > 1 ? "?p=" + encodeURIComponent(item.bilibili_page) : "");
      sourceBiliLink.setAttribute("aria-label", "跳转到 B 站播放 " + item.title);
    }
    activeMvCleanup();
    activeMvCleanup = function() {};
    if (mv_player && typeof mv_player.dispose === "function") {
      mv_player.dispose();
      mv_player = null;
    }
    clearPlayingCard();
    if (card) {
      card.classList.add("is-playing");
      card.setAttribute("aria-current", "true");
      activePlayingCard = card;
    }
    if (!playerStage) return;
    var usingRemoteParser = getBiliParserMode() === "remote";

    playerStage.hidden = false;
    playerStage.innerHTML = "";
    var shell = document.createElement("div");
    shell.setAttribute("class", "mv-player-shell");
    var savedTheme = mv_settings.theme === "midnight" ? "midnight" : "sea";
    try {
      savedTheme = localStorage.getItem("mv-player-theme") === "midnight" ? "midnight" : "sea";
    } catch (error) {}

    var frameWrap = document.createElement("div");
    frameWrap.setAttribute("class", "mv_player_subdiv mv_player_subdiv--direct");
    var playerPlaceholder = document.createElement("div");
    playerPlaceholder.setAttribute("class", "mv-local-player-placeholder");
    var placeholderTitle = document.createElement("strong");
    var placeholderText = document.createElement("span");
    playerPlaceholder.appendChild(placeholderTitle);
    playerPlaceholder.appendChild(placeholderText);
    frameWrap.appendChild(playerPlaceholder);
    shell.appendChild(frameWrap);

    var info = document.createElement("div");
    info.setAttribute("class", "mv-player-info");
    var copy = document.createElement("div");
    copy.setAttribute("class", "mv-player-copy");
    var title = document.createElement("h3");
    title.innerText = item.title;
    var playerTags = document.createElement("div");
    playerTags.setAttribute("class", "mv-card-tags");
    addTags(playerTags, item);
    copy.appendChild(title);
    if (item.author) {
      var author = document.createElement("p");
      author.innerText = item.author;
      copy.appendChild(author);
    }
    copy.appendChild(playerTags);
    info.appendChild(copy);
    shell.appendChild(info);
    playerStage.appendChild(shell);

    var currentVideo = null;
    var selectedQuality = null;
    var qualityOptions = [];
    var qualitySources = [];
    var activeResolved = null;
    var activePlaybackSource = null;
    var destroyed = false;
    var playbackRecoveryAttempts = 0;
    var recoveryPending = false;
    var mediaRetryPending = false;
    var resumePlaybackAfterRecovery = false;
    var mediaLoadTimer = 0;
    activeMvCleanup = function() {
      destroyed = true;
    };

    function setPlaceholder(titleText, statusText) {
      placeholderTitle.innerText = titleText;
      placeholderText.innerText = statusText;
      var existingRetryButton = playerPlaceholder.querySelector(".mv-player-retry-button");
      if (existingRetryButton) existingRetryButton.remove();
      if (!frameWrap.contains(playerPlaceholder)) {
        frameWrap.innerHTML = "";
        frameWrap.appendChild(playerPlaceholder);
      }
    }

    function disposeCurrentVideoPlayer() {
      if (mediaLoadTimer) window.clearTimeout(mediaLoadTimer);
      mediaLoadTimer = 0;
      if (mv_player && typeof mv_player.dispose === "function" && !(typeof mv_player.isDisposed === "function" && mv_player.isDisposed())) {
        mv_player.dispose();
      }
      mv_player = null;
      currentVideo = null;
      activePlaybackSource = null;
      mediaRetryPending = false;
    }

    function showManualRetry() {
      if (destroyed) return;
      setPlaceholder("正在等待重新连接", "当前网络线路有波动；本次失败不会被记录，可立即重新尝试。");
      var retryButton = document.createElement("button");
      retryButton.type = "button";
      retryButton.className = "mv-player-retry-button";
      retryButton.innerText = "重新尝试";
      retryButton.addEventListener("click", function() {
        playbackRecoveryAttempts = 0;
        resumePlaybackAfterRecovery = false;
        mvFastSourceCache.clear();
        resolveCurrentMv(true);
      });
      playerPlaceholder.appendChild(retryButton);
    }

    function scheduleFreshResolve() {
      if (destroyed || recoveryPending) return;
      if (playbackRecoveryAttempts >= MV_PLAYBACK_RECOVERY_RETRIES) {
        showManualRetry();
        return;
      }
      resumePlaybackAfterRecovery = resumePlaybackAfterRecovery || Boolean(mv_player && typeof mv_player.paused === "function" && !mv_player.paused());
      disposeCurrentVideoPlayer();
      // 快速 MP4 与 DASH 一样是短签名链接。若刚才该线路已经出错，不能在新
      // 一轮解析时从内存继续取回同一条旧链接。
      mvFastSourceCache.clear();
      playbackRecoveryAttempts += 1;
      recoveryPending = true;
      setPlaceholder("正在重新连接", "线路连接不稳定，正在重新获取可用视频源（" + playbackRecoveryAttempts + "/" + MV_PLAYBACK_RECOVERY_RETRIES + "）…");
      window.setTimeout(function() {
        recoveryPending = false;
        if (!destroyed) resolveCurrentMv(true);
      }, parserRetryDelay(playbackRecoveryAttempts));
    }

    function applyPlayerTheme(themeName) {
      var isMidnight = themeName === "midnight";
      if (currentVideo) {
        currentVideo.classList.toggle("vjs-theme-sea", !isMidnight);
        currentVideo.classList.toggle("vjs-theme-midnight", isMidnight);
      }
      if (mv_player && typeof mv_player.toggleClass === "function") {
        mv_player.toggleClass("vjs-theme-sea", !isMidnight);
        mv_player.toggleClass("vjs-theme-midnight", isMidnight);
      }
    }

    function showResolveError(error) {
      if (destroyed) return;
      if (usingRemoteParser && error && error.code === "SERVICE_NOT_LOGGED_IN") {
        setPlaceholder("正在等待解析服务", "解析服务正在等待登录，请稍后再试。");
        return;
      }
      // 不保存解析失败，也不把一次网络抖动当作此 MV 永久不可用；重新解析会获取
      // 新的短时签名与新的 CDN 候选节点。
      scheduleFreshResolve();
    }

    function dashSourceFor(option) {
      return qualitySources.find(function(entry) {
        return entry.format === option.code;
      });
    }

    function xmlText(value) {
      return String(value || "").replace(/[<>&"']/g, function(character) {
        return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[character];
      });
    }

    function fallbackManifest(option, candidateIndex) {
      var fallbackVideo = Array.isArray(option?.candidates?.video) ? option.candidates.video : [];
      var fallbackAudio = Array.isArray(option?.candidates?.audio) ? option.candidates.audio : [];
      if (!option?.manifest || (!fallbackVideo.length && !fallbackAudio.length)) return "";
      var index = Number.isInteger(candidateIndex) && candidateIndex >= 0 ? candidateIndex : 0;
      var mediaIndex = 0;
      return option.manifest.replace(/<BaseURL>[\s\S]*?<\/BaseURL>/g, function(baseURL) {
        var candidates = mediaIndex++ === 0 ? fallbackVideo : fallbackAudio;
        // 视频和音频的备用节点数量不一定相同；缺少同序号时复用它们各自的
        // 第一个备用节点，仍可组成一个完整的 DASH 清单。
        var fallback = candidates[index] || candidates[0];
        return fallback ? "<BaseURL>" + xmlText(fallback) + "</BaseURL>" : baseURL;
      });
    }

    function dashRetrySources(option) {
      if (!option?.manifest) return [];
      var videoCandidates = Array.isArray(option?.candidates?.video) ? option.candidates.video : [];
      var audioCandidates = Array.isArray(option?.candidates?.audio) ? option.candidates.audio : [];
      var count = Math.max(videoCandidates.length, audioCandidates.length);
      var manifests = [];
      for (var index = 0; index < count; index += 1) {
        var manifest = fallbackManifest(option, index);
        if (manifest && manifests.indexOf(manifest) === -1) manifests.push(manifest);
      }
      return manifests.map(dashObjectURL).filter(Boolean);
    }

    function dashObjectURL(manifest) {
      if (!manifest) return "";
      // VHS 会以主清单 URL 解析 DASH 轨道。blob: URL 不能作为相对路径的基准，
      // 会在部分 Video.js 版本中抛出 “Invalid URL”；data: 清单会回退至页面 URL，
      // 同时保留 MPD 内的绝对 B 站 BaseURL。
      return "data:application/dash+xml;charset=utf-8," + encodeURIComponent(manifest);
    }

    function usesBiliAnalysisFastPath(option) {
      return Boolean(option && option.fastProgressive);
    }

    function mediaRetryDelay(attempt) {
      return 280 * Math.pow(2, Math.max(0, attempt || 0)) + Math.floor(Math.random() * 100);
    }

    function waitForMediaRetry(attempt) {
      return new Promise(function(resolve) {
        window.setTimeout(resolve, mediaRetryDelay(attempt));
      });
    }

    function retryableMediaResponse(response) {
      return Boolean(response && (response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500));
    }

    function preflightMediaLink(url, retriesLeft) {
      return fetch(url, {
        headers: { Range: "bytes=0-0" },
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "no-store"
      }).then(function(response) {
        if (response.ok) return url;
        if (retriesLeft > 0 && retryableMediaResponse(response)) {
          return waitForMediaRetry(retriesLeft).then(function() { return preflightMediaLink(url, retriesLeft - 1); });
        }
        var error = new Error("快速直链不可用（HTTP " + response.status + "）。");
        error.mediaStatus = response.status;
        throw error;
      }).catch(function(error) {
        // 非 HTTP 的网络中断也值得重新请求一次；403、404 则直接尝试备用节点。
        if (retriesLeft > 0 && !Number.isInteger(error && error.mediaStatus)) {
          return waitForMediaRetry(retriesLeft).then(function() { return preflightMediaLink(url, retriesLeft - 1); });
        }
        throw error;
      });
    }

    function firstPlayableMediaLink(urls) {
      var candidates = Array.from(new Set((urls || []).filter(Boolean)));
      function tryNext(index, lastError) {
        if (index >= candidates.length) return Promise.reject(lastError || new Error("快速直链不可用。"));
        return preflightMediaLink(candidates[index], 3).then(function(url) {
          return { url: url, remaining: candidates.slice(index + 1) };
        }).catch(function(error) {
          return tryNext(index + 1, error);
        });
      }
      return tryNext(0, null);
    }

    function fastSourceFor(option) {
      if (!usesBiliAnalysisFastPath(option) || !activeResolved?.cid) return Promise.reject(new Error("该画质没有可用的快速直链。"));
      var cacheKey = [activeResolved.bvid || item.bilibili_bvid, activeResolved.page || item.bilibili_page, activeResolved.cid, option.qn].join(":");
      var cached = mvFastSourceCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) return cached.promise;
      var entry = { expiresAt: Date.now() + MV_FAST_SOURCE_CACHE_TTL_MS, promise: null };
      entry.promise = biliParserRequest("/fast?bvid=" + encodeURIComponent(activeResolved.bvid || item.bilibili_bvid) + "&p=" + encodeURIComponent(activeResolved.page || item.bilibili_page) + "&cid=" + encodeURIComponent(activeResolved.cid) + "&qn=" + encodeURIComponent(option.qn), { cache: "no-store" }).then(function(data) {
        if (!data?.url) throw new Error("快速解析未返回 MP4 直链。");
        // B 站偶尔会返回已失效或只对解析机房可用的 durl。先以与播放器相同的
        // 跨域策略读取一个字节；临时网络故障重试一次，节点不可用则轮换备用 URL。
        return firstPlayableMediaLink([data.url].concat(data.backupUrls || [])).then(function(result) {
          return {
            format: option.code,
            src: result.url,
            type: data.type || "video/mp4",
            linkRetrySources: result.remaining,
            linkRetryIndex: -1,
            requestRetryCount: 0
          };
        });
      }).catch(function(error) {
        mvFastSourceCache.delete(cacheKey);
        throw error;
      });
      mvFastSourceCache.set(cacheKey, entry);
      return entry.promise;
    }

    function directDashSource(option, dashSource) {
      if (!dashSource) return null;
      // 直连 DASH 已由解析服务按国内可用节点排序。它能同时提供视频、音频和完整
      // 的来源画质；BiliAnalysis 的渐进式 MP4 仅在直连失败时再启用。
      return {
        format: dashSource.format,
        src: dashSource.src,
        type: dashSource.type,
        linkRetrySources: dashSource.linkRetrySources || [],
        linkRetryIndex: -1,
        requestRetryCount: 0,
        biliAnalysisOption: usesBiliAnalysisFastPath(option) ? option : null,
        triedBiliAnalysis: false
      };
    }

    function sameLinkRetry(source) {
      if (!source || (source.requestRetryCount || 0) >= MV_SAME_LINK_RETRIES) return null;
      var retryCount = (source.requestRetryCount || 0) + 1;
      var retrySource = Object.assign({}, source, { requestRetryCount: retryCount });
      // Video.js/VHS 会记住相同 data: 清单的失败结果；添加仅用于播放器实例的
      // fragment 使它重新建立 manifest loader，MPD 内容及 B 站签名均不变。
      if (retrySource.type === "application/dash+xml" && /^data:/i.test(String(retrySource.src || ""))) {
        retrySource.src += "#mv-retry=" + Date.now().toString(36) + "-" + retryCount;
      }
      return retrySource;
    }

    function nextLinkRetry(source) {
      if (!source || !Array.isArray(source.linkRetrySources)) return null;
      var nextIndex = (Number.isInteger(source.linkRetryIndex) ? source.linkRetryIndex : -1) + 1;
      var nextURL = source.linkRetrySources[nextIndex];
      if (!nextURL) return null;
      return Object.assign({}, source, {
        src: nextURL,
        linkRetryIndex: nextIndex,
        requestRetryCount: 0
      });
    }

    function setVideoJsSource(source) {
      if (!source || !mv_player) return;
      if (mediaLoadTimer) window.clearTimeout(mediaLoadTimer);
      mediaLoadTimer = 0;
      mediaRetryPending = false;
      activePlaybackSource = source;
      var resumeAt = mv_player.currentTime() || 0;
      var shouldPlay = !mv_player.paused();
      mv_player.one("loadedmetadata", function() {
        if (mediaLoadTimer) window.clearTimeout(mediaLoadTimer);
        mediaLoadTimer = 0;
        try {
          mv_player.currentTime(Math.min(resumeAt, mv_player.duration() || resumeAt));
        } catch (error) {}
        if (shouldPlay) mv_player.play().catch(function() {});
      });
      mv_player.src({ src: source.src, type: source.type });
      // 某些 UPOS 节点会永远保持 pending，既不触发 error 也不会取得 metadata。
      // 这种情况以前会令“重新尝试”停在同一播放器状态；统一按一次失败处理。
      mediaLoadTimer = window.setTimeout(function() {
        if (destroyed || !mv_player || mv_player.isDisposed() || activePlaybackSource !== source) return;
        if (typeof mv_player.readyState === "function" && mv_player.readyState() >= 1) return;
        recoverMediaSource(source);
      }, MV_SOURCE_LOAD_TIMEOUT_MS);
    }

    function scheduleMediaSourceRetry(failedSource, nextSource, activeSource) {
      if (!failedSource || !nextSource || destroyed || mediaRetryPending) return;
      mediaRetryPending = true;
      var retryNumber = Math.max(1, Number(nextSource.requestRetryCount) || 1);
      window.setTimeout(function() {
        if (destroyed || activePlaybackSource !== (activeSource || failedSource)) return;
        setVideoJsSource(nextSource);
      }, mediaRetryDelay(retryNumber - 1));
    }

    function retryNextDashSource(dashSource, activeSource) {
      var nextSource = nextLinkRetry(dashSource);
      if (nextSource) {
        scheduleMediaSourceRetry(dashSource, nextSource, activeSource);
        return;
      }
      scheduleFreshResolve();
    }

    function recoverMediaSource(failedSource) {
      if (!failedSource || destroyed || mediaRetryPending) return;
      if (mediaLoadTimer) window.clearTimeout(mediaLoadTimer);
      mediaLoadTimer = 0;

      var retriedSource = sameLinkRetry(failedSource);
      if (retriedSource) {
        scheduleMediaSourceRetry(failedSource, retriedSource);
        return;
      }

      // 低/中画质的 BiliAnalysis MP4 在部分国内网络下比 DASH 更容易取得首帧。
      // 它现在在一次 DASH 重试后立刻参与恢复，而不是等待所有 DASH 备用节点逐一
      // 超时；MP4 不可用时再继续原有 DASH 候选，画质与可靠性都不被牺牲。
      if (failedSource.biliAnalysisOption && !failedSource.triedBiliAnalysis) {
        failedSource.triedBiliAnalysis = true;
        mediaRetryPending = true;
        fastSourceFor(failedSource.biliAnalysisOption).then(function(source) {
          mediaRetryPending = false;
          if (destroyed || activePlaybackSource !== failedSource) return;
          source.dashFallbackSource = Object.assign({}, failedSource, { triedBiliAnalysis: true, requestRetryCount: 0 });
          setVideoJsSource(source);
        }).catch(function() {
          mediaRetryPending = false;
          if (destroyed || activePlaybackSource !== failedSource) return;
          retryNextDashSource(failedSource);
        });
        return;
      }

      // MP4 自身及其备用链接都失败时，回到尚未尝试的 DASH CDN，而非直接把本次
      // 解析判为失败。这样快速路径只是一条额外线路，不会遮蔽高画质 DASH。
      if (failedSource.dashFallbackSource) {
        retryNextDashSource(failedSource.dashFallbackSource, failedSource);
        return;
      }
      retryNextDashSource(failedSource);
    }

    function switchVideoJsQuality(nextQuality) {
      var fallbackSource = dashSourceFor(nextQuality);
      if (!fallbackSource || !mv_player) return;
      setVideoJsSource(directDashSource(nextQuality, fallbackSource));
    }

    function createVideoPlayer(initialSource) {
      if (destroyed || !initialSource) return;
      activePlaybackSource = initialSource;
      var preloadMode = mvPreloadMode();
      frameWrap.innerHTML = "";
      currentVideo = document.createElement("video");
      currentVideo.setAttribute("id", "mv_player");
      currentVideo.setAttribute("class", "video-js vjs-theme-sea bilibili-direct-mv-player");
      currentVideo.setAttribute("title", item.title + " - B 站直链播放器");
      currentVideo.setAttribute("controls", "true");
      currentVideo.setAttribute("playsinline", "true");
      currentVideo.setAttribute("preload", preloadMode);
      currentVideo.setAttribute("referrerpolicy", "no-referrer");
      currentVideo.poster = item.bilibili_cover || item.post_small_url || item.post_url || "";
      frameWrap.appendChild(currentVideo);

      if (typeof window.videojs !== "function") {
        setPlaceholder("播放器暂不可用", "请刷新页面后重试。");
        return;
      }
      mv_player = window.videojs("mv_player", {
        language: "zh-CN",
        fluid: true,
        aspectRatio: "16:9",
        controls: true,
        autoplay: false,
        preload: preloadMode,
        poster: currentVideo.poster
      });
      // qualityselector 会在首个元数据事件中建立菜单。此时若先让用户点击播放，
      // Video.js、VHS 和插件会并发重设同一个 source，可能永久停在 0:00。
      // 菜单就绪前统一拦截操作并给出明确状态，下一帧再开放播放器。
      mv_player.addClass("vjs-mv-preparing");
      var requestedPlaybackWhilePreparing = false;
      var queuedQualityCode = "";
      // 遮罩期间的点击不交给 Video.js（否则会与首个 source 初始化竞争），但记录
      // 用户的明确播放意图，菜单就绪后自动继续，不需要再点一次。
      mv_player.el().addEventListener("click", function(event) {
        if (!mv_player || mv_player.isDisposed() || !mv_player.hasClass("vjs-mv-preparing")) return;
        var qualityContainer = event.target.closest && event.target.closest(".vjs-quality-container");
        if (qualityContainer) {
          var qualityItem = event.target.closest(".vjs-quality-dropdown li[data-code]");
          // 可用画质在开始缓冲前就可以展开查看；若此时直接选档，记住选择，待
          // 首个元数据到达后再切源，避免 qualityselector 与 VHS 并发重设 source。
          if (qualityItem) {
            queuedQualityCode = qualityItem.dataset.code || "";
            var dropdown = qualityContainer.querySelector(".vjs-quality-dropdown");
            if (dropdown) dropdown.classList.remove("show");
            event.preventDefault();
            event.stopImmediatePropagation();
          }
          return;
        }
        requestedPlaybackWhilePreparing = true;
        event.preventDefault();
        event.stopImmediatePropagation();
      }, true);
      mv_player.volume(read_player_settings().mv.volume);
      mv_player.on("volumechange", function() {
        update_player_settings('mv', { volume: mv_player.volume() });
      });
      var qualitySelectorReady = false;
      function closeQualityDropdownOnOutsideClick(event) {
        if (!mv_player || mv_player.isDisposed()) return;
        var qualityContainer = mv_player.el().querySelector(".vjs-quality-container");
        if (!qualityContainer || qualityContainer.contains(event.target)) return;
        var dropdown = qualityContainer.querySelector(".vjs-quality-dropdown");
        if (dropdown) dropdown.classList.remove("show");
      }
      document.addEventListener("pointerdown", closeQualityDropdownOnOutsideClick, true);
      mv_player.one("dispose", function() {
        document.removeEventListener("pointerdown", closeQualityDropdownOnOutsideClick, true);
      });

      function syncQualitySelectorUI(option) {
        var qualityContainer = mv_player.el().querySelector(".vjs-quality-container");
        if (!qualityContainer) return;
        var label = qualityContainer.querySelector(".vjs-brand-quality-link");
        if (label) label.innerText = option.label;
        Array.prototype.forEach.call(qualityContainer.querySelectorAll(".vjs-quality-dropdown li[data-code]"), function(entry) {
          entry.classList.toggle("current", entry.dataset.code === option.code);
        });
      }

      function setupQualitySelector() {
        if (qualitySelectorReady || typeof mv_player?.qualityselector !== "function") return false;
        qualitySelectorReady = true;
        mv_player.qualityselector({
          text: selectedQuality.label,
          sources: qualitySources,
          formats: qualityOptions.map(function(option) {
            return { code: option.code, name: option.label };
          }),
          onFormatSelected: function(format) {
            var nextQuality = qualityOptions.find(function(option) {
              return option.code === format.code;
            });
            if (nextQuality) {
              selectedQuality = nextQuality;
              update_player_settings('mv', { qualityCode: nextQuality.code });
              // 旧 qualityselector 会先回写其 DASH source，下一轮将低画质替换为快速 MP4。
              window.setTimeout(function() {
                switchVideoJsQuality(nextQuality);
              }, 0);
            }
          }
        });
        window.requestAnimationFrame(function() {
          if (!destroyed && mv_player && !mv_player.isDisposed()) syncQualitySelectorUI(selectedQuality);
        });
        return true;
      }
      function unlockPreparedPlayer() {
        if (destroyed || !mv_player || mv_player.isDisposed()) return;
        mv_player.removeClass("vjs-mv-preparing");
        var queuedQuality = qualityOptions.find(function(option) {
          return option.code === queuedQualityCode;
        });
        if (queuedQuality) {
          selectedQuality = queuedQuality;
          update_player_settings('mv', { qualityCode: queuedQuality.code });
          syncQualitySelectorUI(queuedQuality);
          if (queuedQuality.code !== initialSource.format) switchVideoJsQuality(queuedQuality);
          if (requestedPlaybackWhilePreparing) {
            if (queuedQuality.code !== initialSource.format) {
              mv_player.one("loadedmetadata", function() { mv_player.play().catch(function() {}); });
            } else {
              mv_player.play().catch(function() {});
            }
          }
          return;
        }
        if (requestedPlaybackWhilePreparing) mv_player.play().catch(function() {});
      }
      // 画质清单已随 resolve 响应返回，不必等待 DASH 首段。先建立菜单，用户能
      // 立即看到可选档位；仍在首个元数据后才解锁播放和实际切源。
      setupQualitySelector();
      mv_player.one("loadedmetadata", unlockPreparedPlayer);
      applyPlayerTheme(savedTheme);
      if (resumePlaybackAfterRecovery) {
        mv_player.one("loadedmetadata", function() {
          resumePlaybackAfterRecovery = false;
          mv_player.play().catch(function() {});
        });
      }
      mv_player.on("error", function() {
        recoverMediaSource(activePlaybackSource);
      });
      // 先让 Video.js 建立技术层，再通过统一入口设置首个 source。直接把 DASH
      // source 传入构造器会与 qualityselector/VHS 的初始化竞争，首段请求可能被
      // 取消而停在 0:00。
      setVideoJsSource(initialSource);
    }

    function startVideo(resolved) {
      playerRuntime.then(function() {
        if (destroyed) return;
        activeResolved = resolved;
        qualityOptions = resolved.sources.map(function(source) {
          return { code: source.code, label: source.label, qn: source.qn, url: source.url, manifest: source.manifest, candidates: source.candidates || {}, type: source.type || "video/mp4", resolution: source.resolution || "", fastProgressive: Boolean(source.fastProgressive) };
        });
        if (!qualityOptions.length) {
          showResolveError(new Error("解析服务未返回可播放的媒体直链。"));
          return;
        }
        var preferredQuality = read_player_settings().mv.qualityCode;
        selectedQuality = qualityOptions.find(function(option) {
          return option.code === preferredQuality;
        }) || qualityOptions.find(function(option) {
          return Number(option.qn) === 64;
        }) || qualityOptions[0];
        qualitySources = qualityOptions.map(function(option) {
          var sourceUrl = dashObjectURL(option.manifest) || option.url;
          // 内联 MPD 必须以 DASH MIME 交给 VHS；后端保留的 video/mp4 是单条
          // 轨道的原始类型，若沿用它，Video.js 会把 data: MPD 误作 MP4 并直接报错。
          return {
            format: option.code,
            src: sourceUrl,
            type: option.manifest ? "application/dash+xml" : option.type,
            linkRetrySources: dashRetrySources(option)
          };
        });
        var dashSource = dashSourceFor(selectedQuality);
        if (!dashSource) {
          showResolveError(new Error("解析服务未返回所选画质。"));
          return;
        }
        createVideoPlayer(directDashSource(selectedQuality, dashSource));
      }).catch(showResolveError);
    }

    function resolveCurrentMv(forceRefresh) {
      if (destroyed) return;
      setPlaceholder("正在加载视频", forceRefresh ? "正在重新获取可用视频线路…" : "正在准备播放器…");
      resolveMv(item, Boolean(forceRefresh)).then(startVideo).catch(showResolveError);
    }

    resolveCurrentMv();
    window.requestAnimationFrame(function() {
      playerStage.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function createCard(item) {
    var card = document.createElement("li");
    card.setAttribute("class", "mv_list_div");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", "在当前页面播放 " + item.title);
    card.dataset.group = item.group || "スペシャル";
    card.dataset.mvId = String(item.mv_id);

    var media = document.createElement("div");
    media.setAttribute("class", "mv-card-media");
    var image = document.createElement("img");
    image.setAttribute("class", "mv_list_post");
    image.src = item.bilibili_cover || item.post_small_url || "";
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", function() {
      image.onerror = null;
      image.src = item.post_small_url || "/img/logo.webp";
    });
    media.appendChild(image);

    var duration = document.createElement("span");
    duration.setAttribute("class", "mv-card-duration");
    duration.innerText = formatDuration(item.duration);
    media.appendChild(duration);
    var play = document.createElement("span");
    play.setAttribute("class", "mv-card-play");
    play.setAttribute("aria-hidden", "true");
    var playIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    playIcon.setAttribute("viewBox", "0 0 24 24");
    playIcon.setAttribute("focusable", "false");
    var playPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    playPath.setAttribute("d", "M8.1 5.85A1.3 1.3 0 0 1 10.12 4.8l8.16 6.07a1.42 1.42 0 0 1 0 2.26l-8.16 6.07A1.3 1.3 0 0 1 8.1 18.15V5.85Z");
    playIcon.appendChild(playPath);
    play.appendChild(playIcon);
    media.appendChild(play);
    card.appendChild(media);

    var body = document.createElement("div");
    body.setAttribute("class", "mv_list_text_div");
    var title = document.createElement("h3");
    title.setAttribute("class", "mv-card-title");
    title.innerText = item.title;
    var tags = document.createElement("div");
    tags.setAttribute("class", "mv-card-tags");
    addTags(tags, item);
    body.appendChild(title);
    body.appendChild(tags);
    card.appendChild(body);

    card.addEventListener("click", function(event) {
      if (event.target.closest("a,button")) return;
      var rect = card.getBoundingClientRect();
      card.style.setProperty("--x", (event.clientX - rect.left) + "px");
      card.style.setProperty("--y", (event.clientY - rect.top) + "px");
      renderMv(item, card);
    });
    // 触控设备没有 hover；按下卡片即开始解析，让随后 click 的渲染直接复用请求。
    card.addEventListener("pointerdown", function(event) {
      if (!event.target.closest("a,button")) prefetchMv(item);
    }, { passive: true });
    card.addEventListener("keydown", function(event) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        renderMv(item, card);
      }
    });
    var prefetchTimer = null;
    card.addEventListener("pointerenter", function(event) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      // 悬停极短时间就开始解析；多数桌面点击会在按下前复用同一个 Promise，
      // 把画质清单的网络等待移到用户浏览卡片的间隙里。
      prefetchTimer = window.setTimeout(function() { prefetchMv(item); }, 80);
    });
    card.addEventListener("pointerleave", function() {
      if (prefetchTimer) window.clearTimeout(prefetchTimer);
      prefetchTimer = null;
    });
    card.addEventListener("focus", function() { prefetchMv(item); });
    return card;
  }

  function filteredItems() {
    return mv_list.filter(function(item) {
      var groupMatch = activeGroup === "全部" || item.group === activeGroup;
      if (!groupMatch) return false;
      if (!searchQuery) return true;
      var haystack = [item.title, item.author, item.group, item.project_tag, item.mv_type]
        .join(" ").toLocaleLowerCase();
      return haystack.indexOf(searchQuery) !== -1;
    });
  }

  var renderedMvCount = 0;
  var renderedMvItems = [];
  var mvSearchRenderFrame = 0;
  var mvVirtualMeasureFrame = 0;
  var mvVirtualScrollFrame = 0;
  var mvRenderVersion = 0;
  var mvCardNodeCache = new Map();
  var mvVirtual = { active: false, columns: 1, itemHeight: 0, rowGap: 0, startRow: -1, endRow: -1, containerWidth: 0 };

  function mvCardKey(item) {
    return [item.mv_id, item.bilibili_bvid, item.bilibili_page || 1].join(":");
  }

  function cachedMvCard(item) {
    var key = mvCardKey(item);
    var card = mvCardNodeCache.get(key);
    if (!card) {
      card = createCard(item);
      mvCardNodeCache.set(key, card);
    }
    return card;
  }

  function resetMvCardLayout(card) {
    card.style.removeProperty("height");
    card.style.removeProperty("width");
  }

  function mvColumnCount() {
    if (viewMode !== "grid") return 1;
    var tracks = String(window.getComputedStyle(ol).gridTemplateColumns || "").trim().split(/\s+/).filter(function(track) {
      return track && track !== "none";
    });
    return Math.max(1, tracks.length);
  }

  function mvRowGap() {
    var style = window.getComputedStyle(ol);
    return parseFloat(style.rowGap || style.gap) || 0;
  }

  function createVirtualSpacer(height, position) {
    var spacer = document.createElement("li");
    spacer.setAttribute("class", "mv-virtual-spacer mv-virtual-spacer--" + position);
    spacer.setAttribute("aria-hidden", "true");
    spacer.style.height = Math.max(0, Math.ceil(height)) + "px";
    return spacer;
  }

  function syncMvListHeight() {
    var firstCard = ol.querySelector(".mv_list_div");
    if (!firstCard || !renderedMvCount) {
      listParent.style.height = "auto";
      listParent.style.maxHeight = "none";
      return;
    }
    var columns = mvVirtual.active ? mvVirtual.columns : mvColumnCount();
    var rowGap = mvVirtual.active ? mvVirtual.rowGap : mvRowGap();
    var visibleRows = Math.min(2, Math.ceil(renderedMvCount / columns));
    var cardHeight = mvVirtual.active ? mvVirtual.itemHeight : firstCard.getBoundingClientRect().height;
    // 虚拟列表在滚动后首卡前面会有占位行；这时不再读取其实际 y 坐标，始终以
    // 已量得的单行高度固定两行视口，避免滚动过程中触发布局同步。
    var targetHeight = Math.ceil(cardHeight * visibleRows + rowGap * Math.max(0, visibleRows - 1) + 4);
    listParent.style.height = targetHeight + "px";
    listParent.style.maxHeight = targetHeight + "px";
  }

  var mvListHeightScheduled = false;
  function scheduleMvListHeight() {
    if (mvListHeightScheduled) return;
    mvListHeightScheduled = true;
    window.requestAnimationFrame(function() {
      syncMvListHeight();
      // 滚动条出现后可用宽度会略变，下一帧再校正一次以保证正好两排。
      window.requestAnimationFrame(function() {
        syncMvListHeight();
        mvListHeightScheduled = false;
      });
    });
  }

  function renderVirtualRange(force) {
    if (!mvVirtual.active || !renderedMvItems.length) return;
    var totalRows = Math.ceil(renderedMvItems.length / mvVirtual.columns);
    var rowPitch = mvVirtual.itemHeight + mvVirtual.rowGap;
    var viewportRows = Math.max(2, Math.ceil(listParent.clientHeight / Math.max(1, rowPitch)));
    var firstVisibleRow = Math.max(0, Math.floor(listParent.scrollTop / Math.max(1, rowPitch)));
    var startRow = Math.max(0, firstVisibleRow - 3);
    var endRow = Math.min(totalRows, firstVisibleRow + viewportRows + 3);
    if (!force && startRow === mvVirtual.startRow && endRow === mvVirtual.endRow) return;

    mvVirtual.startRow = startRow;
    mvVirtual.endRow = endRow;
    ol.classList.add("is-virtualized");
    ol.innerHTML = "";
    var fragment = document.createDocumentFragment();
    if (startRow > 0) fragment.appendChild(createVirtualSpacer(startRow * rowPitch - mvVirtual.rowGap, "before"));
    var startIndex = startRow * mvVirtual.columns;
    var endIndex = Math.min(renderedMvItems.length, endRow * mvVirtual.columns);
    for (var index = startIndex; index < endIndex; index += 1) {
      var card = cachedMvCard(renderedMvItems[index]);
      card.style.height = Math.ceil(mvVirtual.itemHeight) + "px";
      fragment.appendChild(card);
    }
    var remainingRows = totalRows - endRow;
    if (remainingRows > 0) fragment.appendChild(createVirtualSpacer(remainingRows * rowPitch - mvVirtual.rowGap, "after"));
    ol.appendChild(fragment);
  }

  function scheduleVirtualRange() {
    if (!mvVirtual.active || mvVirtualScrollFrame) return;
    mvVirtualScrollFrame = window.requestAnimationFrame(function() {
      mvVirtualScrollFrame = 0;
      renderVirtualRange(false);
    });
  }

  function activateVirtualList(version) {
    if (version !== mvRenderVersion || !renderedMvItems.length) return;
    var firstCard = ol.querySelector(".mv_list_div");
    var itemHeight = firstCard && firstCard.getBoundingClientRect().height;
    if (!(itemHeight > 0)) {
      scheduleMvListHeight();
      return;
    }
    mvVirtual = {
      active: true,
      columns: mvColumnCount(),
      itemHeight: Math.ceil(itemHeight),
      rowGap: mvRowGap(),
      startRow: -1,
      endRow: -1,
      containerWidth: listParent.clientWidth
    };
    renderVirtualRange(true);
    scheduleMvListHeight();
  }

  function renderCards() {
    var items = filteredItems();
    renderedMvItems = items;
    renderedMvCount = items.length;
    mvRenderVersion += 1;
    var version = mvRenderVersion;
    mvVirtual.active = false;
    mvVirtual.startRow = -1;
    mvVirtual.endRow = -1;
    if (mvVirtualMeasureFrame) window.cancelAnimationFrame(mvVirtualMeasureFrame);
    listParent.scrollTop = 0;
    ol.classList.remove("is-virtualized");
    ol.innerHTML = "";
    var fragment = document.createDocumentFragment();
    if (!items.length) {
      var empty = document.createElement("li");
      empty.setAttribute("class", "mv-empty-state");
      empty.innerHTML = "<strong>没有找到匹配的 MV</strong><span>试试其他关键词或组合。</span>";
      fragment.appendChild(empty);
    } else if (items.length <= 36) {
      items.forEach(function(item) {
        var card = cachedMvCard(item);
        resetMvCardLayout(card);
        fragment.appendChild(card);
      });
    } else {
      // 只先放入一张测量卡。过去每次初始化都会把 477 张卡片、图片和监听器
      // 同时交给布局引擎；这里量取实际行高后仅保留可视两行及前后缓冲行。
      var measureCard = cachedMvCard(items[0]);
      resetMvCardLayout(measureCard);
      fragment.appendChild(measureCard);
    }
    ol.appendChild(fragment);
    if (resultCount) resultCount.innerText = items.length;
    if (currentFilterLabel) currentFilterLabel.innerText = activeGroup === "全部" ? "全部组合" : activeGroup;
    scheduleMvListHeight();
    if (items.length > 36) {
      mvVirtualMeasureFrame = window.requestAnimationFrame(function() {
        mvVirtualMeasureFrame = 0;
        activateVirtualList(version);
      });
    }
  }

  function renderFilters() {
    if (!filterBar) return;
    filterBar.innerHTML = "";
    ["全部"].concat(groupOrder).forEach(function(group) {
      var count = group === "全部" ? mv_list.length : mv_list.filter(function(item) { return item.group === group; }).length;
      if (!count) return;
      var button = document.createElement("button");
      button.type = "button";
      button.setAttribute("class", "mv-group-chip" + (group === activeGroup ? " is-active" : ""));
      button.setAttribute("aria-pressed", group === activeGroup ? "true" : "false");
      button.innerHTML = "<span>" + (group === "全部" ? "全部" : group) + "</span><b>" + count + "</b>";
      button.addEventListener("click", function() {
        activeGroup = group;
        update_player_settings('mv', { group: activeGroup });
        renderFilters();
        renderCards();
      });
      filterBar.appendChild(button);
    });
  }

  function applyViewMode() {
    ol.setAttribute("class", "mv-list-ol mv-view-" + viewMode);
    if (gridButton) {
      gridButton.classList.toggle("is-active", viewMode === "grid");
      gridButton.setAttribute("aria-pressed", viewMode === "grid" ? "true" : "false");
    }
    if (listButton) {
      listButton.classList.toggle("is-active", viewMode === "list");
      listButton.setAttribute("aria-pressed", viewMode === "list" ? "true" : "false");
    }
    scheduleMvListHeight();
  }

  if (searchInput) {
    searchInput.value = "";
    searchInput.oninput = function(event) {
      searchQuery = event.target.value.trim().toLocaleLowerCase();
      // 输入法组合与连续键入时合并为一帧渲染，避免每个字符都重建整张 MV 列表。
      if (mvSearchRenderFrame) window.cancelAnimationFrame(mvSearchRenderFrame);
      mvSearchRenderFrame = window.requestAnimationFrame(function() {
        mvSearchRenderFrame = 0;
        renderCards();
      });
    };
  }
  if (gridButton) gridButton.onclick = function() {
    viewMode = "grid";
    update_player_settings('mv', { view: viewMode });
    localStorage.setItem("mv-view-mode", viewMode);
    applyViewMode();
    renderCards();
  };
  if (listButton) listButton.onclick = function() {
    viewMode = "list";
    update_player_settings('mv', { view: viewMode });
    localStorage.setItem("mv-view-mode", viewMode);
    applyViewMode();
    renderCards();
  };
  listParent.addEventListener("scroll", scheduleVirtualRange, { passive: true });
  function handleMvListLayoutChange() {
    if (mvVirtual.active && Math.abs(mvVirtual.containerWidth - listParent.clientWidth) > 1) {
      renderCards();
      return;
    }
    scheduleMvListHeight();
  }
  if (window.__yusenMvListResizeHandler) window.removeEventListener("resize", window.__yusenMvListResizeHandler);
  window.__yusenMvListResizeHandler = handleMvListLayoutChange;
  window.addEventListener("resize", window.__yusenMvListResizeHandler);
  if (window.__yusenMvListResizeObserver) window.__yusenMvListResizeObserver.disconnect();
  if (typeof window.ResizeObserver === "function") {
    // 只观察容器尺寸变化（主要是窗口宽度变化），不再因每张懒加载封面完成而
    // 重新扫描全部卡片。
    window.__yusenMvListResizeObserver = new window.ResizeObserver(handleMvListLayoutChange);
    window.__yusenMvListResizeObserver.observe(listDiv);
  }
  renderFilters();
  applyViewMode();
  renderCards();
}

function init_custom_list() {
  var list_div = document.getElementById("aplayer_list_active");
  var list_div_sel = document.querySelector("#aplayer_list_active");
  var ol = list_div.querySelector(".music-list-ol");
  try {
    list_div_sel.removeChild(ol);
  } catch (err) {
    //console.error(err)
  }

  var ol = document.createElement("ol");
  ol.setAttribute("class", "music-list-ol");
  //console.log("active_list.length",active_list.length);

  for (var i = 0; i < active_list.length; i++) {
    var arr = music_all[quality][active_list[i]];
    //console.log(arr.author + " - " + arr.title);
    var li = document.createElement("li");
    li.setAttribute("style", "margin-top:0px;");
    li.setAttribute("class", "music-list");
    li.setAttribute("id", "music-id" + active_list[i]);
    li.music = active_list[i];
    li.dataset.musicId = active_list[i];
    li.setAttribute("aria-selected", "false");
    //li.setAttribute("name","music" + i);

    var list_num = document.createElement("span");
    list_num.setAttribute("class", "music-track-index");
    list_num.innerText = i + 1;
    li.appendChild(list_num);

    var cover = document.createElement("div");
    cover.setAttribute("class", "music-track-cover");
    if (arr.pic) {
      var coverImage = document.createElement("img");
      coverImage.loading = "lazy";
      coverImage.alt = "";
      // 列表一次会生成大量曲目。直接由对应的 <img> 进行懒加载，并为每个
      // 节点单独维护镜像重试状态，不能共用循环内的 coverImage 变量。
      set_music_track_cover_image(coverImage, arr);
      cover.appendChild(coverImage);
    }
    li.appendChild(cover);

    var meta = document.createElement("div");
    meta.setAttribute("class", "music-track-meta");

    var list_title = document.createElement("span");
    list_title.setAttribute("id", "music-list-title");
    list_title.setAttribute("class", "music-track-title");
    list_title.setAttribute("name", "music" + active_list[i]);
    list_title.innerText = arr.title;
    meta.appendChild(list_title);

    var list_author = document.createElement("span");
    list_author.setAttribute("id", "music-list-author");
    list_author.setAttribute("class", "music-track-author");
    list_author.setAttribute("name", "music" + active_list[i]);
    list_author.innerText = arr.author;
    meta.appendChild(list_author);
    li.appendChild(meta);

    var checkBox = document.createElement("input");
    checkBox.setAttribute("type", "checkbox");
    checkBox.setAttribute("class", "music-list-checkbox");
    checkBox.setAttribute("name", "music" + active_list[i]);
    checkBox.setAttribute("aria-label", "切换 " + arr.title);
    checkBox.music = active_list[i];
    checkBox.dataset.musicId = active_list[i];
    for (var j = 0; j < ap_list_ptr[1].length; j++) {
      if (ap_list_ptr[1][j] == active_list[i]) {
        checkBox.checked = true;
        break;
      }
    }
    var actions = document.createElement('div');
    actions.setAttribute('class', 'music-track-actions');
    actions.appendChild(create_music_download_action(arr));
    if (music_admin_state.authenticated) {
      actions.appendChild(create_music_tag_action(arr, active_list[i]));
    }
    actions.appendChild(checkBox);
    li.appendChild(actions);

    ol.appendChild(li);
  }
  list_div.appendChild(ol);
  var resultCount = document.getElementById('music-list-result-count');
  if (resultCount) resultCount.innerText = active_list.length;
  apply_music_list_display_limit(music_list_display_limit);
  ol.setAttribute("style","opacity: 1;")
  if(is_mobile)
  {
    list_div.style.width = "90%";
    list_div.style.left = "5%";
    list_div.style.position = "relative";
  }
}
function switch_list() {
  //console.log("current_list: " + current_list);
  try {
    document.querySelector(".sytle-button.--activated").className =
      "sytle-button";
  } catch {
    document.querySelector(".sytle-button-current-list.--activated").className =
      "sytle-button-current-list";
  }
  try{
    document.querySelector("#ap_list" + current_list).className += " --activated";
  } catch{}
  var activeButton = document.querySelector("#ap_list" + current_list);
  var playlistName = document.getElementById('current_playlist_name');
  if (activeButton && playlistName) playlistName.innerText = activeButton.innerText;
  
  active_list = music_list_all[current_list].slice();
  init_custom_list();
}
function set_quality() {
  function updatePlayerTrack(player, index, nextTrack) {
    if (!player || !player.list || !player.list.audios || !player.list.audios[index] || !nextTrack) return;
    var currentTrack = player.list.audios[index];
    ['source_url', 'source_candidates', 'cover_source', 'pic_source', 'cover_candidates', 'pic_candidates', 'cover', 'pic']
      .forEach(function(key) { currentTrack[key] = nextTrack[key]; });
    var candidates = music_source_candidates(currentTrack);
    if (candidates.length) {
      currentTrack.__musicSourceIndex = 0;
      currentTrack.__musicSourceRetries = 0;
      currentTrack.__musicSourceHost = music_hf_url_host(candidates[0]);
      currentTrack.url = candidates[0];
    } else {
      currentTrack.url = nextTrack.url;
    }
    if (player.list.index === index) set_player_cover(player, currentTrack);
  }
  
  for (var i = 0; i < ap_list_ptr[1].length; i++) {
    var nextTrack = music_all[quality][ap_list_ptr[1][i]];
    ap_list_ptr[0][i] = nextTrack;
    if(typeof window.ap1 == 'object')
    {
      updatePlayerTrack(window.ap1, i, nextTrack);
    }
    if(typeof window.ap0 == 'object')
    {
      updatePlayerTrack(window.ap0, i, nextTrack);
    }
  }
}

function sync_music_quality_buttons(isLoading) {
  if (SQ_button) {
    SQ_button.disabled = Boolean(isLoading);
    SQ_button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    SQ_button.style.opacity = quality === 1 ? 1 : 0.4;
  }
  if (HQ_button) {
    HQ_button.disabled = Boolean(isLoading);
    HQ_button.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    HQ_button.style.opacity = quality === 0 ? 1 : 0.4;
  }
}

function switch_music_quality(nextQuality) {
  nextQuality = Number(nextQuality) === 1 ? 1 : 0;
  if (nextQuality === quality || music_quality_switching) return;
  music_quality_switching = true;
  sync_music_quality_buttons(true);
  ensure_music_quality(nextQuality).then(function() {
    quality = nextQuality;
    update_player_settings('music', { quality: quality });
    set_quality();
    // 同一首歌在两个资料库中的编号一致；重绘可同步封面和标题，不改变当前队列。
    if (active_list && active_list.length) init_custom_list();
  }).catch(function(error) {
    console.error('Unable to load selected music quality', error);
  }).then(function() {
    music_quality_switching = false;
    sync_music_quality_buttons(false);
  });
}

function _createSvg(tag, obj) {
  //SVG节点要带命名空间'http://www.w3.org/2000/svg'
  const oTag = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const attr in obj) {
    oTag.setAttribute(attr, obj[attr]);
  }

  return oTag;
}

function add_search_box() {
  var last_text;
  if(!is_mobile)
  {
    var div = document.getElementById("ap_list_button");
  }
  else
  {
    var div = document.getElementById("aplayer_list-current-list");
  }
  var seachbox_div = document.createElement("div");
  seachbox_div.setAttribute("id", "search-music-div");
  var svg_div = document.createElement("button");
  svg_div.setAttribute("id", "search-music-svg");
  svg_div.setAttribute("type", "button");
  svg_div.setAttribute("aria-label", "搜索音乐");
  //svg_div.setAttribute("class", "sytle-button");
  const childSVG = _createSvg("svg", {
    version: "1.1",
    xmlns: "http://www.w3.org/2000/svg",
    width: "32",
    height: "32", 
    viewBox: "0 0 1024 1024",
  });
  const path1 = _createSvg("path", {
    fill: "currentColor",
    d: "M430.829268 124.878049c156.097561 0 280.97561 124.878049 280.97561 280.97561s-124.878049 280.97561-280.97561 280.97561-280.97561-124.878049-280.97561-280.97561S280.97561 124.878049 430.829268 124.878049M430.829268 0c-224.780488 0-405.853659 181.073171-405.853659 405.853659s181.073171 405.853659 405.853659 405.853659 405.853659-181.073171 405.853659-405.853659S655.609756 0 430.829268 0L430.829268 0z",
  });
  const path2 = _createSvg("path", {
    fill: "currentColor",
    d: "M674.341463 661.853659c-12.487805 0-24.97561 6.243902-31.219512 12.487805L624.390244 699.317073c-18.731707 18.731707-18.731707 49.95122 0 68.682927l243.512195 243.512195c6.243902 6.243902 18.731707 12.487805 31.219512 12.487805 12.487805 0 24.97561-6.243902 31.219512-12.487805l18.731707-18.731707c18.731707-18.731707 18.731707-49.95122 0-68.682927l-243.512195-243.512195C699.317073 668.097561 686.829268 661.853659 674.341463 661.853659L674.341463 661.853659z",
  });
  childSVG.appendChild(path1);
  childSVG.appendChild(path2);

  svg_div.appendChild(childSVG);
  var searchbox = document.createElement("input");
  searchbox.maxLength = 40;
  searchbox.type = "text";
  searchbox.setAttribute("id", "music-searbox");
  searchbox.setAttribute("placeholder", "搜索歌曲、歌手");
  searchbox.setAttribute("aria-label", "搜索歌曲或歌手");
  searchbox.setAttribute("autocomplete", "off");
  seachbox_div.appendChild(searchbox);
  seachbox_div.appendChild(svg_div);
  div.appendChild(seachbox_div);

  function runSearch() {
    var nextText = searchbox.value.trim();
    if (nextText.length > 0 && last_text !== nextText) {
      last_text = nextText;
      search_music(last_text);
    }
  }

  $("#music-searbox").keydown(function (event) {
    if (event.keyCode == 13) {
      event.preventDefault();
      runSearch();
    }
    else if (event.keyCode == 46) {
      searchbox.value = "";
      //searchbox.blur();
    }
  });
  
  searchbox.addEventListener("focus", function () {
    if (searchbox.value == "") {
      last_list = active_list;
    }
  });
  searchbox.addEventListener("focusout", function () {
    if (searchbox.value == "") {
      active_list = last_list;
      last_text = null;
      init_custom_list();
    }
  });
  svg_div.addEventListener("click", function () {
    runSearch();
    searchbox.focus();
  });

}
function bind_music_player_settings(player) {
  if (!player) return;
  var saved = read_player_settings().music;
  player.volume(Number(saved.volume));
  player.on('volumechange', function() {
    update_player_settings('music', { volume: player.volume() });
  });
  if (player.template && player.template.order) {
    player.template.order.addEventListener('click', function() {
      window.setTimeout(function() {
        update_player_settings('music', { order: player.options.order });
      }, 0);
    });
  }
  if (player.template && player.template.loop) {
    player.template.loop.addEventListener('click', function() {
      window.setTimeout(function() {
        update_player_settings('music', { loop: player.options.loop });
      }, 0);
    });
  }
}

function clear_player_cover_transition(picture) {
  if (!picture) return;
  var layer = picture.querySelector('.music-player-cover-transition');
  if (layer) layer.remove();
}

function show_player_cover(picture, cssSource, resolvedSource, requestId) {
  if (!picture || picture.dataset.coverRequest !== requestId) return;

  // 同一张封面不重新播放动画。音频重试可能会再次进入本函数；若镜像地址没有
  // 改变，保留已经显示的图像即可。
  if (picture.dataset.coverSource === resolvedSource && picture.style.backgroundImage) {
    picture.classList.remove('aplayer-pic--fallback');
    return;
  }

  clear_player_cover_transition(picture);
  var previousBackground = picture.style.backgroundImage;
  // 新图预读完成后从透明覆盖层淡入，旧图不会在新图已经显示后重新出现。动画
  // 结束时先替换底图、下一帧才移除覆盖层，避免两张图交接的一帧闪出背景色。
  picture.classList.remove('aplayer-pic--fallback');
  if (!previousBackground) {
    picture.style.backgroundImage = 'url("' + cssSource + '")';
    picture.dataset.coverSource = resolvedSource;
    return;
  }

  var layer = document.createElement('span');
  layer.className = 'music-player-cover-transition';
  layer.style.backgroundImage = 'url("' + cssSource + '")';
  picture.appendChild(layer);

  var completed = false;
  function finish() {
    if (completed) return;
    completed = true;
    if (picture.dataset.coverRequest !== requestId || layer.parentNode !== picture) {
      if (layer.parentNode) layer.remove();
      return;
    }
    picture.style.backgroundImage = 'url("' + cssSource + '")';
    picture.dataset.coverSource = resolvedSource;
    var nextFrame = window.requestAnimationFrame || function(callback) { return window.setTimeout(callback, 0); };
    nextFrame(function() {
      nextFrame(function() {
        if (layer.parentNode) layer.remove();
      });
    });
  }
  layer.addEventListener('animationend', finish, {once: true});
  // 浏览器在页面切到后台时可能暂停 CSS 动画，不能让临时层永久留在 DOM 中。
  window.setTimeout(finish, 450);
}

function set_player_cover(player, audio) {
  if (!player || !player.template || !player.template.pic) return;

  var picture = player.template.pic;
  var candidates = music_cover_candidates(audio);
  var requestId = String(Number(picture.dataset.coverRequest || "0") + 1);
  picture.dataset.coverRequest = requestId;
  if (!candidates.length) {
    clear_player_cover_transition(picture);
    picture.style.backgroundImage = "";
    delete picture.dataset.coverSource;
    picture.classList.add("aplayer-pic--fallback");
    return;
  }

  // 背景图不会触发元素自身的 error 事件。预读镜像封面；单个来源在 12 秒内
  // 没有响应时会继续尝试下一镜像。旧封面在新图成功前继续显示，从而保留切歌
  // 时的淡入淡出，而不是先出现一帧空白占位图。
  load_music_cover(candidates, function(source) {
    if (picture.dataset.coverRequest === requestId) {
      var resolvedSource;
      try {
        // 曲库中的文件名可以包含日文、空格和单引号。APlayer 原先使用
        // url('...') 直接拼接，像 IT'S A PERFECT BLUE 这样的目录会提前结束
        // CSS 字符串，从而只剩下纯色封面。使用规范化 URL 和双引号可避免此类字符
        // 破坏 background-image 声明。
        resolvedSource = new URL(String(source), window.location.href).href;
      } catch (error) {
        return;
      }
      var cssSource = resolvedSource.replace(/["\\\n\r\f]/g, function(character) {
        return encodeURIComponent(character);
      });
      show_player_cover(picture, cssSource, resolvedSource, requestId);
    }
  }, function() {
    if (picture.dataset.coverRequest === requestId) {
      clear_player_cover_transition(picture);
      picture.style.backgroundImage = "";
      delete picture.dataset.coverSource;
      picture.classList.add("aplayer-pic--fallback");
    }
  });
}

/*
 * LDDC 导出的逐行歌词会把原文和译文写成相邻、相同时间戳的两行。APlayer
 * 默认把它们当作两条独立歌词，播放时会在原文和译文之间来回跳动。这里在
 * 解析阶段合并同一毫秒的文本；数组的第三项供渲染时作为译文使用，APlayer
 * 仍然只使用前两项计算播放时间，因此单行 LRC 与原有行为完全一致。
 */
function parse_bilingual_lrc(lrc_source) {
  if (!lrc_source) return [];

  var timestamp_pattern = /\[(\d{2}):(\d{2})(\.(\d{2,3}))?\]/g;
  var inline_timestamp_pattern = /<(\d{2}):(\d{2})(\.(\d{2,3}))?>/g;
  var timed_lines = [];
  var source_lines = String(lrc_source)
    .replace(/([^\]^\n])\[/g, function(match, prefix) { return prefix + "\n["; })
    .split(/\r?\n/);

  source_lines.forEach(function(source_line, source_index) {
    var timestamps = [];
    var match;
    timestamp_pattern.lastIndex = 0;
    while ((match = timestamp_pattern.exec(source_line))) {
      var minutes = Number(match[1]);
      var seconds = Number(match[2]);
      var fractional = match[4] ? Number(match[4]) / Math.pow(10, match[4].length) : 0;
      timestamps.push(minutes * 60 + seconds + fractional);
    }
    if (!timestamps.length) return;

    var text = source_line
      .replace(/\[(\d{2}):(\d{2})(\.(\d{2,3}))?\]/g, "")
      .replace(inline_timestamp_pattern, "")
      .replace(/^\s+|\s+$/g, "");
    if (!text) return;

    timestamps.forEach(function(time, timestamp_index) {
      timed_lines.push({
        time: time,
        text: text,
        order: source_index * 100 + timestamp_index,
      });
    });
  });

  timed_lines.sort(function(left, right) {
    return left.time - right.time || left.order - right.order;
  });

  var grouped_lines = [];
  timed_lines.forEach(function(line) {
    var key = Math.round(line.time * 1000);
    var group = grouped_lines[grouped_lines.length - 1];
    if (!group || group.key !== key) {
      group = {key: key, time: line.time, texts: []};
      grouped_lines.push(group);
    }
    // 部分歌词源会重复写入同一句；不把重复内容显示成伪译文。
    if (group.texts.indexOf(line.text) === -1) group.texts.push(line.text);
  });

  return grouped_lines.map(function(group) {
    var original = group.texts[0] || "";
    var alternatives = group.texts.slice(1);
    // 原文、罗马音和中文译文同时存在时，优先显示中文译文；只有双行时保持
    // LDDC 文件中的相邻顺序。
    var chinese_translation = alternatives.filter(function(text) { return /[\u3400-\u9fff]/.test(text); });
    var translation = (chinese_translation.length ? chinese_translation : alternatives).join("\n");
    return translation ? [group.time, original, translation] : [group.time, original];
  });
}

function render_bilingual_lyrics(player) {
  var lyric = player && player.lrc;
  if (!lyric || !lyric.container || !lyric.current || !lyric.current.length) return;
  var paragraphs = lyric.container.getElementsByTagName("p");
  if (paragraphs.length !== lyric.current.length) return;

  Array.prototype.forEach.call(paragraphs, function(paragraph, index) {
    var line = lyric.current[index] || [];
    var original = String(line[1] || "");
    var translation = line[2] ? String(line[2]) : "";
    var identity = original + "\u0000" + translation;
    if (paragraph.dataset.bilingualIdentity === identity) return;
    paragraph.dataset.bilingualIdentity = identity;
    paragraph.textContent = "";
    paragraph.classList.toggle("aplayer-lrc-bilingual", Boolean(translation));

    var original_element = document.createElement("span");
    original_element.className = "aplayer-lrc-original";
    original_element.textContent = original;
    paragraph.appendChild(original_element);

    if (translation) {
      var translation_element = document.createElement("span");
      translation_element.className = "aplayer-lrc-translation";
      translation_element.textContent = translation;
      paragraph.appendChild(translation_element);
    }
  });
}

/*
 * APlayer 1.10.1 对 lrcType: 3 只做一次 XMLHttpRequest：请求经过
 * hf-mirror 的 308 跳转后会落到 Hugging Face。前一个 308 响应没有 CORS
 * 响应头，浏览器会把这次请求判定为网络错误；直接在地址栏打开却没有问题。
 *
 * 新导入的歌词统一经过同源的 /api/music-lyrics 读取。该端点只转发本曲库的
 * .lrc 文件，服务端可以正常跟随镜像跳转。函数短暂不可用时，再退回允许 CORS
 * 的 huggingface.co 原始地址。失败不写入 parsed 缓存，下一次切回同一首歌
 * 会重新请求，而不是永久显示“不可用”。
 */
var music_lyric_text_cache = Object.create(null);
var music_lyric_pending_cache = Object.create(null);
var MUSIC_LYRIC_TIMEOUT_MS = 8000;
var MUSIC_LYRIC_PROXY_ATTEMPTS = 3;

function music_lyric_error(message, status) {
  var error = new Error(message);
  error.status = Number(status) || 0;
  return error;
}

function music_lyric_wait(milliseconds) {
  return new Promise(function(resolve) { window.setTimeout(resolve, milliseconds); });
}

function normalise_music_lyric_source(source) {
  try {
    var url = new URL(String(source || ""), window.location.href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch (error) {
    return null;
  }
}

function music_lyric_proxy_url(source) {
  return "/api/music-lyrics?source=" + encodeURIComponent(source);
}

function music_lyric_fetch_targets(source) {
  var upstream = normalise_music_lyric_source(source);
  if (!upstream) return [];
  var targets = [];
  var hostname = upstream.hostname.toLowerCase();
  var is_yusen_hf_dataset = (hostname === "hf-mirror.com" || hostname === "huggingface.co") &&
    upstream.pathname.indexOf("/datasets/Yusen/music/resolve/main/") === 0;

  if (is_yusen_hf_dataset) {
    // 与静态数据保持 hf-mirror 地址不变；仅歌词请求走同源 Function，避免镜像
    // 重定向响应缺少 CORS 头。第二个目标供本地开发或 Function 临时失效时使用。
    targets.push({url: music_lyric_proxy_url(upstream.href), sameOrigin: true, attempts: MUSIC_LYRIC_PROXY_ATTEMPTS});
    var direct = new URL(upstream.href);
    direct.protocol = "https:";
    direct.hostname = "huggingface.co";
    direct.port = "";
    targets.push({url: direct.href, sameOrigin: false, attempts: 1});
  } else {
    targets.push({url: upstream.href, sameOrigin: upstream.origin === window.location.origin, attempts: 2});
  }
  return targets;
}

function fetch_music_lyric_text_once(target) {
  var controller = typeof window.AbortController === "function" ? new window.AbortController() : null;
  var timeout = controller ? window.setTimeout(function() { controller.abort(); }, MUSIC_LYRIC_TIMEOUT_MS) : 0;
  var options = {
    method: "GET",
    cache: "force-cache",
    credentials: target.sameOrigin ? "same-origin" : "omit",
    headers: {accept: "text/plain, text/*;q=0.9, */*;q=0.1"},
  };
  if (controller) options.signal = controller.signal;

  return fetch(target.url, options).then(function(response) {
    if (!response.ok) throw music_lyric_error("歌词请求失败（HTTP " + response.status + "）", response.status);
    return response.text();
  }).then(function(text) {
    if (!String(text || "").trim()) throw music_lyric_error("歌词文件为空", 502);
    // LRC 是纯文本，限制异常上游响应占用播放器内存；正常文件通常仅几十 KiB。
    if (text.length > 1024 * 1024) throw music_lyric_error("歌词文件过大", 413);
    return text;
  }).then(function(text) {
    if (timeout) window.clearTimeout(timeout);
    return text;
  }, function(error) {
    if (timeout) window.clearTimeout(timeout);
    throw error;
  });
}

function should_retry_music_lyric_request(error) {
  var status = Number(error && error.status) || 0;
  return !status || status === 408 || status === 425 || status === 429 || status >= 500;
}

function request_music_lyric_target(target, attempt) {
  return fetch_music_lyric_text_once(target).catch(function(error) {
    if (attempt + 1 >= target.attempts || !should_retry_music_lyric_request(error)) throw error;
    // 退避时间很短：歌词文件小，网络瞬断或 Function 冷启动恢复后可立即复用。
    return music_lyric_wait(300 * (attempt + 1)).then(function() {
      return request_music_lyric_target(target, attempt + 1);
    });
  });
}

function request_music_lyric_text(source) {
  var key = String(source || "");
  if (Object.prototype.hasOwnProperty.call(music_lyric_text_cache, key)) {
    return Promise.resolve(music_lyric_text_cache[key]);
  }
  if (music_lyric_pending_cache[key]) return music_lyric_pending_cache[key];

  var targets = music_lyric_fetch_targets(key);
  if (!targets.length) return Promise.reject(music_lyric_error("歌词地址无效", 400));
  var next_target = function(index) {
    if (index >= targets.length) return Promise.reject(music_lyric_error("歌词暂时无法载入", 0));
    return request_music_lyric_target(targets[index], 0).catch(function() {
      return next_target(index + 1);
    });
  };
  var pending = next_target(0).then(function(text) {
    music_lyric_text_cache[key] = text;
    delete music_lyric_pending_cache[key];
    return text;
  }, function(error) {
    delete music_lyric_pending_cache[key];
    throw error;
  });
  music_lyric_pending_cache[key] = pending;
  return pending;
}

function write_music_lyric_lines(lyric, lines) {
  lyric.container.textContent = "";
  lines.forEach(function(line, index) {
    var paragraph = document.createElement("p");
    paragraph.textContent = String(line && line[1] || "");
    if (index === 0) paragraph.className = "aplayer-lrc-current";
    lyric.container.appendChild(paragraph);
  });
  lyric.index = 0;
  lyric.current = lines;
  lyric.update(0);
}

function install_resilient_lyric_loader(player) {
  var lyric = player && player.lrc;
  if (!lyric || lyric.__yusenResilientLyrics) return;
  lyric.__yusenResilientLyrics = true;
  lyric.__yusenLyricRequestId = 0;

  lyric.switch = function(index) {
    var activeIndex = Number(index);
    if (!Number.isInteger(activeIndex) || !this.player.list.audios[activeIndex]) return;
    var audio = this.player.list.audios[activeIndex];
    var source = audio && audio.lrc;
    var requestId = ++this.__yusenLyricRequestId;
    var currentLyric = this;

    if (this.parsed[activeIndex]) {
      write_music_lyric_lines(this, this.parsed[activeIndex]);
      return;
    }
    if (!source || typeof source !== "string") {
      write_music_lyric_lines(this, [[0, "暂无歌词"]]);
      return;
    }

    write_music_lyric_lines(this, [[0, "歌词加载中…"]]);
    request_music_lyric_text(source).then(function(text) {
      var parsed = currentLyric.parse(text);
      if (!Array.isArray(parsed) || !parsed.length) throw music_lyric_error("歌词格式无有效时间标签", 422);
      currentLyric.parsed[activeIndex] = parsed;
      // 曲目已切换时只写缓存，不覆盖当前歌词；下一次切回可直接使用缓存。
      if (currentLyric.player.list.index === activeIndex && currentLyric.__yusenLyricRequestId === requestId) {
        write_music_lyric_lines(currentLyric, parsed);
        render_bilingual_lyrics(currentLyric.player);
      }
    }).catch(function(error) {
      // 不缓存失败结果。hf-mirror 的短暂波动、Function 冷启动和网络恢复后，切歌
      // 或再次选择当前曲目时会发起全新的请求。
      if (currentLyric.player.list.index === activeIndex && currentLyric.__yusenLyricRequestId === requestId) {
        write_music_lyric_lines(currentLyric, [[0, "歌词暂时无法载入"]]);
        currentLyric.player.notice("歌词暂时无法载入，将在下次切换时重试。", 2600);
      }
      if (window.console && typeof window.console.warn === "function") {
        window.console.warn("Unable to load lyric", error);
      }
    });
  };
}

function install_bilingual_lyrics(player) {
  if (!player || !player.lrc || player.lrc.__yusenBilingualLyrics) return;
  player.lrc.parse = parse_bilingual_lrc;
  player.lrc.__yusenBilingualLyrics = true;
  install_resilient_lyric_loader(player);
  // APlayer has already created the first LRC object before this page-level
  // extension is installed. Reload the active item once so the first song and
  // every subsequent list switch use the grouped representation.
  if (player.list && typeof player.lrc.switch === "function") {
    player.lrc.switch(player.list.index);
  }
}

function install_stable_queue_switch(player) {
  if (!player || !player.list || player.list.__yusenStableSwitch) return;
  var list = player.list;
  // APlayer 1.10.1 每次切歌都会启动一个 500ms 的 scrollTop 动画，且动画无法
  // 取消。用户先手动滚动队列再连续点歌时，旧动画会把列表拉回上一首，随后新动画
  // 又拉到新歌。改为一次无动画定位，队列只会朝本次选中的歌曲移动。
  list.switch = function(index, options) {
    if (index === undefined || !this.audios[index]) return;
    this.player.events.trigger("listswitch", { index: index });
    this.index = index;
    var audio = this.audios[index];
    set_player_cover(this.player, audio);
    this.player.theme(audio.theme || this.player.options.theme, index, false);
    this.player.template.title.innerHTML = audio.name;
    this.player.template.author.innerHTML = audio.artist ? " - " + audio.artist : "";
    var previous = this.player.container.getElementsByClassName("aplayer-list-light")[0];
    if (previous) previous.classList.remove("aplayer-list-light");
    var entries = this.player.container.querySelectorAll(".aplayer-list li");
    var entry = entries[index];
    if (entry) {
      entry.classList.add("aplayer-list-light");
      var queue = this.player.template.listOl;
      // 用户已经手动滚动到目标行时，点击不应再次把队列拉回中间。否则惯性滚动
      // 与自动定位会让第一次点击看起来像“只滚动了列表”，需要第二次才能选歌。
      if (!options || !options.preserveQueuePosition) {
        var target = entry.offsetTop - Math.max(0, (queue.clientHeight - entry.offsetHeight) / 2);
        queue.scrollTop = Math.max(0, Math.min(target, queue.scrollHeight - queue.clientHeight));
      }
    }
    this.player.setAudio(audio);
    if (this.player.lrc) this.player.lrc.switch(index);
    if (this.player.lrc) this.player.lrc.update(0);
    if (this.player.duration !== 1) this.player.template.dtime.innerHTML = "00:00";
  };

  // APlayer 1.10.1 在气泡阶段按显示序号处理点击，并且必定调用 switch() 的
  // 自动滚动逻辑。使用捕获阶段接管队列行的点击：以实际 li 的索引选歌，并保留
  // 用户刚刚滚出的可视位置。这样滚动停止后的第一次点击就会直接切歌。
  var queuePanel = player.template.list;
  var queueList = player.template.listOl;
  queuePanel.addEventListener("click", function(event) {
    var target = event.target;
    var entry = target && target.closest ? target.closest("li") : null;
    if (!entry || !queueList.contains(entry)) return;

    var entries = queueList.querySelectorAll("li");
    var index = Array.prototype.indexOf.call(entries, entry);
    if (index < 0 || !list.audios[index]) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    var wasCurrent = index === list.index;
    if (wasCurrent) {
      player.toggle();
      return;
    }
    list.switch(index, { preserveQueuePosition: true });
    player.play();
  }, true);
  list.__yusenStableSwitch = true;
}

function aplayer0() {
  try {
    window.ap0.destroy();
  } catch {}
  var ap0_list = JSON.parse(JSON.stringify(ap_list_ptr[0]));
  window.ap0 = new APlayer({
    element: document.getElementById("aplayer0"),
    fixed: false,
    autoplay: false,
    theme: "var(--ifm-color-primary)",
    loop: read_player_settings().music.loop,
    order: read_player_settings().music.order,
    preload: "none",
    volume: read_player_settings().music.volume,
    listFolded: true,
    listMaxHeight: "260px",
    lrcType: 3,
    audio: ap0_list,
  });
  install_bilingual_lyrics(window.ap0);
  install_stable_queue_switch(window.ap0);
  install_music_source_fallback(window.ap0);
  set_player_cover(window.ap0, window.ap0.list && window.ap0.list.audios[window.ap0.list.index]);
  bind_music_player_settings(window.ap0);

  window.ap0.on('pause', function () {
    is_playing = false;
    var pause_or_paly_div = document.getElementById("pause_or_paly_div");
    var pause_or_paly_div_sel = document.querySelector("#pause_or_paly_div");
    var svg = pause_or_paly_div.querySelector("svg");
    try {
      pause_or_paly_div_sel.removeChild(svg);
    } catch (err) {
      //console.error(err)
    }
    childSVG = _createSvg("svg", {
      version: "1.1",
      xmlns: "http://www.w3.org/2000/svg",
      width: "20", 
      height: "20", 
      viewBox: "0 0 1024 1024",
    });
    path1 = _createSvg("path", {
      fill: "currentColor",
      d: "M870.2 466.333333l-618.666667-373.28a53.333333 53.333333 0 0 0-80.866666 45.666667v746.56a53.206667 53.206667 0 0 0 80.886666 45.666667l618.666667-373.28a53.333333 53.333333 0 0 0 0-91.333334z",
    });
    childSVG.setAttribute("style","margin-left: 3px;")
    childSVG.appendChild(path1);
    pause_or_paly_div.appendChild(childSVG);


  });
  window.ap0.on('play', function () {
    is_playing = true;
    var pause_or_paly_div = document.getElementById("pause_or_paly_div");
    var pause_or_paly_div_sel = document.querySelector("#pause_or_paly_div");
    var svg = pause_or_paly_div.querySelector("svg");
    try {
      pause_or_paly_div_sel.removeChild(svg);
    } catch (err) {
      //console.error(err)
    }
    childSVG = _createSvg("svg", {
      version: "1.1",
      xmlns: "http://www.w3.org/2000/svg",
      width: "20", 
      height: "20", 
      viewBox: "0 0 1024 1024",
    });
    path1 = _createSvg("path", {
      fill: "currentColor",
      d: "M309.3 130.7h-70.9c-24.3 0-44 19.7-44 44v674.5c0 24.3 19.7 44 44 44h70.9c24.3 0 44-19.7 44-44V174.7c0-24.3-19.7-44-44-44z m476.3 0h-70.9c-24.3 0-44 19.7-44 44v674.5c0 24.3 19.7 44 44 44h70.9c24.3 0 44-19.7 44-44V174.7c0-24.3-19.7-44-44-44z",
    });
    childSVG.setAttribute("style","margin-left: 1px;")
    childSVG.appendChild(path1);
    pause_or_paly_div.appendChild(childSVG);
  });
  var aplayer_ctr_div = document.getElementById("aplayer_ctr");
  if (!aplayer_ctr_div) return;
  aplayer_ctr_div.innerHTML = "";
  var ctr_panel = document.createElement("div");
  ctr_panel.setAttribute("id", "ctr_panel_div");
  var last_song = document.createElement("button");
  last_song.setAttribute("type", "button");
  last_song.setAttribute("id", "last_song_div");
  last_song.setAttribute("class", "song_ctr_button");
  last_song.setAttribute("aria-label", "上一首");
  var childSVG = _createSvg("svg", {
    version: "1.1",
    xmlns: "http://www.w3.org/2000/svg",
    width: "20", 
    height: "20", 
    viewBox: "0 0 1024 1024",
  });
  var path1 = _createSvg("path", {
    fill: "currentColor",
    d: "M518.4 598.4c-19.2-19.2-41.6-51.2-41.6-86.4 0-32 19.2-57.6 41.6-86.4l275.2-281.6c32-32 32-86.4 0-121.6-16-12.8-38.4-22.4-60.8-22.4s-41.6 9.6-60.8 25.6L256 451.2c-32 32-32 86.4 0 121.6l419.2 425.6c32 32 86.4 32 118.4 0s32-86.4 0-121.6l-275.2-278.4z",
  });
  childSVG.appendChild(path1);
  last_song.appendChild(childSVG);
  //last_song_parent.appendChild(last_song)
  ctr_panel.appendChild(last_song);
  aplayer_ctr_div.appendChild(ctr_panel);
  
  var pause_or_paly = document.createElement("button");
  pause_or_paly.setAttribute("type", "button");
  pause_or_paly.setAttribute("id", "pause_or_paly_div");
  pause_or_paly.setAttribute("class", "song_ctr_button");
  pause_or_paly.setAttribute("aria-label", "播放或暂停");
  childSVG = _createSvg("svg", {
    version: "1.1",
    xmlns: "http://www.w3.org/2000/svg",
    width: "20", 
    height: "20", 
    viewBox: "0 0 1024 1024",
  });
  path1 = _createSvg("path", {
    fill: "currentColor",
    d: "M870.2 466.333333l-618.666667-373.28a53.333333 53.333333 0 0 0-80.866666 45.666667v746.56a53.206667 53.206667 0 0 0 80.886666 45.666667l618.666667-373.28a53.333333 53.333333 0 0 0 0-91.333334z",
  });
  childSVG.setAttribute("style","margin-left: 3px;")
  childSVG.appendChild(path1);
  pause_or_paly.appendChild(childSVG);
 // pause_or_paly_parent.appendChild(pause_or_paly);
  ctr_panel.appendChild(pause_or_paly);
  aplayer_ctr_div.appendChild(ctr_panel);

  var next_song = document.createElement("button");
  next_song.setAttribute("type", "button");
  next_song.setAttribute("id", "next_song_div");
  next_song.setAttribute("class", "song_ctr_button");
  next_song.setAttribute("aria-label", "下一首");
  childSVG = _createSvg("svg", {
    version: "1.1",
    xmlns: "http://www.w3.org/2000/svg",
    width: "20", 
    height: "20", 
    viewBox: "0 0 1024 1024",
  });
  path1 = _createSvg("path", {
    fill: "currentColor",
    d: "M268.8 876.8c-32 32-32 86.4 0 121.6 32 32 86.4 32 118.4 0l419.2-425.6c32-32 32-86.4 0-121.6L387.2 25.6c-16-16-38.4-25.6-60.8-25.6S284.8 9.6 265.6 25.6c-32 32-32 86.4 0 121.6l275.2 281.6c22.4 25.6 41.6 51.2 41.6 86.4s-22.4 64-41.6 86.4l-272 275.2z",
  });
  childSVG.appendChild(path1);
  next_song.appendChild(childSVG);
  // next_song_parent.appendChild(next_song);
  ctr_panel.appendChild(next_song);

  var queue_toggle = document.createElement("button");
  queue_toggle.setAttribute("type", "button");
  queue_toggle.setAttribute("id", "player_queue_toggle");
  queue_toggle.setAttribute("class", "player-queue-toggle");
  queue_toggle.setAttribute("aria-label", "显示播放队列");
  queue_toggle.setAttribute("aria-pressed", "false");
  var queue_icon = _createSvg("svg", {
    version: "1.1",
    xmlns: "http://www.w3.org/2000/svg",
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
  });
  queue_icon.appendChild(_createSvg("path", {
    fill: "currentColor",
    d: "M4 6h12v2H4zm0 5h12v2H4zm0 5h8v2H4zm14-5 3 2.5-3 2.5z",
  }));
  queue_toggle.appendChild(queue_icon);
  var queue_label = document.createElement("span");
  queue_label.innerText = "播放队列";
  queue_toggle.appendChild(queue_label);
  queue_toggle.addEventListener("click", function() {
    if (window.ap0 && window.ap0.list) window.ap0.list.toggle();
  });
  ctr_panel.appendChild(queue_toggle);
  aplayer_ctr_div.appendChild(ctr_panel);

  function sync_queue_toggle() {
    var is_open = window.ap0 && window.ap0.template && window.ap0.template.list &&
      !window.ap0.template.list.classList.contains("aplayer-list-hide");
    queue_toggle.setAttribute("aria-pressed", is_open ? "true" : "false");
    queue_toggle.setAttribute("aria-label", is_open ? "收起播放队列" : "显示播放队列");
    var shell = aplayer_ctr_div.closest(".music-player-shell");
    if (shell) shell.classList.toggle("music-player-shell--queue-open", Boolean(is_open));
  }
  // APlayer 在触发 listshow/listhide 事件后才修改 class，延迟到下一帧读取
  // 才能让辅助按钮与实际队列展开状态保持一致。
  window.ap0.on("listshow", function() { window.setTimeout(sync_queue_toggle, 0); });
  window.ap0.on("listhide", function() { window.setTimeout(sync_queue_toggle, 0); });
  sync_queue_toggle();

  // APlayer 原本按单行歌词的高度计算偏移；新版歌词窗更高时，把当前歌词
  // 重新对齐到可视区域正中央，前后歌词自然环绕显示。
  function center_current_lyric() {
    var lyric_content = window.ap0 && window.ap0.template && window.ap0.template.lrc;
    if (!lyric_content) return;
    // template.lrc 指向内容容器，外层 .aplayer-lrc 才是可视歌词窗。
    var lyric_view = lyric_content.closest(".aplayer-lrc");
    if (!lyric_view || !lyric_view.clientHeight) return;
    var current_line = lyric_view.querySelector(".aplayer-lrc-current");
    if (!current_line) return;
    var offset = lyric_view.clientHeight / 2 - (current_line.offsetTop + current_line.offsetHeight / 2);
    lyric_content.style.transform = "translate3d(0," + Math.round(offset) + "px,0)";
  }
  var lyric_center_pending = false;
  function schedule_lyric_center() {
    if (lyric_center_pending) return;
    lyric_center_pending = true;
    window.requestAnimationFrame(function() {
      // 异步歌词解析器会在本帧末尾写入自己的 transform；再等一帧后覆盖它，
      // 保证当前句无论首次加载还是播放中切换都稳定落在中间。
      window.requestAnimationFrame(function() {
        lyric_center_pending = false;
        render_bilingual_lyrics(window.ap0);
        center_current_lyric();
      });
    });
  }
  window.ap0.on("timeupdate", schedule_lyric_center);
  window.ap0.on("listswitch", function() { window.setTimeout(schedule_lyric_center, 0); });
  if (window.__musicLyricObserver) window.__musicLyricObserver.disconnect();
  if (window.MutationObserver && window.ap0.template && window.ap0.template.lrc) {
    window.__musicLyricObserver = new window.MutationObserver(schedule_lyric_center);
    window.__musicLyricObserver.observe(window.ap0.template.lrc, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
  }
  window.setTimeout(schedule_lyric_center, 0);
  window.setTimeout(schedule_lyric_center, 120);
  window.setTimeout(schedule_lyric_center, 320);
}


function aplayer1() {

  var ap1_list = JSON.parse(JSON.stringify(ap_list_ptr[0]));
  window.ap1 = new APlayer({
    element: document.getElementById("aplayer"),
    showlrc: false,
    fixed: true,
    autoplay: false,
    theme: "var(--ifm-color-primary)",
    loop: read_player_settings().music.loop,
    order: read_player_settings().music.order,
    preload: "none",
    volume: read_player_settings().music.volume,
    listFolded: true,
    listMaxHeight: "200px",
    lrcType: 3,
    audio: ap1_list,
  });
  bind_music_player_settings(window.ap1);
  install_music_source_fallback(window.ap1);
  set_player_cover(window.ap1, window.ap1.list && window.ap1.list.audios[window.ap1.list.index]);
}

function search_music(text) {
  var reg_child = new RegExp(text, "i");
  active_list = new Array();
  
  var query = new AV.SearchQuery("music_sq");
  var all_alf = /^[A-Za-z]+$/;
  if(all_alf.test(text))
  {
    var reg = '/' + text + '|' + text + '.*|'  + text + '*|.*' +  text + '.*/';
  }
  else{
    var reg = '/';
    for (var i = 0 ;i < text.length; i++)
    {
      reg =  reg + "*" + text.slice(i,i+1);
    }
    reg = reg + '*|';
    if(text.length > 1)
    {
      reg = reg + text.slice(0,1);
      for (var i = 1 ;i < text.length; i++)
      {
        reg =  reg + ".*" + text.slice(i,i+1) ;
      }
      reg = reg + '|';
    }
    else{
      reg = reg + text + '|';
    }
    if(text.length > 1)
    {
      reg = reg + text.slice(0,1);
      for (var i = 1 ;i < text.length; i++)
      {
        reg =  reg + "*" + text.slice(i,i+1) ;
      }
      reg = reg + '|';
    }
    else{
      reg = reg + text + '|';
    }
    for (var i = 0 ;i < text.length; i++)
    {
      reg =  reg  + text.slice(i,i+1) + "|";
    }
  
    for (var i = 0 ;i < text.length; i++)
    {
      reg =  reg + ".*" + text.slice(i,i+1);
    }
    reg = reg + '.*|' + text + '/';

  }


  //console.log(reg);
  query.queryString("z_full_name:" + reg);
  query.limit(1000);
    query.find().then((results) => {
      //console.log(results);
      if (results.length > 0) {
        var flag_arr = new Array();
        for(var i = results.length-1 ;i >= 0 ;i--)
        {
          if(results[i]._serverData.z_full_name.match(text))
          {
            flag_arr[i] = true;
            active_list.push(results[i]._serverData.mid);
          }
          else
          {
            flag_arr[i] = false;
          }
        }
        for(var i = results.length-1 ;i >= 0 ;i--)
        {
          if(results[i]._serverData.z_full_name.search(reg_child) != -1 && flag_arr[i] == false)
          {
            flag_arr[i] = true;
            active_list.push(results[i]._serverData.mid);
          }
        }
        for(var i = results.length-1 ;i >= 0 ;i--)
        {
          if(flag_arr[i] == false)
          {
            active_list.push(results[i]._serverData.mid);
          }
        }
      } 
          if(active_list.length > 0)
          {
            init_custom_list();
          }
          else{
            search_not_found();
          }
     });
     
}

/* Local replacement for the former LeanCloud full-text search. */
search_music = function(text) {
  var keyword = String(text || '').trim().toLowerCase();
  active_list = (music_all[quality] || []).filter(function(song) {
    var fullName = (song.z_full_name || ((song.author || '') + ' - ' + (song.title || ''))).toLowerCase();
    return fullName.indexOf(keyword) !== -1;
  }).map(function(song) { return song.mid; });
  if (active_list.length) init_custom_list();
  else search_not_found();
};

function search_not_found() {
  var list_div = document.getElementById("aplayer_list_active");
  var list_div_sel = document.querySelector("#aplayer_list_active");
  var ol = list_div.querySelector(".music-list-ol");
  try {
    list_div_sel.removeChild(ol);
  } catch (err) {}

  var mes = document.createElement("span");
  mes.innerText = "未检索到相关歌曲";
  mes.setAttribute("class", "music-list-ol");
  mes.style.fontSize = "24px";
  mes.style.fontWeight = 700;
  mes.style.padding = "20px 40px";
  mes.style.textAlign = "center";
  list_div.appendChild(mes);
}

function load_music_lists()
{

  var div = document.getElementById("aplayer_list");
  subdiv = document.createElement("div");
  subdiv.setAttribute("id", "aplayer_list_sub");
  var query = new AV.Query("music_tag");
  query.ascending("tag_order");
  query.limit(1000);
  query.find().then((results) => {
      for (var i = 0; i < results.length; i++) {
        if (results[i]._serverData.tag_id > list_count) {
          list_count = results[i]._serverData.tag_id;
        }
        let newbutton = document.createElement("botton");
        newbutton.setAttribute("class", "sytle-button");
        newbutton.setAttribute("id", "ap_list" + results[i]._serverData.tag_id);
        if (current_list == results[i]._serverData.tag_id) {
          newbutton.className += " --activated";
        }
        newbutton.tag_id = results[i]._serverData.tag_id;
        newbutton.innerText = results[i]._serverData.tag_name;
        subdiv.appendChild(newbutton);
      }
      div.appendChild(subdiv);

      setup_music_lists();
      init_custom_list();
      target_x_list[0] = 0;
      for (var i = 0; i < results.length; i ++) {
        if (
          subdiv.childNodes[i].offsetLeft +
            subdiv.childNodes[i].clientWidth -
            target_x_list[current_page] >
          subdiv.clientWidth
        ) {
          if(target_x_list[current_page] != subdiv.childNodes[i].offsetLeft - 8)
          {
            current_page++;
            target_x_list[current_page] = subdiv.childNodes[i].offsetLeft - 8;
          }
        }
      }
      current_page = 0;
      div.parentNode.style.opacity = "1"
      div.parentNode.style.bottom = "0";
      div.parentNode.style.height = "auto";

    })
    .catch(function (err) {
      load_music_lists();
      console.err(err);
    });

  var former_page = document.createElement("div");
  former_page.setAttribute("id", "former_page_div");
  former_page.setAttribute("class", "tag_list_switch_button");
  var childSVG = _createSvg("svg", {
    version: "1.1",
    xmlns: "http://www.w3.org/2000/svg",
    width: "20",
    height: "20",
    viewBox: "0 0 1024 1024",
  });
  var path1 = _createSvg("path", {
    fill: "currentColor",
    d: "M518.4 598.4c-19.2-19.2-41.6-51.2-41.6-86.4 0-32 19.2-57.6 41.6-86.4l275.2-281.6c32-32 32-86.4 0-121.6-16-12.8-38.4-22.4-60.8-22.4s-41.6 9.6-60.8 25.6L256 451.2c-32 32-32 86.4 0 121.6l419.2 425.6c32 32 86.4 32 118.4 0s32-86.4 0-121.6l-275.2-278.4z",
  });
  childSVG.appendChild(path1);
  former_page.appendChild(childSVG);
  div.before(former_page);


  var next_page = document.createElement("div");
  var next_page = document.createElement("div");
  next_page.setAttribute("id", "next_page_div");
  next_page.setAttribute("class", "tag_list_switch_button");
  childSVG = _createSvg("svg", {
    version: "1.1",
    xmlns: "http://www.w3.org/2000/svg",
    width: "20",
    height: "20",
    viewBox: "0 0 1024 1024",
  });
  path1 = _createSvg("path", {
    fill: "currentColor",
    d: "M268.8 876.8c-32 32-32 86.4 0 121.6 32 32 86.4 32 118.4 0l419.2-425.6c32-32 32-86.4 0-121.6L387.2 25.6c-16-16-38.4-25.6-60.8-25.6S284.8 9.6 265.6 25.6c-32 32-32 86.4 0 121.6l275.2 281.6c22.4 25.6 41.6 51.2 41.6 86.4s-22.4 64-41.6 86.4l-272 275.2z",
  });
  childSVG.appendChild(path1);
  next_page.appendChild(childSVG);
  div.after(next_page);


  $(document).on("click", ".tag_list_switch_button", function (e) {
    var list_obj = $(e.target);
    const { left, top } = list_obj[0].getBoundingClientRect();
    list_obj[0].style = `--x2:${e.clientX - left}px;--y2:${
      e.clientY - top
    }px;margin-top:0px;`;
    if (
      e.target.id == "next_page_div" &&
      current_page < target_x_list.length - 1
    ) {
      current_page++;
      var target_x = target_x_list[current_page];
      subdiv.scrollTo({
        left: target_x,
        behavior: "smooth",
      });
    } else if (e.target.id == "former_page_div" && current_page > 0) {
      current_page--;
      var target_x = target_x_list[current_page];
      subdiv.scrollTo({
        left: target_x,
        behavior: "smooth",
      });
    }
  });
  
  subdiv.addEventListener("scroll",function(e)
  {
      var former_value = subdiv.scrollLeft;
	    var timer = setTimeout(()=>{
        if(former_value === subdiv.scrollLeft) {
          for(var i = 0;i < target_x_list.length; i++)
          {
            if(subdiv.scrollLeft + 1 > target_x_list[i] && subdiv.scrollLeft - 1 < target_x_list[i] )
            {
              current_page = i;
              break;
            }
            else if(subdiv.scrollLeft > target_x_list[i] && subdiv.scrollLeft < target_x_list[i+1])
            {
              if(i+1 == target_x_list.length)
               current_page = i;
              else
               current_page = i+1;
              break;
            }
          }
          clearTimeout(timer)
        }
      }, 300);

  });

}

/* Render the original playlist controls from local exported tags. */
load_music_lists = function() {
  var div = document.getElementById('aplayer_list');
  if (!div) return;
  ['former_page_div', 'next_page_div'].forEach(function(id) {
    var oldButton = document.getElementById(id);
    if (oldButton) oldButton.remove();
  });
  div.innerHTML = '';
  subdiv = document.createElement('div');
  subdiv.setAttribute('id', 'aplayer_list_sub');

  function createTagButton(tag) {
    list_count = Math.max(list_count, tag.tag_id);
    var button = document.createElement('button');
    button.setAttribute('class', 'sytle-button' + (current_list === tag.tag_id ? ' --activated' : ''));
    button.setAttribute('id', 'ap_list' + tag.tag_id);
    button.tag_id = tag.tag_id;
    button.innerText = tag.tag_name;
    return button;
  }

  function createTagGroup(className) {
    var group = document.createElement('div');
    group.setAttribute('class', 'playlist-tag-group' + (className ? ' ' + className : ''));
    for (var rowIndex = 0; rowIndex < 3; rowIndex += 1) {
      var row = document.createElement('div');
      row.setAttribute('class', 'playlist-tag-row');
      group.appendChild(row);
    }
    return group;
  }

  // 先挂载容器再量取可用宽度。标签不再按固定的 5 列硬分组，而是按它们的
  // 实际文字宽度连续填满三行；渲染后由 flex 把每行余宽分给现有项目，保证
  // 长名称完整可见，并让每页的三行都贴齐左右边缘。
  div.appendChild(subdiv);
  var measurementGroup = createTagGroup('playlist-tag-group--measure');
  subdiv.appendChild(measurementGroup);
  var measurementRow = measurementGroup.firstElementChild;
  var tagWidths = music_tags.map(function(tag) {
    var button = createTagButton(tag);
    measurementRow.appendChild(button);
    var width = Math.ceil(button.getBoundingClientRect().width);
    button.remove();
    return width;
  });
  // 最终分页组受分页间距与保留滚动条影响会比临时量尺窄约 8px；提前扣除这部分
  // 宽度和子像素边框余量，保证最右标签仍贴齐栏内边缘而不会被裁掉。
  var availableWidth = Math.max(1, Math.floor(measurementRow.clientWidth) - 8);
  measurementGroup.remove();
  rendered_playlist_width = availableWidth;
  var rowGap = 9;
  var group;
  var rows;
  var rowWidths;
  var rowIndex;
  function startTagGroup() {
    group = createTagGroup();
    rows = Array.prototype.slice.call(group.children);
    rowWidths = [0, 0, 0];
    rowIndex = 0;
    subdiv.appendChild(group);
  }

  startTagGroup();
  music_tags.forEach(function(tag, index) {
    var tagWidth = tagWidths[index];
    // 当前行只在已经有标签时才换行，单个很长的名称仍然保持完整显示。
    if (rows[rowIndex].children.length && rowWidths[rowIndex] + rowGap + tagWidth > availableWidth) {
      rowIndex += 1;
    }
    if (rowIndex >= rows.length) {
      startTagGroup();
    }
    rows[rowIndex].appendChild(createTagButton(tag));
    rowWidths[rowIndex] += (rowWidths[rowIndex] ? rowGap : 0) + tagWidth;
  });
  var initialTag = music_tags.find(function(tag) { return tag.tag_id === current_list; });
  var playlistName = document.getElementById('current_playlist_name');
  if (initialTag && playlistName) playlistName.innerText = initialTag.tag_name;

  function createPager(id, pathData) {
    var pager = document.createElement('div');
    pager.setAttribute('id', id);
    pager.setAttribute('class', 'tag_list_switch_button');
    var svg = _createSvg('svg', {version: '1.1', xmlns: 'http://www.w3.org/2000/svg', width: '20', height: '20', viewBox: '0 0 1024 1024'});
    svg.appendChild(_createSvg('path', {fill: 'currentColor', d: pathData}));
    pager.appendChild(svg);
    return pager;
  }

  var formerPage = createPager('former_page_div', 'M518.4 598.4c-19.2-19.2-41.6-51.2-41.6-86.4 0-32 19.2-57.6 41.6-86.4l275.2-281.6c32-32 32-86.4 0-121.6-16-12.8-38.4-22.4-60.8-22.4s-41.6 9.6-60.8 25.6L256 451.2c-32 32-32 86.4 0 121.6l419.2 425.6c32 32 86.4 32 118.4 0s32-86.4 0-121.6l-275.2-278.4z');
  var nextPage = createPager('next_page_div', 'M268.8 876.8c-32 32-32 86.4 0 121.6 32 32 86.4 32 118.4 0l419.2-425.6c32-32 32-86.4 0-121.6L387.2 25.6c-16-16-38.4-25.6-60.8-25.6S284.8 9.6 265.6 25.6c-32 32-32 86.4 0 121.6l275.2 281.6c22.4 25.6 41.6 51.2 41.6 86.4s-22.4 64-41.6 86.4l-272 275.2z');
  div.before(formerPage);
  div.after(nextPage);

  function rebuildTagPages() {
    target_x_list = [0];
    var page = 0;
    Array.prototype.forEach.call(subdiv.childNodes, function(button) {
      if (button.offsetLeft + button.clientWidth - target_x_list[page] > subdiv.clientWidth) {
        var nextOffset = Math.max(0, button.offsetLeft - 8);
        if (target_x_list[page] !== nextOffset) {
          target_x_list.push(nextOffset);
          page++;
        }
      }
    });
    current_page = Math.min(current_page, target_x_list.length - 1);
  }
  function scrollTagPage(page) {
    var targetX = target_x_list[page] || 0;
    var before = subdiv.scrollLeft;
    subdiv.scrollTo({left: targetX, behavior: 'smooth'});
    // 旧版的平滑分页体验保留；个别浏览器在 scroll-snap 下会吞掉 smooth
    // 定位，短暂等待后才用立即定位兜底，避免出现“页码变了但列表不动”。
    window.setTimeout(function() {
      if (Math.abs(subdiv.scrollLeft - targetX) > 2 && Math.abs(subdiv.scrollLeft - before) < 2) {
        subdiv.scrollTo({left: targetX, behavior: 'auto'});
      }
    }, 520);
  }
  setTimeout(rebuildTagPages, 0);
  formerPage.addEventListener('click', function() {
    rebuildTagPages();
    if (current_page > 0) current_page--;
    scrollTagPage(current_page);
  });
  nextPage.addEventListener('click', function() {
    rebuildTagPages();
    if (current_page < target_x_list.length - 1) current_page++;
    scrollTagPage(current_page);
  });
  setup_music_lists();
  init_custom_list();
  current_page = 0;
  if (div.parentNode) {
    div.parentNode.style.opacity = '1';
    div.parentNode.style.bottom = '0';
    div.parentNode.style.height = 'auto';
  }
};

$(window).resize(function() {
  if(page_loaded)
  {
    // 容器宽度变化后重新按真实文字宽度填充，避免在桌面宽屏留下稀疏空行。
    if (subdiv && Math.abs(rendered_playlist_width - Math.floor(subdiv.clientWidth)) > 1) {
      load_music_lists();
      return;
    }
    target_x_list = new Array();
    target_x_list[0] = 0;
    current_page = 0;
    for(var i = 0;i < subdiv.childNodes.length; i++)
    {
      if(subdiv.childNodes[i].offsetLeft + subdiv.childNodes[i].clientWidth - target_x_list[current_page] > subdiv.clientWidth)
      {
        if(target_x_list[current_page] != subdiv.childNodes[i].offsetLeft - 8)
        {
          current_page++;
          target_x_list[current_page] = subdiv.childNodes[i].offsetLeft - 8;
        }

      }
    }
    current_page = 0;
    subdiv.scrollTo({
      left: 0,
      behavior: "smooth",
    });
  }

});

function setup_music_lists() {
  document.getElementsByClassName("sytle-button-current-list")[0].tag_id = 0;
  $(document).off("click.musicPlaylistSwitch", ".sytle-button, .sytle-button-current-list");
  $(document).on("click.musicPlaylistSwitch", ".sytle-button, .sytle-button-current-list", function (e) {
    var nextList = Number(e.currentTarget.tag_id);
    if (!Number.isInteger(nextList)) return;
    current_list = nextList;
    update_player_settings('music', { currentList: current_list });
    get_music_list(current_list, true);
  });

  // var i = 0;
  // function update_hq() {
  //   if (i < music_all_hq.length) {
  //     const hq_up = AV.Object.createWithoutData(
  //       "music_hq",
  //       music_all_hq_sql[i].id
  //     );
  //     hq_up.set("z_full_name", music_all_hq[i].author + " - " + music_all_hq[i].title);
  //     hq_up.save().then((hq_up) => {
  //       i++;
  //       update_hq();
  //     });
  //   }
  // }
  // var j = 0;
  // function update_sq() {
  //   if (j < music_all_sq.length) {
  //     const sq_up = AV.Object.createWithoutData(
  //       "music_sq",
  //       music_all_sq_sql[j].id
  //     );
  //     sq_up.set("z_full_name", music_all_sq[j].author + " - " + music_all_sq[j].title);
  //     sq_up.save().then((sq_up) => {
  //       j++;
  //       update_sq();
  //     });
  //   }
  // }
  //pdate_hq();
  //update_sq();

}
