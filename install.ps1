# DSH Prompt Enhancer 一键安装（PowerShell 包装）
# 本地仓库模式：执行同目录 install.mjs（git clone 后）
# 远程模式：自动下载 install.mjs 后执行
#
# 用法：powershell -ExecutionPolicy Bypass -File install.ps1 [dshCheckoutPath] [--skip-build] [--with-web]
param(
  [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
  [string[]]$PassedArgs
)
$ErrorActionPreference = 'Stop'
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$local = Join-Path $DIR 'install.mjs'

if (Test-Path $local) {
  if ($PassedArgs.Count -gt 0) { & node $local @PassedArgs } else { & node $local }
  exit $LASTEXITCODE
}

$BASE = 'https://raw.githubusercontent.com/spiceemilissa502-max/dsh-prompt-enhancer/main'
$TMP = Join-Path $env:TEMP ("dsh-pe-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $TMP | Out-Null
try {
  Invoke-WebRequest -Uri "$BASE/install.mjs" -OutFile (Join-Path $TMP 'install.mjs') -UseBasicParsing
  if ($PassedArgs.Count -gt 0) { & node (Join-Path $TMP 'install.mjs') @PassedArgs } else { & node (Join-Path $TMP 'install.mjs') }
} finally {
  Remove-Item -Recurse -Force $TMP -ErrorAction SilentlyContinue
}
