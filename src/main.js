// Portfolio City - Phaser.js skeleton
// 使用手繪 SVG 等角建築美術素材 (assets/) 取代色塊佔位

const CATEGORY_ASSET = {
  blog: { key: "building-blog", label: "📰", baseScale: 0.55 },
  youtube: { key: "building-youtube", label: "🎬", baseScale: 0.5 },
  speech: { key: "building-speech", label: "🎤", baseScale: 0.5 },
  book: { key: "building-book", label: "📚", baseScale: 0.5 },
};

// 依數值級距決定建築等級 (0~2)，可依需求調整門檻
function getLevel(item) {
  const metricValue = Object.values(item.metric || {})[0] || 0;
  if (metricValue >= 20000) return 2;
  if (metricValue >= 5000) return 1;
  return 0;
}

class CityScene extends Phaser.Scene {
  constructor() {
    super("CityScene");
  }

  preload() {
    this.load.json("content", "content.json");

    // 建築美術素材 (SVG，向量縮放不失真)
    this.load.svg("building-blog", "assets/building-blog.svg", { width: 140, height: 150 });
    this.load.svg("building-youtube", "assets/building-youtube.svg", { width: 150, height: 180 });
    this.load.svg("building-speech", "assets/building-speech.svg", { width: 160, height: 150 });
    this.load.svg("building-book", "assets/building-book.svg", { width: 150, height: 190 });
    this.load.svg("island-base", "assets/island-base.svg", { width: 260, height: 140 });
    this.load.svg("star-badge", "assets/star-badge.svg", { width: 24, height: 24 });
  }

  create() {
    const data = this.cache.json.get("content");
    this.districts = data.districts;
    this.items = data.items;

    this.cameras.main.setBackgroundColor("#1e2a38");
    this.drawOcean();
    this.drawDistricts();
    this.placeBuildings();
    this.enableCameraDrag();
  }

