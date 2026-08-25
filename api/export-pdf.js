const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

function getTypstExecutable() {
  const binName = os.platform() === 'win32' ? 'typst.exe' : 'typst';
  const localBin = path.join(process.cwd(), 'bin', binName);
  if (fs.existsSync(localBin)) {
    return localBin;
  }
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
      return res.status(400).json({ error: 'Chybí nebo je neplatný řetězec typstCode.' });
    }

    if (fs.existsSync(typstBin)) {
      try { fs.chmodSync(typstBin, 0o755); } catch (e) {}
    }

    // 1. Write markup to temporary file on disk
    fs.writeFileSync(inputPath, typstCode, 'utf8');

    // 2. Execute PURE native CLI compilation
    const args = ['compile'];
    if (fs.existsSync(fontsDir)) {
      args.push('--font-path', fontsDir);
    }
    args.push(inputPath, outputPath);

    const envObj = { ...process.env };
    if (fs.existsSync(fontsDir)) {
      envObj.TYPST_FONT_PATHS = fontsDir;
    }

    await execFilePromise(typstBin, args, {
      timeout: 15000,
      env: envObj
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Nativní CLI proběhlo, ale výstupní PDF soubor nebyl vytvořen.');
    }

    const pdfBuffer = fs.readFileSync(outputPath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Tepelne_Ztraty_Vypocet.pdf"');
    return res.status(200).send(pdfBuffer);

  } catch (err) {
    const cliDiagnostics = err.stderr ? String(err.stderr) : (err.message || String(err));
    console.error("Pure CLI Export Error:", cliDiagnostics);
    return res.status(500).json({ error: `Kompilace PDF selhala: ${cliDiagnostics}` });
  } finally {
    // Clean up temporary files in finally block
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (e) {}
  }
};
