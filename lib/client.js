/**
 * dsh-avatar — 消息头像（browser 半边）
 *
 * 两件事：
 *   1. 把配置渲染成 CSS 注入页面（助手头像挂左、用户头像挂右）；
 *   2. 在设置面板注册一个独立页，可上传图片、调尺寸/间距/形状/贴边偏移。
 *
 * 三个踩过的坑，写在注释里免得再犯：
 *   - `content: url(img)` 在 Chrome 里生成的是「内容图像」，不吃 width/height，
 *     必须 `content:""` + `background-image`；
 *   - `::before` 默认 inline，宽高圆角全失效，必须显式 `display:block`；
 *   - padding 不是 absolute 定位的基准，想挪贴边头像只能改 right/left 偏移值。
 */
window.__ModuleLoader__.load({
  id: "dsh-avatar",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    let react = require("react");

    const inject = ["slots"];
    const API = "/api/dsh-avatar";
    const STYLE_ID = "dsh-avatar-css";
    /** 用户侧基准：让滑块 0 = 当前拉齐位置（UI 上不暴露这个数字）。 */
    const RIGHT_BASE = 7;

        /**
     * 两边默认共用同一个灰白剪影占位：SVG 运行时编码，零网络请求、零版权素材。
     * 想换图去设置页上传——图片存在 dsh home 的 storage 里，不进代码库。
     */
    const DEFAULT_AVATAR =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">'
        + '<rect width="40" height="40" fill="#c9ced3"/>'
        + '<circle cx="20" cy="15.5" r="9" fill="#767c84"/>'
        + '<path d="M1 40c0-8.9 8.5-13.5 19-13.5S39 31.1 39 40z" fill="#767c84"/>'
        + "</svg>"
      );
    const DEFAULT_ASSISTANT = DEFAULT_AVATAR;
    const DEFAULT_USER = DEFAULT_AVATAR;

    const DEFAULTS = {
      enabled: true,
      size: 42,
      gap: 12,
      radius: 0,
      leftInset: 0,
      rightInset: 0,
      assistant: DEFAULT_ASSISTANT,
      user: DEFAULT_USER,
    };

    let state = { ...DEFAULTS };

    // ── 订阅（设置页与 CSS 之间的桥）──
    const listeners = new Set();
    function emit() {
      applyCss();
      for (const listener of listeners) {
        try { listener(); } catch (error) { /* 单个订阅者出错不影响其他人 */ }
      }
    }
    function subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }

    async function load() {
      try {
        // 带时间戳破缓存：浏览器会长期缓存 /api 响应，导致配置改了却不重载（cache:no-store 对它不灵）
        const res = await fetch(API + "?t=" + Date.now(), { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const cfg = data && data.config ? data.config : {};
        state = { ...DEFAULTS, ...cfg };
        if (typeof state.assistant !== "string" || state.assistant === "") state.assistant = DEFAULT_ASSISTANT;
        if (typeof state.user !== "string" || state.user === "") state.user = DEFAULT_USER;
      } catch (error) {
        console.error("[dsh-avatar] load failed, using defaults: " + (error instanceof Error ? error.message : String(error)));
        state = { ...DEFAULTS };
      }
      emit();
    }

    async function save(patch) {
      state = { ...state, ...patch };
      emit();
      try {
        await fetch(API, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(state),
        });
      } catch (error) {
        console.error("[dsh-avatar] save failed: " + (error instanceof Error ? error.message : String(error)));
      }
    }

    // ── CSS 渲染 ──
    function buildCss() {
      const cfg = state;
      if (cfg.enabled === false) return "";
      const size = Math.round(cfg.size);
      const gap = Math.round(cfg.gap);
      const pad = size + gap;
      const radius = Math.round(cfg.radius);
      const minHeight = size + 16;
      const mobile = Math.max(16, Math.round(size * 0.65));
      const mobileMinHeight = mobile + 12;
      const mobilePad = mobile + Math.max(6, Math.round(gap * 0.75));

      const rule = (anchor, prop, url, side) => {
        const image = typeof url === "string" && url !== ""
          ? 'background-image: url("' + url + '");'
          : "background-image: none;";
        const edge = side === "right"
          ? "right: " + -(RIGHT_BASE + Math.round(cfg.rightInset)) + "px;"
          : "left: " + Math.round(cfg.leftInset) + "px;";
        return [
          // min-height 必须跟着 size 走：头像 absolute 不占文档流，行高不足就会压到下一行
          "[" + anchor + "] { position: relative !important; padding-" + prop + ": " + pad
            + "px !important; min-height: " + minHeight + "px !important; }",
          "[" + anchor + "]::before {",
          '  content: "" !important;',
          "  display: block !important;",
          "  position: absolute !important; " + edge,
          "  width: " + size + "px !important; height: " + size + "px !important;",
          "  border-radius: " + radius + "px !important;",
          "  background-size: cover !important;",
          "  background-repeat: no-repeat !important;",
          "  background-position: center !important;",
          "  " + image,
          "  background-color: rgba(127, 127, 127, 0.14) !important;",
          "  user-select: none !important; pointer-events: none !important;",
          "}",
        ].join("\n");
      };

      return [
        rule('class*="hWmORq_root"', "left", cfg.assistant, "left"),
        rule('class*="Sixlwa_userRow"', "right", cfg.user, "right"),
        "/* 移动端没有两侧把手沟槽，外伸偏移会跑出屏幕 → 归零 */",
        "@media (max-width: 560px) {",
        '  [class*="hWmORq_root"] { padding-left: ' + mobilePad + 'px !important; min-height: ' + mobileMinHeight + 'px !important; }',
        '  [class*="hWmORq_root"]::before { width: ' + mobile + 'px !important; height: ' + mobile + 'px !important; }',
        '  [class*="Sixlwa_userRow"] { padding-right: ' + mobilePad + 'px !important; min-height: ' + mobileMinHeight + 'px !important; }',
        '  [class*="Sixlwa_userRow"]::before { width: ' + mobile + 'px !important; height: ' + mobile + 'px !important; right: 0 !important; }',
        "}",
      ].join("\n");
    }

    function applyCss() {
      const css = buildCss();
      if (css === "") {
        const old = document.getElementById(STYLE_ID);
        if (old) old.remove();
        return;
      }
      let style = document.getElementById(STYLE_ID);
      if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = css;
    }

    // ── 设置页 UI ──
    const LABEL = { fontSize: "12px", color: "var(--dsw-alias-label-primary)" };
    const HINT = { fontSize: "11px", color: "var(--dsw-alias-label-tertiary)" };

    function Slider(props) {
      return react.createElement(
        "label",
        { style: { display: "block", marginBottom: "12px" } },
        react.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" } },
          react.createElement("span", { style: LABEL }, props.label),
          react.createElement(
            "span",
            { style: { fontSize: "12px", color: "var(--dsw-alias-state-business-primary)" } },
            String(props.value) + (props.unit || "")
          )
        ),
        react.createElement("input", {
          type: "range",
          min: props.min,
          max: props.max,
          step: props.step || 1,
          value: props.value,
          style: { width: "100%" },
          onChange: (event) => props.onChange(Number(event.target.value)),
        })
      );
    }

    function pickImage(onPick) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (file.size > 6 * 1024 * 1024) {
          window.alert("图片太大啦，上限 6MB");
          return;
        }
        const reader = new FileReader();
        reader.onload = () => onPick(String(reader.result));
        reader.onerror = () => window.alert("读取图片失败");
        reader.readAsDataURL(file);
      };
      input.click();
    }

    const CROP_BOX = 240;

    function CropDialog(props) {
      const [zoom, setZoom] = react.useState(1);
      const [pos, setPos] = react.useState({ x: 0, y: 0 });
      const [natural, setNatural] = react.useState(null);
      const drag = react.useRef(null);

      react.useEffect(() => {
        const img = new Image();
        img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = props.src;
      }, [props.src]);

      const base = natural ? Math.max(CROP_BOX / natural.w, CROP_BOX / natural.h) : 0;   // cover：默认填满方框，长图不露空边
      const dispW = natural ? natural.w * base * zoom : 0;
      const dispH = natural ? natural.h * base * zoom : 0;

      const onDown = (event) => {
        drag.current = { px: event.clientX, py: event.clientY, ox: pos.x, oy: pos.y };
        event.currentTarget.setPointerCapture(event.pointerId);
      };
      const onMove = (event) => {
        if (!drag.current) return;
        setPos({
          x: drag.current.ox + (event.clientX - drag.current.px),
          y: drag.current.oy + (event.clientY - drag.current.py),
        });
      };
      const onUp = () => { drag.current = null; };

      const confirm = () => {
        const img = new Image();
        img.onload = () => {
          const OUT = 256;
          const scale = OUT / CROP_BOX;
          const canvas = document.createElement("canvas");
          canvas.width = OUT;
          canvas.height = OUT;
          const g = canvas.getContext("2d");
          const b = Math.max(CROP_BOX / img.naturalWidth, CROP_BOX / img.naturalHeight);
          const w = img.naturalWidth * b * zoom;
          const h = img.naturalHeight * b * zoom;
          g.drawImage(
            img,
            (pos.x + (CROP_BOX - w) / 2) * scale,
            (pos.y + (CROP_BOX - h) / 2) * scale,
            w * scale,
            h * scale
          );
          props.onDone(canvas.toDataURL("image/png"));
        };
        img.src = props.src;
      };

      return react.createElement(
        "div",
        { style: { padding: "10px 0" } },
        react.createElement("div", { style: LABEL }, props.title || "裁剪头像"),
        react.createElement(
          "div",
          {
            style: {
              position: "relative",
              width: CROP_BOX + "px",
              height: CROP_BOX + "px",
              overflow: "hidden",
              background: "rgba(127,127,127,0.12)",
              border: "1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.35))",
              cursor: "grab",
              touchAction: "none",
              marginBottom: "10px",
            },
            onPointerDown: onDown,
            onPointerMove: onMove,
            onPointerUp: onUp,
            onPointerCancel: onUp,
          },
          natural
            ? react.createElement("img", {
                src: props.src,
                draggable: false,
                style: {
                  position: "absolute",
                  left: pos.x + (CROP_BOX - dispW) / 2 + "px",
                  top: pos.y + (CROP_BOX - dispH) / 2 + "px",
                  width: dispW + "px",
                  height: dispH + "px",
                  pointerEvents: "none",
                  userSelect: "none",
                },
              })
            : null
        ),
        react.createElement(Slider, {
          label: "缩放",
          value: Math.round(zoom * 100),
          min: 100,
          max: 300,
          unit: "%",
          onChange: (value) => setZoom(value / 100),
        }),
        react.createElement("div", { style: HINT }, "默认已填满方框：拖动挑位置、拉滑块缩放，想裁哪一块就挪到哪；确定后按正方形裁切。"),
        react.createElement(
          "div",
          { style: { display: "flex", gap: "8px", marginTop: "10px" } },
          react.createElement("button", { type: "button", onClick: confirm }, "确定"),
          react.createElement("button", { type: "button", onClick: props.onCancel, style: { opacity: 0.7 } }, "取消")
        )
      );
    }

    function ImageRow(props) {
      const [cropSrc, setCropSrc] = react.useState(null);

      const preview = react.createElement("div", {
        style: {
          width: "52px",
          height: "52px",
          borderRadius: Math.round(state.radius) + "px",
          backgroundImage: props.value ? 'url("' + props.value + '")' : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "rgba(127,127,127,0.14)",
          border: "1px solid var(--dsw-alias-border-weak, rgba(127,127,127,0.3))",
          flex: "0 0 auto",
        },
      });
      const buttons = react.createElement(
        "div",
        { style: { display: "flex", gap: "6px", marginTop: "6px" } },
        react.createElement("button", { type: "button", onClick: () => pickImage((dataUri) => setCropSrc(dataUri)) }, "上传图片"),
        react.createElement(
          "button",
          { type: "button", onClick: props.onClear, style: { opacity: 0.7 } },
          props.clearLabel || "恢复默认"
        )
      );

      if (cropSrc) {
        return react.createElement(CropDialog, {
          src: cropSrc,
          title: "裁剪 · " + props.label,
          onDone: (dataUri) => { setCropSrc(null); props.onPick(dataUri); },
          onCancel: () => setCropSrc(null),
        });
      }

      return react.createElement(
        "div",
        { style: { display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "16px" } },
        preview,
        react.createElement(
          "div",
          null,
          react.createElement("div", { style: LABEL }, props.label),
          buttons
        )
      );
    }

    function AvatarSettingsPage() {
      const [, force] = react.useReducer((n) => n + 1, 0);
      react.useEffect(() => subscribe(force), []);

      const enabled = state.enabled !== false;
      const size = Math.round(state.size);
      const gap = Math.round(state.gap);
      const radius = Math.round(state.radius);
      const leftInset = Math.round(state.leftInset);
      const rightInset = Math.round(state.rightInset);

      return react.createElement(
        "div",
        { style: { padding: "4px 0", maxWidth: "520px" } },
        react.createElement(
          "label",
          { style: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", cursor: "pointer" } },
          react.createElement("input", {
            type: "checkbox",
            checked: enabled,
            onChange: (event) => save({ enabled: event.target.checked }),
          }),
          react.createElement("span", { style: LABEL }, "启用消息头像")
        ),
        enabled
          ? react.createElement(
              "div",
              null,
              react.createElement(ImageRow, {
                label: "助手头像（挂在回复左侧）",
                value: state.assistant,
                onPick: (dataUri) => save({ assistant: dataUri }),
                onClear: () => save({ assistant: "" }),
              }),
              react.createElement(ImageRow, {
                label: "你的头像（挂在气泡右侧）",
                value: state.user,
                onPick: (dataUri) => save({ user: dataUri }),
                onClear: () => save({ user: "" }),
              }),
              react.createElement(Slider, {
                label: "头像尺寸",
                value: size,
                min: 20,
                max: 72,
                onChange: (value) => save({ size: value }),
              }),
              react.createElement(Slider, {
                label: "头像与文字的间距",
                value: gap,
                min: 0,
                max: 40,
                onChange: (value) => save({ gap: value }),
              }),
              react.createElement(Slider, {
                label: "圆角",
                value: radius,
                min: 0,
                max: 40,
                onChange: (value) => save({ radius: value }),
              }),
              react.createElement(Slider, {
                label: "助手头像离左边框",
                value: leftInset,
                min: 0,
                max: 32,
                onChange: (value) => save({ leftInset: value }),
              }),
              react.createElement(Slider, {
                label: "你的头像离右边框",
                value: rightInset,
                min: 0,
                max: 32,
                onChange: (value) => save({ rightInset: value }),
              }),
              react.createElement(
                "p",
                { style: HINT },
                "圆角拉到一半 = 胶囊形，全拉满 = 正圆。上传的图片会自动裁成正方形。改动即时生效，无需重启。"
              )
            )
          : react.createElement("p", { style: HINT }, "头像已关闭，消息恢复纯文字排版。")
      );
    }

    /* ── 窄屏设置精简（≤700px）──
       1) 只 display:none 藏掉其余项，不碰激活逻辑（免得「点第二个被弹回第一个」）；
          仅当打开时选中项恰好被藏，才补切一次。
       2) 收紧按钮 padding 与图标间距 —— 横排本来就塞得下，只是桌面间距太奢侈。
       3) 标题行藏掉，把关闭键搬到内容区右上角。 */
    const MOBILE_SETTINGS_MAX = 700;
    const MOBILE_SETTINGS_KEEP = ["消息头像", "Wallpaper Engine"];

    function narrowViewport() {
      return window.innerWidth <= MOBILE_SETTINGS_MAX;
    }

    function isSelected(cell) {
      return /\bactive\b/.test(cell.className || "")
        || /\bselected\b/.test(cell.className || "")
        || cell.getAttribute("aria-current") === "true"
        || cell.getAttribute("aria-selected") === "true";
    }

    function ensureCompactStyle() {
      let style = document.getElementById("dsh-avatar-settings-css");
      if (style) return;
      style = document.createElement("style");
      style.id = "dsh-avatar-settings-css";
      style.textContent = [
        "@media (max-width: " + MOBILE_SETTINGS_MAX + "px) {",
        '  [class*="navCell"] { padding-left: 4px !important; padding-right: 4px !important; gap: 1px !important; min-width: 0 !important; }',
        '  [class*="navCell"] svg { width: 14px !important; height: 14px !important; flex: 0 0 auto !important; margin-right: 1px !important; }',
        '  [class*="navCell"] > * { margin-left: 0 !important; margin-right: 0 !important; }',
        '  [class*="navCell"] > span { white-space: nowrap !important; overflow: visible !important; }',
        "  /* 兜底：窄屏下别的插件（Wallpaper Engine 等）的说明文字会被 flex 挤成一列竖字。",
        "     这里只放宽设置内容区里带 row/hint 的容器，不动布局主干。 */",
        '  [role="dialog"] [class*="content"] [class*="row"] { flex-wrap: wrap !important; }',
        '  [role="dialog"] [class*="content"] [class*="hint"] { flex: 1 1 100% !important; min-width: 100% !important; padding-left: 0 !important; }',
        "  /* 横向按钮组（倍速/帧率/字体/色环）窄屏一律允许换行，别把内容顶出边框；",
        "     同时给滚动条留出内边距，避免竖条压住最后一列的文字 */",
        "  /* 页签必须保持单行：高亮 pill 按单行坐标定位，wrap 会让 pill 跑偏甚至出框。",
        "     靠缩内边距和字号把 6 个页签塞进一行（实测 339px -> 可用 306px）。 */",
        '  [role="dialog"] [class*="content"] .we-tabs { flex-wrap: nowrap !important; }',
        '  [role="dialog"] [class*="content"] [class*="tabs__tab"] { padding-left: 9px !important; padding-right: 9px !important; font-size: 13px !important; flex: 0 0 auto !important; }',
        '  [role="dialog"] [class*="content"] [class*="row"] { flex-wrap: wrap !important; min-width: 0 !important; }',
        '  [role="dialog"] [class*="content"] * { min-width: 0 !important; }',
        '  [role="dialog"] [class*="content"] { overflow-x: hidden !important; }',
        '  [role="dialog"] [class*="content"] [class*="tabs"] { padding-right: 6px !important; }',
        "  /* 高亮 pill 是插件按单行坐标写死的内联 left，窄屏算不准（实测偏移 62px）。",
        "     彻底废掉它，改由激活页签自己出背景，位置永远跟着文字走。 */",
        '  [role="dialog"] [class*="content"] [class*="tabs__pill"] { display: none !important; }',
        '  [role="dialog"] [class*="content"] [class*="tabs__tab--active"] { background: var(--fill-quaternary, rgba(120,120,255,0.32)) !important; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18) !important; }',
        "  /* 逐项对位窄屏（全部实测得来）：",
        "     swatch 22x36 ratio 0.61 变形 -> 锁正方；",
        "     ctl(帧率那行) nowrap 溢出 9px、按钮文字被压 -> 换行 + 按钮不许缩 */",
        '  [role="dialog"] [class*="content"] button[class*="picker__swatch"] { width: 30px !important; height: 30px !important; min-width: 30px !important; min-height: 30px !important; flex: 0 0 30px !important; padding: 0 !important; border-radius: 50% !important; }',
        '  [role="dialog"] [class*="content"] [class*="picker__swatch-custom"] { width: auto !important; height: auto !important; min-width: 0 !important; min-height: 0 !important; flex: 0 0 auto !important; border-radius: 8px !important; }',
        "  /* swatch-custom 里那个原生颜色 input 在窄屏被 Chrome 画成 15x36 竖条，收成 28px 正方 */",
        "  /* swatch-custom：input 会被父级 stretch 成 28x36 椭圆，必须自己锁死并关掉 stretch */",
        '  [role="dialog"] [class*="content"] [class*="swatch-custom"] { align-items: center !important; }',
        '  [role="dialog"] [class*="content"] [class*="swatch-custom"] input[type="color"] { width: 26px !important; height: 26px !important; min-width: 26px !important; min-height: 26px !important; flex: 0 0 26px !important; align-self: center !important; padding: 0 !important; border-radius: 50% !important; }',
        '  [role="dialog"] [class*="content"] [class*="swatch-custom"] [class*="value"] { flex: 0 0 auto !important; min-width: 48px !important; white-space: nowrap !important; }',
        "  /* 卡片标题被 flex 压成 88px 宽导致竖排：给它整行宽 + 禁止收缩 */",
        '  [role="dialog"] [class*="content"] [class*="card-name"] { flex: 1 1 100% !important; min-width: 0 !important; white-space: normal !important; }',
        '  [role="dialog"] [class*="content"] [class*="card-head"] { flex-wrap: wrap !important; align-items: center !important; }',
        '  [role="dialog"] [class*="content"] [class*="card-body"],',
        '  [role="dialog"] [class*="content"] [class*="card-sub"],',
        '  [role="dialog"] [class*="content"] [class*="card-meta"] { flex: 1 1 100% !important; min-width: 0 !important; }',
        '  [role="dialog"] [class*="content"] [class*="picker__ctl"] { flex-wrap: wrap !important; }',
        '  [role="dialog"] [class*="content"] [class*="picker__btn"] { flex: 0 0 auto !important; white-space: nowrap !important; }',
        '  [role="dialog"] [class*="content"] [class*="picker__ctl-hint"] { flex: 1 1 100% !important; min-width: 0 !important; white-space: normal !important; }',
        "  /* seg 按钮组：帧率那排实测 154px 装不下 209px 的按钮，必须换行；",
        "     倍速那排没溢出但 1x 被压到 16.8px（同级 28-36），统一禁止收缩 */",
        '  [role="dialog"] [class*="content"] [class*="picker__seg"] { flex-wrap: wrap !important; max-width: 100% !important; }',
        '  [role="dialog"] [class*="content"] [class*="picker__seg"] > button { flex: 0 0 auto !important; white-space: nowrap !important; min-width: 34px !important; padding-left: 8px !important; padding-right: 8px !important; }',
        "  /* tabs 右侧空 38px 是我之前给滚动条留的 6px 叠加自身留白，窄屏下没必要 */",
        '  [role="dialog"] [class*="content"] [class*="tabs"] { padding-right: 0 !important; margin-right: 0 !important; width: 100% !important; }',
        '  [role="dialog"] [class*="content"] [class*="picker__section"],',
        '  [role="dialog"] [class*="content"] [class*="picker"],',
        '  [role="dialog"] [class*="content"] [class*="tabpanel"] { min-width: 0 !important; }',
        "}",
      ].join("\n");
      (document.head || document.documentElement).appendChild(style);
    }

    function slimSettingsNav() {
      ensureCompactStyle();
      const dialog = document.querySelector('[role="dialog"][class*="panel"]');
      if (!dialog) return;
      const narrow = narrowViewport();
      if (!narrow) {
        restoreSettingsStyles(dialog);
        return;
      }
      const cells = dialog.querySelectorAll('[class*="navCell"]');
      if (cells.length === 0) return;
      const kept = [];
      cells.forEach(function (cell) {
        const title = (cell.textContent || "").trim();
        const keep = MOBILE_SETTINGS_KEEP.some(function (k) { return title.indexOf(k) !== -1; });
        cell.style.display = keep ? "" : "none";
        if (keep) kept.push(cell);
      });
      if (kept.length === 0) return;
      compactNavCells(cells);
      // 选中项被藏 → 内容区白屏，只在这种前提下补切一次；其余情况绝不干扰用户的点击
      const anySelectedVisible = Array.prototype.some.call(cells, function (c) {
        return c.style.display !== "none" && isSelected(c);
      });
      if (!anySelectedVisible) kept[0].click();
    }

    /* 图标必须用内联 style 改：CSS 里的 !important 压不住它（实测 svg 仍是 38px），
       而图标一变小，两个 tab 就会缩到 × 左边不再压字。 */
    function compactNavCells(cells) {
      cells.forEach(function (cell) {
        const icon = cell.querySelector("svg");
        if (icon) {
          /* 两层要点：
             1) 必须内联 !important —— 作者级 !important 压不住，实测普通内联完全无效
             2) 必须清 padding —— svg 自带 padding-left:12px，文字 span 也带 12px，
                不清的话图标与文字中间凭空多出 24px */
          icon.style.cssText = "width:15px !important;height:15px !important;padding:0 !important;margin:0 2px 0 0 !important;flex:0 0 auto !important;min-width:0 !important;";
        }
        const label = cell.querySelector('[class*="navLabel"]');
        if (label) {
          label.style.cssText = "margin:0 !important;padding:0 !important;";
        }
      });
    }    function restyleSettingsHeader() {
      const dialog = document.querySelector('[role="dialog"][class*="panel"]');
      if (!dialog || !narrowViewport()) return;
      const close = dialog.querySelector('[class*="close"]');
      const content = dialog.querySelector('[class*="content"]');
      const list = dialog.querySelector('[class*="navList"]');
      if (!close || !content) return;
      // 面板标题（navTitle）藏掉，tab 行上移到第一行
      const navTitle = dialog.querySelector('[class*="navTitle"]');
      if (navTitle) navTitle.style.display = "none";
      // 真正的排列发生在 navList（nav 是纵向容器：title + list），让位要加在它身上
      if (list) list.style.paddingRight = "44px";
      const header = close.parentElement;
      if (header && header !== content) {
        Array.prototype.forEach.call(header.children, function (child) {
          if (child !== close && !child.contains(close)) child.style.display = "none";
        });
        header.style.position = "absolute";
        header.style.left = "auto";
        header.style.right = "8px";
        header.style.bottom = "auto";
        header.style.height = "auto";
        header.style.padding = "0";
        header.style.background = "transparent";
        header.style.border = "none";
        header.style.pointerEvents = "none";
        close.style.position = "static";
        close.style.pointerEvents = "auto";
        // 按实测把 × 顶边对齐 tab 行，避免压住文字
        const firstCell = dialog.querySelector('[class*="navCell"]:not([style*="display: none"])');
        if (firstCell) {
          const dr = dialog.getBoundingClientRect();
          const tr = firstCell.getBoundingClientRect();
          header.style.top = Math.max(0, Math.round(tr.top - dr.top)) + "px";
        } else {
          header.style.top = "10px";
        }
      }
      content.style.paddingTop = "0";
    }

    // 设置面板是异步挂载的，apply 时它多半还没打开；盯住 DOM 变化，改完再补一次布局。
    let settingsSlimTimer = null;
    function refreshSettingsLayout() {
      slimSettingsNav();
      restyleSettingsHeader();
    }
    function watchSettingsNav() {
      if (watchSettingsNav._obs) return;
      const obs = new MutationObserver(function () {
        clearTimeout(settingsSlimTimer);
        settingsSlimTimer = setTimeout(refreshSettingsLayout, 120);
      });
      obs.observe(document.body, { childList: true, subtree: true });
      watchSettingsNav._obs = obs;
      window.addEventListener("resize", refreshSettingsLayout);
    }

    // 这一层 try/catch 是故意的：cordis 里某个插件 apply 抛错会被记成 entry FAILED，
    // web boot 发现不是全 active 就直接抛「Failed to load plugins」，整个界面白屏。
    // 头像只是锦上添花，出错记日志就够了，不能让它把主界面一起带走。
    function apply(ctx) {
      try {
        applyInner(ctx);
      } catch (error) {
        console.error("[dsh-avatar] apply failed: " + (error && error.message ? error.message : String(error)));
      }
    }

    function applyInner(ctx) {
      watchSettingsNav();
      slimSettingsNav();

      const slots = ctx.get("slots");   // cordis 里服务要走 ctx.get，直接 ctx.slots 取不到

      // 接管：workbench tweak 脚本注入的旧样式（#wb-avatar-css）双份规则会打架，直接摘掉。
      try {
        const legacy = document.getElementById("wb-avatar-css");
        if (legacy) {
          legacy.remove();
          console.error("[dsh-avatar] removed legacy #wb-avatar-css");
        }
      } catch (error) { /* ignore */ }

      applyCss();
      load();

      if (slots !== undefined) {
        slots.inject("settings.section", () => slots.register(
          { name: "settings.section", id: "dsh-avatar-settings", order: 38, label: "消息头像" },
          () => react.createElement(AvatarSettingsPage)
        ));
      }
    }

    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
