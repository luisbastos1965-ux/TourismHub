// firebase-messaging-sw.js
// 1. Importar as bibliotecas do Firebase para o Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// 2. Coloca aqui a tua firebaseConfig IGUAL à que tens no teu firebase.js
const firebaseConfig = {
  apiKey: "AIzaSyAUU6riTOuybEamgkPke4UXJwyjMA0nJzU",
  authDomain: "turmapro-e6358.firebaseapp.com",
  projectId: "turmapro-e6358",
  storageBucket: "turmapro-e6358.firebasestorage.app",
  messagingSenderId: "242512169110",
  appId: "1:242512169110:web:f94978c0c2a13858a41ab7"
};

// 3. Inicializar a app no background
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 4. O que fazer quando a app está fechada e chega uma notificação
messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Notificação recebida em background: ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo_tur.png', // O teu logótipo
    badge: '/logo_tur.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
