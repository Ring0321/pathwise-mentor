param(
  [string]$SourceDocx = "",
  [string]$OutputPdf = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($SourceDocx)) {
  $sourceItem = Get-ChildItem -LiteralPath $root -Recurse -Filter "SE-Path*.docx" |
    Sort-Object Length -Descending |
    Select-Object -First 1
  if ($null -eq $sourceItem) {
    throw "Source DOCX not found. Pass -SourceDocx explicitly."
  }
  $source = $sourceItem.FullName
}
else {
  $source = Join-Path $root $SourceDocx
}

if ([string]::IsNullOrWhiteSpace($OutputPdf)) {
  $output = Join-Path $root "submission-artifacts\SE-Path_product_design_v0.2.pdf"
}
else {
  $output = Join-Path $root $OutputPdf
}
$outputDir = Split-Path -Parent $output

if (-not (Test-Path -LiteralPath $source)) {
  throw "Source DOCX not found: $source"
}

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$word = $null
$doc = $null

try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0

  $doc = $word.Documents.Open($source, $false, $true)

  foreach ($field in $doc.Fields) {
    $field.Update() | Out-Null
  }

  foreach ($toc in $doc.TablesOfContents) {
    $toc.Update() | Out-Null
  }

  $wdExportFormatPDF = 17
  $wdExportOptimizeForPrint = 0
  $wdExportAllDocument = 0
  $wdExportDocumentContent = 0
  $wdExportCreateHeadingBookmarks = 1

  $doc.ExportAsFixedFormat(
    $output,
    $wdExportFormatPDF,
    $false,
    $wdExportOptimizeForPrint,
    $wdExportAllDocument,
    1,
    1,
    $wdExportDocumentContent,
    $true,
    $true,
    $wdExportCreateHeadingBookmarks,
    $true,
    $true,
    $false
  )

  [pscustomobject]@{
    source = $source
    output = $output
    bytes = (Get-Item -LiteralPath $output).Length
  } | ConvertTo-Json -Compress
}
finally {
  if ($doc -ne $null) {
    try {
      $doc.Close($false) | Out-Null
    }
    catch {
      Write-Warning "Word document close reported a COM cleanup warning."
    }
    try {
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) | Out-Null
    }
    catch {
      Write-Warning "Word document COM release reported a cleanup warning."
    }
  }
  if ($word -ne $null) {
    try {
      $word.Quit() | Out-Null
    }
    catch {
      Write-Warning "Word application quit reported a COM cleanup warning."
    }
    try {
      [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    catch {
      Write-Warning "Word application COM release reported a cleanup warning."
    }
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
