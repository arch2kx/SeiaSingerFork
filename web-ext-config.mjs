// web-ext config: keeps the packaged .zip to just what the extension needs at
// runtime, not the TypeScript sources and build tooling that live alongside it.
// The popup uses seia-yurizono-seia.gif, so .gif files must stay in.
export default {
    ignoreFiles: [
        "*.ts",
        "*.d.ts",
        "*.d.ts.map",
        "*.js.map",
        "tsconfig.json",
        "package.json",
        "package-lock.json",
        "README.md",
        "readme/**",
        "frame_00_delay-0.03s.png",
        ".gitattributes",
        "install.log",
        "web-ext-config.mjs",
        "web-ext-artifacts/**"
    ]
};
