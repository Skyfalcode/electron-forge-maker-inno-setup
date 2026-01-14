"use strict";
/**
 * @packageDocumentation
 *
 * Electron Forge "maker" that builds Windows installers using **Inno Setup**.
 *
 * This package integrates with Electron Forge's `make` pipeline and generates/compiles an Inno Setup (`.iss`)
 * script using `@skyfalcode/inno-setup`, producing a Windows installer as the output artifact.
 *
 * ⚠️ Credits:
 * This project is a wrapper/automation layer around **Inno Setup**, which is developed and maintained by
 * Jordan Russell and Martijn Laan. Inno Setup itself is not created by this package — all credit for the
 * installer system belongs to its original authors.
 *
 * Inno Setup:
 * - https://jrsoftware.org/
 * - https://jrsoftware.org/isinfo.php
 * - https://jrsoftware.org/ishelp/
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const maker_base_1 = require("@electron-forge/maker-base");
const inno_setup_1 = __importDefault(require("@skyfalcode/inno-setup"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
/**
 * Electron Forge Maker implementation that builds a Windows installer using Inno Setup.
 *
 * Output:
 * - Returns an array containing the path to the generated installer (OutputDir + OutputBaseFilename).
 *
 * Platform support:
 * - Only targets `win32` by default.
 * - `isSupportedOnCurrentPlatform()` ensures the maker only runs on Windows.
 */
