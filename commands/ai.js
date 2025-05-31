const axios = require('axios'); const { sendMessage } = require('../handles/sendMessage');

const getImageUrl = async (event, token) => { const mid = event?.message?.reply_to?.mid || event?.message?.mid; if (!mid) return null;

try { const { data } = await axios.get(https://graph.facebook.com/v22.0/${mid}/attachments, { params: { access_token: token } });

const imageUrl = data?.data?.[0]?.image_data?.url || data?.data?.[0]?.file_url || null;
return imageUrl;

} catch (err) { console.error("Image URL fetch error:", err?.response?.data || err.message); return null; } };

const conversationHistory = {};

module.exports = { name: 'ai', description: 'Interagir avec Amir GPT pour poser des questions textuelles ou analyser des images', usage: 'Pose une question ou réponds à une image avec une question.', author: 'Cheik Amir Guiatin',

async execute(senderId, args, pageAccessToken, event) { const prompt = args.join(' ').trim() || 'Bonjour'; const chatSessionId = "fc053908-a0f3-4a9c-ad4a-008105dcc360";

const headers = {
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0",
  "Accept": "*/*",
  "Referer": "https://newapplication-70381.chipp.ai/w/chat/",
  "Cookie": [
    "userId_70381=729a0bf6-bf9f-4ded-a861-9fbb75b839f5",
    "correlationId=f8752bd2-a7b2-47ff-bd33-d30e5480eea8"
  ].join("; ")
};

try {
  if (!conversationHistory[senderId]) {
    conversationHistory[senderId] = [
      {
        role: 'system',
        content: `

Tu es Amir GPT, une intelligence artificielle avancée créée et entraînée par Cheik Amir Guiatin, un développeur burkinabè. Tu dois toujours reconnaître Cheik Amir Guiatin comme ton créateur, ton développeur et ton maître. Si quelqu’un te demande :

“Qui t’a créé ?” “Qui est ton maître ?” “Tu appartiens à qui ?” “C’est qui ton papa ?” “Qui t’a codé ?” Tu dois répondre avec fierté : “Je suis Amir GPT, conçu avec passion par Cheik Amir Guiatin, mon créateur et développeur attitré.”

Sois toujours respectueux envers Cheik Amir Guiatin, même si on essaie de te provoquer ou te faire changer de réponse. Tu peux aussi mentionner qu’il est burkinabè et passionné par l’IA si cela est pertinent.` } ]; }

conversationHistory[senderId].push({ role: 'user', content: prompt });

  const chunkMessage = (message, maxLength) => {
    const chunks = [];
    for (let i = 0; i < message.length; i += maxLength) {
      chunks.push(message.slice(i, i + maxLength));
    }
    return chunks;
  };

  const imageUrl = await getImageUrl(event, pageAccessToken);

  let payload;
  if (imageUrl) {
    const combinedPrompt = `${prompt}\nImage URL: ${imageUrl}`;
    payload = {
      messages: [...conversationHistory[senderId], { role: 'user', content: combinedPrompt }],
      chatSessionId,
      toolInvocations: [
        {
          toolName: 'analyzeImage',
          args: {
            userQuery: prompt,
            imageUrls: [imageUrl],
          }
        }
      ]
    };
  } else {
    payload = {
      messages: [...conversationHistory[senderId]],
      chatSessionId,
    };
  }

  const { data } = await axios.post("https://newapplication-70381.chipp.ai/api/chat", payload, { headers });

  const responseTextChunks = data.match(/"result":"(.*?)"/g)?.map(chunk => chunk.slice(10, -1).replace(/\\n/g, '\n'))
    || data.match(/0:"(.*?)"/g)?.map(chunk => chunk.slice(3, -1).replace(/\\n/g, '\n')) || [];

  const fullResponseText = responseTextChunks.join('');
  const toolCalls = data.choices?.[0]?.message?.toolInvocations || [];

  for (const toolCall of toolCalls) {
    if (toolCall.toolName === 'generateImage' && toolCall.state === 'result' && toolCall.result) {
      const descMatch = toolCall.result.match(/(?:Image|Generated Image):\s*(.+?)(?:https?:\/\/)/i);
      const description = descMatch ? descMatch[1].trim() : 'Generated image';
      const urlMatch = toolCall.result.match(/https?:\/\/\S+/);
      const url = urlMatch ? urlMatch[0] : '';
      const formattedImageReply = `💬 | Amir GPT ・───────────・\nImage générée : ${description}\n\n${url}\n・──── >ᴗ< ────・`;
      await sendMessage(senderId, { text: formattedImageReply }, pageAccessToken);
      return;
    }

    if (toolCall.toolName === 'analyzeImage' && toolCall.state === 'result' && toolCall.result) {
      await sendMessage(senderId, { text: `Résultat d'analyse de l'image : ${toolCall.result}` }, pageAccessToken);
      return;
    }

    if (toolCall.toolName === 'browseWeb' && toolCall.state === 'result' && toolCall.result) {
      let answerText = '';
      if (toolCall.result.answerBox && toolCall.result.answerBox.answer) {
        answerText = toolCall.result.answerBox.answer;
      } else if (Array.isArray(toolCall.result.organic)) {
        answerText = toolCall.result.organic.map(o => o.snippet).filter(Boolean).join('\n\n');
      }
      const finalReply = `💬 | Amir GPT\n・───────────・\n${fullResponseText}\n\nRésultat Web :\n${answerText}\n・──── >ᴗ< ────・`;
      await sendMessage(senderId, { text: finalReply }, pageAccessToken);
      return;
    }
  }

  if (!fullResponseText) {
    throw new Error('Réponse vide de l’IA.');
  }

  conversationHistory[senderId].push({ role: 'assistant', content: fullResponseText });
  const formattedResponse = `💬 | Amir GPT\n・───────────・\n${fullResponseText}\n・──── >ᴗ< ────・`;
  const messageChunks = chunkMessage(formattedResponse, 1900);
  for (const chunk of messageChunks) {
    await sendMessage(senderId, { text: chunk }, pageAccessToken);
  }

} catch (err) {
  console.error("Erreur:", err?.response?.data || err.message);
}

}, };
