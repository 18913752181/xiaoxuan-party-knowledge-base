import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: { absolute: "小宣干货社简介" },
  description: "认识小宣干货社，以及住在喵喵工作台里的小宣社长和工作小猫 Dimmo。"
};

const styles = `
  .studio-page, .studio-page * { box-sizing: border-box; }
  body:has(.studio-page) > header, body:has(.studio-page) > footer { display: none; }
  body:has(.studio-page) > main { padding-bottom: 0; }
  .studio-page {
    --ink: #302d28; --muted: #706a61; --line: #e9e3d7; --paper: #fffdf8;
    --warm: #f4d77d; --warm-soft: #fff5d8;
    min-height: 100vh; overflow: hidden; color: var(--ink); background: var(--paper);
    font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    font-size: 16px; line-height: 1.78; letter-spacing: .015em;
  }
  .studio-shell { width: min(100% - 44px, 1120px); margin: 0 auto; }
  .studio-nav { display: flex; align-items: center; justify-content: space-between; min-height: 72px; border-bottom: 1px solid var(--line); }
  .studio-brand { font-size: 18px; font-weight: 700; letter-spacing: -.02em; }
  .studio-nav-link { color: var(--ink); font-size: 14px; font-weight: 600; text-decoration: none; }
  .studio-nav-link:hover { text-decoration: underline; text-underline-offset: 5px; }
  .studio-hero { position: relative; display: grid; grid-template-columns: .86fr 1.14fr; align-items: center; min-height: 610px; padding: 42px 0 24px; }
  .studio-hero::before { content: ""; position: absolute; z-index: 0; width: 520px; height: 520px; right: -120px; top: 44px; border-radius: 50%; background: var(--warm-soft); }
  .studio-hero-copy { position: relative; z-index: 2; padding-bottom: 46px; }
  .studio-kicker { margin: 0 0 18px; color: #8b6a16; font-size: 14px; font-weight: 650; letter-spacing: .12em; }
  .studio-h1, .studio-h2, .studio-h3 { margin: 0; line-height: 1.32; letter-spacing: -.03em; }
  .studio-h1 { max-width: 560px; font-size: clamp(42px, 5.2vw, 62px); font-weight: 680; }
  .studio-h2 { font-size: clamp(29px, 3.7vw, 40px); font-weight: 680; }
  .studio-h3 { font-size: 20px; font-weight: 650; }
  .studio-hero-lead { max-width: 520px; margin: 24px 0 0; color: var(--muted); font-size: 18px; }
  .studio-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; margin-top: 30px; }
  .studio-button { display: inline-flex; align-items: center; justify-content: center; min-height: 50px; padding: 0 22px; border-radius: 14px; background: #35312c; color: #fff; font-size: 15px; font-weight: 650; text-decoration: none; transition: transform .18s ease, box-shadow .18s ease; }
  .studio-button:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(37,31,21,.16); }
  .studio-action-note { color: #81796d; font-size: 14px; }
  .studio-hero-art { position: relative; z-index: 1; align-self: end; min-height: 585px; }
  .studio-hero-art img { width: 126%; height: auto; max-width: none; margin: 0 0 -18px -20%; object-fit: contain; filter: drop-shadow(0 24px 28px rgba(83,62,29,.11)); }
  .studio-intro { display: grid; grid-template-columns: .78fr 1.22fr; gap: 70px; padding: 76px 0; border-top: 1px solid var(--line); }
  .studio-intro-title { font-size: clamp(28px, 4vw, 42px); }
  .studio-prose { margin: 0; color: var(--muted); font-size: 18px; }
  .studio-prose + .studio-prose { margin-top: 18px; }
  .studio-quote { margin: 34px 0 0; padding: 24px 28px; border-left: 4px solid var(--warm); background: rgba(255,245,216,.66); color: #3d382f; font-size: 17px; }
  .studio-work { padding: 76px 0; background: #34312c; color: #fff; }
  .studio-work .studio-kicker { color: var(--warm); }
  .studio-work-head { display: grid; grid-template-columns: 1fr .72fr; align-items: end; gap: 50px; margin-bottom: 54px; }
  .studio-work-note { margin: 0; color: rgba(255,255,255,.64); font-size: 16px; }
  .studio-roles { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid rgba(255,255,255,.18); }
  .studio-role { padding: 36px 54px 12px 0; }
  .studio-role + .studio-role { padding-left: 54px; border-left: 1px solid rgba(255,255,255,.18); }
  .studio-role-name { display: block; margin-bottom: 11px; color: var(--warm); font-size: 14px; font-weight: 650; letter-spacing: .08em; }
  .studio-role p { margin: 13px 0 0; color: rgba(255,255,255,.7); }
  .studio-places { padding: 76px 0 70px; }
  .studio-places-head { max-width: 700px; margin-bottom: 42px; }
  .studio-places-head p { margin: 16px 0 0; color: var(--muted); font-size: 17px; }
  .studio-place-list { border-top: 1px solid var(--line); }
  .studio-place { display: grid; grid-template-columns: 180px 1fr auto; align-items: center; gap: 30px; min-height: 108px; border-bottom: 1px solid var(--line); }
  .studio-place-state { color: #8b6a16; font-size: 14px; font-weight: 650; }
  .studio-place p { margin: 5px 0 0; color: var(--muted); font-size: 15px; }
  .studio-place-link { color: var(--ink); font-size: 15px; font-weight: 650; text-decoration: none; }
  .studio-place-link:hover { text-decoration: underline; text-underline-offset: 5px; }
  .studio-boundary { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 48px; margin-bottom: 76px; padding: 42px 48px; border: 1px solid #eddaa0; border-radius: 22px; background: var(--warm-soft); }
  .studio-boundary p { max-width: 710px; margin: 12px 0 0; color: #665b48; font-size: 16px; }
  .studio-signoff { padding-bottom: 44px; text-align: center; color: #918a7f; font-size: 14px; }
  @media (prefers-reduced-motion: reduce) { .studio-button { transition: none; } }
  @media (max-width: 800px) {
    .studio-shell { width: min(100% - 28px, 620px); }
    .studio-nav { min-height: 62px; }
    .studio-hero { grid-template-columns: 1fr; min-height: auto; padding-top: 54px; }
    .studio-hero::before { width: 330px; height: 330px; right: -145px; top: 330px; }
    .studio-hero-copy { padding-bottom: 10px; }
    .studio-h1 { font-size: clamp(36px, 9.5vw, 44px); }
    .studio-hero-lead { font-size: 16px; }
    .studio-hero-art { min-height: 345px; }
    .studio-hero-art img { width: 118%; margin: 0 0 -12px -12%; }
    .studio-intro { grid-template-columns: 1fr; gap: 24px; padding: 64px 0; }
    .studio-prose { font-size: 16px; }
    .studio-work { padding: 64px 0; }
    .studio-work-head { grid-template-columns: 1fr; gap: 18px; margin-bottom: 38px; }
    .studio-roles { grid-template-columns: 1fr; }
    .studio-role { padding: 30px 0; }
    .studio-role + .studio-role { padding-left: 0; border-top: 1px solid rgba(255,255,255,.18); border-left: 0; }
    .studio-places { padding: 64px 0; }
    .studio-place { grid-template-columns: 1fr auto; gap: 8px 20px; padding: 22px 0; }
    .studio-place-state { grid-column: 1 / -1; }
    .studio-place p { font-size: 14px; }
    .studio-boundary { grid-template-columns: 1fr; gap: 26px; margin-bottom: 50px; padding: 30px 24px; }
    .studio-boundary .studio-button { width: 100%; }
  }
  @media (max-width: 420px) {
    .studio-nav-link { display: none; }
    .studio-actions { align-items: flex-start; flex-direction: column; }
    .studio-hero-art { min-height: 300px; }
    .studio-place { grid-template-columns: 1fr; }
    .studio-place-state { grid-column: auto; }
  }
`;

