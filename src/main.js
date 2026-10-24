// Portfolio City - Phaser.js skeleton
// 以色塊代表建築，之後可替換成正式美術素材 (PNG/Spine)

const CATEGORY_STYLE = {
  blog: { color: 0x795548, label: "📰", baseW: 60, baseH: 60 },
  youtube: { color: 0xe53935, label: "🎬", baseW: 70, baseH: 90 },
  speech: { color: 0xfb8c00, label: "🎤", baseW: 80, baseH: 70 },
  book: { color: 0x8e24aa, label: "📚", baseW: 70, baseH: 100 },
};

// 依數值級距決定建築大小等級 (0~2)，可依需求調整門檻
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
      // 島嶼基座
      const g = this.add.graphics();
      g.fillStyle(Phaser.Display.Color.HexStringToColor(d.color).color, 1);
      g.fillEllipse(d.x, d.y + 60, 220, 110);

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
      const spacing = 90;
      const startX = d.x - ((districtItems.length - 1) * spacing) / 2;

      districtItems.forEach((item, idx) => {
        const style = CATEGORY_STYLE[item.category] || CATEGORY_STYLE.blog;
        const level = getLevel(item);
        const w = style.baseW + level * 15;
        const h = style.baseH + level * 25;
        const bx = startX + idx * spacing;
        const by = d.y + 40 - h / 2;

        const rect = this.add
          .rectangle(bx, by, w, h, style.color)
          .setStrokeStyle(2, 0xffffff, 0.8)
          .setInteractive({ useHandCursor: true });

        this.add
          .text(bx, by, style.label, { fontSize: "24px" })
          .setOrigin(0.5);

        this.add
          .text(bx, by + h / 2 + 12, item.title, {
            fontSize: "11px",
            color: "#ffffff",
            wordWrap: { width: w + 20 },
            align: "center",
          })
          .setOrigin(0.5, 0);

        rect.on("pointerover", () => rect.setFillStyle(style.color, 0.7));
        rect.on("pointerout", () => rect.setFillStyle(style.color, 1));
        rect.on("pointerdown", () => this.showPanel(item));
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
