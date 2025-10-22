// server.js - VERSÃO COM MÚLTIPLAS APIS DE GEOLOCALIZAÇÃO

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require("socket.io");
const axios = require('axios');
const cors = require('cors');
const Jimp = require('jimp');
const dialogue = require('./dialogue');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);

const PUSHPAY_API_KEY = "sua_chave_secreta_da_api_do_pushpay_aqui";
const BASE_URL = 'https://whatsapp-backend-vott.onrender.com'; // ← URL DO SEU BACKEND

// --- CONFIGURAÇÃO DO SERVIDOR ---
app.use(cors());
app.use(bodyParser.json());
// Servindo APENAS a pasta de mídia
app.use(express.static(path.join(__dirname, 'media')));
// -----------------------------------------

// Rota para gerar a imagem com a cidade
app.get('/generate-image-with-city', async (req, res) => {
  try {
    const city = req.query.cidade || 'Sua Cidade';
    const imagePath = path.join(__dirname, 'media', 'generated-image-1.png');
    const fontPath = path.join(__dirname, 'media', 'fonts', 'open-sans-64-black.fnt');

    const font = await Jimp.loadFont(fontPath);
    const image = await Jimp.read(imagePath);
    const textToPrint = `${city}`;

    const finalX = 198;
    const finalY = 115;

    image.print(font, finalX, finalY, { text: textToPrint, alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT }, image.bitmap.width, image.bitmap.height);

    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
    res.set('Content-Type', Jimp.MIME_PNG);
    res.send(buffer);
  } catch (error) {
    console.error("ERRO CRÍTICO AO GERAR IMAGEM NO BACKEND:", error);
    res.status(500).send("Erro ao gerar imagem: " + error.message);
  }
});

// Rota de Pagamento
app.post('/create-payment', async (req, res) => {
  console.log("Recebida requisição para criar pagamento...");
  if (PUSHPAY_API_KEY === "sua_chave_secreta_da_api_do_pushpay_aqui") {
    return res.status(400).json({ error: "A chave da API não foi configurada no servidor." });
  }
  try {
    const paymentData = { value: 1999, description: "Acesso ao Grupo VIP" };
    const response = await axios.post('https://api.pushinpay.com.br/v1/pix/charges', paymentData, {
      headers: { 'Authorization': `Bearer ${PUSHPAY_API_KEY}`, 'Content-Type': 'application/json' }
    });
    console.log("Pagamento criado com sucesso!");
    const pixData = { qrCode: response.data.qr_code_base64, copiaECola: response.data.copia_e_cola };
    res.json(pixData);
  } catch (error) {
    console.error("ERRO AO CRIAR PAGAMENTO:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: "Não foi possível gerar o pagamento." });
  }
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const userSessions = {};

// --- NOVA FUNÇÃO DE GEOLOCALIZAÇÃO ---
async function getGeolocation(ip) {
  console.log(`🌐 Testando geolocalização para IP: ${ip}`);

  const apis = [
    {
      name: 'ipwhois.app',
      url: `https://ipwhois.app/json/${ip}`,
      getCity: (data) => data.success ? data.city : null
    },
    {
      name: 'ip-api.com',
      url: `http://ip-api.com/json/${ip}?fields=status,message,country,region,city`,
      getCity: (data) => data.status === 'success' ? data.city : null
    },
    {
      name: 'ipapi.co',
      url: `https://ipapi.co/${ip}/json/`,
      getCity: (data) => data.city
    }
  ];

  for (let api of apis) {
    try {
      console.log(`🔄 Tentando ${api.name}...`);
      const response = await axios.get(api.url);
      const city = api.getCity(response.data);

      if (city) {
        console.log(`✅ ${api.name} funcionou! Cidade: ${city}`);
        return city;
      } else {
        console.log(`❌ ${api.name} não retornou cidade`);
      }
    } catch (error) {
      console.log(`❌ ${api.name} falhou: ${error.message}`);
    }
  }

  console.log('❌ Todas as APIs de geolocalização falharam');
  return null;
}
// ------------------------------------------

async function sendBotMessages(socket, stepKey) {
  const userState = userSessions[socket.id];
  if (!userState) return;
  const step = dialogue[stepKey];
  if (!step) { return; }
  socket.emit('setUI', { inputEnabled: false, buttons: [] });
  for (const message of step.messages) {
    const status = message.type === 'audio' ? 'gravando áudio...' : 'digitando...';
    socket.emit('botStatus', { status });
    await new Promise(resolve => setTimeout(resolve, message.delay || 1000));
    let messageToSend = { ...message };
    if (messageToSend.type === 'text' && messageToSend.content.includes('{{city}}')) {
      messageToSend.content = messageToSend.content.replace('{{city}}', userState.city);
    }
    else if (messageToSend.type === 'image_with_location') {
      const city = encodeURIComponent(userState.city);
      messageToSend.type = 'image';
      messageToSend.content = `${BASE_URL}/generate-image-with-city?cidade=${city}`;
    }
    socket.emit('botMessage', messageToSend);
    socket.emit('botStatus', { status: 'online' });
  }
  if (step.response) {
    if (step.response.type === 'text') {
      socket.emit('setUI', { inputEnabled: true, buttons: [] });
    } else if (step.response.type === 'buttons') {
      socket.emit('setUI', { inputEnabled: false, buttons: step.response.options });
    } else if (step.response.type === 'continue') {
      userState.conversationStep = step.response.next;
      sendBotMessages(socket, userState.conversationStep);
    }
  }
}

io.on('connection', async (socket) => {
  console.log(`✅ Usuário conectado: ${socket.id}`);
  const userState = { city: 'São Paulo', conversationStep: 'START' }; // Cidade padrão

  const userIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  const finalIp = userIp.split(',')[0].trim();

  // --- LÓGICA DE GEOLOCALIZAÇÃO ATUALIZADA ---
  const detectedCity = await getGeolocation(finalIp);
  if (detectedCity) {
    userState.city = detectedCity;
    console.log(`📍 Cidade final detectada: ${userState.city}`);
  } else {
    console.log(`📍 Usando cidade padrão: São Paulo`);
  }
  // --------------------------------------------

  console.log(`🌍 Localização final para ${socket.id}: ${userState.city}`);
  userSessions[socket.id] = userState;
  sendBotMessages(socket, userState.conversationStep);

  socket.on('userMessage', (data) => {
    const userState = userSessions[socket.id];
    if (!userState) return;
    const currentStep = dialogue[userState.conversationStep];
    if (!currentStep || !currentStep.response) return;
    let nextStepKey;
    if (currentStep.response.type === 'text') {
      nextStepKey = currentStep.response.next;
    } else if (currentStep.response.type === 'buttons') {
      const option = currentStep.response.options.find(o => o.text === data.text);
      if (option) {
        nextStepKey = option.next;
      }
    }
    if (nextStepKey) {
      userState.conversationStep = nextStepKey;
      console.log(`🧠 Bot avançou para o estado: ${nextStepKey}`);
      sendBotMessages(socket, nextStepKey);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Usuário desconectado: ${socket.id}`);
    delete userSessions[socket.id];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor BACKEND rodando na porta ${PORT}`);
});
