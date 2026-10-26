import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const categories = ["全部", "教材", "数码", "生活用品", "运动器材", "其他"];
const conditions = ["全新", "九成新", "八成新", "七成新", "六成新及以下"];
const categoryIcons = {
  全部: "grid",
  教材: "book",
  数码: "monitor",
  生活用品: "lamp",
  运动器材: "ball",
  其他: "box",
};
const money = (value) => Number(value).toFixed(2).replace(/\.00$/, "");
const price = (p) => p.priceYuan ?? p.price ?? p.price_cents / 100;

function Icon({ name = "spark", size = 20, ...props }) {
  const shapes = {
    swap: (
      <>
        <path d="M3 7h17l-4-4M21 17H4l4 4" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    book: (
      <>
        <path d="M12 5v15M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Z" />
      </>
    ),
    monitor: (
      <>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 22h8m-4-5v5" />
      </>
    ),
    lamp: (
      <>
        <path d="m8 3-4 9h16l-4-9Zm4 9v9m-4 0h8" />
      </>
    ),
    ball: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3v18M5 5c9 2 12 5 14 14M19 5C10 7 7 10 5 19" />
      </>
    ),
    box: (
      <>
        <path d="m12 2 10 5v10l-10 5-10-5V7Zm0 10L2 7m10 5L22 7m-10 5v10M7 4.5l10 5" />
      </>
    ),
    heart: (
      <path d="M20 4c-3-2-6 0-8 2-2-2-5-4-8-2-5 4 0 10 8 16 8-6 13-12 8-16Z" />
    ),
    pin: (
      <>
        <path d="M19 10c0 6-7 12-7 12S5 16 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    plus: <path d="M12 4v16M4 12h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    spark: (
      <>
        <path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z" />
        <path d="M20 2v4m-2-2h4" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4 20-7ZM11 13l6-6" />
      </>
    ),
    shield: (
      <>
        <path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    logout: (
      <>
        <path d="M9 3H3v18h6m6-15 6 6-6 6m-7-6h13" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {shapes[name] || shapes.spark}
    </svg>
  );
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  let body = options.body;
  if (body && !(body instanceof Blob)) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers,
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error || `请求失败（${response.status}）`);
  return data;
}

function ProductArt({ product, large = false }) {
  const c = product.category || "其他";
  if (product.image)
    return (
      <div className={`product-art actual ${large ? "large" : ""}`}>
        <img src={product.image} alt={product.title} loading="lazy" />
      </div>
    );
  return (
    <div
      className={`product-art art-${categories.indexOf(c)} ${large ? "large" : ""}`}
    >
      <div className="art-circle" />
      <svg
        className="art-object"
        viewBox="0 0 260 180"
        fill="none"
        aria-hidden="true"
      >
        {c === "教材" ? (
          <g transform="translate(67 20) rotate(-9 60 70)">
            <rect x="7" y="6" width="112" height="145" rx="4" fill="#bdc7b3" />
            <rect x="0" y="0" width="112" height="145" rx="4" fill="#faf8e9" />
            <path d="M9 0v145" stroke="#dedac9" strokeWidth="3" />
            <rect x="22" y="25" width="67" height="6" rx="2" fill="#254d41" />
            <rect x="22" y="39" width="45" height="4" rx="2" fill="#8da18a" />
            <circle cx="62" cy="88" r="25" stroke="#b4c5a2" strokeWidth="1.5" />
            <path
              d="m38 87 49-1M62 63v51M40 72l44 31M43 107l38-38"
              stroke="#b4c5a2"
            />
            <rect x="22" y="125" width="34" height="3" rx="1" fill="#8da18a" />
          </g>
        ) : c === "数码" ? (
          <g>
            <rect
              x="51"
              y="30"
              width="158"
              height="103"
              rx="8"
              fill="#50645d"
            />
            <rect x="59" y="38" width="142" height="87" rx="3" fill="#d5e8dd" />
            <path d="m62 121 45-44 32 22 26-42 34 64" fill="#b0c8b9" />
            <circle cx="92" cy="61" r="10" fill="#f8efd0" />
            <path
              d="M130 133v19m-28 0h56"
              stroke="#50645d"
              strokeWidth="7"
              strokeLinecap="round"
            />
          </g>
        ) : c === "生活用品" ? (
          <g>
            <path d="m109 25-31 63h104l-32-63Z" fill="#ecdba7" />
            <path
              d="M130 88v58m-32 3h64"
              stroke="#8d8268"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path d="M91 88h78l21 43H70Z" fill="#ffe9a3" opacity=".22" />
            <path d="M156 90v26" stroke="#8d8268" strokeWidth="2" />
          </g>
        ) : c === "运动器材" ? (
          <g transform="rotate(15 130 90)">
            <circle cx="130" cy="88" r="61" fill="#cb8f67" />
            <circle cx="130" cy="88" r="61" stroke="#946c51" strokeWidth="3" />
            <path
              d="M69 88h122M130 27v122M85 46c53 14 76 45 89 84M174 46c-53 14-76 45-89 84"
              stroke="#8e674f"
              strokeWidth="3"
            />
          </g>
        ) : (
          <g>
            <path d="m130 31 72 37v69l-72 32-72-32V68Z" fill="#c6aa80" />
            <path d="m130 31 72 37-72 34-72-34Z" fill="#e4cfac" />
            <path d="M130 102v67" stroke="#a68c67" strokeWidth="2" />
            <path d="m100 47 72 35v30l-16 8V89L84 55Z" fill="#f3e4c3" />
            <path
              d="m75 126 29 13"
              stroke="#a68c67"
              strokeWidth="4"
              strokeLinecap="round"
            />
          </g>
        )}
      </svg>
      <span className="illustration-label">品类示意 · 暂无实拍</span>
    </div>
  );
}

function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    function key(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll(
          'button:not(:disabled),input,select,textarea,[tabindex="0"]',
        );
        if (!items?.length) return;
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items[items.length - 1].focus();
        } else if (
          !e.shiftKey &&
          document.activeElement === items[items.length - 1]
        ) {
          e.preventDefault();
          items[0].focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "wide" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="关闭弹窗"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null),
    [authReady, setAuthReady] = useState(false);
  const [page, setPage] = useState("hall"),
    [category, setCategory] = useState("全部");
  const [query, setQuery] = useState(""),
    [q, setQ] = useState(""),
    [maxPrice, setMaxPrice] = useState(""),
    [sort, setSort] = useState("newest");
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [refresh, setRefresh] = useState(0);
  const [modal, setModal] = useState(null),
    [selected, setSelected] = useState(null),
    [notice, setNotice] = useState("");
  const [resumeDraft, setResumeDraft] = useState(false);
  const [aiOpen, setAiOpen] = useState(false),
    [aiStatus, setAiStatus] = useState(null),
    [chat, setChat] = useState([]),
    [chatInput, setChatInput] = useState(""),
    [chatBusy, setChatBusy] = useState(false),
    [conversationId, setConversationId] = useState(null);
  const [authMode, setAuthMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [formError, setFormError] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    priceYuan: "",
    category: "教材",
    condition: "九成新",
    location: "",
    image: "",
  });
  const chatEnd = useRef(null),
    chatLock = useRef(false);

  useEffect(() => {
    request("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setAuthReady(true));
    request("/api/ai/mode")
      .then((d) => setAiStatus({ configured: d.mode === "online" }))
      .catch(() => setAiStatus({ configured: false }));
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  useEffect(() => {
    if (!authReady) return;
    if (page !== "hall" && !user) {
      setLoading(false);
      setItems([]);
      setError("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ q, sort });
    if (category !== "全部") params.set("category", category);
    if (maxPrice !== "") params.set("maxPrice", maxPrice);
    const path =
      page === "mine"
        ? "/api/products/my/list"
        : page === "favorites"
          ? "/api/products/favorites/list"
          : `/api/products?${params}`;
    request(path, { signal: controller.signal })
      .then((d) => setItems(d.items || []))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, q, category, maxPrice, sort, refresh, user?.id, authReady]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat, chatBusy, aiOpen]);

  function showModal(next) {
    setFormError("");
    setModal(next);
  }
  function requireLogin(action) {
    if (!user) {
      setNotice("请先登录，再使用这项功能");
      showModal("auth");
      return;
    }
    action();
  }
  function publish() {
    requireLogin(() => {
      setResumeDraft(false);
      setDraft({
        title: "",
        description: "",
        priceYuan: "",
        category: "教材",
        condition: "九成新",
        location: "",
        image: "",
      });
      setSelected(null);
      showModal("publish");
    });
  }
  async function openProduct(product) {
    try {
      const d = await request(`/api/products/${product.id}`);
      setSelected(d.product || d);
      showModal("detail");
    } catch (e) {
      setNotice(e.message);
    }
  }
  async function authenticate(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const d = await request(`/api/auth/${authMode}`, {
        method: "POST",
        body: data,
      });
      setUser(d.user);
      setModal(null);
      setNotice("登录成功，欢迎来到易换校园");
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (chatLock.current) return setNotice("请等待本次助手回复结束再退出");
    try {
      await request("/api/auth/logout", { method: "POST" });
      setUser(null);
      setChat([]);
      setConversationId(null);
      setPage("hall");
      setModal(null);
    } catch (e) {
      setNotice(e.message);
    }
  }
  async function favorite(p, remove = false) {
    requireLogin(async () => {
      try {
        await request(`/api/products/favorites/${p.id}`, {
          method: remove ? "DELETE" : "POST",
        });
        setNotice(remove ? "已取消收藏" : "已收藏，可以在“我的收藏”找到");
        if (remove) setRefresh((n) => n + 1);
      } catch (e) {
        setNotice(e.message);
      }
    });
  }
  async function saveProduct(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError("");
    try {
      if (draft.file && !selected) {
        const uploaded = await request("/api/upload/image", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: draft.file,
        });
        draft.image = uploaded.file;
      }
      const { file, ...body } = draft;
      await request(
        selected ? `/api/products/${selected.id}` : "/api/products",
        { method: selected ? "PUT" : "POST", body },
      );
      setModal(null);
      setPage("mine");
      setRefresh((n) => n + 1);
      setNotice(selected ? "商品已更新" : "发布成功，闲置正在寻找新主人");
    } catch (e) {
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function productAction(product, action) {
    if (action === "edit") {
      setSelected(product);
      setDraft({ ...product, image: "", priceYuan: String(price(product)) });
      showModal("publish");
      return;
    }
    if (
      action === "delete" &&
      !window.confirm("确定删除这件商品？此操作无法撤销。")
    )
      return;
    try {
      await request(
        `/api/products/${product.id}${action === "delete" ? "" : `/${action}`}`,
        { method: action === "delete" ? "DELETE" : "POST" },
      );
      setRefresh((n) => n + 1);
      setNotice("操作成功");
    } catch (e) {
      setNotice(e.message);
    }
  }
  async function askAi(text = chatInput) {
    const message = text.trim();
    if (!message || chatLock.current) return;
    if (!user) {
      setNotice("登录后即可使用 AI 助手");
      showModal("auth");
      return;
    }
    chatLock.current = true;
    setChatInput("");
    setChatBusy(true);
    setChat((old) => [...old, { role: "user", content: message }]);
    try {
      const d = await request("/api/ai/chat", {
        method: "POST",
        body: { message, conversationId },
      });
      if (d.conversationId) setConversationId(d.conversationId);
      setChat((old) => [
        ...old,
        {
          role: "assistant",
          content:
            d.reply || d.content || d.message || "暂未收到回复，请重试。",
          products: d.productCards || d.products || [],
          traces: d.traces || d.trace || d.toolCalls || [],
          mode: d.mode,
        },
      ]);
    } catch (e) {
      setChat((old) => [
        ...old,
        {
          role: "assistant",
          content: `这次没有完成：${e.message}。请重试。`,
          error: true,
        },
      ]);
    } finally {
      chatLock.current = false;
      setChatBusy(false);
    }
  }

  const configured = !!(
    aiStatus?.configured ??
    aiStatus?.aiConfigured ??
    aiStatus?.isConfigured
  );
  const title =
    page === "mine"
      ? "我的发布"
      : page === "favorites"
        ? "我的收藏"
        : "发现校园好物";
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <button
            className="brand"
            onClick={() => setPage("hall")}
            aria-label="易换校园首页"
          >
            <span className="brand-icon">
              <Icon name="swap" size={26} />
            </span>
            <span>
              易换校园<small>YIHUAN CAMPUS</small>
            </span>
          </button>
          <nav className="top-nav" aria-label="主导航">
            <button
              className={page === "hall" ? "active" : ""}
              onClick={() => setPage("hall")}
            >
              闲置集市
            </button>
            <button
              className={page === "favorites" ? "active" : ""}
              onClick={() => setPage("favorites")}
            >
              我的收藏
            </button>
            <button
              className={page === "mine" ? "active" : ""}
              onClick={() => setPage("mine")}
            >
              我的发布
            </button>
          </nav>
          <div className="header-actions">
            <span className="campus">
              <Icon name="pin" size={15} />
              徐州工程学院
            </span>
            <button className="button primary small" onClick={publish}>
              <Icon name="plus" size={17} />
              <span>发布闲置</span>
            </button>
            <button
              className="account"
              onClick={() => showModal(user ? "account" : "auth")}
              aria-label={user ? "我的账户" : "登录或注册"}
            >
              <Icon name="user" size={20} />
              <span>{user ? user.displayName : "登录 / 注册"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="breadcrumb">
          <span className="live-dot" />
          校园循环生活，从这里开始
          <span className="breadcrumb-right">校内自提 · 闲置新生</span>
        </div>
        {page === "hall" && (
          <section className="hero">
            <div className="hero-copy">
              <span className="eyebrow">A SECOND LIFE, A NEW STORY</span>
              <h1>
                你的闲置，
                <br />
                是另一位同学的<span>刚刚好。</span>
              </h1>
              <p>
                从一本课本到第一辆单车，
                <br className="mobile-break" />
                让好物在校园里继续发光。
              </p>
              <div className="hero-actions">
                <button className="button lime" onClick={publish}>
                  给闲置一个新去处
                  <Icon name="arrow" size={18} />
                </button>
                <span>少一点浪费，多一点连接</span>
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="hero-orbit orbit-one" />
              <div className="hero-orbit orbit-two" />
              <div className="floating-label label-top">
                <Icon name="book" size={15} />
                旧书也有新故事
              </div>
              <div className="hero-book book-back" />
              <div className="hero-book book-front">
                <span>
                  让好物
                  <br />
                  再出发
                </span>
                <div className="book-line" />
                <Icon name="swap" size={43} />
              </div>
              <div className="hero-pot">
                <span />
                <i />
              </div>
              <div className="floating-label label-bottom">
                <span className="mini-dot" />
                一场校园里的循环
              </div>
              <span className="art-star">✳</span>
            </div>
          </section>
        )}

        {page === "hall" && (
          <section className="assistant-banner">
            <div className="assistant-emblem">
              <Icon name="spark" size={24} />
            </div>
            <div>
              <h2>想找什么？和小易聊聊</h2>
              <p>说出预算和需求，让助手帮你找好物、拟文案、看交易风险。</p>
            </div>
            <button className="text-button" onClick={() => setAiOpen(true)}>
              打开智能助手
              <Icon name="arrow" size={18} />
            </button>
          </section>
        )}

        <section className="market" aria-label={title}>
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                {page === "hall" ? "THE CAMPUS EDIT" : "MY CAMPUS"}
              </span>
              <h2>
                {title}
                <span className="count">{items.length}</span>
              </h2>
            </div>
            <span className="section-note">
              {page === "hall"
                ? "用得上的好物，触手可及"
                : "把喜欢的、闲置的，都好好安放"}
            </span>
          </div>
          {page === "hall" && (
            <>
              <div className="filters">
                <div
                  className="category-tabs"
                  role="group"
                  aria-label="商品分类"
                >
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={category === c ? "chosen" : ""}
                      onClick={() => setCategory(c)}
                    >
                      <Icon name={categoryIcons[c]} size={17} />
                      {c}
                    </button>
                  ))}
                </div>
                <form
                  className="search-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setQ(query);
                  }}
                >
                  <Icon name="search" size={18} />
                  <input
                    aria-label="搜索商品"
                    placeholder="搜一搜你需要的好物"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button type="submit" aria-label="执行搜索">
                    <Icon name="arrow" size={18} />
                  </button>
                </form>
              </div>
              <div className="filter-bottom">
                <div className="demo-hint">
                  <span className="tiny-dot" />
                  演示商品已标注，欢迎发布真实闲置
                </div>
                <div className="sort-controls">
                  <label>
                    预算上限
                    <input
                      type="number"
                      aria-label="预算上限"
                      placeholder="不限"
                      min="0"
                      step="0.01"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="排序方式"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="newest">最新发布</option>
                    <option value="price_asc">价格从低到高</option>
                    <option value="price_desc">价格从高到低</option>
                  </select>
                </div>
              </div>
            </>
          )}
          {loading ? (
            <div className="loading-grid" aria-label="加载商品中">
              {[1, 2, 3, 4].map((i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="empty">
              <Icon name="box" size={36} />
              <h3>暂时没能加载商品</h3>
              <p>{error}</p>
              <button
                className="button primary"
                onClick={() => setRefresh((n) => n + 1)}
              >
                重新加载
              </button>
            </div>
          ) : page !== "hall" && !user ? (
            <div className="empty">
              <Icon name="user" size={36} />
              <h3>登录后，找回你的校园小天地</h3>
              <p>管理发布与收藏，让每一次交换都井井有条。</p>
              <button
                className="button primary"
                onClick={() => showModal("auth")}
              >
                去登录
              </button>
            </div>
          ) : !items.length ? (
            <div className="empty">
              <Icon name="box" size={36} />
              <h3>
                {page === "hall" ? "还没有找到合适的好物" : "这里还空着呢"}
              </h3>
              <p>
                {page === "hall"
                  ? "换个关键词或预算试试，也可以让小易帮你找。"
                  : "从逛逛集市或发布第一件闲置开始。"}
              </p>
              <button
                className="button primary"
                onClick={() => {
                  if (page === "hall") {
                    setQ("");
                    setQuery("");
                    setMaxPrice("");
                    setCategory("全部");
                  } else setPage("hall");
                }}
              >
                逛逛全部好物
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {items.map((p) => (
                <article className="product-card" key={p.id}>
                  <button
                    className="product-image-button"
                    aria-label={`查看${p.title}`}
                    onClick={() => openProduct(p)}
                  >
                    <ProductArt product={p} />
                    <span className="condition-tag">{p.condition}</span>
                  </button>
                  <button
                    className="favorite-button"
                    aria-label={`${page === "favorites" ? "取消收藏" : "收藏"}${p.title}`}
                    onClick={() => favorite(p, page === "favorites")}
                  >
                    <Icon
                      name="heart"
                      size={18}
                      fill={page === "favorites" ? "currentColor" : "none"}
                    />
                  </button>
                  <div className="product-info">
                    <div className="product-meta">
                      <span>{p.category}</span>
                      {p.isDemo && <span className="demo-label">演示数据</span>}
                      {p.status !== "on_sale" && (
                        <span className="off-label">已下架</span>
                      )}
                    </div>
                    <button
                      className="product-title"
                      onClick={() => openProduct(p)}
                    >
                      {p.title}
                    </button>
                    <div className="product-price">
                      <span>¥</span>
                      {money(price(p))}
                      <small>校内自提</small>
                    </div>
                    <div className="product-location">
                      <Icon name="pin" size={13} />
                      {p.location}
                    </div>
                    <div className="product-seller">
                      <span className="avatar">
                        {(p.sellerName || "同学").slice(-1)}
                      </span>
                      <span>{p.sellerName || "校园同学"}</span>
                      <span className="seller-arrow">
                        <Icon name="arrow" size={14} />
                      </span>
                    </div>
                    {page === "mine" && (
                      <div className="manage-row">
                        <button onClick={() => productAction(p, "edit")}>
                          编辑
                        </button>
                        <button
                          onClick={() =>
                            productAction(
                              p,
                              p.status === "on_sale" ? "offsale" : "onsale",
                            )
                          }
                        >
                          {p.status === "on_sale" ? "下架" : "上架"}
                        </button>
                        <button
                          className="danger-text"
                          onClick={() => productAction(p, "delete")}
                        >
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="safety-strip">
          <Icon name="shield" size={22} />
          <div>
            <strong>好物交换，安心先行</strong>
            <p>公共区域当面验货 · 不点陌生链接 · 不向陌生人提前转账</p>
          </div>
          <button
            className="text-button"
            onClick={() => {
              setAiOpen(true);
              setChatInput("交易前应该注意什么？");
            }}
          >
            问问小易
            <Icon name="chevron" size={16} />
          </button>
        </section>
      </main>
      <footer>
        <span>
          易换校园 <span className="footer-dot">·</span> 让闲置遇见需要
        </span>
        <span>校园二手交易参赛原型 · 演示账号未通过学生认证</span>
      </footer>
      {!aiOpen && (
        <button className="ai-fab" onClick={() => setAiOpen(true)}>
          <Icon name="spark" size={21} />
          <span>小易助手</span>
          <span className="fab-dot" />
        </button>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}

      {modal === "auth" && (
        <Modal
          title={authMode === "login" ? "欢迎回到易换校园" : "加入校园循环生活"}
          onClose={() => setModal(null)}
        >
          <p className="muted">一个账号，收藏喜欢的好物，发布闲置的故事。</p>
          <div className="form-tabs">
            <button
              className={authMode === "login" ? "selected" : ""}
              onClick={() => {
                setAuthMode("login");
                setFormError("");
              }}
            >
              登录
            </button>
            <button
              className={authMode === "register" ? "selected" : ""}
              onClick={() => {
                setAuthMode("register");
                setFormError("");
              }}
            >
              注册
            </button>
          </div>
          <form className="stack-form" onSubmit={authenticate}>
            <label>
              用户名
              <input
                required
                name="username"
                minLength="3"
                maxLength="30"
                pattern="[A-Za-z0-9_]{3,30}"
                autoComplete="username"
                placeholder="3—30 位字母、数字或下划线"
              />
            </label>
            {authMode === "register" && (
              <label>
                昵称
                <input
                  name="displayName"
                  maxLength="30"
                  placeholder="怎么称呼你？"
                />
              </label>
            )}
            <label>
              密码
              <input
                required
                name="password"
                type="password"
                minLength="6"
                maxLength="100"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                placeholder="至少 6 位"
              />
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? "请稍候…" : authMode === "login" ? "登录" : "注册并登录"}
            </button>
          </form>
          <div className="demo-account">
            <strong>先体验一下？</strong>
            <p>
              演示买家：demo_buyer
              <br />
              演示卖家：demo_seller
              <br />
              密码均为：demo123456
            </p>
            <small>演示账号仅用于体验，不代表真实学生身份。</small>
          </div>
        </Modal>
      )}

      {modal === "publish" && (
        <Modal
          title={selected ? "编辑闲置" : "给闲置一个新故事"}
          onClose={() => !busy && setModal(null)}
          wide
        >
          <p className="muted">如实描述成色与瑕疵，让下一位同学放心接手。</p>
          <form className="stack-form" onSubmit={saveProduct}>
            <label>
              商品标题
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                required
                maxLength="100"
                placeholder="例如：高等数学第八版，带铅笔笔记"
              />
            </label>
            <div className="form-grid">
              <label>
                价格（元）
                <input
                  type="number"
                  required
                  min="0.01"
                  max="999999.99"
                  step="0.01"
                  value={draft.priceYuan}
                  onChange={(e) =>
                    setDraft({ ...draft, priceYuan: e.target.value })
                  }
                  placeholder="0.00"
                />
              </label>
              <label>
                分类
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value })
                  }
                >
                  {categories.slice(1).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                成色
                <select
                  value={draft.condition}
                  onChange={(e) =>
                    setDraft({ ...draft, condition: e.target.value })
                  }
                >
                  {conditions.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                校内自提地点
                <input
                  required
                  value={draft.location}
                  onChange={(e) =>
                    setDraft({ ...draft, location: e.target.value })
                  }
                  maxLength="100"
                  placeholder="例如：图书馆正门"
                />
              </label>
            </div>
            <label>
              商品描述
              <textarea
                required
                rows="4"
                maxLength="1000"
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder="介绍版本、使用情况、配件和瑕疵。请勿填写公开手机号或宿舍号。"
              />
            </label>
            <button
              className="text-button draft-helper"
              type="button"
              onClick={() => {
                setResumeDraft(true);
                setAiOpen(true);
                setChatInput(
                  `帮我拟一份商品描述草稿：${draft.title}；成色：${draft.condition}；价格：${draft.priceYuan}元；已知情况：${draft.description || "尚未提供，请不要编造成色细节"}。`,
                );
                setModal(null);
              }}
            >
              {" "}
              <Icon name="spark" size={17} />
              让小易帮我拟文案
            </button>
            {!selected && (
              <label className="file-label">
                商品实拍（选填）
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file && file.size > 3145728) {
                      e.target.value = "";
                      setFormError("图片不能超过 3MB");
                    } else {
                      setDraft({ ...draft, file });
                      setFormError("");
                    }
                  }}
                />
                <small>
                  支持 JPG、PNG、WebP，最大 3MB。未上传时使用品类示意图。
                </small>
              </label>
            )}
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? "正在保存…" : selected ? "保存修改" : "发布闲置"}
            </button>
          </form>
        </Modal>
      )}

      {modal === "detail" && selected && (
        <Modal title="好物详情" onClose={() => setModal(null)} wide>
          <div className="detail-grid">
            <ProductArt product={selected} large />
            <div>
              <div className="product-meta">
                <span>
                  {selected.category} / {selected.condition}
                </span>
                {selected.isDemo && (
                  <span className="demo-label">演示数据</span>
                )}
              </div>
              <h2 className="detail-title">{selected.title}</h2>
              <div className="detail-price">¥{money(price(selected))}</div>
              <p className="detail-description">{selected.description}</p>
              <p className="location-line">
                <Icon name="pin" size={16} />
                {selected.location}
              </p>
              <div className="seller-box">
                <strong>{selected.sellerName}</strong>
                <p>
                  {user
                    ? selected.sellerContactNote ||
                      "卖家暂未填写联系说明，请稍后再来。"
                    : "登录后查看卖家自愿提供的联系说明。"}
                </p>
              </div>
              <div className="detail-actions">
                <button
                  className="button primary"
                  onClick={() =>
                    user
                      ? setNotice(
                          selected.sellerContactNote || "卖家暂未提供联系说明",
                        )
                      : showModal("auth")
                  }
                >
                  查看联系说明
                </button>
                <button
                  className="button secondary"
                  onClick={() => favorite(selected)}
                >
                  <Icon name="heart" size={17} />
                  收藏
                </button>
              </div>
            </div>
          </div>
          <div className="detail-safety">
            <Icon name="shield" size={18} />
            建议校内公共区域当面验货，不提供验证码，不提前向陌生人付款。
            {selected.status !== "on_sale" && <strong> 此商品已下架。</strong>}
          </div>
        </Modal>
      )}

      {modal === "account" && user && (
        <Modal title="我的账户" onClose={() => setModal(null)}>
          <div className="account-profile">
            <span className="avatar large-avatar">
              {user.displayName.slice(-1)}
            </span>
            <div>
              <h3>{user.displayName}</h3>
              <p className="muted">
                {user.isDemo
                  ? "演示账号 · 未通过学生认证"
                  : "普通注册账号 · 未进行学生认证"}
              </p>
            </div>
          </div>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const note = new FormData(e.currentTarget).get("contactNote");
              try {
                await request("/api/auth/contact", {
                  method: "PUT",
                  body: { contactNote: note },
                });
                setUser({ ...user, contactNote: note });
                setNotice("联系说明已保存");
              } catch (e) {
                setNotice(e.message);
              }
            }}
          >
            <label>
              卖家联系说明
              <textarea
                name="contactNote"
                rows="3"
                maxLength="300"
                defaultValue={user.contactNote}
                placeholder="自愿填写联系方法或约定方式，仅登录用户可见。请勿提供身份证号和验证码。"
              />
            </label>
            <button className="button primary">保存联系说明</button>
          </form>
          <button
            className="text-button danger-text logout-button"
            onClick={logout}
          >
            <Icon name="logout" size={16} />
            退出登录
          </button>
        </Modal>
      )}

      {aiOpen && (
        <>
          <div className="chat-scrim" onClick={() => setAiOpen(false)} />
          <aside className="chat-panel" aria-label="小易智能助手">
            <div className="chat-heading">
              <span className="assistant-emblem">
                <Icon name="spark" size={22} />
              </span>
              <div>
                <h2>小易 · 校园好物助手</h2>
                <p>
                  {configured
                    ? "已配置模型接口 · 回复将尝试真实调用"
                    : "离线演示模式 · 未接入真实大模型"}
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="关闭智能助手"
                onClick={() => setAiOpen(false)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="chat-body">
              <div className="welcome-bubble">
                <span className="section-kicker">HELLO, CAMPUS</span>
                <h3>嗨，今天想淘点什么？</h3>
                <p>
                  告诉我想要的东西和预算，我可以查询平台商品，也能帮你看交易风险、拟发布文案。
                </p>
                {!configured && (
                  <p className="offline-note">
                    当前使用规则流程演示工具调用；接通模型接口后才能体验真实
                    AI。价格建议仅参考平台在售数据。
                  </p>
                )}
              </div>
              {!chat.length && (
                <div className="chat-suggestions">
                  {[
                    "帮我找30元以内的高数教材",
                    "卖家让我点击链接先付款，安全吗？",
                    "我想卖教材，帮我拟发布文案",
                  ].map((text) => (
                    <button key={text} onClick={() => askAi(text)}>
                      {text}
                      <Icon name="arrow" size={15} />
                    </button>
                  ))}
                </div>
              )}
              {chat.map((m, i) => (
                <div
                  key={i}
                  className={`chat-message ${m.role} ${m.error ? "chat-error" : ""}`}
                >
                  <div className="message-content">{m.content}</div>
                  {m.products?.map((p) => (
                    <button
                      className="chat-product"
                      key={p.id}
                      onClick={() => openProduct(p)}
                    >
                      <span>
                        <strong>{p.title}</strong>
                        <small>
                          {p.condition} · {p.location}
                        </small>
                      </span>
                      <b>¥{money(price(p))}</b>
                    </button>
                  ))}
                  {m.traces?.length > 0 && (
                    <details className="tool-trace">
                      <summary>查看工具调用记录（{m.traces.length}）</summary>
                      <pre>{JSON.stringify(m.traces, null, 2)}</pre>
                    </details>
                  )}
                </div>
              ))}
              {chatBusy && (
                <div className="thinking" role="status">
                  小易正在查询和整理，请稍候<span>…</span>
                </div>
              )}
              <div ref={chatEnd} />
            </div>
            <div className="chat-composer">
              {resumeDraft && (
                <button className="text-button" onClick={() => {
                  setAiOpen(false);
                  setResumeDraft(false);
                  showModal("publish");
                }}>返回发布草稿</button>
              )}
              <button
                className="new-chat"
                disabled={chatBusy}
                onClick={() => {
                  setChat([]);
                  setConversationId(null);
                }}
              >
                开启新对话
              </button>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  askAi();
                }}
              >
                <textarea
                  aria-label="给小易发送消息"
                  placeholder={
                    user
                      ? "比如：帮我找 100 元以内的键盘…"
                      : "登录后即可使用助手"
                  }
                  rows="2"
                  maxLength="2000"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      askAi();
                    }
                  }}
                />
                <button
                  className="send-button"
                  aria-label="发送消息"
                  disabled={chatBusy || !chatInput.trim()}
                >
                  <Icon name="send" size={19} />
                </button>
              </form>
              <small>工具查询基于平台数据 · AI 建议请自行核实</small>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
