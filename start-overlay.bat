@echo off
rem Launch the Claude Usage Overlay. Clears ELECTRON_RUN_AS_NODE just in case
rem the parent shell had it set (Claude Code's own runtime does).
cd /d "%~dp0"
set "ELECTRON_RUN_AS_NODE="
call "node_modules\.bin\electron.cmd" .
