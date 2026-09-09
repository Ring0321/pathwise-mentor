param(
  [string]$ConfigPath = ".\cloud\wrangler.sepath.toml",
  [switch]$CreateConfigFromExample,
  [switch]$SkipGeneratedPlatformSecrets,
  [switch]$OnlyLlmKey
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Convert-SecureStringToPlainText {
  param([securestring]$Secret)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function New-RandomSecret {
  param([int]$ByteLength = 32)

  $bytes = [byte[]]::new($ByteLength)
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToBase64String($bytes)
}

function Read-RequiredSecret {
  param(
    [string]$Name,
    [string]$Prompt
  )

  Write-Host ""
  Write-Host $Prompt
  $secure = Read-Host "Enter $Name" -AsSecureString
  $value = Convert-SecureStringToPlainText $secure
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "$Name is required."
  }
  return $value
}

function Put-WranglerSecret {
  param(
    [string]$Name,
    [string]$Value
  )

  Write-Host "Uploading Cloudflare secret: $Name"
  $Value | & npx wrangler secret put $Name --config $ConfigPath
  if ($LASTEXITCODE -ne 0) {
    throw "wrangler secret put failed for $Name"
  }
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $ProjectRoot

try {
  $exampleConfig = ".\cloud\wrangler.sepath.example.toml"
  if (!(Test-Path $ConfigPath)) {
    if ($CreateConfigFromExample) {
      Copy-Item -LiteralPath $exampleConfig -Destination $ConfigPath -NoClobber
      Write-Host "Created $ConfigPath from $exampleConfig"
      Write-Host "Update D1 database_id, SEPATH_ALLOWED_ORIGINS, LLM_BASE_URL, and LLM_MODEL before deploy."
    } else {
      throw "Missing $ConfigPath. Copy cloud/wrangler.sepath.example.toml first, or rerun with -CreateConfigFromExample."
    }
  }

  $llmApiKey = Read-RequiredSecret `
    -Name "LLM_API_KEY" `
    -Prompt "Paste a fresh model-provider key here. Do not reuse a key that was sent in chat or saved in files."
  Put-WranglerSecret -Name "LLM_API_KEY" -Value $llmApiKey

  if (-not $OnlyLlmKey) {
    if ($SkipGeneratedPlatformSecrets) {
      Write-Host "Skipped platform HMAC secrets by request."
    } else {
      $teacherAccessCode = Read-RequiredSecret `
        -Name "SEPATH_TEACHER_ACCESS_CODE" `
        -Prompt "Enter the teacher console access code for pilot login. Store it outside source control and rotate it if shared."
      Put-WranglerSecret -Name "SEPATH_AUTH_SECRET" -Value (New-RandomSecret)
      Put-WranglerSecret -Name "SEPATH_TEACHER_ACCESS_CODE" -Value $teacherAccessCode
      Put-WranglerSecret -Name "SEPATH_RETURN_SECRET" -Value (New-RandomSecret)
      Put-WranglerSecret -Name "SEPATH_TOKEN_ISSUER_SECRET" -Value (New-RandomSecret)
      Put-WranglerSecret -Name "SEPATH_GITHUB_WEBHOOK_SECRET" -Value (New-RandomSecret)
    }
  }

  Write-Host ""
  Write-Host "Cloudflare secrets are set. No secret values were written to this repository."
  Write-Host "Next: run npm run cloud:smoke:llm, npm run cloud:openapi:validate, then deploy with the same wrangler config."
} finally {
  Pop-Location
}
