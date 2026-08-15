# DSH Prompt Enhancer — 一键安装（PowerShell 包装）
# 用法：powershell -ExecutionPolicy Bypass -File install.ps1 [dshCheckoutPath]
param([string]$DshPath)
$ErrorActionPreference = 'Stop'
$DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($DshPath) { & node "$DIR\install.mjs" $DshPath } else { & node "$DIR\install.mjs" }
