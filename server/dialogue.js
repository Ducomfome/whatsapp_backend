// server/dialogue.js

const dialogue = {
  START: {
    messages: [ { type: 'audio', content: '/audios/audio01.mp3', delay: 2000 } ],
    response: { type: 'text', next: 'AWAITING_CITY' }
  },
  AWAITING_CITY: {
    messages: [
      { type: 'audio', content: '/audios/audio02.mp3', delay: 5000 },
      { type: 'image_with_location', content: {}, delay: 2500 }, 
      { type: 'text', content: 'Sou aqui de {{city}}', delay: 4000 },
      { type: 'text', content: 'Me diz de qual cidade você é amor  🥰😈', delay: 2000 }
    ],
    response: { type: 'text', next: 'AWAITING_ROMANCE_CHOICE' }
  },
  AWAITING_ROMANCE_CHOICE: {
    messages: [
      { type: 'audio', content: '/audios/audio03.mp3', delay: 5000 },
      { type: 'audio', content: '/audios/audio04.mp3', delay: 6500 }
    ],
    response: {
      type: 'buttons',
      options: [
        { text: "Sou mais safado", next: 'NAUGHTY_PATH' },
        { text: "Sou mais carinhoso", next: 'CARING_PATH' }
      ]
    }
  },
  NAUGHTY_PATH: {
    messages: [ { type: 'audio', content: '/audios/audio05.mp3', delay: 2000 } ],
    response: { type: 'continue', next: 'POST_CHOICE_AUDIO' }
  },
  CARING_PATH: {
    messages: [ { type: 'audio', content: '/audios/audio06.mp3', delay: 5000 } ],
    response: { type: 'continue', next: 'POST_CHOICE_AUDIO' }
  },
  POST_CHOICE_AUDIO: {
    messages: [ { type: 'audio', content: '/audios/audio07.mp3', delay: 5000 } ],
    response: { type: 'continue', next: 'AWAITING_CONFIRM_JOIN' }
  },
  AWAITING_CONFIRM_JOIN: {
    messages: [ { type: 'audio', content: '/audios/audio08.mp3', delay: 2500 } ],
    response: {
      type: 'buttons',
      options: [ { text: "Entro sim meu amor ❤️", next: 'AWAITING_NO_OBJECTION' } ]
    }
  },
  AWAITING_NO_OBJECTION: {
    messages: [
      { type: 'audio', content: '/audios/audio09.mp3', delay: 6000 },
      { type: 'audio', content: '/audios/audio10.mp3', delay: 6000 },
      { type: 'audio', content: '/audios/audio11.mp3', delay: 6000 },
      { type: 'audio', content: '/audios/audio12.mp3', delay: 6000 },
      { type: 'audio', content: '/audios/audio13.mp3', delay: 6000 },
      { type: 'image', content: 'https://midia.jdfnu287h7dujn2jndjsifd.com/qmrjn8qo44cqk2n2k2dbww6n.jpeg', delay: 2500 },
      { type: 'image', content: 'https://midia.jdfnu287h7dujn2jndjsifd.com/oi6gtpxvamkpw9g2661pohgv.jpeg', delay: 2500 },
      { type: 'audio', content: '/audios/audio14.mp3', delay: 2000 }
    ],
    response: {
      type: 'buttons',
      options: [ { text: "Combinado❤️", next: 'AWAITING_COMBINED' } ]
    }
  },
  AWAITING_COMBINED: {
    messages: [
      { type: 'audio', content: '/audios/audio15.mp3', delay: 2000 },
      { type: 'audio', content: '/audios/audio16.mp3', delay: 2000 },
    ],
    response: {
      type: 'buttons',
      options: [ { text: "Entendi meu amor❤️", next: 'AWAITING_ENTER_CLUB' } ]
    }
  },
  AWAITING_ENTER_CLUB: {
    messages: [
      { type: 'audio', content: '/audios/audio17.mp3', delay: 6000 },
      { type: 'audio', content: '/audios/audio18.mp3', delay: 5000 },
      { type: 'audio', content: '/audios/audio19.mp3', delay: 6000 },
      { type: 'gif', content: 'https://midia.jdfnu287h7dujn2jndjsifd.com/ohjlvxht3us81l3l5c6sckxx.gif', delay: 3000},
      { type: 'audio', content: '/audios/audio20.mp3', delay: 5000 },
      { type: 'audio', content: '/audios/audio21.mp3', delay: 5000 },
      { type: 'video', content: 'https://midia.jdfnu287h7dujn2jndjsifd.com/wun2i87362bus82913.mp4', delay: 2500 },
      { type: 'text', content: 'Olha o FOGOOO dessas meninas meu deus kkkkkkkkk', delay: 5500 },
      { type: 'audio', content: '/audios/audio22.mp3', delay: 4000 },
      { type: 'audio', content: '/audios/audio23.mp3', delay: 4000 },
    ],
    response: {
      type: 'buttons',
      options: [ { text: "ENTRAR NO CLUBE SECRETO 🔥", next: 'AWAITING_WANT_TO_ENTER' } ]
    }
  },
  AWAITING_WANT_TO_ENTER: {
    messages: [
      { type: 'text', content: 'Eu aposto que você vai adorar amor... não vai se arrepender 😈😏', delay: 2500 },
      { type: 'audio', content: '/audios/audio24.mp3', delay: 2000 },
      { type: 'audio', content: '/audios/audio25.mp3', delay: 2000 },
      { type: 'audio', content: '/audios/audio26.mp3', delay: 2000 }
    ],
    response: {
      type: 'buttons',
      options: [ 
        { 
          // MUDANÇA 1: O botão agora é um botão normal que leva para o próximo passo
          text: "QUERO ENTRAR ❤️", 
          next: 'SEND_PAYMENT_LINK'
        } 
      ]
    }
  },
  // MUDANÇA 2: Criamos o novo passo final
  SEND_PAYMENT_LINK: {
    messages: [
        { 
            type: 'text', 
            content: 'Tudo certo, meu amor! Para finalizar, é só acessar o link seguro de pagamento abaixo: \n\nhttps://app.pushinpay.com.br/service/pay/9FFF1898-0574-46A6-B963-5E9A356A5F4F',
            delay: 2000
        }
    ],
    response: {} // Fim da conversa
  }
};

module.exports = dialogue;