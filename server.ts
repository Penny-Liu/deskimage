import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "radportal.db");
const db = new Database(dbPath);

// Configure Multer for file uploads
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
  CREATE TABLE IF NOT EXISTS worklogs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS maintenance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, -- 'routine' or 'fault'
    device TEXT,
    content TEXT,
    status TEXT, -- 'normal', 'urgent', 'critical', 'resolved'
    reporter TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
  );
  CREATE TABLE IF NOT EXISTS disease_guidelines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    title TEXT,
    content TEXT,
    keywords TEXT,
    image_url TEXT,
    reference_cases TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add new columns if they don't exist (for existing DBs)
try {
  db.prepare("ALTER TABLE disease_guidelines ADD COLUMN image_url TEXT").run();
} catch (e) { /* Column likely exists */ }
try {
  db.prepare("ALTER TABLE disease_guidelines ADD COLUMN reference_cases TEXT").run();
} catch (e) { /* Column likely exists */ }


// Seed default guidelines
const seedData = [
  { category: '肝膽系統', title: '脂肪肝 (Fatty Liver)', content: '【超音波特徵】\n1. 肝臟回音(Echogenicity)增強，比腎皮質(Renal cortex)亮。\n2. 深部音波衰減(Attenuation)，深處看不清楚。\n3. 肝內血管模糊(Vessel blurring)。\n\n【分級標準】\n- Mild: 稍微變亮，血管仍清晰。\n- Moderate: 變亮，血管模糊，深部稍暗。\n- Severe: 很亮，深部全黑，無法看清橫膈膜。\n\n【建議】\n建議控制飲食與運動，定期追蹤。', keywords: 'fatty liver, 肝臟, 脂肪肝' },
  { category: '肝膽系統', title: '肝囊腫 (Hepatic Cyst)', content: '【超音波特徵】\n1. 無回音(Anechoic)圓形病灶。\n2. 後壁增強效應(Posterior enhancement)。\n3. 邊界清晰平滑。\n\n【鑑別診斷】\n若內部有雜質或分隔(Septum)，需排除膿瘍或腫瘤可能。\n\n【建議】\n良性病灶，通常不需處理，定期追蹤大小變化即可。', keywords: 'cyst, 水泡, 囊腫' },
  { category: '肝膽系統', title: '膽結石 (Gallstone)', content: '【超音波特徵】\n1. 膽囊內強回音(Hyperechoic)病灶。\n2. 後方伴隨聲影(Acoustic shadow)。\n3. 隨姿勢改變移動(Rolling stone sign)。\n\n【鑑別診斷】\n膽囊息肉(Polyp)通常固定不動且無聲影。\n\n【建議】\n無症狀者定期追蹤，若有膽絞痛(Biliary colic)建議至一般外科評估。', keywords: 'stone, 結石, 膽囊' },
  { category: '泌尿系統', title: '腎結石 (Renal Stone)', content: '【超音波特徵】\n1. 強回音(Hyperechoic)亮點或弧形。\n2. 後方伴隨聲影(Acoustic shadow)。\n3. 可能伴隨腎水腫(Hydronephrosis)。\n\n【掃描技巧】\n若結石太小(<0.3cm)可能無聲影，可調整Focus位置或改用高頻探頭確認。\n\n【建議】\n多喝水，若有腰痛血尿請至泌尿科就診。', keywords: 'stone, 結石, 腎臟' },
  { category: '泌尿系統', title: '腎囊腫 (Renal Cyst)', content: '【超音波特徵】\n1. 圓形無回音(Anechoic)病灶。\n2. 壁薄且平滑。\n3. 後壁增強效應(Posterior enhancement)。\n\n【Bosniak 分級】\n- Type I: 單純囊腫(Simple cyst)，良性。\n- Type II: 微小鈣化或分隔(Septum)。\n- Type III/IV: 厚壁、實心成分，需懷疑惡性。\n\n【建議】\n單純囊腫通常良性，定期追蹤即可。', keywords: 'cyst, 水泡, 腎臟' },
  { category: '甲狀腺', title: '甲狀腺結節 (Thyroid Nodule)', content: '【TI-RADS 分級重點】\n1. Composition: 實心/囊性/海綿狀\n2. Echogenicity: 低回音/高回音\n3. Shape: 寬大於高(好)/高大於寬(壞)\n4. Margin: 平滑/不規則\n5. Echogenic Foci: 鈣化點\n\n【建議】\nTI-RADS 3以上建議定期追蹤，4以上建議穿刺檢查。', keywords: 'nodule, 結節, 甲狀腺' },
  { category: '乳房', title: '乳房囊腫 (Breast Cyst)', content: '【超音波特徵】\n1. 圓形或橢圓形無回音(Anechoic)。\n2. 邊界清晰。\n3. 後壁增強效應。\n\n【BI-RADS 分級】\n單純囊腫通常歸類為 BI-RADS 2 (良性)。\n\n【建議】\n良性發現，定期追蹤。若有症狀可考慮抽吸。', keywords: 'cyst, 水泡, 乳房' },
  { category: '攝護腺', title: '攝護腺肥大 (BPH)', content: '【超音波特徵】\n1. 攝護腺體積增大(>20-25ml)。\n2. 移行區(Transition zone)擴大。\n3. 可能伴隨膀胱小樑化(Trabeculation)或餘尿(Residual urine)。\n\n【測量公式】\n體積 = 長 x 寬 x 高 x 0.52\n\n【建議】\n至泌尿科評估，依症狀嚴重度決定藥物或手術治療。', keywords: 'BPH, 攝護腺, 前列腺' }
];

