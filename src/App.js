import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import io from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';


import Lobby from './webpages/Lobby';
import GamePage from './webpages/Game';


const socket = io('http://localhost:5000')
const generateUUID = () => {
  let playerUUID = sessionStorage.getItem('playerId');
  if (!playerUUID) {
    playerUUID = uuidv4();
    sessionStorage.setItem('playerId', playerUUID);
  }
  return playerUUID;
}
const playerId = generateUUID();

function App() {

  // connect to the server at once when visit the website
  const [selfUsername, setSelfUsername] = useState();

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Successfully connect to the server.');
      socket.emit('register_player', {'playerId': playerId});
    });
    
    socket.on('registerSuccessResponse', (selfPlayer) => {
      console.log('Successfully login as ', selfPlayer.pid);
      setSelfUsername(selfPlayer.username);
    });

    return () => {
      socket.off('connect');
      socket.off('registerSuccessResponse');
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate replace to="/lobby" />} />
        <Route path="/lobby" element={<Lobby selfName={selfUsername} socket={socket}/>} />
        <Route path="/game" element={<GamePage selfName={selfUsername} socket={socket}/>} />
      </Routes>
    </Router>
  );
}

export default App;