class MakerInnoSetup extends maker_base_1.MakerBase {
    constructor() {
        super(...arguments);
        /**
         * Electron Forge platforms supported by this maker.
         * This maker is Windows-only (`win32`).
         */
        this.defaultPlatforms = ["win32"];
        /**
         * Maker name as recognized by Electron Forge.
         */
        this.name = "inno-setup";
    }
    /**
     * Determines whether the maker can run on the current OS.
     * Inno Setup builds require Windows.
     */
    isSupportedOnCurrentPlatform() {
        return process.platform === "win32";
    }
    ;
    /**
     * Main Electron Forge entry point for producing artifacts.
     *
     * Steps:
     * 1. Resolve ISCC (use configured path, auto-discovery, or download+install Inno Setup)
     * 2. Ensure the output directory exists
     * 3. Build `InnoSetupScriptOptions` from defaults + user overrides
     * 4. Compile the `.iss` script using ISCC
     * 5. Optionally uninstall the temporary Inno Setup installation
     * 6. Return the resulting installer path
     */
    async make(options) {
        /**
         * Resolves the path to `ISCC.exe` and optionally prepares a temporary Inno Setup installation.
         *
         * The resolved object may include:
         * - `ISCC`: full path to the compiler
         * - `DIR`: install directory used when performing a temporary installation
         * - `uninstall`: whether to run the uninstaller after compilation
         */
        const ISCC = await new Promise(async (resolve, reject) => {
            try {
                let ISCC;
                /**
                 * Attempt #1: use a configured ISCC path if provided, otherwise auto-discover it.
                 * Auto-discovery delegates to `InnoSetup.resolveISCCPath()`, which typically uses `where ISCC` on Windows.
                 */
                try {
                    ISCC = this.config.ISCC?.path ?? inno_setup_1.default.resolveISCCPath();
                }
                catch { }
                ;
                /**
                 * If ISCC is already available, return immediately without downloading/installing anything.
                 */
                if (ISCC)
                    return resolve({ ISCC });
                /**
                * If ISCC is not found, we may optionally download and install Inno Setup based on config.
                */
                const download = this.config.ISCC?.download;
                /**
                 * If download behavior is disabled/unset, fail early.
                 */
                if (!download)
                    return reject("ISCC not found");
                /**
                 * Install Inno Setup into a temporary directory under the OS temp folder.
                 * The maker expects ISCC to be located at `${DIR}\\ISCC.exe` after installation.
                 */
                const DIR = path_1.default.join(os_1.default.tmpdir(), "electron-forge-maker-inno-setup");
                ISCC = path_1.default.join(DIR, "ISCC.exe");
                /**
                 * Optional custom download URL and uninstall behavior.
                 * `uninstall` defaults to `true` when using the object form.
                 */
                let url;
                let uninstall = true;
                if (typeof download == "string" || download instanceof URL) {
                    url = download;
                }
                else if (typeof download == "object") {
                    url = download.url;
                    uninstall = download.uninstall ?? true;
                }
                ;
                /**
                 * Only install if the expected ISCC executable does not already exist in the temp install directory.
                 */
                if (!(await promises_1.default.access(ISCC).then(() => true).catch(() => false))) {
                    /**
                     * Download the Inno Setup installer executable into the system temp folder.
                     * The default URL comes from `@skyfalcode/inno-setup` unless overridden.
                     */
                    const installer = await inno_setup_1.default.download({ dir: os_1.default.tmpdir(), url });
                    /**
                     * Run the installer silently, targeting the temp install directory (`DIR`).
                     *
                     * `RESTARTEXITCODE: 3` matches Inno Setup behavior so the maker can detect reboot-required flows.
                     */
                    const code = (await inno_setup_1.default.install({
                        installer,
                        setupCommandLineParameters: {
                            DIR,
                            RESTARTEXITCODE: 3,
                            SILENT: true
                        }
                    })).code;
                    /**
                     * Exit code 3 is treated as "restart required".
                     */
                    if (code === 3)
                        return reject("System restart required by Inno Setup");
                    /**
                     * Any non-zero code is treated as a failed installation.
                     */
                    if (code !== 0)
                        return reject(`The Inno Setup installation failed. Exit code: ${code}`);
                    /**
                     * Cleanup: remove the downloaded installer executable.
                     */
                    await promises_1.default.rm(installer, { force: true });
                }
                ;
                /**
                 * Return the resolved ISCC path and temp install directory metadata.
                 */
                resolve({ DIR, ISCC, uninstall });
            }
            catch (error) {
                /**
                 * Propagate unexpected failures (download/installation/fs errors).
                 */
                reject(error);
            }
            ;
        });
        /**
         * Ensure Electron Forge's output directory exists before writing/compiling artifacts.
         */
        await this.ensureDirectory(options.makeDir);
        /**
         * Escapes and quotes values for safe use inside Inno Setup preprocessor `#define` directives.
         *
         * Behavior:
         * - Ensures the returned value is wrapped in quotes
         * - Doubles embedded quotes (`" -> ""`) which matches Inno Setup string escaping rules
         */
        function validate(string) {
            return `"${(string.length >= 2 && string.startsWith('"') && string.endsWith('"') ? string.slice(1, -1) : string).replace(/"/g, '""')}"`;
        }
        ;
        /**
         * Builds the final script options by combining:
         * - Electron Forge context defaults
         * - User-provided overrides from `config.ScriptOptions`
         *
         * Also injects a set of preprocessor defines to make scripts easier to template:
         * - `appName`, `dir`, `makeDir`, `targetArch`, `targetPlatform`
         */
        const ScriptOptions = {
            ...this.config.ScriptOptions,
            Preprocessor: {
                Directives: {
                    "#define": {
                        appName: validate(options.appName),
                        dir: validate(options.dir),
                        makeDir: validate(options.makeDir),
                        targetArch: validate(options.targetArch),
                        targetPlatform: validate(options.targetPlatform),
                        ...this.config.ScriptOptions?.Preprocessor?.Directives?.["#define"]
                    }
                }
            },
            Setup: {
                AppName: options.appName,
                AppVersion: options.packageJSON.version,
                OutputBaseFilename: options.appName,
                OutputDir: options.makeDir,
                ...this.config.ScriptOptions?.Setup
            }
        };
        /**
         * Compile the generated `.iss` script using the resolved ISCC executable.
         */
        await (new inno_setup_1.default.InnoSetupScript(ScriptOptions)).run({ ISCC: ISCC.ISCC });
        /**
         * Optionally uninstall the temporary Inno Setup installation (when it was installed for this build).
         * This is best-effort; it is not awaited to avoid blocking the maker result in normal flows.
         */
        if (ISCC.uninstall)
            inno_setup_1.default.uninstall({
                dir: ISCC.DIR,
                uninstallerCommandLineParameters: {
                    NORESTART: true,
                    SILENT: true
                }
            });
        /**
         * Return the full path to the generated installer.
         */
        return [path_1.default.join(ScriptOptions.Setup.OutputDir, ScriptOptions.Setup.OutputBaseFilename)];
    }
    ;
}
exports.default = MakerInnoSetup;
;
