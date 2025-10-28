
// server.js - ToBeNB-TeenCare (Node.js + Express) -- demo-ready
// IMPORTANT: This is a starter template. For production, follow security & PDPA guidance.

const express = require('express');
const line = require('@line/bot-sdk');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};
const client = new line.Client(config);
const pool = new Pool({ connectionString: process.env.DATABASE_URL});

const app = express();
app.use(bodyParser.json());

// 9Q questions (Thai)
const nineQ = [
  "1) ในช่วง 2 สัปดาห์ที่ผ่านมา คุณรู้สึกเศร้าหรือหดหู่บ่อยแค่ไหน?",
  "2) คุณสูญเสียความสนใจ/ความสุขในการทำกิจกรรมที่เคยชอบหรือไม่?",
  "3) คุณมีปัญหาในการนอน (มากขึ้นหรือน้อยลง)?",
  "4) คุณรู้สึกเหนื่อย/ไม่มีแรงบ่อยไหม?",
  "5) คุณรู้สึกไม่มีคุณค่า/รู้สึกผิดมากผิดน้อยแค่ไหน?",
  "6) คุณมีปัญหาในการคิดหรือตัดสินใจ?",
  "7) ปัญหาเกี่ยวกับการกิน (เบื่ออาหาร/กินมากขึ้น)?",
  "8) มีความคิดอยากตายหรือทำร้ายตัวเองไหม?",
  "9) มีพฤติกรรมเสี่ยง/ใช้สารเสพติดเพิ่มขึ้นไหม?"
];

function calc9QScore(answers) {
  return answers.reduce((a,b)=>a+Number(b||0),0);
}

function assessRisk(score, answers) {
  const redFlag = Number(answers[7] || 0) > 0; // Q8
  if (redFlag) return {level: 'สูง', reason: 'มีความคิดจะทำร้ายตัวเองหรือคิดอยากตาย'};
  if (score >= 15) return {level: 'สูง', reason: 'คะแนนสูง'};
  if (score >= 10) return {level: 'ค่อนข้างสูง', reason: 'คะแนนค่อนข้างสูง'};
  if (score >= 5) return {level: 'ปานกลาง', reason: 'คะแนนปานกลาง'};
  return {level: 'ต่ำ', reason: 'คะแนนต่ำ'};
}

async function saveScreening(userId, sessionId, answers, score, risk, consent) {
  if (!pool) return;
  const clientDb = await pool.connect();
  try {
    await clientDb.query('BEGIN');
    const insertSession = `INSERT INTO sessions(session_id, user_id, started_at, current_stage) VALUES($1,$2,now(),'finished') ON CONFLICT DO NOTHING`;
    await clientDb.query(insertSession, [sessionId, userId]);
    const insertScreen = `INSERT INTO screening_9q(session_id, q1,q2,q3,q4,q5,q6,q7,q8,q9, total_score, risk_level, red_flag, consent, created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())`;
    await clientDb.query(insertScreen, [sessionId, answers[0],answers[1],answers[2],answers[3],answers[4],answers[5],answers[6],answers[7],answers[8], score, risk.level, Number(answers[7]>0), consent]);
    await clientDb.query('COMMIT');
  } catch (e) {
    await clientDb.query('ROLLBACK');
    console.error('DB save failed', e);
  } finally {
    clientDb.release();
  }
}

// Simple in-memory session store for demo. Replace with Redis or DB for production.
const sessions = new Map();

// Admin list (LINE userIds) - set in Render/Env
const ADMIN_LINE_IDS = (process.env.ADMIN_LINE_IDS).split(',').filter(Boolean);

app.get('/', (req, res) => {
  res.send('ToBeNB-TeenCare webhook is running. Configure /webhook as LINE webhook.');
});

