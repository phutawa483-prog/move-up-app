require('dotenv').config();

const path = require('path');
const express = require('express');
const multer = require('multer');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const PORT = process.env.PORT || 3000;

if (!ANTHROPIC_API_KEY) {
  console.warn(
    '\n[move-up-server] WARNING: ANTHROPIC_API_KEY is not set.\n' +
    'Create a .env file (see .env.example) or set the environment variable before starting the server,\n' +
    'otherwise every /api/* call will fail with a 500 error.\n'
  );
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 } // 8MB per frame, up to 10 frames
});

// ---- Shared helper: call the Anthropic Messages API ----
async function callClaude({ system, messages, maxTokens = 1000 }) {
  if (!ANTHROPIC_API_KEY) {
    const err = new Error('Server is missing ANTHROPIC_API_KEY');
    err.status = 500;
    throw err;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`Anthropic API error (${response.status}): ${detail.slice(0, 300)}`);
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  const text = (data.content || [])
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')
    .trim();

  if (!text) {
    const err = new Error('Empty response from Anthropic API');
    err.status = 502;
    throw err;
  }
  return text;
}

function parseJsonReply(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// ---- POST /api/analyze-basketball ----
// Receives a few JPEG frames sampled from the user's video (multipart/form-data,
// field name "frames") and asks Claude for an estimated shooting analysis.
app.post('/api/analyze-basketball', upload.array('frames', 10), async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: 'No frames were uploaded.' });
    }

    const content = [
      {
        type: 'text',
        text:
          'These are frames sampled evenly across a short basketball video, in time order. ' +
          "Estimate the shooter's performance from what is visible (shooting form, ball/hoop position, " +
          'follow-through, court context). Respond ONLY with valid JSON, no markdown fences, no preamble, ' +
          'in exactly this shape: {"made": number, "attempts": number, "two": number, "three": number, ' +
          '"rhythm": number (0-100), "note": "short Thai headline like \'ชู้ตลง 6 ลูก ได้ 12 คะแนน\'"}. ' +
          'attempts must be >= made, and two+three must be <= made. This is a rough AI estimate, so give ' +
          'your best reasonable guess even with limited frames rather than all zeros.'
      },
      ...files.map(file => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: file.mimetype && file.mimetype.startsWith('image/') ? file.mimetype : 'image/jpeg',
          data: file.buffer.toString('base64')
        }
      }))
    ];

    const text = await callClaude({ messages: [{ role: 'user', content }] });
    const data = parseJsonReply(text);
    res.json(data);
  } catch (error) {
    console.error('[analyze-basketball]', error);
    res.status(error.status || 500).json({ error: error.message || 'Analysis failed.' });
  }
});

// ---- POST /api/ai-coach ----
// Receives { history: [{role, content}], language: 'th'|'en' } and returns
// { th, en } — a bilingual coach reply so the frontend can switch languages
// without re-calling the API.
app.post('/api/ai-coach', async (req, res) => {
  try {
    const { history } = req.body || {};
    if (!Array.isArray(history) || !history.length) {
      return res.status(400).json({ error: 'Missing conversation history.' });
    }

    const messages = history
      .filter(m => m && typeof m.content === 'string' && m.content.trim())
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

    const system =
      'You are a friendly, knowledgeable sports coach inside the MOVE UP app, helping a young athlete with ' +
      'football, volleyball, or basketball. Reply ONLY with valid JSON, no markdown fences, no preamble, in the ' +
      'exact shape {"th":"...","en":"..."} where "th" is your reply in Thai and "en" is the same reply in ' +
      'English. Keep each reply to 2-4 short, practical sentences (a quick drill or tip), matching the tone of ' +
      'a supportive personal coach.';

    const text = await callClaude({ system, messages });
    const data = parseJsonReply(text);
    if (!data.th || !data.en) throw new Error('Invalid AI response shape');
    res.json(data);
  } catch (error) {
    console.error('[ai-coach]', error);
    res.status(error.status || 500).json({ error: error.message || 'Coach reply failed.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'move-up-app.html'));
});

app.listen(PORT, () => {
  console.log(`[move-up-server] listening on http://localhost:${PORT}`);
});
