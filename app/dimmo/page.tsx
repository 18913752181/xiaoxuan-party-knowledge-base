import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DimmoCompanion } from "@/components/DimmoCompanion";

export const metadata: Metadata = {
  title: { absolute: "小宣干货社简介" },
  description: "认识小宣干货社、喵喵工作台、Dimmo 和小宣社长，以及资料、工具、待办提醒和人工专业支持。"
};

const productEntries = [
  {
    label: "找资料",
    title: "模板、制度和专题资料",
    description: "按关键词和专题查找常用资料，支持收藏、下载与会员批量下载。",
    href: "/library",
    action: "进入资料库"
  },
  {
    label: "找路径",
    title: "按工作事项进入办理流程",
    description: "从具体工作进入专题、流程、制度依据、常见问题和关联资料。",
    href: "/work-navigation",
    action: "打开工作导航"
  },
  {
    label: "用工具",
    title: "算时间，找基地",
    description: "核算发展党员时间节点，查找红色教育基地与参观信息。",
    href: "/",
    action: "从工作台开始"
  },
  {
    label: "交给 Dimmo",
    title: "记待办，到点提醒",
    description: "在微信里记录事项、查看清单和设置提醒，会员任务与小程序保持同步。",
    href: "/membership/payment",
    action: "了解会员工作台"
  }
];

