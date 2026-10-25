# 🏝️ Portfolio City｜個人履歷模擬城市

把部落格文章、YouTube 影片、演講紀錄、出版著作等個人輸出，轉化成一座可探索的模擬城市／島嶼建設遊戲，讓履歷不再只是條列式文字，而是一座能讓人逛、能點擊互動的小世界。

![城市預覽](docs/preview.png)
![點擊建築顯示內容](docs/panel-demo.png)

## ✨ 核心概念

- **分區島嶼**：依內容類型分區（創作島=部落格、影音島=YouTube、講台島=演講、著作島=書籍），之後可自由擴充更多分區。
- **建築即內容**：每一棟建築對應一筆內容紀錄，點擊建築會彈出側邊面板顯示標題、數據、摘要與連結。
- **等級成長**：依內容成效（瀏覽數、出席人數等）自動決定建築大小與星星等級，數字越漂亮、城市越繁榮。
- **資料驅動**：所有分區與內容都讀取 `content.json`，新增內容不需要改程式碼。

## 📂 專案結構

```
portfolio-city/
├── index.html          # 預設首頁：3D 版 (Three.js)
├── city2d.html         # 2D 版 (Phaser)，網址 /city2d.html
├── content.json         # 資料模型：分區 (districts) 與內容項目 (items)
├── src/
│   ├── main3d.js         # 3D 場景：島嶼、Kenney 建築模型、植物裝飾、互動面板
│   ├── ocean3d.js        # 水面 shader 與波浪公式
│   ├── props3d.js        # 碼頭、橋梁、小船、海鷗
│   └── main.js           # 2D 版 Phaser 場景邏輯
├── assets/               # 2D 美術素材 (SVG，原創手繪，可自由替換)
│   ├── models/kenney-city/   # 3D 建築模型 (Kenney City Kit, CC0)
│   ├── building-blog.svg     # 部落格 → 小屋
│   ├── building-youtube.svg  # YouTube → 電視塔
│   ├── building-speech.svg   # 演講 → 露天劇場
│   ├── building-book.svg     # 出書 → 圖書館
│   ├── island-base.svg       # 島嶼基座 (依分區顏色 tint 上色)
│   └── star-badge.svg        # 等級星星徽章
├── vendor/                # 本地化的 Phaser 執行檔 (由 npm postinstall 自動產生)
├── scripts/copy-vendor.js # 安裝後自動複製 Phaser 到 vendor/
└── docs/                 # README 用截圖
```

## 🚀 本機啟動

需求：Node.js 18+

```bash
npm install     # 安裝相依套件，並自動把 Phaser 複製到 vendor/
npm start       # 啟動本機伺服器 (http://localhost:5173)
```

或啟動時自動開啟瀏覽器：

```bash
npm run dev
```

> 3D 版使用 `node_modules/three`，需先執行 `npm install`。若無法使用 npm，也可以用任何靜態伺服器（例如 VS Code 的 Live Server 擴充套件）開啟；2D 版 `city2d.html` 另需 `vendor/phaser.min.js`（可從 `node_modules/phaser/dist/phaser.min.js` 手動複製）。

城市會隨作品數量成長：作品越多，島嶼越大、道路與路燈/長椅越多、解鎖更多設施（噴水池、涼亭、燈塔、摩天輪、第二座碼頭），行人、小船、海鷗也隨之增加。可在網址加上 `?demo=N`（例如 `http://localhost:5173/?demo=6`）為每個區域額外塞入 N 件假作品來預覽。點擊行人會冒出對話氣泡。

## ✏️ 新增你的內容

編輯 `content.json`，在 `items` 陣列中新增一筆資料即可，例如新增一篇部落格文章：

```json
{
  "id": "blog-003",
  "district": "creative",
  "category": "blog",
  "title": "我的新文章標題",
  "date": "2025-01-01",
  "metric": { "views": 8000 },
  "link": "https://your-blog.com/post",
  "description": "一句話摘要。"
}
```

- `district`：對應 `districts` 陣列中的分區 `id`
- `category`：`blog` / `youtube` / `speech` / `book`，決定使用哪個建築美術素材
- `metric`：取第一個數值判斷等級門檻（目前：≥20000 為 Lv.2、≥5000 為 Lv.1、其餘 Lv.0），可在 `src/main.js` 的 `getLevel()` 調整門檻

## 🎨 美術素材說明

目前 `assets/` 內為原創手繪 SVG（等角簡化風格），可直接替換成你自己的美術圖或委外設計稿，只要維持相同檔名與尺寸比例即可無痛替換。SVG 以向量方式載入，縮放不失真。

## 🗺️ 後續可擴充方向

- 時間軸拖曳：依年份動態顯示城市擴張過程
- 更多分區：榮譽廣場（得獎/合作里程碑）、市政中心（關於我/聯絡方式）
- 音效與過場動畫（搭船/起飛切換分區）
- 串接 CMS 或 RSS，自動產生 `content.json`，免手動維護
