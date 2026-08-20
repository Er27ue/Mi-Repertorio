$ErrorActionPreference = "Stop"

$androidRoot = (Resolve-Path $PSScriptRoot).Path
$projectRoot = (Resolve-Path (Join-Path $androidRoot "..")).Path
$appRoot = Join-Path $androidRoot "app"
$sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$buildTools = Join-Path $sdkRoot "build-tools\36.0.0"
$platformJar = Join-Path $sdkRoot "platforms\android-37.0\android.jar"
$javaBin = "C:\Program Files\Android\Android Studio\jbr\bin"
$manualBuild = [System.IO.Path]::GetFullPath((Join-Path $appRoot "build\manual"))
$apkOutput = Join-Path $appRoot "build\outputs\apk\debug"
$assetsOutput = Join-Path $appRoot "src\main\assets\public"
$keyStore = Join-Path $androidRoot "mi-repertorio-release.jks"
$env:JAVA_HOME = Split-Path $javaBin -Parent
$env:Path = "$javaBin;$env:Path"

if (-not $manualBuild.StartsWith($androidRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "La carpeta temporal queda fuera del proyecto Android."
}

$requiredFiles = @(
    (Join-Path $buildTools "aapt2.exe"),
    (Join-Path $buildTools "aapt.exe"),
    (Join-Path $buildTools "d8.bat"),
    (Join-Path $buildTools "zipalign.exe"),
    (Join-Path $buildTools "apksigner.bat"),
    $platformJar,
    (Join-Path $javaBin "javac.exe"),
    (Join-Path $javaBin "keytool.exe")
)
foreach ($requiredFile in $requiredFiles) {
    if (-not (Test-Path -LiteralPath $requiredFile)) { throw "Falta: $requiredFile" }
}

Push-Location $projectRoot
try {
    & npm.cmd run build --workspace client -- --mode android
    if ($LASTEXITCODE -ne 0) { throw "No se pudo compilar la interfaz." }
} finally {
    Pop-Location
}

if (-not $assetsOutput.StartsWith($androidRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "La carpeta de assets queda fuera del proyecto Android."
}
if (Test-Path -LiteralPath $assetsOutput) {
    Remove-Item -LiteralPath $assetsOutput -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $assetsOutput | Out-Null
Copy-Item -Path (Join-Path $projectRoot "client\dist\*") -Destination $assetsOutput -Recurse -Force

if (Test-Path -LiteralPath $manualBuild) {
    Remove-Item -LiteralPath $manualBuild -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $manualBuild | Out-Null
$classesDir = New-Item -ItemType Directory -Force -Path (Join-Path $manualBuild "classes")
$dexDir = New-Item -ItemType Directory -Force -Path (Join-Path $manualBuild "dex")
$compiledResources = Join-Path $manualBuild "resources.zip"
$localPlatformJar = Join-Path $manualBuild "android.jar"
$unsignedApk = Join-Path $manualBuild "unsigned.apk"
$alignedApk = Join-Path $manualBuild "aligned.apk"
$sourceFile = Join-Path $appRoot "src\main\java\com\mirepertorio\app\MainActivity.java"
$manifestFile = Join-Path $appRoot "src\main\AndroidManifest.xml"
$resourcesDir = Join-Path $appRoot "src\main\res"
$assetsDir = Join-Path $appRoot "src\main\assets"
Copy-Item -LiteralPath $platformJar -Destination $localPlatformJar -Force

& (Join-Path $buildTools "aapt2.exe") compile --dir $resourcesDir -o $compiledResources
if ($LASTEXITCODE -ne 0) { throw "No se pudieron compilar los recursos Android." }

& (Join-Path $buildTools "aapt2.exe") link -o $unsignedApk -I $localPlatformJar --manifest $manifestFile --min-sdk-version 24 --target-sdk-version 36 --version-code 4 --version-name 1.3 -R $compiledResources --auto-add-overlay
if ($LASTEXITCODE -ne 0) { throw "No se pudo crear la base del APK." }

& (Join-Path $javaBin "jar.exe") uf $unsignedApk -C (Join-Path $appRoot "src\main") "assets"
if ($LASTEXITCODE -ne 0) { throw "No se pudieron agregar los archivos de la interfaz." }

& (Join-Path $javaBin "javac.exe") -encoding UTF-8 -source 8 -target 8 -classpath $localPlatformJar -d $classesDir.FullName $sourceFile
if ($LASTEXITCODE -ne 0) { throw "No se pudo compilar la actividad Android." }

$classFile = Join-Path $classesDir.FullName "com\mirepertorio\app\MainActivity.class"
& (Join-Path $buildTools "d8.bat") --lib $localPlatformJar --min-api 24 --output $dexDir.FullName $classFile
if ($LASTEXITCODE -ne 0) { throw "No se pudo generar classes.dex." }

Copy-Item -LiteralPath (Join-Path $dexDir.FullName "classes.dex") -Destination (Join-Path $manualBuild "classes.dex") -Force
Push-Location $manualBuild
try {
    & (Join-Path $buildTools "aapt.exe") add $unsignedApk "classes.dex"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo agregar el código al APK." }
} finally {
    Pop-Location
}

& (Join-Path $buildTools "zipalign.exe") -f 4 $unsignedApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "No se pudo alinear el APK." }

if (-not (Test-Path -LiteralPath $keyStore)) {
    & (Join-Path $javaBin "keytool.exe") -genkeypair -noprompt -keystore $keyStore -storepass android -keypass android -alias mi-repertorio -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Mi Repertorio, O=Personal, C=DO"
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear la firma de la app." }
}

New-Item -ItemType Directory -Force -Path $apkOutput | Out-Null
$finalApk = Join-Path $apkOutput "Mi-Repertorio.apk"
& (Join-Path $buildTools "apksigner.bat") sign --ks $keyStore --ks-pass pass:android --key-pass pass:android --ks-key-alias mi-repertorio --out $finalApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw "No se pudo firmar el APK." }

& (Join-Path $buildTools "apksigner.bat") verify --verbose $finalApk
if ($LASTEXITCODE -ne 0) { throw "La verificación de firma falló." }

Write-Output "APK_READY=$finalApk"
