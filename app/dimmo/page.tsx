import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dimmo 工作小猫",
  description: "住在喵喵工作台里的微信工作小猫，帮忙接待、找资料、记留言，把专业问题交给小宣社长。"
};

const styles = `
  .dimmo-product, .dimmo-product * { box-sizing: border-box; }
  body:has(.dimmo-product) > header,
  body:has(.dimmo-product) > footer { display: none; }
  body:has(.dimmo-product) > main { padding-bottom: 0; }
  .dimmo-product {
    --ink: #171717;
    --muted: #626262;
    --soft: #f7f7f5;
    --line: #e7e5e1;
    --yellow: #f6df9b;
    --yellow-soft: #fff8df;
    --green: #07c160;
    position: relative;
    overflow: hidden;
    color: var(--ink);
    background: #fff;
    font-family: Inter, "Noto Sans SC", "PingFang SC", system-ui, sans-serif;
    font-size: 16px;
    line-height: 1.85;
    letter-spacing: .02em;
  }
  .dimmo-grid-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(0,0,0,.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,0,0,.035) 1px, transparent 1px);
    background-size: 32px 32px;
    -webkit-mask-image: radial-gradient(ellipse 85% 45% at 50% 13%, #000 25%, transparent 78%);
    mask-image: radial-gradient(ellipse 85% 45% at 50% 13%, #000 25%, transparent 78%);
  }
  .dimmo-page { position: relative; width: min(100% - 40px, 980px); margin: 0 auto; padding: 72px 0 64px; }
  .dimmo-section { margin-bottom: 88px; }
  .dimmo-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
    padding: 5px 12px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: rgba(255,255,255,.86);
    font-size: 14px;
    font-weight: 650;
  }
  .dimmo-eyebrow-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 4px rgba(7,193,96,.12); }
  .dimmo-h1, .dimmo-h2, .dimmo-h3 { margin: 0; line-height: 1.38; letter-spacing: -.025em; }
  .dimmo-h1 { max-width: 580px; font-size: clamp(42px, 6vw, 66px); font-weight: 760; }
  .dimmo-h2 { font-size: clamp(28px, 4vw, 38px); font-weight: 720; }
  .dimmo-h3 { font-size: 18px; font-weight: 700; letter-spacing: -.01em; }
  .dimmo-highlight { background: linear-gradient(transparent 59%, var(--yellow) 59%, var(--yellow) 92%, transparent 92%); padding: 0 3px; }
  .dimmo-body { margin: 18px 0 0; color: var(--muted); font-size: 17px; line-height: 1.85; }
  .dimmo-caption { color: #8b8b88; font-size: 14px; }
  .dimmo-hero { display: grid; grid-template-columns: 1.15fr .85fr; align-items: center; gap: 54px; min-height: 520px; }
  .dimmo-hero-copy { position: relative; z-index: 2; }
  .dimmo-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 30px; }
  .dimmo-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 22px;
    border-radius: 12px;
    background: var(--ink);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    text-decoration: none;
    transition: transform .18s ease, box-shadow .18s ease;
  }
  .dimmo-button:hover { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,.12); }
  .dimmo-illo {
    position: relative;
    min-height: 390px;
    overflow: hidden;
    border: 1px solid #f1dea6;
    border-radius: 34px;
    background: var(--yellow-soft);
  }
  .dimmo-dots { position: absolute; width: 110px; height: 110px; right: 22px; top: 22px; opacity: .7; background-image: radial-gradient(circle, rgba(0,0,0,.2) 1.3px, transparent 1.4px); background-size: 10px 10px; }
  .dimmo-illo img { position: absolute; z-index: 2; width: 112%; height: auto; left: 50%; bottom: -18%; transform: translateX(-50%); filter: drop-shadow(0 14px 18px rgba(0,0,0,.12)); }
  .dimmo-note {
    position: absolute;
    z-index: 3;
    right: 18px;
    bottom: 18px;
    padding: 8px 13px;
    border: 1px solid rgba(0,0,0,.08);
    border-radius: 999px;
    background: rgba(255,255,255,.9);
    font-size: 14px;
    font-weight: 700;
    box-shadow: 0 8px 22px rgba(0,0,0,.07);
  }
  .dimmo-section-head { max-width: 680px; margin-bottom: 28px; }
  .dimmo-demo { display: grid; grid-template-columns: .82fr 1.18fr; gap: 28px; align-items: stretch; }
  .dimmo-demo-copy {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 510px;
    padding: 32px;
    border: 1px solid var(--line);
    border-radius: 24px;
    background: linear-gradient(145deg, #fafafa, #fff);
  }
  .dimmo-demo-copy img { align-self: center; width: 78%; height: auto; margin: 8px auto -22px; object-fit: contain; }
  .dimmo-chat { overflow: hidden; border: 1px solid var(--line); border-radius: 24px; background: #fff; box-shadow: 0 18px 50px rgba(0,0,0,.06); }
  .dimmo-chat-bar { display: flex; align-items: center; justify-content: space-between; min-height: 58px; padding: 0 20px; border-bottom: 1px solid var(--line); background: #f6f6f4; }
  .dimmo-chat-title { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; }
  .dimmo-avatar { display: grid; place-items: center; width: 31px; height: 31px; border-radius: 9px; background: #102c31; color: #fff; font-size: 15px; }
  .dimmo-chat-status { color: #7d7d79; font-size: 14px; }
  .dimmo-chat-body { display: flex; flex-direction: column; gap: 18px; min-height: 450px; padding: 24px; background-color: #f3f3f1; background-image: radial-gradient(rgba(0,0,0,.055) .7px, transparent .7px); background-size: 14px 14px; }
  .dimmo-msg { max-width: 85%; padding: 13px 16px; border-radius: 13px; font-size: 15px; line-height: 1.65; white-space: pre-line; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
  .dimmo-msg-user { align-self: flex-end; border-bottom-right-radius: 4px; background: #95ec69; }
  .dimmo-msg-cat { align-self: flex-start; border-bottom-left-radius: 4px; background: #fff; }
  .dimmo-divider { display: flex; align-items: center; gap: 12px; color: #999; font-size: 14px; }
  .dimmo-divider::before, .dimmo-divider::after { content: ""; flex: 1; height: 1px; background: #ddd; }
  .dimmo-services { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .dimmo-card { min-height: 176px; padding: 22px; border: 1px solid var(--line); border-radius: 18px; background: #fff; }
  .dimmo-card:nth-child(2), .dimmo-card:nth-child(4) { background: #faf9f6; }
  .dimmo-card-icon { display: grid; place-items: center; width: 38px; height: 38px; margin-bottom: 20px; border-radius: 11px; background: var(--yellow-soft); font-size: 20px; }
  .dimmo-card p { margin: 9px 0 0; color: var(--muted); font-size: 14px; line-height: 1.7; }
  .dimmo-boundary { margin-top: 14px; }
  .dimmo-boundary-box { padding: 24px; border-radius: 18px; background: #1b1b1b; color: #fff; }
  .dimmo-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 15px; }
  .dimmo-tag { padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,.72); color: #4c4c49; font-size: 14px; }
  .dimmo-boundary-box .dimmo-tag { background: rgba(255,255,255,.1); color: rgba(255,255,255,.82); }
  .dimmo-cta { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 30px; padding: 38px 42px; border-radius: 28px; background: var(--yellow-soft); border: 1px solid #f1dea6; }
  .dimmo-cta .dimmo-body { margin-top: 8px; }
  .dimmo-footnote { margin-top: 20px; text-align: center; color: #969690; font-size: 14px; }
  @media (prefers-reduced-motion: reduce) { .dimmo-button { transition: none; } }
  @media (max-width: 760px) {
    .dimmo-page { width: min(100% - 28px, 620px); padding: 36px 0 40px; }
    .dimmo-section { margin-bottom: 48px; }
    .dimmo-hero { grid-template-columns: 1fr; gap: 28px; min-height: auto; }
    .dimmo-h1 { font-size: clamp(38px, 12vw, 52px); }
    .dimmo-body { font-size: 16px; }
    .dimmo-illo { min-height: 270px; }
    .dimmo-illo img { width: 94%; bottom: -30%; }
    .dimmo-demo { grid-template-columns: 1fr; }
    .dimmo-demo-copy { display: none; }
    .dimmo-chat-body { min-height: 400px; padding: 18px; }
    .dimmo-services { grid-template-columns: 1fr 1fr; }
    .dimmo-card { min-height: 150px; padding: 17px; }
    .dimmo-boundary-box { padding: 20px; }
    .dimmo-cta { grid-template-columns: 1fr; padding: 30px 24px; }
    .dimmo-cta .dimmo-button { width: 100%; }
  }
  @media (max-width: 390px) {
    .dimmo-services { grid-template-columns: 1fr; }
    .dimmo-card { min-height: 0; }
  }
`;

