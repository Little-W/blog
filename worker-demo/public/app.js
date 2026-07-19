(() => {
  const healthText = document.querySelector("#health-text");
  let art;

  function createPlayer() {
    if (art) art.destroy(false);
    art = new Artplayer({
      container: "#artplayer",
      url: "/media/demo.mp4",
      title: "Local Worker Stream Demo",
      autoplay: false,
      muted: false,
      volume: 0.7,
      theme: "#00a8e9",
      setting: true,
      playbackRate: true,
      aspectRatio: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      mutex: true
    });
  }

  async function checkHealth() {
    try {
      const response = await fetch("/health", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const status = await response.json();
      healthText.textContent = `${status.runtime} 已就绪；浏览器 Cookie 转发：关闭`;
      healthText.classList.add("ok");
    } catch (error) {
      healthText.textContent = `Worker 检查失败：${error.message}`;
      healthText.classList.add("error");
    }
  }

  async function parseBilibiliReference(event) {
    event.preventDefault();
    const input = document.querySelector("#bili-reference-input").value.trim();
    const page = document.querySelector("#bili-reference-page").value;
    const status = document.querySelector("#bili-reference-status");
    const player = document.querySelector("#bili-reference-player");
    status.className = "reference-status";
    status.textContent = "正在校验视频编号…";
    player.hidden = true;
    player.replaceChildren();

    try {
      const params = new URLSearchParams({ input, p: page });
      const response = await fetch(`/api/bili/parse?${params}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);

      const frame = document.createElement("iframe");
      frame.src = result.embedUrl;
      frame.title = `${result.type === "bvid" ? result.id : `av${result.id}`} - 哔哩哔哩官方嵌入播放器`;
      frame.allow = "autoplay; fullscreen; picture-in-picture";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      player.appendChild(frame);
      player.hidden = false;
      status.textContent = `已识别 ${result.type === "bvid" ? result.id : `av${result.id}`} · P${result.page} · 官方嵌入模式`;
      status.classList.add("ok");
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("error");
    }
  }

  document.querySelector("#reload-player").addEventListener("click", createPlayer);
  document.querySelector("#bili-reference-form").addEventListener("submit", parseBilibiliReference);
  createPlayer();
  checkHealth();
})();
