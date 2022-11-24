interface VirtualModule {
  id: string;
  filter: RegExp;
}

export const serverBuildVirtualModule: VirtualModule = {
  id: "@remix-run/dev/server-build",
  filter: /^@remix-run\/dev\/server-build$/,
};

export const cssBuildVirtualModule: VirtualModule = {
  id: "@remix-run/dev/css-build",
  filter: /^@remix-run\/dev\/css-build$/,
};

export const assetsManifestVirtualModule: VirtualModule = {
  id: "@remix-run/dev/assets-manifest",
  filter: /^@remix-run\/dev\/assets-manifest$/,
};
