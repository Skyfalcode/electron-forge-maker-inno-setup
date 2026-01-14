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

import { MakerBase, MakerOptions } from "@electron-forge/maker-base";
import InnoSetup, { InnoSetupScriptOptions, InnoSetupSetupOptions } from "@skyfalcode/inno-setup";
import os from "os";
import path from "path";
import fsp from "fs/promises";

/**
 * Configuration object consumed by the Electron Forge maker.
 *
 * - `ISCC`: controls how the Inno Setup Compiler (ISCC) is located/installed.
 * - `ScriptOptions`: partial `.iss` script options merged with defaults derived from Electron Forge.
 */
export type MakerInnoSetupConfig = {
    /**
     * Inno Setup Compiler (ISCC) resolution and lifecycle options.
     */
    ISCC?: {
        /**
         * Controls downloading and installing Inno Setup when ISCC is not found.
         *
         * Supported values:
         * - `string | URL`: download URL for the Inno Setup installer executable.
         * - `boolean`: a truthy value enables download using the default URL from `@skyfalcode/inno-setup`.
         * - `{ url?, uninstall? }`: advanced form allowing a custom URL and whether to uninstall afterwards.
         *
         * Notes:
         * - If omitted or falsy and ISCC cannot be found, the maker rejects with "ISCC not found".
         * - When installation succeeds, the installer executable is removed from the temp directory.
         */
        download?: string | boolean | URL | {
            /**
             * Custom URL for the Inno Setup installer executable.
             * If omitted, the default download behavior from `@skyfalcode/inno-setup` is used.
             */
            url?: string | URL;
            /**
             * When `true` (default), the maker will attempt to uninstall the temporary Inno Setup installation
             * after building the installer.
             */
            uninstall?: boolean;
        };
        /**
         * Explicit path to `ISCC.exe`.
         * If provided, it is used before attempting auto-discovery or download.
         */
        path?: string;
    };
    /**
     * Partial `.iss` script options.
     *
     * The maker will merge these options with defaults derived from the Electron Forge context:
     * - AppName, AppVersion
     * - OutputDir, OutputBaseFilename
     * - Preprocessor defines (appName, dir, makeDir, targetArch, targetPlatform)
     *
     * `Setup` is required, but is merged with the default `Setup` values.
     */
    ScriptOptions?: Partial<Omit<InnoSetupScriptOptions, "Setup">> & {
        /**
         * Partial `[Setup]` directives for the generated script.
         * 
         * See {@linkcode InnoSetupSetupOptions}.
         */
        Setup: Partial<InnoSetupScriptOptions["Setup"]>;
    };
};

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
export default class MakerInnoSetup extends MakerBase<MakerInnoSetupConfig> {
    /**
     * Electron Forge platforms supported by this maker.
     * This maker is Windows-only (`win32`).
     */
    defaultPlatforms: string[] = ["win32"];
    /**
     * Maker name as recognized by Electron Forge.
     */
    name: string = "inno-setup";

