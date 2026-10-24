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
    const g = this.add.graphics();
    g.fillStyle(0x0d47a1, 1);
    g.fillRect(0, 350, 1300, 300);
    // 簡單波浪紋裝飾
    for (let x = 0; x < 1300; x += 40) {
      g.lineStyle(2, 0x1565c0, 0.6);
      g.beginPath();
      g.arc(x, 380, 15, Math.PI, 0, false);
      g.strokePath();
    }
  }

  drawDistricts() {
    this.districts.forEach((d) => {
      // 島嶼基座美術圖，依分區顏色上色 (setTint)
      const island = this.add
        .image(d.x, d.y + 60, "island-base")
        .setDisplaySize(260, 140);
      island.setTint(Phaser.Display.Color.HexStringToColor(d.color).color);

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

        sprite.on("pointerover", () => sprite.setTint(0xcccccc));
        sprite.on("pointerout", () => sprite.clearTint());
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
