const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

function getTypstExecutable() {
  try {
    const platformPkg = require('@flukxr/typst-cli-linux-x64');
    if (platformPkg.typstPath) return platformPkg.typstPath;
    if (platformPkg.executablePath) return platformPkg.executablePath;
  } catch (e) {}
  try {
    const genericPkg = require('@flukxr/typst-cli');
    if (genericPkg.executablePath) return genericPkg.executablePath;
  } catch (e) {}
  return path.join(process.cwd(), 'node_modules', '@flukxr', 'typst-cli-linux-x64', 'bin', 'typst');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const tmpDir = os.tmpdir();
  const fileId = `tepelne_ztraty_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const inputPath = path.join(tmpDir, `${fileId}.typ`);
  const outputPath = path.join(tmpDir, `${fileId}.pdf`);
  const fontsDir = path.join(process.cwd(), 'assets', 'fonts');
  const typstBin = getTypstExecutable();

  try {
    const { typstCode } = req.body || {};
    if (!typstCode || typeof typstCode !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid typstCode string.' });
    }

    if (fs.existsSync(typstBin)) {
      try { fs.chmodSync(typstBin, 0755); } catch (e) {}
    }

    fs.writeFileSync(inputPath, typstCode, 'utf8');

    await execFilePromise(typstBin, ['compile', '--font-path', fontsDir, inputPath, outputPath], {
      timeout: 15000,
      env: { ...process.env, TYPST_FONT_PATHS: fontsDir }
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('PDF output file was not generated.');
    }

    const pdfBuffer = fs.readFileSync(outputPath);

    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (e) {}

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Tepelne_Ztraty_Vypocet.pdf"');
    return res.status(200).send(pdfBuffer);

  } catch (err) {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (e) {}

    const cliDiagnostics = err.stderr ? String(err.stderr) : (err.message || String(err));
    console.error("PDF Export Error:", cliDiagnostics);
    return res.status(500).json({ error: `Kompilace PDF selhala: ${cliDiagnostics}` });
  }
};
