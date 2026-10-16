param([Parameter(Mandatory)][string]$Binary)
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true') { throw 'Startup cancellation runs only in Windows CI' }
$binaryPath = (Resolve-Path -LiteralPath $Binary).Path
$enginePath = Join-Path (Split-Path -Parent $binaryPath) 'engine/dechord-engine.exe'
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('dechord-cancel-' + [guid]::NewGuid())
$null = New-Item -ItemType Directory -Path $temporary
$previousReport = $env:DECHORD_SMOKE_REPORT
$appProcess = $null
$engineProcess = $null
try {
    $env:DECHORD_SMOKE_REPORT = Join-Path $temporary 'ready.json'
    $appProcess = Start-Process -FilePath $binaryPath -PassThru -WindowStyle Hidden -WorkingDirectory $temporary
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        $engineProcess = Get-CimInstance Win32_Process -Filter "ParentProcessId=$($appProcess.Id)" |
            Where-Object { $_.ExecutablePath -eq $enginePath } | Select-Object -First 1
        if ($engineProcess) { break }
        Start-Sleep -Milliseconds 100
    } while ([DateTime]::UtcNow -lt $deadline)
    if (-not $engineProcess) { throw 'Desktop did not spawn its bundled engine' }
    Start-Sleep -Milliseconds 500
    if (Test-Path -LiteralPath (Join-Path $temporary 'ready.json')) { throw 'Cancellation did not occur during startup' }
    Stop-Process -Id $appProcess.Id -Force
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    while (Get-Process -Id $engineProcess.ProcessId -ErrorAction SilentlyContinue) {
        if ([DateTime]::UtcNow -ge $deadline) { throw 'Engine survived desktop termination during native startup' }
        Start-Sleep -Milliseconds 100
    }
    Write-Output 'Native Windows job terminated the engine during cold startup'
} finally {
    $env:DECHORD_SMOKE_REPORT = $previousReport
    foreach ($owned in @($appProcess, $engineProcess)) {
        if (-not $owned) { continue }
        $ownedId = if ($owned -is [Diagnostics.Process]) { $owned.Id } else { $owned.ProcessId }
        Stop-Process -Id $ownedId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    $resolved = (Resolve-Path -LiteralPath $temporary).Path
    $tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
    if (-not $resolved.StartsWith($tempRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe test cleanup path' }
    if ((Get-Item -LiteralPath $resolved -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked test directory' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