    /**
     * Determines whether the maker can run on the current OS.
     * Inno Setup builds require Windows.
     */
    isSupportedOnCurrentPlatform(): boolean {
        return process.platform === "win32";
    };

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
    async make(options: MakerOptions): Promise<string[]> {
        /**
         * Resolves the path to `ISCC.exe` and optionally prepares a temporary Inno Setup installation.
         *
         * The resolved object may include:
         * - `ISCC`: full path to the compiler
         * - `DIR`: install directory used when performing a temporary installation
         * - `uninstall`: whether to run the uninstaller after compilation
         */
        const ISCC = await new Promise<{ DIR?: string; ISCC: string; uninstall?: boolean; }>(async (resolve, reject) => {
            try {
                let ISCC: string | undefined;

                /**
                 * Attempt #1: use a configured ISCC path if provided, otherwise auto-discover it.
                 * Auto-discovery delegates to `InnoSetup.resolveISCCPath()`, which typically uses `where ISCC` on Windows.
                 */
                try {
                    ISCC = this.config.ISCC?.path ?? InnoSetup.resolveISCCPath();
                } catch { };

                /**
                 * If ISCC is already available, return immediately without downloading/installing anything.
                 */
                if (ISCC) return resolve({ ISCC });

                 /**
                 * If ISCC is not found, we may optionally download and install Inno Setup based on config.
                 */
                const download = this.config.ISCC?.download;

                /**
                 * If download behavior is disabled/unset, fail early.
                 */
                if (!download) return reject("ISCC not found");

                /**
                 * Install Inno Setup into a temporary directory under the OS temp folder.
                 * The maker expects ISCC to be located at `${DIR}\\ISCC.exe` after installation.
                 */
                const DIR = path.join(os.tmpdir(), "electron-forge-maker-inno-setup");

                ISCC = path.join(DIR, "ISCC.exe");

                /**
                 * Optional custom download URL and uninstall behavior.
                 * `uninstall` defaults to `true` when using the object form.
                 */
                let url: string | URL | undefined;
                let uninstall: boolean = true;

                if (typeof download == "string" || download instanceof URL) {
                    url = download;
                } else if (typeof download == "object") {
                    url = download.url;
                    uninstall = download.uninstall ?? true;
                };

                /**
                 * Only install if the expected ISCC executable does not already exist in the temp install directory.
                 */
                if (!(await fsp.access(ISCC).then(() => true).catch(() => false))) {
                    /**
                     * Download the Inno Setup installer executable into the system temp folder.
                     * The default URL comes from `@skyfalcode/inno-setup` unless overridden.
                     */
                    const installer = await InnoSetup.download({ dir: os.tmpdir(), url });
                    /**
                     * Run the installer silently, targeting the temp install directory (`DIR`).
                     *
                     * `RESTARTEXITCODE: 3` matches Inno Setup behavior so the maker can detect reboot-required flows.
                     */
                    const code = (await InnoSetup.install({
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
                    if (code === 3) return reject("System restart required by Inno Setup");

                    /**
                     * Any non-zero code is treated as a failed installation.
                     */
                    if (code !== 0) return reject(`The Inno Setup installation failed. Exit code: ${code}`);

                    /**
                     * Cleanup: remove the downloaded installer executable.
                     */
                    await fsp.rm(installer, { force: true });
                };

                /**
                 * Return the resolved ISCC path and temp install directory metadata.
                 */
                resolve({ DIR, ISCC, uninstall });
            } catch (error) {
                /**
                 * Propagate unexpected failures (download/installation/fs errors).
                 */
                reject(error);
            };
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
        function validate(string: string): string {
            return `"${(string.length >= 2 && string.startsWith('"') && string.endsWith('"') ? string.slice(1, -1) : string).replace(/"/g, '""')}"`
        };

        /**
         * Builds the final script options by combining:
         * - Electron Forge context defaults
         * - User-provided overrides from `config.ScriptOptions`
         *
         * Also injects a set of preprocessor defines to make scripts easier to template:
         * - `appName`, `dir`, `makeDir`, `targetArch`, `targetPlatform`
         */
        const ScriptOptions: InnoSetupScriptOptions = {
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
        await (new InnoSetup.InnoSetupScript(ScriptOptions)).run({ ISCC: ISCC.ISCC });

        /**
         * Optionally uninstall the temporary Inno Setup installation (when it was installed for this build).
         * This is best-effort; it is not awaited to avoid blocking the maker result in normal flows.
         */
        if (ISCC.uninstall) InnoSetup.uninstall({
            dir: ISCC.DIR,
            uninstallerCommandLineParameters: {
                NORESTART: true,
                SILENT: true
            }
        });

        /**
         * Return the full path to the generated installer.
         */
        return [path.join(ScriptOptions.Setup.OutputDir!, ScriptOptions.Setup.OutputBaseFilename!)];
    };
};