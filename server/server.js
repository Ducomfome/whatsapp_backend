// server.js - VERSÃO FINAL SEM CHAVE

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
const BASE_URL = 'https://whatsapp-backend-vott.onrender.com';

// --- CONFIGURAÇÃO DO SERVIDOR ---
app.use(cors());
app.use(bodyParser.json());
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

    const finalX = 220; 
    const finalY = 45;

    image.print(font, finalX, finalY, { text: textToPrint, alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT }, image.bitmap.width, image.bitmap.height);
    
    const buffer = await image.getBufferAsync(Jimp.MIME_PNG);
    res.set('Content-Type', Jimp.MIME_PNG);
    res.send(buffer);
  } catch (error) {
    console.error("ERRO CRÍTICO AO GERAR IMAGEM NO BACKEND:", error);
    res.status(500).send("Erro ao gerar imagem: " + error.message);
  }
});

// Rota de Pagamento (atualmente não usada pela lógica de redirecionamento direto)
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
  const userState = { city: 'São Paulo', conversationStep: 'START' };
  try {
    const userIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    const finalIp = userIp; 
    
    console.log(`🌐 Tentando geolocalização para IP: ${finalIp}`);
    
    // ✅ API SEM CHAVE - IP-API.COM
    const response = await axios.get(`http://ip-api.com/json/${finalIp}?fields=status,message,country,region,city`);
    
    if (response.data.status === 'success' && response.data.city) {
      userState.city = response.data.city;
      console.log(`📍 Cidade detectada: ${userState.city}`);
    } else {
      console.log('❌ API não retornou cidade válida');
    }
  } catch (error) { 
    console.log("⚠️ Erro na geolocalização:", error.message);
    console.log("📍 Usando cidade padrão: São Paulo");
  }
  
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
