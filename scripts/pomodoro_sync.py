#!/usr/bin/env python3
"""每晚定时任务：番茄回写 Notion + Notion 任务同步到 Google 日历。

使用方式（需代理）:
    set HTTPS_PROXY=http://127.0.0.1:7890
    python pomodoro_sync.py

或由 cc cron 调度时自动传入代理环境变量。
"""

import glob
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone, timedelta

# ---------- 配置 ----------

DOWNLOADS_DIR = os.path.expanduser("~/Downloads")
MARKDOWN_GLOB = "番茄钟-*.md"

GAPI_SCRIPT = (
    "F:/hermess/hermes-home/skills/productivity/"
    "google-workspace/scripts/google_api.py"
)

# Notion 关键 ID
INBOX_DS = "0c6c6a19-21a9-459e-9d65-72a30867ff79"    # 待办库
TASK_DS  = "44f3e88f-845c-4a10-83b4-b3a841dff53a"     # 任务库

TZ = timezone(timedelta(hours=8))


# ---------- 工具 ----------

def gapi(*args):
    """调用 google_api.py，返回 dict 或 list。"""
    env = os.environ.copy()
    env.setdefault("HTTPS_PROXY", "http://127.0.0.1:7890")
    cmd = [sys.executable, GAPI_SCRIPT] + list(args)
    r = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if r.returncode != 0:
        print(f"[gapi] 失败: {r.stderr.strip()}")
        return None
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        print(f"[gapi] 非 JSON 输出: {r.stdout[:200]}")
        return None


def notion(action, **kwargs):
    """占位——cron agent 实际运行时通过 cc 的 mcp__notion__* 工具调用 Notion API。
    此处给出逻辑骨架与注释；具体实现落到 cc prompt 中执行。"""
    # agent 会直接调用 Notion MCP，无需通过 subprocess
    pass


# ---------- A. 番茄回写 ----------

def parse_markdown(path):
    """从导出的 markdown 中提取每一轮 session 的信息。"""
    with open(path, encoding="utf-8") as f:
        text = f.read()

    sessions = []
    # 按 "## 轮次" 分割
    blocks = re.split(r'\n## 轮次 \d+ - ', text)
    if len(blocks) < 2:
        return sessions

    for block in blocks[1:]:
        ses = {}
        # 任务名
        m = re.search(r'\*\*任务：\*\*\s*(.+?)\s*\n', block)
        if m:
            ses['task'] = m.group(1).strip()

        # 完成情况
        m = re.search(r'\*\*完成情况：\*\*\s*(.+?)\s*\n', block)
        if m:
            ses['status'] = m.group(1).strip()

        # 复盘笔记
        m = re.search(r'\*\*📝 复盘笔记：\*\*\s*\n((?:\s*- .+\n?)+)', block)
        if m:
            ses['review'] = m.group(1).strip()

        # 延后想法
        m = re.search(r'\*\*💭 延后想法：\*\*\s*\n((?:\s*- .+\n?)+)', block)
        if m:
            ses['ideas'] = m.group(1).strip()

        # 关联日程
        m = re.search(r'\*\*📅 关联日程：\*\*\s*(.+?)\s*\n', block)
        if m:
            ses['linked_event'] = m.group(1).strip()

        # 阶段产出表
        rows = re.findall(
            r'\| (.+?) \| (.+?) \| (.+?) \|', block
        )
        ses['phases'] = [
            {'phase': r[0].strip(), 'type': r[1].strip(), 'output': r[2].strip()}
            for r in rows
        ]

        sessions.append(ses)

    return sessions


def sync_pomodoro_to_notion(date_str=None):
    """扫描当天导出的 markdown，回写 Notion 任务库。"""
    if date_str is None:
        date_str = datetime.now(TZ).strftime("%Y-%m-%d")

    pattern = os.path.join(DOWNLOADS_DIR, f"番茄钟-{date_str}-*.md")
    files = sorted(glob.glob(pattern))

    if not files:
        print(f"[回写] {date_str} 没有番茄钟导出文件，跳过")
        return

    filepath = files[-1]  # 取当天最后一个导出
    sessions = parse_markdown(filepath)
    print(f"[回写] 从 {os.path.basename(filepath)} 解析到 {len(sessions)} 轮 session")

    for ses in sessions:
        task_name = ses.get('task', '')
        status = ses.get('status', '')
        review = ses.get('review', '')

        if not task_name:
            print(f"[回写] 跳过无任务名的 session")
            continue

        print(f"[回写] 任务: {task_name} | 状态: {status}")
        if review:
            print(f"[回写] 复盘: {review[:80]}...")

        # --- agent 执行（由 cc 在 cron 中通过 Notion MCP 完成）---
        #
        # 1. 查询任务库：FILTER "名称" CONTAINS task_name 且 "日期" = date_str
        # 2. 找到匹配记录后：
        #    - 更新番茄数 += 1
        #    - 更新完成情况 = 映射 status（✅达标/⚠️未达标/⏸️进行中）
        #    - 追加复盘笔记到页面正文（notion-update-page insert_content position=end）
        #
        print(f"[回写] ↑ 上述数据待 cc agent 通过 Notion MCP 写入")


# ---------- B. Notion → Google 日历同步 ----------

def sync_notion_to_gcal(date_str=None):
    """把 Notion 任务库当天有日期的任务同步到 Google 日历。"""
    if date_str is None:
        date_str = datetime.now(TZ).strftime("%Y-%m-%d")

    gcal_events = gapi("calendar", "list",
                       "--start", f"{date_str}T00:00:00+08:00",
                       "--end",   f"{date_str}T23:59:59+08:00")
    if gcal_events is None:
        print("[GCal] 读取日历失败，跳过同步")
        return

    existing = set()
    for ev in gcal_events:
        summary = ev.get("summary", "")
        if "🍅" in summary:
            existing.add(summary.replace("🍅 ", "").strip())

    print(f"[GCal] 当天已有 {len(existing)} 条 pomodoro 任务事件")

    # --- agent 执行（由 cc 在 cron 中通过 Notion MCP 完成）---
    #
    # 1. 查询任务库：FILTER "日期" = date_str 且 "阶段" ≠ "完成"
    # 2. 对每条查询结果：
    #    - 若 task_name 不在 existing 中 → gapi calendar create
    #      --summary "🍅 task_name" --start {date_str}T09:00:00+08:00 --end {date_str}T09:25:00+08:00
    #    - 若 task_name 已在 existing 中 → 跳过（已同步）
    #
    print(f"[GCal] ↑ 同步逻辑待 cc agent 通过 Notion MCP + GAPI 执行")


# ---------- 主入口 ----------

def main():
    today = datetime.now(TZ).strftime("%Y-%m-%d")
    print(f"=== Pomodoro Sync {today} ===")

    print("\n--- A. 番茄回写 ---")
    sync_pomodoro_to_notion(today)

    print("\n--- B. GCal 同步 ---")
    sync_notion_to_gcal(today)

    print("\n=== 完成 ===")


if __name__ == "__main__":
    main()