  drawOcean() {
    const W = 2000;
    const H = this.scale.height;
    const horizon = 330;

    // 天空漸層
    const sky = this.add.graphics().setScrollFactor(0);
    sky.fillGradientStyle(0x1b3a6b, 0x1b3a6b, 0xffb98a, 0xffb98a, 1);
    sky.fillRect(0, 0, this.scale.width, horizon + 20);

    // 太陽光暈
    const sun = this.add.graphics().setScrollFactor(0.1);
    [90, 65, 45].forEach((r, i) => {
      sun.fillStyle(0xfff3b0, 0.15 + i * 0.25);
      sun.fillCircle(this.scale.width * 0.8, horizon - 40, r);
    });

    // 雲朵緩慢飄動
    for (let i = 0; i < 6; i++) {
      const cx = Phaser.Math.Between(0, this.scale.width);
      const cy = Phaser.Math.Between(40, horizon - 80);
      const cloud = this.add.graphics().setScrollFactor(0.2).setAlpha(0.55);
      cloud.fillStyle(0xffffff, 1);
      cloud.fillEllipse(0, 0, 120, 30);
      cloud.fillEllipse(-30, -10, 60, 28);
      cloud.fillEllipse(25, -12, 70, 30);
      cloud.setPosition(cx, cy);
      this.tweens.add({
        targets: cloud,
        x: cx + Phaser.Math.Between(150, 300),
        duration: Phaser.Math.Between(20000, 40000),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    // 海洋漸層
    const sea = this.add.graphics();
    sea.fillGradientStyle(0x4fc3f7, 0x4fc3f7, 0x0d47a1, 0x0d47a1, 1);
    sea.fillRect(-W / 2, horizon, W * 2, H);

    // 動態波浪紋
    for (let row = 0; row < 5; row++) {
      for (let x = -400; x < 1700; x += 60) {
        const y = horizon + 25 + row * 45 + (x % 120 === 0 ? 0 : 12);
        const wave = this.add.graphics();
        wave.lineStyle(2, 0xffffff, 0.25 - row * 0.03);
        wave.beginPath();
        wave.arc(0, 0, 14, Math.PI, 0, false);
        wave.strokePath();
        wave.setPosition(x, y);
        this.tweens.add({
          targets: wave,
          y: y + 5,
          alpha: 0.3,
          duration: 1500 + Math.random() * 1500,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          delay: Math.random() * 1500,
        });
      }
    }

    // 標題
    this.add
      .text(this.scale.width / 2, 36, "🏙️ 個人履歷城市", {
        fontSize: "32px",
        fontStyle: "bold",
        color: "#ffffff",
        stroke: "#1b3a6b",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(50);
  }

  drawDistricts() {
    this.districts.forEach((d) => {
      // 島嶼基座美術圖，依分區顏色上色 (setTint)
      const island = this.add
        .image(d.x, d.y + 60, "island-base")
        .setDisplaySize(260, 140);
      island.setTint(Phaser.Display.Color.HexStringToColor(d.color).color);
      this.tweens.add({
        targets: island,
        y: island.y + 4,
        duration: 2200 + Math.random() * 800,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });

      // 分區標題
      this.add
        .text(d.x, d.y - 60, d.name, {
          fontSize: "22px",
          fontStyle: "bold",
          color: "#ffffff",
          backgroundColor: "#00000055",
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5);
    });
  }

  placeBuildings() {
    // 依分區分組，群內自動排列建築位置
    this.districts.forEach((d) => {
      const districtItems = this.items.filter((i) => i.district === d.id);
      const spacing = 110;
      const startX = d.x - ((districtItems.length - 1) * spacing) / 2;

      districtItems.forEach((item, idx) => {
        const style = CATEGORY_ASSET[item.category] || CATEGORY_ASSET.blog;
        const level = getLevel(item);
        const scale = style.baseScale + level * 0.12;
        const bx = startX + idx * spacing;
        const by = d.y + 70;

        // 建築陰影
        this.add.ellipse(bx, by - 2, 90 * scale * 1.6, 18, 0x000000, 0.3);

        const sprite = this.add
          .image(bx, by, style.key)
          .setOrigin(0.5, 1)
          .setScale(scale)
          .setInteractive({ useHandCursor: true });

        // 等級星星徽章 (0~2顆)
        for (let s = 0; s <= level; s++) {
          this.add
            .image(bx - level * 8 + s * 16, by - sprite.displayHeight - 10, "star-badge")
            .setScale(0.7);
        }

        this.add
          .text(bx, by + 10, item.title, {
            fontSize: "11px",
            color: "#ffffff",
            backgroundColor: "#00000066",
            padding: { x: 4, y: 2 },
            wordWrap: { width: 110 },
            align: "center",
          })
          .setOrigin(0.5, 0);

        sprite.on("pointerover", () => {
          sprite.setTint(0xeeeeee);
          this.tweens.add({ targets: sprite, scale: scale * 1.1, duration: 120 });
        });
        sprite.on("pointerout", () => {
          sprite.clearTint();
          this.tweens.add({ targets: sprite, scale, duration: 120 });
        });
        sprite.on("pointerdown", () => this.showPanel(item));
      });
    });
  }

  showPanel(item) {
    const panel = document.getElementById("ui-panel");
    document.getElementById("panel-title").innerText = item.title;

    const metricText = Object.entries(item.metric || {})
      .map(([k, v]) => `${k}: ${v.toLocaleString()}`)
      .join(" ・ ");
    document.getElementById("panel-meta").innerText = `${item.date} ・ ${metricText}`;
    document.getElementById("panel-desc").innerText = item.description || "";

    const linkEl = document.getElementById("panel-link");
    if (item.link) {
      linkEl.href = item.link;
      linkEl.style.display = "inline-block";
    } else {
      linkEl.style.display = "none";
    }
    panel.classList.add("open");
  }

  enableCameraDrag() {
    this.input.on("pointermove", (pointer) => {
      if (!pointer.isDown) return;
      this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x);
    });
  }
}

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: "game",
  scene: [CityScene],
};

new Phaser.Game(config);

document.getElementById("close-btn").addEventListener("click", () => {
  document.getElementById("ui-panel").classList.remove("open");
});
