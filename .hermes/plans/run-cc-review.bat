@echo off
cd /d F:\hermess\projects\pomodoro
echo [CC Review] 正在启动 Claude Code 审查计划...
echo.
call claude -p "请阅读 .hermes/plans/2026-06-20_150000-gcal-calendar-link.md 和 .hermes/plans/cc-review-prompt.txt，按 cc-review-prompt.txt 的要求审查并修改计划文档" --max-turns 25
echo.
echo [CC Review] 进程已结束
pause
