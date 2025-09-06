{\rtf1\ansi\ansicpg1252\cocoartf2761
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const express = require('express');\
const multer = require('multer');\
const path = require('path');\
const fs = require('fs');\
const \{ v4: uuidv4 \} = require('uuid');\
const sqlite3 = require('sqlite3').verbose();\
\
const app = express();\
const PORT = process.env.PORT || 3000;\
\
// Initialize DB\
const db = new sqlite3.Database('./galleries.db');\
\
db.serialize(() => \{\
  db.run(`\
    CREATE TABLE IF NOT EXISTS galleries (\
      id TEXT PRIMARY KEY,\
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP\
    )\
  `);\
  db.run(`\
    CREATE TABLE IF NOT EXISTS photos (\
      id INTEGER PRIMARY KEY AUTOINCREMENT,\
      gallery_id TEXT,\
      filename TEXT,\
      selected INTEGER DEFAULT 0,\
      FOREIGN KEY(gallery_id) REFERENCES galleries(id)\
    )\
  `);\
\});\
\
// Serve static files\
app.use(express.static('public'));\
\
// Multer storage: preserve original name\
const storage = multer.diskStorage(\{\
  destination: (req, file, cb) => \{\
    const galleryId = req.params.galleryId || uuidv4(); // fallback for root upload\
    const uploadPath = `./uploads/$\{galleryId\}`;\
    if (!fs.existsSync(uploadPath)) \{\
      fs.mkdirSync(uploadPath, \{ recursive: true \});\
    \}\
    cb(null, uploadPath);\
  \},\
  filename: (req, file, cb) => \{\
    cb(null, file.originalname);\
  \}\
\});\
\
const upload = multer(\{ storage \});\
\
// Route: Create new gallery + upload\
app.post('/api/gallery', upload.array('photos'), (req, res) => \{\
  const galleryId = uuidv4();\
  const uploadPath = `./uploads/$\{galleryId\}`;\
  \
  if (!fs.existsSync(uploadPath)) \{\
    fs.mkdirSync(uploadPath, \{ recursive: true \});\
  \}\
\
  // Save gallery\
  db.run(`INSERT INTO galleries (id) VALUES (?)`, [galleryId]);\
\
  // Save each photo\
  req.files.forEach(file => \{\
    db.run(`INSERT INTO photos (gallery_id, filename) VALUES (?, ?)`, \
      [galleryId, file.originalname]);\
  \});\
\
  const url = `$\{req.protocol\}://$\{req.get('host')\}/gallery.html?id=$\{galleryId\}`;\
  res.json(\{ galleryId, url \});\
\});\
\
// Route: Get photos in gallery\
app.get('/api/gallery/:id', (req, res) => \{\
  const \{ id \} = req.params;\
  db.all(`SELECT filename, selected FROM photos WHERE gallery_id = ?`, [id], (err, rows) => \{\
    if (err) return res.status(500).json(\{ error: err.message \});\
    res.json(rows);\
  \});\
\});\
\
// Route: Toggle photo selection\
app.post('/api/gallery/:id/select', express.json(), (req, res) => \{\
  const \{ id \} = req.params;\
  const \{ filename, selected \} = req.body;\
\
  db.run(\
    `UPDATE photos SET selected = ? WHERE gallery_id = ? AND filename = ?`,\
    [selected ? 1 : 0, id, filename],\
    function(err) \{\
      if (err) return res.status(500).json(\{ error: err.message \});\
      res.json(\{ success: true \});\
    \}\
  );\
\});\
\
// Route: Download selection list\
app.get('/api/gallery/:id/download', (req, res) => \{\
  const \{ id \} = req.params;\
  db.all(`SELECT filename FROM photos WHERE gallery_id = ? AND selected = 1`, [id], (err, rows) => \{\
    if (err) return res.status(500).json(\{ error: err.message \});\
\
    const list = rows.map(r => r.filename).join('\\n');\
    res.setHeader('Content-Type', 'text/plain');\
    res.setHeader('Content-Disposition', `attachment; filename="selected_photos_$\{id\}.txt"`);\
    res.send(list);\
  \});\
\});\
\
app.listen(PORT, () => \{\
  console.log(`PhotoSelect Pro running on http://localhost:$\{PORT\}`);\
\});}