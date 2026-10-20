param([Parameter(Mandatory=$true)][string]$Script,[Parameter(Mandatory=$true)][string]$Request)
$tabbitCli = "$env:LOCALAPPDATA\Tabbit\LocalAgent\bin\tabbit-cli.exe"
$scriptPath = (Resolve-Path -LiteralPath $Script).Path
cmd.exe /d /c "`"$tabbitCli`" nodejs --task paper-huangpu --request-id $Request < `"$scriptPath`""
exit $LASTEXITCODE
