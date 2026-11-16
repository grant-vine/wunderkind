param([string]$EvidenceDirectory)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This gate requires native Windows; PowerShell on macOS or Linux is insufficient.' }
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('wunderkind-windows-policy-' + [Guid]::NewGuid().ToString('N'))
if (-not $EvidenceDirectory) { $EvidenceDirectory = Join-Path ([IO.Path]::GetTempPath()) ('wunderkind-policy-evidence-' + [Guid]::NewGuid().ToString('N')) }
$keys = @('WUNDERKIND_WINDOWS_POLICY_UPSTREAM', 'WUNDERKIND_POLICY_TRACE', 'DO_NOT_TRACK', 'OMO_DISABLE_TELEMETRY', 'OMO_DISABLE_POSTHOG')
$previous = @{}
foreach ($key in $keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
$originalLocation = Get-Location
$transcribing = $false
try {
    New-Item -ItemType Directory -Path $temporary | Out-Null
    New-Item -ItemType Directory -Path $EvidenceDirectory | Out-Null
    $EvidenceDirectory = (Resolve-Path $EvidenceDirectory).Path
    Start-Transcript -Path (Join-Path $EvidenceDirectory 'gate-transcript.txt') | Out-Null
    $transcribing = $true
    Set-Location $projectRoot
    $env:DO_NOT_TRACK = '1'
    $env:OMO_DISABLE_TELEMETRY = '1'
    $env:OMO_DISABLE_POSTHOG = '1'
    $env:WUNDERKIND_POLICY_TRACE = '1'
    & git rev-parse HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot identify source revision' }
    & node --version
    & bun --version
    Write-Output 'Budgets: sync child=15s; installer child=45s; integration tests and CLI envelope=90s.'
    & bun install --frozen-lockfile --ignore-scripts
    if ($LASTEXITCODE -ne 0) { throw 'Frozen dependency installation failed' }
    & bun run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
    & bunx tsc --noEmit
    if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }
    $graphs = @(
        @{ Version = '5.1.70'; Integrity = '01c7Sqmoa0ZepREO/3tAsRb4QkcA1H+LheOJVO0Z9MxCVRs9FPk2fGvIFrtkGhMgHkkyYqrolPonRb9ZjB4BEQ=='; Purpose = 'historical Windows regression' },
        @{ Version = '5.1.72'; Integrity = 'APsLZX2BcVs8V0QmcSX8SDvBBg8jtRvnXdZ+ozDq23vK+tpwEsBk1Z0nYdXaDhnzSF9qSnUqUcOuU+dlTCmckQ=='; Purpose = 'current packaged graph' }
    )
    $results = @()
    foreach ($graph in $graphs) {
        $timer = [Diagnostics.Stopwatch]::StartNew()
        Write-Output ("Graph begin: " + $graph.Version + ' (' + $graph.Purpose + ')')
        $graphRoot = Join-Path $temporary $graph.Version
        New-Item -ItemType Directory -Path $graphRoot | Out-Null
        $archive = Join-Path $graphRoot 'upstream.tgz'
        Invoke-WebRequest -Uri ("https://registry.npmjs.org/oh-my-openagent/-/oh-my-openagent-" + $graph.Version + '.tgz') -OutFile $archive
        $hash = [Security.Cryptography.SHA512]::Create()
        try { $actual = [Convert]::ToBase64String($hash.ComputeHash([IO.File]::ReadAllBytes($archive))) }
        finally { $hash.Dispose() }
        if ($actual -ne $graph.Integrity) { throw ('Pinned archive integrity mismatch: ' + $graph.Version) }
        & tar -xzf $archive -C $graphRoot
        if ($LASTEXITCODE -ne 0) { throw 'Archive extraction failed' }
        $env:WUNDERKIND_WINDOWS_POLICY_UPSTREAM = Join-Path $graphRoot 'package'
        & bun test tests/unit/codex-policy-manifest.test.ts tests/unit/codex-policy-native.test.ts
        if ($LASTEXITCODE -ne 0) { throw ('Native tests failed for ' + $graph.Version + '; CLI smoke cannot replace them') }
        & node tests/unit/helpers/run-native-policy-smoke.mjs $env:WUNDERKIND_WINDOWS_POLICY_UPSTREAM
        if ($LASTEXITCODE -ne 0) { throw ('Disposable CLI policy action failed for ' + $graph.Version) }
        $timer.Stop()
        $results += @{ version = $graph.Version; status = 'pass'; elapsedMs = $timer.ElapsedMilliseconds }
        $results | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $EvidenceDirectory 'graphs.json')
        Write-Output ("Graph pass: " + $graph.Version + '; elapsedMs=' + $timer.ElapsedMilliseconds)
    }
    Write-Output 'Disposable native Windows gate passed for BOTH graphs; fixture host metadata, no inference. Live policy repair remains on hold pending acceptance review.'
} finally {
    Set-Location $originalLocation
    foreach ($key in $keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
    if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Recurse -Force }
    if ($transcribing) { Stop-Transcript | Out-Null }
    Write-Output "Gate evidence retained at: $EvidenceDirectory"
}
