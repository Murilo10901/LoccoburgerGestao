@echo off
set "ROOT=%~dp0"
set "WINSCP=%ROOT%ferramentas-publicacao\WinSCP-Portable\WinSCP.exe"

if not exist "%WINSCP%" (
  echo WinSCP portatil nao encontrado.
  echo Avise o Codex para baixar novamente a ferramenta de publicacao.
  pause
  exit /b 1
)

start "" "%WINSCP%" /ini=nul "ftp://u535762948@77.37.127.179/"
