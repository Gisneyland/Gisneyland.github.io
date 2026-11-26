import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = resolve(appDir, "android");
const manifestPath = resolve(androidDir, "app/src/main/AndroidManifest.xml");

if (!existsSync(androidDir)) {
  execFileSync("npx", ["cap", "add", "android"], { cwd: appDir, stdio: "inherit" });
}
execFileSync("npx", ["cap", "sync", "android"], { cwd: appDir, stdio: "inherit" });

const capacitorConfig = JSON.parse(readFileSync(resolve(appDir, "capacitor.config.json"), "utf8"));
const javaPackagePath = capacitorConfig.appId.replaceAll(".", "/");
const javaSourceDir = resolve(androidDir, "app/src/main/java", javaPackagePath);
const mainActivityPath = resolve(javaSourceDir, "MainActivity.java");
const downloadsPluginPath = resolve(javaSourceDir, "DownloadsPlugin.java");
copyFileSync(resolve(appDir, "native/DownloadsPlugin.java"), downloadsPluginPath);

let mainActivity = readFileSync(mainActivityPath, "utf8");
if (!mainActivity.includes("registerPlugin(DownloadsPlugin.class)")) {
  const classDeclaration = /public class MainActivity extends BridgeActivity\s*\{/;
  if (!classDeclaration.test(mainActivity)) {
    throw new Error(`Could not find MainActivity declaration in ${mainActivityPath}`);
  }
  mainActivity = mainActivity.replace(
    classDeclaration,
    `public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(DownloadsPlugin.class);
        super.onCreate(savedInstanceState);
    }
`,
  );
  writeFileSync(mainActivityPath, mainActivity);
}

let manifest = readFileSync(manifestPath, "utf8");
const permissions = [
  "android.permission.ACCESS_COARSE_LOCATION",
  "android.permission.ACCESS_FINE_LOCATION",
];
const missingPermissions = permissions.filter(
  (permission) => !manifest.includes(`android:name="${permission}"`),
);

if (missingPermissions.length) {
  const applicationTag = /^([ \t]*)<application\b/m.exec(manifest);
  if (!applicationTag) {
    throw new Error(`Could not find the application tag in ${manifestPath}`);
  }
  const permissionTags = missingPermissions
    .map((permission) => `${applicationTag[1]}<uses-permission android:name="${permission}" />`)
    .join("\n");
  manifest = `${manifest.slice(0, applicationTag.index)}${permissionTags}\n${manifest.slice(applicationTag.index)}`;
  writeFileSync(manifestPath, manifest);
}