const styles = `
  .studio-page, .studio-page * { box-sizing: border-box; }
  body:has(.studio-page) > header, body:has(.studio-page) > footer, body:has(.studio-page) nav[aria-label="移动端导航"] { display: none; }
  body:has(.studio-page) > main { padding-bottom: 0; }
  .studio-page {
    --ink: #262622;
    --muted: #6f6d65;
    --line: #e6e2d9;
    --paper: #fffefa;
    --surface: #f7f6f1;
    --yellow: #f1cc64;
    --yellow-soft: #fff5d4;
    --yellow-deep: #7b5c12;
    min-height: 100vh;
    overflow: hidden;
    color: var(--ink);
    background: var(--paper);
    font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.75;
  }
  .studio-shell { width: min(100% - 44px, 1160px); margin: 0 auto; }
  .studio-nav { display: flex; min-height: 72px; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }
  .studio-brand { color: var(--ink); font-size: 18px; font-weight: 760; letter-spacing: -.025em; text-decoration: none; }
  .studio-nav-links { display: flex; align-items: center; gap: 28px; }
  .studio-nav-link { color: #535149; font-size: 14px; font-weight: 620; text-decoration: none; text-underline-offset: 6px; }
  .studio-nav-link:hover { color: var(--ink); text-decoration: underline; text-decoration-color: var(--yellow); text-decoration-thickness: 3px; }
  .studio-hero-wrap {
    background-image: radial-gradient(circle at 80% 15%, rgba(241,204,100,.25), transparent 25rem), linear-gradient(rgba(38,38,34,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(38,38,34,.035) 1px, transparent 1px);
    background-size: auto, 32px 32px, 32px 32px;
  }
  .studio-hero { display: grid; grid-template-columns: .86fr 1.14fr; align-items: center; min-height: 640px; padding: 54px 0 26px; }
  .studio-hero-copy { position: relative; z-index: 2; padding: 18px 0 58px; }
  .studio-kicker { margin: 0 0 18px; color: var(--yellow-deep); font-size: 14px; font-weight: 720; letter-spacing: .08em; }
  .studio-h1, .studio-h2, .studio-h3 { margin: 0; letter-spacing: -.045em; }
  .studio-h1 { max-width: 560px; font-size: clamp(44px, 5.5vw, 68px); font-weight: 720; line-height: 1.1; }
  .studio-h2 { max-width: 760px; font-size: clamp(30px, 4vw, 46px); font-weight: 700; line-height: 1.2; }
  .studio-h3 { font-size: 22px; font-weight: 690; line-height: 1.35; }
  .studio-hero-lead { max-width: 520px; margin: 24px 0 0; color: #55534c; font-size: 18px; line-height: 1.85; }
  .studio-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
  .studio-button { display: inline-flex; min-height: 50px; align-items: center; justify-content: center; padding: 0 22px; border: 1px solid var(--ink); border-radius: 14px; background: var(--ink); color: #fffefa; font-size: 15px; font-weight: 700; text-decoration: none; transition: transform .18s ease, box-shadow .18s ease, background-color .18s ease; }
  .studio-button:hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgba(48,45,35,.13); }
  .studio-button:active { transform: translateY(0) scale(.98); }
  .studio-button-secondary { border-color: #d9d4c8; background: rgba(255,254,250,.86); color: var(--ink); }
  .studio-button-secondary:hover { background: var(--yellow-soft); box-shadow: none; }
  .studio-hero-art { position: relative; align-self: end; min-height: 590px; }
  .studio-hero-art::before { content: ""; position: absolute; inset: 8% -4% 2% 9%; border-radius: 32px; background: var(--yellow); box-shadow: 0 24px 60px rgba(111,84,20,.12); }
  .studio-hero-art img { position: absolute; z-index: 1; right: -9%; bottom: -2%; width: 126%; height: auto; max-width: none; object-fit: contain; filter: drop-shadow(0 22px 28px rgba(83,62,29,.1)); }
  .studio-section { padding: 92px 0; }
  .studio-section-copy { max-width: 680px; }
  .studio-section-copy p { max-width: 620px; margin: 18px 0 0; color: var(--muted); font-size: 17px; }
  .studio-product-list { margin-top: 52px; border-top: 1px solid var(--line); }
  .studio-product { display: grid; grid-template-columns: 130px minmax(0,1fr) 190px; align-items: center; gap: 34px; min-height: 138px; border-bottom: 1px solid var(--line); color: var(--ink); text-decoration: none; transition: background-color .22s ease, padding .22s ease; }
  .studio-product:hover { padding: 0 22px; background: var(--yellow-soft); }
  .studio-product-label { color: var(--yellow-deep); font-size: 14px; font-weight: 720; }
  .studio-product p { margin: 8px 0 0; color: var(--muted); font-size: 15px; }
  .studio-product-action { justify-self: end; font-size: 14px; font-weight: 700; text-decoration: underline; text-decoration-color: transparent; text-decoration-thickness: 3px; text-underline-offset: 7px; transition: text-decoration-color .22s ease; }
  .studio-product:hover .studio-product-action { text-decoration-color: var(--yellow); }
  .studio-collaboration { padding: 92px 0; background: var(--surface); }
  .studio-collaboration-head { max-width: 760px; }
  .studio-collaboration-head > p { max-width: 620px; margin: 18px 0 0; color: var(--muted); font-size: 16px; }
  .studio-roles { display: grid; grid-template-columns: 1.08fr .92fr; gap: 18px; margin-top: 48px; }
  .studio-role { min-height: 330px; padding: 38px; border: 1px solid var(--line); border-radius: 22px; background: var(--paper); }
  .studio-role-cat { display: grid; grid-template-columns: minmax(0,1fr) 150px; align-items: end; background: var(--yellow-soft); border-color: #ead89d; }
  .studio-role-name { display: block; margin-bottom: 18px; color: var(--yellow-deep); font-size: 14px; font-weight: 720; }
  .studio-role p { max-width: 480px; margin: 16px 0 0; color: var(--muted); }
  .studio-role-points { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 26px; }
  .studio-role-points span { padding: 7px 11px; border: 1px solid var(--line); border-radius: 10px; background: #fff; color: #56534b; font-size: 13px; }
  .studio-cat-spot { display: flex; min-height: 150px; align-items: flex-end; justify-content: center; overflow: hidden; }
  .studio-cat-spot > div { transform: scale(1.12); transform-origin: bottom center; }
  .studio-boundary { display: grid; grid-template-columns: .72fr 1.28fr; gap: 70px; align-items: center; padding-top: 46px; }
  .studio-boundary-label { color: var(--yellow-deep); font-size: 14px; font-weight: 720; }
  .studio-boundary-quote { margin: 0; font-size: clamp(26px, 3.6vw, 40px); font-weight: 680; line-height: 1.35; letter-spacing: -.035em; }
  .studio-boundary-copy { margin: 18px 0 0; color: var(--muted); font-size: 16px; }
  .studio-membership { padding: 0 0 92px; }
  .studio-membership-panel { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 50px; padding: 46px 50px; border: 1px solid #ead89d; border-radius: 22px; background: var(--yellow-soft); }
  .studio-membership-panel p { max-width: 680px; margin: 14px 0 0; color: #655c47; }
  .studio-benefits { display: flex; flex-wrap: wrap; gap: 9px 18px; margin-top: 22px; color: #4c483f; font-size: 14px; font-weight: 620; }
  .studio-benefits span { padding: 6px 10px; border: 1px solid #e5d194; border-radius: 10px; background: rgba(255,255,255,.55); }
  .studio-signoff { padding: 30px 0 42px; border-top: 1px solid var(--line); color: #8a877f; font-size: 14px; text-align: center; }
  @media (prefers-reduced-motion: reduce) {
    .studio-button, .studio-product, .studio-product-action { transition: none; }
  }
  @media (max-width: 820px) {
    .studio-shell { width: min(100% - 28px, 640px); }
    .studio-nav { min-height: 64px; }
    .studio-nav-links { gap: 18px; }
    .studio-hero { grid-template-columns: 1fr; min-height: auto; padding: 54px 0 0; }
    .studio-hero-copy { padding: 0; }
    .studio-h1 { font-size: clamp(40px, 11vw, 54px); }
    .studio-hero-lead { font-size: 16px; }
    .studio-hero-art { min-height: 410px; margin-top: 28px; }
    .studio-hero-art::before { inset: 8% 0 2%; }
    .studio-hero-art img { right: -7%; width: 116%; }
    .studio-section, .studio-collaboration { padding: 68px 0; }
    .studio-product { grid-template-columns: 92px 1fr; gap: 12px 20px; padding: 24px 0; }
    .studio-product:hover { padding: 24px 14px; }
    .studio-product-action { grid-column: 2; justify-self: start; }
    .studio-roles { grid-template-columns: 1fr; }
    .studio-role { min-height: auto; padding: 30px 26px; }
    .studio-role-cat { grid-template-columns: minmax(0,1fr) 140px; }
    .studio-boundary { grid-template-columns: 1fr; gap: 20px; padding-top: 34px; }
    .studio-membership { padding-bottom: 68px; }
    .studio-membership-panel { grid-template-columns: 1fr; gap: 28px; padding: 34px 28px; }
    .studio-membership-panel .studio-button { width: 100%; }
  }
  @media (max-width: 480px) {
    .studio-nav-links .studio-nav-link:first-child { display: none; }
    .studio-actions { flex-direction: column; align-items: stretch; }
    .studio-button { width: 100%; }
    .studio-hero-art { min-height: 330px; }
    .studio-hero-art img { right: -14%; width: 126%; }
    .studio-product { grid-template-columns: 1fr; gap: 5px; }
    .studio-product-action { grid-column: auto; margin-top: 8px; }
    .studio-role-cat { grid-template-columns: 1fr; }
    .studio-cat-spot { min-height: 120px; justify-content: flex-start; }
  }
`;

