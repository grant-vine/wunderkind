$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This gate requires native Windows; PowerShell on macOS or Linux is insufficient.' }
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('wunderkind-windows-policy-' + [Guid]::NewGuid().ToString('N'))
$keys = @('WUNDERKIND_WINDOWS_POLICY_UPSTREAM', 'DO_NOT_TRACK', 'OMO_DISABLE_TELEMETRY', 'OMO_DISABLE_POSTHOG')
$previous = @{}
foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
$originalLocation = Get-Location
try {
    New-Item -ItemType Directory -Path $temporary | Out-Null
    Set-Location $projectRoot
    $env:DO_NOT_TRACK = '1'
    $env:OMO_DISABLE_TELEMETRY = '1'
    $env:OMO_DISABLE_POSTHOG = '1'
    $archive = Join-Path $temporary 'upstream.tgz'
    Invoke-WebRequest -Uri 'https://registry.npmjs.org/oh-my-openagent/-/oh-my-openagent-5.1.70.tgz' -OutFile $archive
    $hash = [Security.Cryptography.SHA512]::Create()
    try { $actual = [Convert]::ToBase64String($hash.ComputeHash([IO.File]::ReadAllBytes($archive))) }
    finally { $hash.Dispose() }
    if ($actual -ne '01c7Sqmoa0ZepREO/3tAsRb4QkcA1H+LheOJVO0Z9MxCVRs9FPk2fGvIFrtkGhMgHkkyYqrolPonRb9ZjB4BEQ==') { throw 'Pinned upstream archive integrity mismatch' }
    & tar -xzf $archive -C $temporary
    if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed' }
    $env:WUNDERKIND_WINDOWS_POLICY_UPSTREAM = Join-Path $temporary 'package'
    & bun install --frozen-lockfile --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw 'Frozen dependency installation failed' }
    & bun run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
    & bunx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }
    & bun test tests/unit/codex-policy-manifest.test.ts tests/unit/codex-policy-native.test.ts
    if ($LASTEXITCODE -ne 0) { throw 'Native policy regression tests failed' }
    & node tests/unit/helpers/run-native-policy-smoke.mjs $env:WUNDERKIND_WINDOWS_POLICY_UPSTREAM
    if ($LASTEXITCODE -ne 0) { throw 'Disposable CLI policy action failed' }
    Write-Output 'Native Windows policy gate passed. Host discovery was fixture metadata; no Codex inference was invoked.'
} finally {
    Set-Location $originalLocation
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
}
