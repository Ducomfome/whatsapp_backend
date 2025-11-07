// server.js - VERSÃO COM ANALYTICS

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

const allowedOrigins = [
  'https://whastappproibido.netlify.app',
  'http://localhost:3000'
];

// Banco de dados em memória (pra começar)
const analyticsDB = {
  sessions: {}, // Para dados detalhados
  funnel: {
    START: 0,
    AWAITING_CITY: 0,
    AWAITING_ROMANCE_CHOICE: 0,
    NAUGHTY_PATH: 0,
    CARING_PATH: 0,
    POST_CHOICE_AUDIO: 0,
    AWAITING_CONFIRM_JOIN: 0,
    AWAITING_NO_OBJECTION: 0,
    AWAITING_COMBINED: 0,
    AWAITING_ENTER_CLUB: 0,
    AWAITING_WANT_TO_ENTER: 0,
    OPEN_WHATSAPP: 0
  },
  conversions: {
    totalLeads: 0,
    completedFunnel: 0,
    dropOffPoints: {}
  }
};

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Acesso negado pelo CORS'));
    }
  }
}));

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'media')));

// Rota para analytics
app.get('/analytics', (req, res) => {
  const totalSessions = Object.keys(analyticsDB.sessions).length;
  const completedFunnel = analyticsDB.conversions.completedFunnel;
  const completionRate = totalSessions > 0 ? (completedFunnel / totalSessions * 100).toFixed(2) : 0;
  
  // Calcular dropoff entre steps
  const funnelSteps = Object.keys(analyticsDB.funnel);
  const dropOffRates = {};
  
  for (let i = 0; i < funnelSteps.length - 1; i++) {
    const currentStep = funnelSteps[i];
    const nextStep = funnelSteps[i + 1];
    const currentCount = analyticsDB.funnel[currentStep];
    const nextCount = analyticsDB.funnel[nextStep];
    
    if (currentCount > 0) {
      const dropoff = ((currentCount - nextCount) / currentCount * 100).toFixed(2);
      dropOffRates[`${currentStep}_to_${nextStep}`] = {
        from: currentStep,
        to: nextStep,
        dropoffRate: dropoff,
        lost: currentCount - nextCount
      };
    }
  }

  res.json({
    overview: {
      totalLeads: totalSessions,
      completedFunnel: completedFunnel,
      completionRate: `${completionRate}%`,
      currentActive: Object.keys(userSessions).length
    },
    funnelData: analyticsDB.funnel,
    dropOffRates: dropOffRates,
    recentSessions: Object.values(analyticsDB.sessions).slice(-10).reverse() // Últimos 10 leads
  });
});

// Rota detalhada por lead
app.get('/analytics/lead/:sessionId', (req, res) => {
  const session = analyticsDB.sessions[req.params.sessionId];
  if (!session) {
    return res.status(404).json({ error: 'Lead não encontrado' });
  }
  res.json(session);
});

// Rota para limpar analytics (opcional)
app.delete('/analytics/reset', (req, res) => {
  Object.keys(analyticsDB.funnel).forEach(key => {
    analyticsDB.funnel[key] = 0;
  });
  analyticsDB.conversions = {
    totalLeads: 0,
    completedFunnel: 0,
    dropOffPoints: {}
  };
  analyticsDB.sessions = {};
  res.json({ message: 'Analytics resetados com sucesso' });
});

// ... (suas rotas existentes de generate-image-with-city e create-payment permanecem iguais)

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

const userSessions = {};

// Função para registrar evento no analytics
function trackEvent(socketId, eventType, data = {}) {
  if (!analyticsDB.sessions[socketId]) {
    analyticsDB.sessions[socketId] = {
      id: socketId,
      startTime: new Date().toISOString(),
      ip: data.ip || '',
      city: data.city || '',
      events: [],
      path: [],
      currentStep: 'START',
      completed: false
    };
    analyticsDB.conversions.totalLeads++;
  }
  
  const session = analyticsDB.sessions[socketId];
  const event = {
    type: eventType,
    step: data.step || session.currentStep,
    timestamp: new Date().toISOString(),
    data: data
  };
  
  session.events.push(event);
  
  if (eventType === 'step_change') {
    session.path.push(data.step);
    session.currentStep = data.step;
    
    // Atualizar contagem do funil
    if (analyticsDB.funnel[data.step] !== undefined) {
      analyticsDB.funnel[data.step]++;
    }
    
    // Marcar como completado se chegou no final
    if (data.step === 'OPEN_WHATSAPP') {
      session.completed = true;
      session.endTime = new Date().toISOString();
      analyticsDB.conversions.completedFunnel++;
    }
  }
}

async function getGeolocation(ip) {
  // ... (seu código existente permanece igual)
}

async function sendBotMessages(socket, stepKey) {
  const userState = userSessions[socket.id];
  if (!userState) return;
  const step = dialogue[stepKey];
  if (!step) return;

  // Registrar mudança de step no analytics
  trackEvent(socket.id, 'step_change', { 
    step: stepKey,
    ip: userState.ip,
    city: userState.city
  });

  if (step.action && step.action.type === 'redirect') {
    socket.emit('redirectToURL', { url: step.action.url });
    return;
  }

  socket.emit('setUI', { inputEnabled: false, buttons: [] });
  for (const message of step.messages) {
    const status = message.type === 'audio' ? 'gravando áudio...' : 'digitando...';
    socket.emit('botStatus', { status });
    await new Promise(resolve => setTimeout(resolve, message.delay || 1000));
    let messageToSend = { ...message };
    if (messageToSend.type === 'text' && messageToSend.content.includes('{{city}}')) {
      messageToSend.content = messageToSend.content.replace('{{city}}', userState.city);
    } else if (messageToSend.type === 'image_with_location') {
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
  const userState = { 
    city: 'São Paulo', 
    conversationStep: 'START',
    ip: ''
  };
  
  const userIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  const finalIp = userIp.split(',')[0].trim();
  userState.ip = finalIp;
  
  const detectedCity = await getGeolocation(finalIp);
  if (detectedCity) {
    userState.city = detectedCity;
  }
  userSessions[socket.id] = userState;
  
  // Registrar conexão inicial
  trackEvent(socket.id, 'session_start', {
    ip: finalIp,
    city: userState.city
  });
  
  sendBotMessages(socket, userState.conversationStep);

  socket.on('userMessage', (data) => {
    const userState = userSessions[socket.id];
    if (!userState) return;

    // Registrar interação do usuário
    trackEvent(socket.id, 'user_interaction', {
      payload: data.payload,
      step: userState.conversationStep
    });

    const currentStep = dialogue[userState.conversationStep];
    if (!currentStep || !currentStep.response) return;

    let nextStepKey;
    if (currentStep.response.type === 'buttons') {
      const option = currentStep.response.options.find(o => o.payload === data.payload);
      if (option) {
        nextStepKey = option.next;
      }
    } else if (currentStep.response.type === 'text') {
      nextStepKey = currentStep.response.next;
    }

    if (nextStepKey) {
      userState.conversationStep = nextStepKey;
      console.log(`🧠 Bot avançou para: ${nextStepKey} via payload: ${data.payload}`);
      sendBotMessages(socket, nextStepKey);
    } else {
      console.log(`❌ Payload não encontrado. Recebido:`, data);
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Usuário desconectado: ${socket.id}`);
    trackEvent(socket.id, 'session_end', {
      step: userSessions[socket.id]?.conversationStep
    });
    delete userSessions[socket.id];
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Servidor BACKEND rodando na porta ${PORT}`);
  console.log(`📊 Analytics disponível em: http://localhost:${PORT}/analytics`);
});
