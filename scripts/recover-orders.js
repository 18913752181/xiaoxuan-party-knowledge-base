// 一次性恢复脚本：主动查询微信订单状态，已支付的立即开通会员。
// 运行方式：docker exec app-web-1 node /tmp/recover-orders.js
const crypto = require('crypto');
const fs = require('fs');

const env = (n) => (process.env[n] || '').trim();
const API = 'https://api.mch.weixin.qq.com';
const SUPA = (env('NEXT_PUBLIC_SUPABASE_URL') || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const SVC = env('SUPABASE_SERVICE_ROLE_KEY');

function wxHeaders(method, path, body) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const msg = `${method}\n${path}\n${ts}\n${nonce}\n${body}\n`;
  const key = fs.readFileSync(env('WECHAT_PAY_PRIVATE_KEY_PATH'), 'utf8');
  const sig = crypto.sign('RSA-SHA256', Buffer.from(msg), key).toString('base64');
  return {
    Authorization: `WECHATPAY2-SHA256-RSA2048 mchid="${env('WECHAT_PAY_MCH_ID')}",nonce_str="${nonce}",signature="${sig}",timestamp="${ts}",serial_no="${env('WECHAT_PAY_SERIAL_NO')}"`,
    Accept: 'application/json',
    'Accept-Language': 'zh-CN',
    'Content-Type': 'application/json'
  };
}

async function queryOrder(no) {
  const path = `/v3/pay/transactions/out-trade-no/${no}?mchid=${env('WECHAT_PAY_MCH_ID')}`;
  const r = await fetch(API + path, { headers: wxHeaders('GET', path, '') });
  return r.json();
}

async function main() {
  const r = await fetch(`${SUPA}/rest/v1/membership_orders?select=out_trade_no,amount_total,status&status=eq.pending&order=created_at.desc&limit=30`, {
    headers: { apikey: SVC }
  });
  const orders = await r.json();
  if (!Array.isArray(orders)) {
    console.log('查询订单失败:', JSON.stringify(orders));
    return;
  }
  console.log(`待支付订单共 ${orders.length} 笔`);
  for (const o of orders) {
    let d = {};
    try {
      d = await queryOrder(o.out_trade_no);
    } catch (e) {
      console.log(o.out_trade_no, '查询异常', e.message);
      continue;
    }
    console.log(o.out_trade_no, `金额${o.amount_total}`, '->', d.trade_state || d.code || 'UNKNOWN');
    if (d.trade_state === 'SUCCESS' && d.amount && d.amount.total === o.amount_total) {
      const act = await fetch(`${SUPA}/rest/v1/rpc/activate_membership_order`, {
        method: 'POST',
        headers: { apikey: SVC, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_out_trade_no: o.out_trade_no,
          p_transaction_id: d.transaction_id,
          p_paid_at: d.success_time,
          p_raw_notification: d
        })
      });
      const text = await act.text();
      console.log('  >>> 开通会员', o.out_trade_no, 'HTTP', act.status, text.slice(0, 200));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