export default function DimmoPage() {
  return (
    <main className="studio-page">
      <div className="studio-hero-wrap">
        <div className="studio-shell">
          <nav className="studio-nav" aria-label="小宣干货社导航">
            <Link className="studio-brand" href="/dimmo">小宣干货社</Link>
            <div className="studio-nav-links">
              <Link className="studio-nav-link" href="/library">资料库</Link>
              <Link className="studio-nav-link" href="/">喵喵工作台</Link>
            </div>
          </nav>

          <section className="studio-hero" aria-labelledby="studio-title">
            <div className="studio-hero-copy">
              <p className="studio-kicker">小宣干货社</p>
              <h1 id="studio-title" className="studio-h1">一个工作台，两位搭档。</h1>
              <p className="studio-hero-lead">小宣社长负责专业判断，Dimmo 负责先接住问题、资料和待办。</p>
              <div className="studio-actions">
                <Link className="studio-button" href="/">进入喵喵工作台</Link>
                <Link className="studio-button studio-button-secondary" href="/membership/payment">查看会员权益</Link>
              </div>
            </div>
            <div className="studio-hero-art">
              <Image
                src="/images/xiaoxuan-dimmo-workbench.png"
                alt="小宣社长与 Dimmo 在喵喵工作台一起工作"
                width={1536}
                height={1024}
                sizes="(min-width: 821px) 58vw, 100vw"
                priority
              />
            </div>
          </section>
        </div>
      </div>

      <section className="studio-section studio-shell" aria-labelledby="product-title">
        <div className="studio-section-copy">
          <h2 id="product-title" className="studio-h2">今天的事，可以从这里开始。</h2>
          <p>喵喵工作台把分散的资料、工作路径、工具和提醒收在一起。你只需要先选一件要做的事。</p>
        </div>
        <div className="studio-product-list">
          {productEntries.map((item) => (
            <Link key={item.label} href={item.href} className="studio-product">
              <span className="studio-product-label">{item.label}</span>
              <span>
                <h3 className="studio-h3">{item.title}</h3>
                <p>{item.description}</p>
              </span>
              <span className="studio-product-action">{item.action}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="studio-collaboration" aria-labelledby="role-title">
        <div className="studio-shell">
          <div className="studio-collaboration-head">
            <h2 id="role-title" className="studio-h2">谁负责什么，很清楚。</h2>
            <p>Dimmo 是工作助手，小宣社长负责专业判断。协作有边界，回答才更可靠。</p>
          </div>

          <div className="studio-roles">
            <article className="studio-role">
              <span className="studio-role-name">小宣社长</span>
              <h3 className="studio-h3">需要判断的事，由人来回答。</h3>
              <p>涉及制度解释、发展党员程序、个案处理、材料审核和合规判断时，问题会交给小宣社长确认。</p>
              <div className="studio-role-points" aria-label="小宣社长负责的事项">
                <span>专业咨询</span><span>材料判断</span><span>人工兜底</span>
              </div>
            </article>

            <article className="studio-role studio-role-cat">
              <div>
                <span className="studio-role-name">Dimmo</span>
                <h3 className="studio-h3">日常的事，先交给咪。</h3>
                <p>接待、找资料、记录待办、查看清单、到点提醒和日常陪伴，都可以先告诉 Dimmo。</p>
              </div>
              <div className="studio-cat-spot" aria-label="可以点击互动的 Dimmo">
                <DimmoCompanion />
              </div>
            </article>
          </div>

          <div className="studio-boundary">
            <span className="studio-boundary-label">工作台的原则</span>
            <div>
              <p className="studio-boundary-quote">咪可以帮你记着，但不会替社长下结论。</p>
              <p className="studio-boundary-copy">不知道从哪里开始时，先把原话告诉 Dimmo。能直接处理的事，咪马上帮你；需要专业判断的事，会连同上下文一起交给小宣社长。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="studio-membership studio-shell" aria-labelledby="membership-title">
        <div className="studio-membership-panel">
          <div>
            <h2 id="membership-title" className="studio-h2">会员让工作台更完整。</h2>
            <p>资料库会员与喵喵工作台会员共用同一份身份，无需重复开通。</p>
            <div className="studio-benefits" aria-label="会员权益">
              <span>会员专属资料</span>
              <span>批量下载</span>
              <span>Dimmo 任务小本本</span>
              <span>日常陪伴</span>
              <span>持续更新</span>
            </div>
          </div>
          <Link className="studio-button" href="/membership/payment">查看会员权益</Link>
        </div>
      </section>

      <footer className="studio-signoff studio-shell">小宣干货社，陪你工作，也陪你更好地生活。</footer>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
    </main>
  );
}