app.post('/webhook', async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.json({status: 'ok'});
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return null;
  const userId = event.source.userId;
  const text = event.message.text.trim();
  
if (/^(เริ่มใหม่|ทำอีกครั้ง|ประเมินใหม่)$/i.test(text)){
  sessions.delete(userId);
  sessions.set(userId, {
    id: uuidv4(),
    stage: 'consent',
    answers: Array(9).fill(null),
    qIndex: 0
  });
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: 'เริ่มการประเมินใหม่ได้เลยครับ/ค่ะ พิมพ์ "ตกลง" เพื่อเริ่ม'
  });
}
  
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      id: uuidv4(),
      stage: 'consent',
      answers: Array(9).fill(null),
      qIndex: 0
    });
  }
  const s = sessions.get(userId);

  if (s.stage === 'consent') {
    if (/^(ตกลง|เริ่ม)$/i.test(text)) {
      s.stage = '9q'; s.qIndex = 0;
      return client.replyMessage(event.replyToken, { type:'text', text: 'ตอบด้วยตัวเลข 0-3 (0=ไม่เลย,1=บางวัน,2=บ่อย,3=เกือบทุกวัน)\\n' + nineQ[0] });
    }
    if (/^(ไม่ตกลง|ยกเลิก)$/i.test(text)) {
      sessions.delete(userId);
      return client.replyMessage(event.replyToken, { type:'text', text: 'เข้าใจครับ/ค่ะ หากต้องการความช่วยเหลือฉุกเฉิน โปรดติดต่อครูที่ปรึกษาหรือสายด่วนของโรงเรียน' });
    }
    return client.replyMessage(event.replyToken, { type:'text', text: 'ก่อนเริ่ม ผม/ฉันขออนุญาตเก็บข้อมูลจำเป็นเพื่อประเมินสภาพจิตใจของคุณ ข้อมูลจะเก็บอย่างปลอดภัยและจะส่งต่อเฉพาะเมื่อมีความเสี่ยงสูงหรือตามที่คุณยินยอม\\n\\nตอบ \"ตกลง\" เพื่อเริ่ม หรือ \"ไม่ตกลง\" เพื่อยกเลิก' });
  }

  if (s.stage === '9q') {
    const v = parseInt(text);
    if (![0,1,2,3].includes(v)) {
      return client.replyMessage(event.replyToken, { type:'text', text: 'กรุณาตอบด้วยตัวเลข 0,1,2,3 เท่านั้น (0=ไม่เลย,1=บางวัน,2=บ่อย,3=เกือบทุกวัน)' });
    }
    s.answers[s.qIndex] = v; s.qIndex += 1;
    if (s.qIndex < 9) return client.replyMessage(event.replyToken, { type:'text', text: nineQ[s.qIndex] });

    // compute
    const score = calc9QScore(s.answers);
    const risk = assessRisk(score, s.answers);
    s.stage = 'post9q'; s.result = {score, risk};

    // save result (consent assumed true for demo)
    await saveScreening(userId, s.id, s.answers, score, risk, true);

    let replyText = `ผลการคัดกรอง: คะแนนรวม ${score} (${risk.level})\\n\\nคำแนะนำเบื้องต้น:\\n- หากรู้สึกอันตราย โปรดติดต่อครู/สายด่วนทันที\\n- หากต้องการพูดคุยต่อ เลือกหัวข้อที่ต้องการ: ครอบครัว / เรียน / ความรัก / เพื่อน / โซเชียล / อื่นๆ`;

    if (risk.level === 'สูง' || risk.level === 'ค่อนข้างสูง') {
      await client.replyMessage(event.replyToken, [{type:'text', text: replyText}, {type:'text', text: 'จากผลประเมิน เราพบความเสี่ยงสูง/ค่อนข้างสูง อยากให้เราส่งข้อมูลสรุปให้ครูที่ปรึกษาเพื่อให้มีคนติดต่อช่วยไหม? (ตอบ: ยินยอม / ไม่ยินยอม)'}]);
    } else {
      await client.replyMessage(event.replyToken, { type:'text', text: replyText });
    }
    return null;
  }

  if (s.stage === 'post9q') {
    const lower = text.toLowerCase();
    if (/^(ส่งต่อ|ยินยอม|ตกลง)$/i.test(text)) {
      // push to admins
      const payload = {
        type: 'flex',
        altText: `แจ้งส่งต่อ: ผู้เรียน ${userId}`,
        contents: buildAdminFlex(userId, s)
      };
      await Promise.all(ADMIN_LINE_IDS.map(id => client.pushMessage(id, payload)));
      s.stage = 'forwarded';
      return client.replyMessage(event.replyToken, { type:'text', text: 'ส่งข้อมูลให้ครูที่ปรึกษาแล้วครับ/ค่ะ ครูจะติดต่อกลับโดยเร็ว' });
    }

    const topics = {
      'ครอบครัว': 'เรื่องครอบครัว: ลองเล่าเหตุการณ์ล่าสุด 1-2 ข้อ เราช่วยออกแบบการสื่อสารกับผู้ใหญ่',
      'เรียน': 'เรื่องการเรียน: บอกปัญหาแบบสั้นๆ (เช่น เวลา/คะแนน/แรงกดดัน) เราจะช่วยแนะนำขั้นตอนแรก',
      'ความรัก': 'เรื่องความรัก: เล่าได้แบบไม่ต้องกลัว เราเป็นพื้นที่ปลอดภัย',
      'เพื่อน': 'เรื่องเพื่อน: บอกว่ามีปัญหาประเภทไหน เราช่วยเตรียมประโยคและทางเลือก',
      'โซเชียล': 'เรื่องโซเชียล: แนะนำการจัดขอบเขต และการเก็บหลักฐานหากถูกรังแก'
    };
    if (topics[text]) return client.replyMessage(event.replyToken, { type:'text', text: topics[text] });

    return client.replyMessage(event.replyToken, { type:'text', text: 'หากต้องการให้ส่งต่อให้ครูพิมพ์ \"ส่งต่อ\" หรือเลือกหัวข้อ: ครอบครัว/เรียน/ความรัก/เพื่อน/โซเชียล' });
  }

  return client.replyMessage(event.replyToken, { type:'text', text: 'ต้องการประเมินใหม่ พิมพ์ "เริ่มใหม่" ได้เลย' });
}

