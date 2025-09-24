// src/firebaseConfig.js
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:        'SUA_API_KEY',
  authDomain:    'seu-projeto.firebaseapp.com',
  projectId:     'seu-projeto',
  storageBucket: 'seu-projeto.appspot.com',
  messagingSenderId: '...',
  appId: '...'
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Faz login anônimo automaticamente
export async function ensureAnonLogin(){
  if (!auth.currentUser) await signInAnonymously(auth)
  return auth.currentUser
}