export default function DimmoPage() {
  return (
    <div className="studio-page">
      <div className="studio-shell">
        <nav className="studio-nav" aria-label="小宣干货社导航">
          <span className="studio-brand">小宣干货社</span>
          <Link className="studio-nav-link" href="/library">去喵喵资料库</Link>
        </nav>
        <section className="studio-hero">
          <div className="studio-hero-copy">
            <p className="studio-kicker">小宣和 DIMMO 的喵喵工作台</p>
            <h1 className="studio-h1">把工作里的真问题，整理成能用的答案。</h1>
            <p className="studio-hero-lead">小宣负责研究、判断和回复，Dimmo 负责先把每一次来访接住。这里是我们一起工作的地方。</p>
            <div className="studio-actions">
              <Link className="studio-button" href="/library">看看我们整理的资料</Link>
              <span className="studio-action-note">在公众号里，也可以直接叫咪</span>
            </div>
          </div>
          <div className="studio-hero-art">
            <Image src="/images/xiaoxuan-dimmo-workbench.png" alt="小宣和 Dimmo 一起在喵喵工作台工作" width={1536} height={1024} priority />
          </div>
        </section>
        <section className="studio-intro">
          <div>
            <p className="studio-kicker">认识干货社</p>
            <h2 className="studio-h2 studio-intro-title">不是冷冰冰的资料站，是有人认真守着的工作台。</h2>
          </div>
          <div>
            <p className="studio-prose">小宣是「干货社」社长，也是公众号「小宣同志」本人。平时会整理资料、研究具体问题，也会亲自回复那些需要判断和经验的咨询。</p>
            <p className="studio-prose">Dimmo 就住在旁边。有人从微信敲门时，咪先接待、找资料、记留言；碰到不能乱答的事，就把原话和上下文收进小本本，等社长回来。</p>
            <blockquote className="studio-quote">“一个负责把事情想清楚，一个负责先把来意接住。”</blockquote>
          </div>
        </section>
      </div>
      <section className="studio-work">
        <div className="studio-shell">
          <div className="studio-work-head">
            <div><p className="studio-kicker">工作台的一天</p><h2 className="studio-h2">资料有人整理，问题有人惦记。</h2></div>
            <p className="studio-work-note">我们想做的不是再添一个聊天机器人，而是让每个从公众号走进来的人，都知道事情被谁接住、接下来会去哪里。</p>
          </div>
          <div className="studio-roles">
            <article className="studio-role"><span className="studio-role-name">小宣社长</span><h3 className="studio-h3">处理需要专业判断的事</h3><p>制度解释、发展党员程序、个案处理、材料审核和合规判断，都由小宣本人看过后回复。</p></article>
            <article className="studio-role"><span className="studio-role-name">工作小猫 DIMMO</span><h3 className="studio-h3">在微信里先接住来访</h3><p>日常接待、资料导航、固定问题、留言和提醒交给咪。专业问题宁可多等一会儿，也不会让咪冒充社长下结论。</p></article>
          </div>
        </div>
      </section>
      <div className="studio-shell">
        <section className="studio-places">
          <div className="studio-places-head"><p className="studio-kicker">工作台的三个入口</p><h2 className="studio-h2">想找什么，就从顺手的地方进来。</h2><p>资料、工具和留言会慢慢住进同一个工作台。现在已经能用的，咪先带路。</p></div>
          <div className="studio-place-list">
            <article className="studio-place"><span className="studio-place-state">已经开放</span><div><h3 className="studio-h3">喵喵资料库</h3><p>工作资料、模板和专题内容</p></div><Link className="studio-place-link" href="/library">现在去看看</Link></article>
            <article className="studio-place"><span className="studio-place-state">正在值班</span><div><h3 className="studio-h3">微信工作小猫</h3><p>接待、找资料、记留言和转交专业问题</p></div><span className="studio-place-link">公众号里叫咪</span></article>
            <article className="studio-place"><span className="studio-place-state">正在准备</span><div><h3 className="studio-h3">喵喵小程序</h3><p>入党时间核算、红色教育基地导览</p></div><span className="studio-place-link">稍后见面</span></article>
          </div>
        </section>
        <section className="studio-boundary">
          <div><h2 className="studio-h2">有些问题，值得等社长回来。</h2><p>Dimmo 会聊天，也会找资料，但不会冒充小宣给专业结论。这不是咪不肯帮忙，是喵喵工作台对每个问题的认真。</p></div>
          <Link className="studio-button" href="/library">先去资料库转转</Link>
        </section>
        <p className="studio-signoff">小宣干货社 · 小宣和 Dimmo 一起住在「喵喵工作台」</p>
      </div>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
    </div>
  );
}