// Build simple flex content for admin (dynamically)
function buildAdminFlex(userId, session) {
  const score = session.result ? session.result.score : '-';
  const risk = session.result ? session.result.risk.level : '-';
  const reason = session.result ? session.result.risk.reason : '-';
  const answersText = session.answers.map((a,i)=> `${i+1}. ${a}`).join('\\n');

  return {
    type: 'bubble',
    header: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: 'แจ้งส่งต่อจาก ToBeNB-TeenCare', weight:'bold' }]},
    body: {
      type: 'box', layout: 'vertical', spacing: 'sm',
      contents: [
        { type: 'text', text: `User ID: ${userId}`, size:'sm' },
        { type: 'text', text: `คะแนน 9Q: ${score}`, size:'md', weight:'bold' },
        { type: 'text', text: `ระดับความเสี่ยง: ${risk}`, size:'sm' },
        { type: 'text', text: `เหตุผล: ${reason}`, wrap:true },
        { type: 'text', text: 'คำตอบ (สรุป):', weight:'bold', margin:'md' },
        { type: 'text', text: answersText, wrap:true, size:'xs' }
      ]
    },
    footer: {
      type: 'box', layout: 'horizontal', contents: [
        { type:'button', action:{type:'message', label:'ติดต่อผู้เรียน', text:'ติดต่อผู้เรียน:'+userId} },
        { type:'button', action:{type:'message', label:'ปิดเคส', text:'ปิดเคส:'+userId} }
      ]
    }
  };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ToBeNB-TeenCare webhook listening on ${PORT}`));
