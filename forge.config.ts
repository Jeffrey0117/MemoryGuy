import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { PublisherGithub } from '@electron-forge/publisher-github';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'MemoryGuy',
  },
  rebuildConfig: {},
  makers: [
    // Squirrel.Windows — its RELEASES/.nupkg feed is what update-electron-app consumes.
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin', 'linux']),
  ],
  // Publish the Squirrel artifacts to GitHub Releases so installed apps can auto-update.
  publishers: [
    new PublisherGithub({
      repository: { owner: 'Jeffrey0117', name: 'MemoryGuy' },
      prerelease: false,
      draft: false,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
