// src/lobby/firebaseLobby.js
import {
  collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { db, auth } from '../firebaseConfig'

export const LOBBIES = 'lobbies'
export const DEFAULT_CAPACITY = 4

export function listenLobbies(cb){
  const q = query(collection(db, LOBBIES), orderBy('createdAt', 'desc'))
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id:d.id, ...d.data() }))
    cb(list)
  })
}

export async function createLobby({ name, capacity = DEFAULT_CAPACITY }){
  const ref = await addDoc(collection(db, LOBBIES), {
    name, capacity, hostId: null, started: false, createdAt: serverTimestamp()
  })
  return (await getDoc(ref)).id
}

export async function joinLobby(lobbyId, { name }){
  const uid = auth.currentUser.uid
  const lobbyRef = doc(db, LOBBIES, lobbyId)
  const lobbySnap = await getDoc(lobbyRef)
  if (!lobbySnap.exists()) throw new Error('Sala não encontrada')

  // conta players
  const playersCol = collection(db, LOBBIES, lobbyId, 'players')
  const playersSnap = await getDocs(playersCol)
  const players = playersSnap.docs.map(d=>d.data())

  // se já está, apenas atualiza nome
  const myRef = doc(db, LOBBIES, lobbyId, 'players', uid)
  const mySnap = await getDoc(myRef)
  if (mySnap.exists()){
    await updateDoc(myRef, { name, lastActive: serverTimestamp() })
    return
  }

  // nova entrada — checa capacidade
  const cap = lobbySnap.data().capacity || DEFAULT_CAPACITY
  if (players.length >= cap) throw new Error('Sala cheia')

  // define host se necessário
  if (!lobbySnap.data().hostId && players.length === 0){
    await updateDoc(lobbyRef, { hostId: uid })
  }

  await setDoc(myRef, {
    name, ready:false, joinedAt: serverTimestamp(), lastActive: serverTimestamp()
  })
}

export async function leaveLobby(lobbyId){
  const uid = auth.currentUser.uid
  const lobbyRef = doc(db, LOBBIES, lobbyId)
  const myRef = doc(db, LOBBIES, lobbyId, 'players', uid)

  // remove meu player
  await deleteDoc(myRef)

  // se eu era host, reatribui ao primeiro player que restar
  const playersCol = collection(db, LOBBIES, lobbyId, 'players')
  const playersSnap = await getDocs(playersCol)
  const lobbySnap = await getDoc(lobbyRef)
  if (lobbySnap.exists()){
    const currHost = lobbySnap.data().hostId
    if (currHost === uid){
      const rest = playersSnap.docs.map(d=>({ id:d.id, ...d.data() }))
      await updateDoc(lobbyRef, { hostId: rest[0]?.id || null })
    }
    // se ficou vazia, opcional: apagar a sala
    if (playersSnap.empty){
      await deleteDoc(lobbyRef)
    }
  }
}

export function listenPlayers(lobbyId, cb){
  const q = query(collection(db, LOBBIES, lobbyId, 'players'), orderBy('joinedAt', 'asc'))
  return onSnapshot(q, snap => {
    const players = snap.docs.map(d=>({ id:d.id, ...d.data() }))
    cb(players)
  })
}

export async function toggleReady(lobbyId){
  const uid = auth.currentUser.uid
  const myRef = doc(db, LOBBIES, lobbyId, 'players', uid)
  const snap = await getDoc(myRef)
  if (!snap.exists()) return
  const ready = !!snap.data().ready
  await updateDoc(myRef, { ready: !ready, lastActive: serverTimestamp() })
}

export async function startGame(lobbyId){
  const lobbyRef = doc(db, LOBBIES, lobbyId)
  await updateDoc(lobbyRef, { started: true, startedAt: serverTimestamp() })
}

export function listenLobby(lobbyId, cb){
  const ref = doc(db, LOBBIES, lobbyId)
  return onSnapshot(ref, (snap)=> cb(snap.exists() ? { id:snap.id, ...snap.data() } : null))
}