export default function DimmoPage() {
  return (
    <div className="dimmo-product">
      <div className="dimmo-grid-bg" aria-hidden="true" />
      <div className="dimmo-page">
        <section className="dimmo-section dimmo-hero">
          <div className="dimmo-hero-copy">
            <div className="dimmo-eyebrow"><span className="dimmo-eyebrow-dot" />微信服务号里的工作小猫</div>
            <h1 className="dimmo-h1">社长不在时，<br /><span className="dimmo-highlight">咪先接住工作。</span></h1>
            <p className="dimmo-body">
              Dimmo 常驻「喵喵工作台」。找资料、留句话、问服务流程，直接发消息就好。需要专业判断的事，咪会收进小本本，交给小宣社长回复。
            </p>
            <div className="dimmo-actions">
              <Link className="dimmo-button" href="/library">打开喵喵资料库&nbsp; →</Link>
              <span className="dimmo-caption">小程序工具箱正在准备中</span>
            </div>
          </div>
          <div className="dimmo-illo" aria-label="Dimmo 工作小猫">
            <div className="dimmo-dots" aria-hidden="true" />
            <Image src="/images/dimmo-default-transparent.png" alt="Dimmo 深蓝黑工作小猫" width={1254} height={1254} priority />
            <span className="dimmo-note">● 正在值班</span>
          </div>
        </section>

        <section className="dimmo-section">
          <div className="dimmo-section-head">
            <div className="dimmo-eyebrow">咪怎么值班</div>
            <h2 className="dimmo-h2">一句话发过来，<span className="dimmo-highlight">该办的办，该等的等。</span></h2>
          </div>
          <div className="dimmo-demo">
            <div className="dimmo-demo-copy">
              <div>
                <h3 className="dimmo-h3">不是套壳客服，是小宣的工作助手。</h3>
                <p className="dimmo-body">日常问题马上接待。碰到具体党务判断，咪不会凭大模型知识乱答，会把原问题和必要上下文一起交给社长。</p>
              </div>
              <Image src="/images/dimmo-resting-transparent-v2.png" alt="趴在工作台值班的 Dimmo" width={1254} height={1254} />
            </div>
            <div className="dimmo-chat" aria-label="Dimmo 微信对话示例">
              <div className="dimmo-chat-bar">
                <div className="dimmo-chat-title"><span className="dimmo-avatar">咪</span>喵喵工作台</div>
                <span className="dimmo-chat-status">Dimmo 正在输入…</span>
              </div>
              <div className="dimmo-chat-body">
                <div className="dimmo-msg dimmo-msg-user">小宣在吗？</div>
                <div className="dimmo-msg dimmo-msg-cat">🐾 社长现在不在，出去赚钱养咪了喵。{"\n\n"}老大有事尽管告诉咪，咪记在待办小本本～</div>
                <div className="dimmo-divider">遇到专业问题</div>
                <div className="dimmo-msg dimmo-msg-user">支委会可以研究接收预备党员吗？</div>
                <div className="dimmo-msg dimmo-msg-cat">🐾 这个要请社长做专业判断，咪不敢乱答～问题已经收进小本本，等小宣社长回来回复喵。</div>
              </div>
            </div>
          </div>
        </section>

        <section className="dimmo-section">
          <div className="dimmo-section-head">
            <div className="dimmo-eyebrow">咪能做什么</div>
            <h2 className="dimmo-h2">先把小事接住，<span className="dimmo-highlight">把专业判断留给社长。</span></h2>
          </div>
          <div className="dimmo-services">
            <article className="dimmo-card"><div className="dimmo-card-icon">🐾</div><h3 className="dimmo-h3">接待</h3><p>有人来问候、找社长，咪先在工作台接住。</p></article>
            <article className="dimmo-card"><div className="dimmo-card-icon">📚</div><h3 className="dimmo-h3">找资料</h3><p>按关键词指向资料库、模板和专题内容。</p></article>
            <article className="dimmo-card"><div className="dimmo-card-icon">📝</div><h3 className="dimmo-h3">记留言</h3><p>提醒和传话会进入社长的待办小本本。</p></article>
            <article className="dimmo-card"><div className="dimmo-card-icon">🧭</div><h3 className="dimmo-h3">认边界</h3><p>不冒充社长，不编政策依据，不乱下结论。</p></article>
          </div>
          <div className="dimmo-boundary">
            <div className="dimmo-boundary-box">
              <h3 className="dimmo-h3">交给小宣社长</h3>
              <div className="dimmo-tags"><span className="dimmo-tag">制度解释</span><span className="dimmo-tag">个案处理</span><span className="dimmo-tag">材料审核</span><span className="dimmo-tag">合规判断</span></div>
            </div>
          </div>
        </section>

        <section className="dimmo-cta">
          <div>
            <h2 className="dimmo-h2">先去资料库转一圈。</h2>
            <p className="dimmo-body">工作资料、模板和专题内容都住在这里。需要时，再回微信叫咪。</p>
          </div>
          <Link className="dimmo-button" href="/library">打开喵喵资料库&nbsp; →</Link>
        </section>
        <p className="dimmo-footnote">Dimmo · 一只住在「喵喵工作台」里的工作小猫</p>
      </div>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
    </div>
  );
}
