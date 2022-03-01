interface VirtualModule {
  id: string;
  filter: RegExp;
}

export const serverBuildVirtualModule: VirtualModule = {
  id: "@remix-run/dev/server-build",
  filter: /^@remix-run\/dev\/server-build$/,
};

export const assetsManifestVirtualModule: VirtualModule = {
  id: "@remix-run/dev/assets-manifest",
  filter: /^@remix-run\/dev\/assets-manifest$/,
};

export const cssModulesVirtualModule: VirtualModule = {
  id: "@remix-run/dev/modules.css",
  filter: /^@remix-run\/dev\/modules\.css$/,
};
