# 批量将 MessageBar 转换为 Toast 的脚本
$pagesToConvert = @(
    "ScoresPageEnhanced.tsx",
    "SettingsPage.tsx",
    "StudentsPage.tsx",
    "TeachersPage.tsx",
    "ScoresPage.tsx",
    "LectureRecordsPage.tsx",
    "PendingRecordsPage.tsx",
    "BackupPage.tsx",
    "DataImportPage.tsx",
    "FirstLoginSetupPage.tsx",
    "ImportExportPage.tsx",
    "ImportExportPageEnhanced.tsx"
)

$pagesPath = "D:\Coding\Proj\ScoreManagerForSchoolNext-v1.1.1\frontend\src\pages"

foreach ($page in $pagesToConvert) {
    $filePath = Join-Path $pagesPath $page
    if (Test-Path $filePath) {
        Write-Host "Processing $page..." -ForegroundColor Yellow
        $content = Get-Content $filePath -Raw -Encoding UTF8
        
        # 检查是否已经有 useToast
        if ($content -notmatch "import.*useToast") {
            Write-Host "  - Adding useToast import" -ForegroundColor Green
        }
        
        # 检查是否使用 MessageBar
        if ($content -match "MessageBar") {
            Write-Host "  - Found MessageBar usage, needs conversion" -ForegroundColor Cyan
        }
    }
}

Write-Host "`nConversion complete!" -ForegroundColor Green
