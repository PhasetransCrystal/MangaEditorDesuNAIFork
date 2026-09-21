# Changelog

Version numbers apply to **this fork only**, not to upstream Manga Editor Desu.

## Unreleased

- Add 画布 → 导出格式 (PNG / JPEG / WebP) and 导出品质 so a finished page can be saved as a compressed image instead of a multi-hundred-megabyte PNG.
- Bound export size: the longest edge is capped at 8192px and the total at 40MP, so an oversized 下载 DPI no longer produces a failure-prone, gigantic file. Exports that hit the cap show a toast.
- 下载 DPI now has a maximum of 1800 in the UI, and its stored default matches the 300 shown in the menu.
- The project preview thumbnail is written as JPEG at quality 0.8 instead of the implicit 1.0, shrinking saved `.lz4` projects.

## 1.0.3 — 2026-08-31

- Empty-canvas overlay can be dismissed (× / 自己裁剪 / Esc) and is remembered; it no longer blocks custom pages.
- Custom pages now lay a full-page panel, so 切割格子 can slice the page without first picking a template.
- Help → 新手教程 includes the custom-page knife path. Skipping or finishing the tutorial stops the overlay from auto-showing.
- Generate preflight and random-cut copy mention 页面 / 自定义页面, not only 模板.
- Startup no longer persist-dismisses the overlay via the initial blank `loadBookSize`.
- GitHub Release now attaches both the EXE installer and the portable ZIP.

## 1.0.2 — 2026-08-26

- Open each fake UI as its own simulator: chat, video site, danmaku, phone, social, forum, live, image board, visual novel.
- Edit and play inside the simulator; placing on the manga canvas is optional and then shows the canvas.
- Fix CJK lettering so changing fonts actually changes the words on the canvas.
- Beginner empty-canvas hint, clearer autosave restore copy, and story/asset buttons that open the matching simulator.

## 1.0.1 — 2026-08-14

- Add a self-contained Windows EXE installer with Chinese/English UI, Start Menu and optional desktop shortcuts, repair/uninstall support.
- Bundle Python 3.12, Node.js and Pillow so ordinary users do not need to configure a development environment.
- Smoke-test the installed application, local server, Node runtime and color-key cutout service on a Windows GitHub Actions runner.
- Keep rembg and its large model weights optional.

## 1.0.0 — 2026-08-14

First public release as **Manga Editor Desu · nai学长魔改版**.

- Retain the original English name; credit [new-sankaku/manga-editor-desu](https://github.com/new-sankaku/manga-editor-desu); keep GPL-3.0.
- NovelAI-only generation and a Windows one-click local server.
- Simulator workspace, canvas zoom, Chinese beginner layout, local cutout.
