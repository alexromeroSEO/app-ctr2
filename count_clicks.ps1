$csv = Import-Csv "c:\Users\aleja\OneDrive\Escritorio\app ctr\Hoja de cálculo sin título - Hoja 1.csv"

$countGte10 = 0
$countGt10 = 0
$totalRows = 0

foreach ($row in $csv) {
    $totalRows++
    $clicksStr = $row.Clicks -replace '[.,]', ''
    try {
        $clicks = [int]$clicksStr
        if ($clicks -ge 10) {
            $countGte10++
        }
        if ($clicks -gt 10) {
            $countGt10++
        }
    } catch {
        Write-Host "Error parsing clicks: $($row.Clicks)"
    }
}

Write-Host "Total de filas: $totalRows"
Write-Host "Keywords con >= 10 clicks: $countGte10"
Write-Host "Keywords con > 10 clicks: $countGt10"
