param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^(feat|fix|chore|docs)/[a-z0-9-]+$')]
  [string]$Nome
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (git status --porcelain) { throw 'Há alterações locais. Faça commit, guarde-as ou descarte-as antes de criar uma branch.' }
git fetch origin main
git switch main
git pull --ff-only origin main
git switch -c $Nome
Write-Host "Branch criada: $Nome"
