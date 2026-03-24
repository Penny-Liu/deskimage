import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import mammoth from "mammoth";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "radportal.db");
console.log(`Connecting to database at: ${dbPath}`);
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
const upload = multer({ 
  storage: storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.docx', '.doc', '.mp4', '.mov', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

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

try {
  // Add 'updates' column for maintenance history if it doesn't exist
  // It stores a JSON string array of { timestamp, content, reporter }
  db.exec(`ALTER TABLE maintenance_logs ADD COLUMN updates TEXT DEFAULT '[]'`);
} catch (err: any) {
  // Ignore error if column already exists (sqlite error: duplicate column name)
  if (!err.message.includes('duplicate column name')) {
    console.warn("Could not add updates column:", err);
  }
}

// Guideline files table (multi-file support)
db.exec(`
  CREATE TABLE IF NOT EXISTS guideline_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guideline_id INTEGER REFERENCES disease_guidelines(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'image', 'pdf', 'word', 'video', 'word_html'
    original_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration: Add new columns if they don't exist (for existing DBs)
try {
  db.prepare("ALTER TABLE disease_guidelines ADD COLUMN image_url TEXT").run();
} catch (e) { /* Column likely exists */ }
try {
  db.prepare("ALTER TABLE disease_guidelines ADD COLUMN reference_cases TEXT").run();
} catch (e) { /* Column likely exists */ }
try {
  // is_featured: stores the date (YYYY-MM-DD) when marked for today's sharing, or null
  db.prepare("ALTER TABLE disease_guidelines ADD COLUMN is_featured TEXT DEFAULT NULL").run();
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
  const PORT = 3001;

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
      const info = db.prepare("INSERT INTO maintenance_logs (type, device, content, status, reporter, updates) VALUES (?, ?, ?, ?, ?, '[]')").run(type, device, content, status, reporter);
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
      db.prepare("UPDATE maintenance_logs SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, reporter = ? WHERE id = ?").run(reporter, id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // 8. Add Maintenance Progress Update
  app.post("/api/maintenance/:id/update", (req, res) => {
    try {
      const { content, reporter } = req.body;
      if (!content || !reporter) return res.status(400).json({ error: "Content and reporter required" });
      
      const log = db.prepare("SELECT updates FROM maintenance_logs WHERE id = ?").get(req.params.id) as any;
      if (!log) return res.status(404).json({ error: "Record not found" });

      let parsedUpdates: any[] = [];
      try {
        parsedUpdates = JSON.parse(log.updates || '[]');
      } catch (e) {
        parsedUpdates = [];
      }

      parsedUpdates.push({
        timestamp: new Date().toISOString(),
        content,
        reporter
      });

      db.prepare(`
        UPDATE maintenance_logs 
        SET updates = ? 
        WHERE id = ?
      `).run(JSON.stringify(parsedUpdates), req.params.id);

      res.json({ success: true });
    } catch (error) {
      console.error(error);
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

  // 9. Create/Update Guideline (with multi-file upload)
  app.post("/api/guidelines", upload.array('files', 10), async (req, res) => {
    try {
      const { id, category, title, content, keywords, reference_cases } = req.body;
      const files = req.files as Express.Multer.File[] | undefined;

      let guidelineId: number | string = id;

      if (id) {
        db.prepare("UPDATE disease_guidelines SET category = ?, title = ?, content = ?, keywords = ?, reference_cases = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(category, title, content, keywords, reference_cases, id);
      } else {
        const info = db.prepare("INSERT INTO disease_guidelines (category, title, content, keywords, reference_cases) VALUES (?, ?, ?, ?, ?)")
          .run(category, title, content, keywords, reference_cases);
        guidelineId = info.lastInsertRowid as number;
      }

      // Process uploaded files
      if (files && files.length > 0) {
        for (const file of files) {
          const ext = path.extname(file.originalname).toLowerCase();
          let fileType = 'image';
          let fileUrl = `/uploads/${file.filename}`;

          if (['.pdf'].includes(ext)) {
            fileType = 'pdf';
          } else if (['.mp4', '.mov', '.webm'].includes(ext)) {
            fileType = 'video';
          } else if (['.docx', '.doc'].includes(ext)) {
            // Convert Word to HTML for browser preview
            try {
              const result = await mammoth.convertToHtml({ path: file.path });
              const htmlFilename = file.filename + '.html';
              const htmlPath = path.join(uploadDir, htmlFilename);
              fs.writeFileSync(htmlPath, result.value);
              fileUrl = `/uploads/${htmlFilename}`;
              fileType = 'word_html';
            } catch (convErr) {
              fileType = 'word';
              console.error("Word conversion failed:", convErr);
            }
          } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
            fileType = 'image';
          }

          db.prepare("INSERT INTO guideline_files (guideline_id, file_url, file_type, original_name) VALUES (?, ?, ?, ?)")
            .run(guidelineId, fileUrl, fileType, file.originalname);
        }
      }

      res.json({ success: true, id: guidelineId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // 10. Get Files for a Guideline
  app.get("/api/guidelines/:id/files", (req, res) => {
    try {
      const rows = db.prepare("SELECT * FROM guideline_files WHERE guideline_id = ? ORDER BY created_at ASC").all(req.params.id);
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // 10b. Toggle Today's Featured Status
  app.post("/api/guidelines/:id/feature", (req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const row = db.prepare("SELECT is_featured FROM disease_guidelines WHERE id = ?").get(req.params.id) as any;
      if (!row) return res.status(404).json({ error: "Not found" });
      const alreadyFeatured = row.is_featured === today;
      db.prepare("UPDATE disease_guidelines SET is_featured = ? WHERE id = ?")
        .run(alreadyFeatured ? null : today, req.params.id);
      res.json({ featured: !alreadyFeatured });
    } catch (error) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // 11. Delete a Guideline File
  app.delete("/api/guidelines/:id/files/:fileId", (req, res) => {
    try {
      const file = db.prepare("SELECT * FROM guideline_files WHERE id = ? AND guideline_id = ?").get(req.params.fileId, req.params.id) as any;
      if (!file) return res.status(404).json({ error: "File not found" });
      // Delete from filesystem
      const fullPath = path.join(uploadDir, path.basename(file.file_url));
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      db.prepare("DELETE FROM guideline_files WHERE id = ?").run(req.params.fileId);
      res.json({ success: true });
    } catch (error) {
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

export { startServer };

if (process.env.NODE_ENV !== 'test' && !process.env.ELECTRON) {
  startServer();
}
