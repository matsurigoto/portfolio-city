// 將安裝好的 Phaser 套件複製一份到 vendor/，供 index.html 以純靜態檔案方式載入
// 這樣即使沒有 bundler，也能在任何靜態伺服器 (http-server、GitHub Pages...) 上直接執行
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "phaser", "dist", "phaser.min.js");
const destDir = path.join(__dirname, "..", "vendor");
const dest = path.join(destDir, "phaser.min.js");

if (!fs.existsSync(src)) {
  console.warn("[copy-vendor] 找不到 node_modules/phaser，略過複製。請確認已執行 npm install。");
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log("[copy-vendor] 已複製 phaser.min.js 到 vendor/");
