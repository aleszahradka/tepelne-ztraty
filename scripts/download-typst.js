import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { execSync } from 'child_process';

const TYPST_VERSION = 'v0.13.0';
const BIN_DIR = path.join(process.cwd(), 'bin');

function getReleaseAssetInfo() {
  const platform = os.platform();
  const arch = os.arch();

  let target = '';
  let extension = 'tar.xz';

  if (platform === 'win32') {
    extension = 'zip';
    if (arch === 'x64') target = 'x86_64-pc-windows-msvc';
    else if (arch === 'arm64') target = 'aarch64-pc-windows-msvc';
    else target = 'i686-pc-windows-msvc';
  } else if (platform === 'darwin') {
    extension = 'tar.gz';
    if (arch === 'arm64') target = 'aarch64-apple-darwin';
    else target = 'x86_64-apple-darwin';
  } else if (platform === 'linux') {
    extension = 'tar.xz';
    if (arch === 'x64') target = 'x86_64-unknown-linux-musl';
    else if (arch === 'arm64') target = 'aarch64-unknown-linux-musl';
    else if (arch === 'arm') target = 'armv7-unknown-linux-musleabi';
  }

  if (!target) {
    throw new Error(`Unsupported platform/architecture: ${platform}/${arch}`);
  }

  const filename = `typst-${target}.${extension}`;
  const url = `https://github.com/typst/typst/releases/download/${TYPST_VERSION}/${filename}`;
  return { url, filename, extension, platform };
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const followRedirect = (currentUrl) => {
      https.get(currentUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return followRedirect(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to download ${currentUrl}: HTTP ${res.statusCode}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve());
        });
        file.on('error', (err) => {
          fs.unlink(dest, () => reject(err));
        });
      }).on('error', (err) => {
        reject(err);
      });
    };
    followRedirect(url);
  });
}

async function main() {
  try {
    if (!fs.existsSync(BIN_DIR)) {
      fs.mkdirSync(BIN_DIR, { recursive: true });
    }

    const binaryName = os.platform() === 'win32' ? 'typst.exe' : 'typst';
    const binaryPath = path.join(BIN_DIR, binaryName);

    if (fs.existsSync(binaryPath)) {
      console.log(`[download-typst] Typst binary already exists at ${binaryPath}`);
      return;
    }

    const { url, filename, extension, platform } = getReleaseAssetInfo();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'typst-download-'));
    const archivePath = path.join(tempDir, filename);

    console.log(`[download-typst] Downloading Typst CLI ${TYPST_VERSION} from ${url}...`);
    await downloadFile(url, archivePath);

    console.log(`[download-typst] Extracting archive...`);
    if (platform === 'win32') {
      const extractDir = path.join(tempDir, 'extracted');
      execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractDir}' -Force"`);

      const findBinary = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (fs.statSync(fullPath).isDirectory()) {
            const found = findBinary(fullPath);
            if (found) return found;
          } else if (file === 'typst.exe') {
            return fullPath;
          }
        }
        return null;
      };

      const foundPath = findBinary(extractDir);
      if (!foundPath) {
        throw new Error('typst.exe not found inside extracted zip');
      }

      fs.copyFileSync(foundPath, binaryPath);
    } else {
      execSync(`tar -xf "${archivePath}" -C "${tempDir}"`);
      const findBinary = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          if (fs.statSync(fullPath).isDirectory()) {
            const found = findBinary(fullPath);
            if (found) return found;
          } else if (file === 'typst') {
            return fullPath;
          }
        }
        return null;
      };

      const foundPath = findBinary(tempDir);
      if (!foundPath) {
        throw new Error('typst binary not found in extracted tarball');
      }

      fs.copyFileSync(foundPath, binaryPath);
      fs.chmodSync(binaryPath, 0o755);
    }

    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`[download-typst] Typst CLI binary successfully installed to ${binaryPath}`);
  } catch (err) {
    console.error(`[download-typst] Warning/Error downloading Typst binary:`, err.message);
  }
}

main();
