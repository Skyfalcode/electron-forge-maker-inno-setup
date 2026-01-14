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
import { InnoSetupScriptOptions } from "@skyfalcode/inno-setup";
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
    defaultPlatforms: string[];
    /**
     * Maker name as recognized by Electron Forge.
     */
    name: string;
    /**
     * Determines whether the maker can run on the current OS.
     * Inno Setup builds require Windows.
     */
    isSupportedOnCurrentPlatform(): boolean;
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
    make(options: MakerOptions): Promise<string[]>;
}
//# sourceMappingURL=MakerInnoSetup.d.ts.map