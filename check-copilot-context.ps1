# check-copilot-context.ps1
# GitHub Copilot のコンテキストサイズを監視するスクリプト

Write-Host "=== GitHub Copilot コンテキストサイズチェック ===" -ForegroundColor Cyan
Write-Host ""

# 1. 指示ファイルのサイズ
Write-Host "📋 指示ファイル:" -ForegroundColor Yellow
$instructionFiles = @("AGENTS.md", ".github\copilot-instructions.md")
$totalInstructionLines = 0
foreach ($file in $instructionFiles) {
    if (Test-Path $file) {
        $lines = (Get-Content $file | Measure-Object -Line).Lines
        $size = [math]::Round((Get-Item $file).Length/1KB, 2)
        $totalInstructionLines += $lines
        Write-Host "  $file : $lines 行 ($size KB)"
    }
}
Write-Host "  合計: $totalInstructionLines 行" -ForegroundColor Green
Write-Host ""

# 2. コードファイルの統計
Write-Host "💻 コードファイル (.js, .mjs):" -ForegroundColor Yellow
$codeFiles = Get-ChildItem -Recurse -File -Include *.js,*.mjs | Where-Object { $_.DirectoryName -notmatch 'node_modules' }
$codeStats = $codeFiles | Measure-Object -Property Length -Sum
Write-Host "  ファイル数: $($codeStats.Count)"
Write-Host "  合計サイズ: $([math]::Round($codeStats.Sum/1KB, 2)) KB"

# 3. 全ファイル（除外候補込み）
Write-Host ""
Write-Host "📦 ワークスペース全体:" -ForegroundColor Yellow
$allFiles = Get-ChildItem -Recurse -File -Exclude 'node_modules','.git'
$allStats = $allFiles | Measure-Object -Property Length -Sum
Write-Host "  ファイル数: $($allStats.Count)"
Write-Host "  合計サイズ: $([math]::Round($allStats.Sum/1KB, 2)) KB"

# 4. コンパクションリスク評価
Write-Host ""
Write-Host "⚠️  リスク評価:" -ForegroundColor Yellow
$riskLevel = "低"
$riskColor = "Green"
if ($totalInstructionLines -gt 500) {
    $riskLevel = "高"
    $riskColor = "Red"
} elseif ($totalInstructionLines -gt 200) {
    $riskLevel = "中"
    $riskColor = "Yellow"
}
Write-Host "  指示ファイルによるコンパクションリスク: " -NoNewline
Write-Host $riskLevel -ForegroundColor $riskColor

# 推奨値の表示
Write-Host ""
Write-Host "📌 推奨値:" -ForegroundColor Cyan
Write-Host "  - AGENTS.md + copilot-instructions.md: 200行以下（現在: $totalInstructionLines 行）"
Write-Host "  - 1ファイルあたり: 1000行以下"
Write-Host "  - 不要なファイルは .copilotignore で除外"
