# Changelog

## [Unreleased]

### Changed
- 基于 frontend-design SKILL 的设计哲学，完成 CSS 标准化清理：
  - 将 `src/style.css` 中 `:root` 外残留的硬编码颜色（音量滑块、GCal 区、remove-mode、hover 态等）全部替换为 CSS 变量。
  - 新增 `--c-surface-hover`、`--c-surface-muted`、`--c-slider-track*` 等补充 token。
  - 将 `index.html` 中所有 inline style 迁移到 CSS 类，HTML 恢复为纯结构语义。
  - 新增 `.action-row`、`.modal.wide`、`.settings-row`、`.checkbox-label`、`.ai-test-result` 等工具类。
- 音量滑块改用品牌紫蓝渐变，与整体视觉统一。

### Fixed
- GCal 选中态、connected 状态、remove-mode 等颜色不再与品牌色板脱节。

## [Earlier]

- 见 Git 提交历史：逐步引入 `:root` CSS 设计令牌（品牌色、强调色、中性色、状态色、圆角/阴影/过渡）。
