
import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const platformConfig: Record<
  string,
  {
    staticName: string;
    bundleDir: string;
    matcher: RegExp;
  }
> = {
  windows: {
    staticName: 'VisioNode_Setup_x64.exe',
    bundleDir: 'nsis',
    matcher: /\.exe$/i
  },
  msi: {
    staticName: 'VisioNode_Setup_x64.msi',
    bundleDir: 'msi',
    matcher: /\.msi$/i
  },
  macos: {
    staticName: 'VisioNode.dmg',
    bundleDir: 'dmg',
    matcher: /\.dmg$/i
  },
  linux: {
    staticName: 'VisioNode.AppImage',
    bundleDir: 'appimage',
    matcher: /\.appimage$/i
  }
};

function findTauriInstaller(platform: string): string | null {
  const config = platformConfig[platform];
  if (!config) return null;

  const bundlePath = path.join(
    process.cwd(),
    'src-tauri',
    'target',
    'release',
    'bundle',
    config.bundleDir
  );

  if (!fs.existsSync(bundlePath)) {
    return null;
  }

  const files = fs.readdirSync(bundlePath);
  const exactMatch = files.find((file) => file === config.staticName);
  if (exactMatch) {
    return path.join(bundlePath, exactMatch);
  }

  const fuzzyMatch = files.find((file) => config.matcher.test(file));
  return fuzzyMatch ? path.join(bundlePath, fuzzyMatch) : null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get('platform');

  if (!platform || !platformConfig[platform]) {
    return NextResponse.json(
      {
        error: 'PLATFORM_NOT_FOUND',
        message: 'Spécifiez une plateforme valide.'
      },
      { status: 400 }
    );
  }

  const { staticName } = platformConfig[platform];
  const publicInstallerPath = path.join(
    process.cwd(),
    'public',
    'installers',
    staticName
  );

  if (fs.existsSync(publicInstallerPath)) {
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(`${origin}/installers/${staticName}`, 302);
  }

  const fallbackPath = findTauriInstaller(platform);
  if (fallbackPath) {
    const fileStream = fs.createReadStream(fallbackPath);
    const webStream = fileStream as unknown as ReadableStream<Uint8Array>;
    const fileSize = fs.statSync(fallbackPath).size;
    const headers = new Headers({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${path.basename(fallbackPath)}"`,
      'Content-Length': fileSize.toString()
    });
    return new Response(webStream, { status: 200, headers });
  }

  return NextResponse.json(
    {
      error: 'FILE_NOT_FOUND',
      message: `Le fichier ${staticName} est absent du serveur. Assurez-vous de l'avoir ajouté dans /public/installers/ avant le push.`
    },
    { status: 404 }
  );
}

