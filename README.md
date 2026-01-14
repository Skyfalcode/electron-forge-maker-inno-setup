# @skyfalcode/electron-forge-maker-inno-setup

An Electron Forge **maker** that builds **Windows installers** using **Inno Setup**.

This package integrates with Electron Forge’s `make` pipeline and generates/compiles an Inno Setup (`.iss`) script using `@skyfalcode/inno-setup`, producing a `.exe` installer as the output artifact.

> ⚠️ **Credits**  
> This project is a wrapper/automation layer around **Inno Setup**, which is developed and maintained by **Jordan Russell** and **Martijn Laan**.  
> Inno Setup itself is not created by this package — all credit for the installer system belongs to its original authors.

---

## Features

- Electron Forge maker for Windows installers (`.exe`)
- Generates `.iss` scripts programmatically
- Compiles scripts using `ISCC` (Inno Setup Compiler)
- Optional automatic download & silent install of Inno Setup when `ISCC` is not available
- Works nicely in CI/build pipelines

---

## Requirements

- Windows (Inno Setup is Windows-only)
- Electron Forge v7+ (Node.js >= 16.4.0) :contentReference[oaicite:0]{index=0}
- Inno Setup installed **or** allow this maker to download/install it automatically

---

## Installation

```bash
npm install --save-dev @skyfalcode/electron-forge-maker-inno-setup
```

---

## Usage

Add the maker to your Forge config (example using `forge.config.js`):

```js
module.exports = {
  makers: [
    {
      name: "@skyfalcode/electron-forge-maker-inno-setup",
      config: {
        ISCC: {
          /**
           * If ISCC is not found, download and install Inno Setup temporarily.
           * - true: use the default download URL from @skyfalcode/inno-setup
           * - string/URL: use a custom installer URL
           * - object: advanced options
           */
          download: {
            uninstall: true
          }
        },

        /**
         * Partial .iss script options. The maker merges these with defaults
         * derived from Electron Forge (AppName/AppVersion/OutputDir/etc).
         */
        ScriptOptions: {
          Setup: {
            /* Example: DefaultDirName: "{pf}\\MyApp" */
          },

          Files: [
            /* Example: { Source: "dist\\*"; DestDir: "{app}"; Flags: ["recursesubdirs"] } */
          ]
        }
      }
    }
  ]
};
```

Run:

```bash
npm run make
```

The maker returns the generated installer path as the output artifact.

---

## Notes

* This maker targets `win32` and only runs on Windows.
* If `ISCC` is already installed and available in PATH, it will be used automatically.
* If `ISCC` is not found and `ISCC.download` is enabled, the maker can download + install Inno Setup silently into a temp directory and (optionally) uninstall afterwards.

---

## Credits

This package is built on top of **Inno Setup**:

* Official website: [https://jrsoftware.org/](https://jrsoftware.org/)
* Product info: [https://jrsoftware.org/isinfo.php](https://jrsoftware.org/isinfo.php)
* Documentation: [https://jrsoftware.org/ishelp/](https://jrsoftware.org/ishelp/)

Inno Setup is developed and maintained by:

* Jordan Russell
* Martijn Laan

All rights and credit for Inno Setup belong to its authors.

---

## License

MIT — see the LICENSE file for details.