const checkGuideline = db.prepare("SELECT id FROM disease_guidelines WHERE title = ?");
const insertGuideline = db.prepare("INSERT INTO disease_guidelines (category, title, content, keywords) VALUES (?, ?, ?, ?)");

seedData.forEach(d => {
  if (!checkGuideline.get(d.title)) {
    insertGuideline.run(d.category, d.title, d.content, d.keywords);
  }
});

const initSettings = db.prepare("SELECT value FROM settings WHERE key = ?").get("announcement");
if (!initSettings) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
    "announcement",
    "⚠️ [注意] 系統升級為全院同步版 | 📌 請使用管理員模式更新此公告 | 🌟 衛耗材盤點於週五進行"
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // --- API Routes ---

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // 1. Get Announcement
  app.get("/api/announcement", (req, res) => {
    try {
      const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("announcement") as { value: string } | undefined;
      res.json({ text: row?.value || "" });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // 2. Update Announcement
  app.post("/api/announcement", (req, res) => {
    try {
      const { text } = req.body;
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("announcement", text);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // 3. Get Work Logs (Last 50)
  app.get("/api/worklogs", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM worklogs ORDER BY created_at DESC LIMIT 50").all();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // 4. Create Work Log
  app.post("/api/worklogs", (req, res) => {
    try {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: "Content required" });
      
      const info = db.prepare("INSERT INTO worklogs (content) VALUES (?)").run(content);
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // 5. Get Maintenance Logs
  app.get("/api/maintenance", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM maintenance_logs ORDER BY created_at DESC LIMIT 50").all();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // 6. Create Maintenance Log
  app.post("/api/maintenance", (req, res) => {
    try {
      const { type, device, content, status, reporter } = req.body;
      const info = db.prepare("INSERT INTO maintenance_logs (type, device, content, status, reporter) VALUES (?, ?, ?, ?, ?)").run(type, device, content, status, reporter);
      res.json({ id: info.lastInsertRowid, success: true });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // 7. Resolve Maintenance Log
  app.post("/api/maintenance/:id/resolve", (req, res) => {
    try {
      const { id } = req.params;
      const { reporter } = req.body;
      db.prepare("UPDATE maintenance_logs SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, content = content || '\n[修復紀錄] ' || ? WHERE id = ?").run(reporter ? `由 ${reporter} 回報修復` : '已修復', id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // 8. Get Guidelines
  app.get("/api/guidelines", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM disease_guidelines ORDER BY category, title").all();
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // 9. Create/Update Guideline
  app.post("/api/guidelines", upload.single('image'), (req, res) => {
    try {
      const { id, category, title, content, keywords, reference_cases } = req.body;
      const image_url = req.file ? `/uploads/${req.file.filename}` : undefined;

      if (id) {
        let sql = "UPDATE disease_guidelines SET category = ?, title = ?, content = ?, keywords = ?, reference_cases = ?, updated_at = CURRENT_TIMESTAMP";
        const params = [category, title, content, keywords, reference_cases];
        
        if (image_url) {
          sql += ", image_url = ?";
          params.push(image_url);
        }
        
        sql += " WHERE id = ?";
        params.push(id);
        
        db.prepare(sql).run(...params);
      } else {
        db.prepare("INSERT INTO disease_guidelines (category, title, content, keywords, image_url, reference_cases) VALUES (?, ?, ?, ?, ?, ?)").run(category, title, content, keywords, image_url || null, reference_cases);
      }
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // --- Vite Middleware ---
  // API 404 Handler
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: Serve static files
    const distPath = path.join(__dirname, "dist");
    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
