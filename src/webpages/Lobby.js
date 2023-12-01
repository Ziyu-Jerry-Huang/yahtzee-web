import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function ActivePlayersList(props) {
  const selfPid =  sessionStorage.getItem('playerId')
  const invitePlayer = (inviteePid) => {
      console.log('Send invite from ' + selfPid + 'to ' + inviteePid);
      props.socket.emit('send_invite', {'inviter': sessionStorage.getItem('playerId'), 'invitee': inviteePid});
  }
  return (Object.keys(props.activePlayers).length === 1)
    ? (<div>No available players right now.</div>) 
    : (<ul>
          {Object.values(props.activePlayers).map(
            player => 
              (player.pid !== selfPid) ? (
                <li key={player.pid}>
                  {player.username}
                  <button onClick={() => invitePlayer(player.pid)}>Invite</button>
                </li>
              ) : null
          )}
        </ul>)
}

function Lobby(props) {
    const [availablePlayers, setAvailablePlayers] = useState({});
    const [invitationReceived, setInvitationReceived] = useState([]);
    const navigate = useNavigate();

    useEffect(
      () => {
        props.socket.on('getPlayersOnlineResponse', playersList => {
          setAvailablePlayers(playersList);
        });

        props.socket.on('receiveInvitation', inviter => {
          // inviter: {pid: xxx, username: xxx}
          setInvitationReceived([...invitationReceived, inviter]);
          console.log('Received new invitation from: ' + inviter.username);
        });

        props.socket.on('invitationDeclined', invitee => {
          // invitee: {pid: xxx, username: xx}
          console.log(invitee.username + ' has declined your invitation.')
        });

        props.socket.on('playerNoLongerAvailable', invitee => {
          // invitee: pid 
          // invitee is no longer available
          // refresh the available player lists
          console.log('The player ' + invitee + ' is no longer available');
          getAllPlayers();
        });

        props.socket.on('enterNewGame', (gameInfo) => {
          // gameInfo : {game_id : xxx, 'oppo_player': {'pid': xxx, 'username': xxx}}
          navigate('/game', { state: {
              gameid : gameInfo['game_id'],
              oppopid : gameInfo['oppo_player']['pid'],
              oppoName : gameInfo['oppo_player']['username']
            }});
          console.log('Enter new game: ', gameInfo['game_id']);
        });

        props.socket.on('resumeGame', (gameInfo) => {
          // gameInfo : {game_id : xxx, 'oppo_player': {'pid': xxx, 'username': xxx}}
          navigate('/game', { state: {
            gameid : gameInfo['game_id'],
            oppopid : gameInfo['oppo_player']['pid'],
            oppoName : gameInfo['oppo_player']['username']
          }});
          // Mount the game object. Whenever mounted, the game page will get 
          // necessary game states from the server through 'game_initialize' event
          console.log('Resume game.');
        });

        return () => {
          props.socket.off('getPlayersOnlineResponse');
          props.socket.off('receiveInvitation');
          props.socket.off('invitationDeclined');
          props.socket.off('playerNoLongerAvailable');
          props.socket.off('enterNewGame');
          props.socket.off('resumeGame');
        }
      }, []
    );

    const getAllPlayers = () => {
      props.socket.emit('get_players_online');
    }

    const acceptInvitation = () => {
      props.socket.emit('accept_invite', {'inviter': invitationReceived[0].pid, 'invitee': sessionStorage.getItem('playerId')});
      setInvitationReceived(invitationReceived.slice(1));
    }

    const declineInvitation = () => {
      props.socket.emit('decline_invite', {'inviter': invitationReceived[0].pid, 'invitee': sessionStorage.getItem('playerId')});
      setInvitationReceived(invitationReceived.slice(1));
    }

    return (
      <div className="App">
        <h1>Welcome to WebYahtzee, {props.selfName}!</h1>
        <button onClick={getAllPlayers}>Get All Players</button>
        {(invitationReceived.length > 0) && (
          <div>
            You are invited by {invitationReceived[0].username} to join a new game!
            <button onClick={acceptInvitation}>accept</button>
            <button onClick={declineInvitation}>decline</button>
          </div>
        )}
        <ActivePlayersList activePlayers={availablePlayers} socket={props.socket}/>
      </div>
    );
  }

export default Lobby;
