import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Game.css';

import DiceRoller from '../components/DiceRoller';


// GamePage: the web page for playing the game, including Game component and post-game logic
function GamePage(props) {
  // props.selfName - username of the player on this computer
  // props.socket - socketio object
  // gameid - uuid for the game
  // oppopid - pid of the opponent player
  // oppoName - username of the opponent player
  const location = useLocation();
  const { gameid, oppopid, oppoName } = location.state;

  // post-game logic: show result / play again
  const [opponentConnected, setOpponentConnected] = useState(true);
  const [gameIsOver, setGameIsOver] = useState(false);
  const [gameResult, setGameResult] = useState('ongoing');

  // navigation element
  const navigate = useNavigate();

  useEffect(() => {
    props.socket.on('gameOver', (message) => {
      // message : {'status' : 'tie'/'win'/'lost'}
      setGameIsOver(true);
      setGameResult(message['status']);
    });

    // navigate back to the lobby is the opponent disconnect
    props.socket.on('opponentDisconnect', (oppoId) => {
      // oppoId: pid
      console.log('The connection of the opponent player has been lost.');
      console.log('Opponent pid: ' + oppoId);
      setGameIsOver(true);
      setOpponentConnected(false);
      setGameResult('The internet connection of the other player has been lost.')
    });

    return () => {
      props.socket.off('gameOver');
      props.socket.off('opponentDisconnect');
    }
  }, []);

  const back2Lobby = () => {
    navigate("/lobby");
  }

  // start listening to invitation after the game has ended.
  const [invitationReceivedInGame, setInvitationReceivedInGame] = useState([]);
  useEffect(() => {
    if (gameIsOver) {

      // initialize the received invitations
      setInvitationReceivedInGame([]);

      props.socket.on('receiveInvitation', inviter => {
        // inviter: {pid: xxx, username: xxx}
        setInvitationReceivedInGame([...invitationReceivedInGame, inviter]);
        console.log('Received new invitation from: ' + inviter.username);
      });

      props.socket.on('enterNewGame', (gameInfo) => {
        // gameInfo : {game_id : xxx, 'oppo_player': {'pid': xxx, 'username': xxx}}
        navigate('/game', { state: {
            gameid : gameInfo['game_id'],
            oppopid : gameInfo['oppo_player']['pid'],
            oppoName : gameInfo['oppo_player']['username']
          }});
        setGameIsOver(false);
        setGameResult('ongoing');
        setOpponentConnected(true);
        console.log('Enter new game: ', gameInfo['game_id']);
      });

    } else {
      setInvitationReceivedInGame([]);
      props.socket.off('receiveInvitation');
      props.socket.off('enterNewGame');
    }
  }, [gameIsOver])

  const inviteOneMoreTime = () => {
    // invite the opposite for one more new game
    props.socket.emit('send_invite', {'inviter': sessionStorage.getItem('playerId'), 'invitee':oppopid});
  }

  const acceptInvitation = () => {
    props.socket.emit('accept_invite', {'inviter': invitationReceivedInGame[0].pid, 'invitee': sessionStorage.getItem('playerId')});
    setInvitationReceivedInGame(invitationReceivedInGame.slice(1));
  }

  const declineInvitation = () => {
    props.socket.emit('decline_invite', {'inviter': invitationReceivedInGame[0].pid, 'invitee': sessionStorage.getItem('playerId')});
    setInvitationReceivedInGame(invitationReceivedInGame.slice(1));
  }


  return (
    <div>
      <Game key={gameid} gameId={gameid} selfName={props.selfName} oppoName={oppoName} socket={props.socket}/>
      {
        gameIsOver && (
          <div>
            <div>{gameResult}</div>
            {opponentConnected && <button onClick={inviteOneMoreTime}>One more game!</button>}
            <button onClick={back2Lobby}>Back to the lobby</button>
            {(invitationReceivedInGame.length > 0) && (
              (invitationReceivedInGame[0].pid === oppopid) ? (
                <div>
                  {invitationReceivedInGame[0].username} invite you to play one more time!
                  <button onClick={acceptInvitation}>accept</button>
                  <button onClick={declineInvitation}>decline</button>
                </div>
              ) : (
                <div>
                  You are invited by {invitationReceivedInGame[0].username} to join a new game!
                  <button onClick={acceptInvitation}>accept</button>
                  <button onClick={declineInvitation}>decline</button>
                </div>)
            )}
          </div>
        )
      }
    </div>
  );
}

export default GamePage;


// Game component
function Game(props) {
  // props.selfName - username of the player on this computer
  // props.socket - socketio object
  // props.key - gameid, uuid for the game
  // props.oppoName - username of the opponent player

  const [round, setRound] = useState(1);
  const [isActive, setIsActive] = useState(false);
  const [iRoll, setIRoll] = useState(0);

  const [dice, setDice] = useState([-1, -1, -1, -1, -1]);
  const [diceToRoll, setDiceToRoll] = useState([true, true, true, true, true]);
  const toggleDie = (i) => {
    if (isActive && iRoll !== 0) {
      let newDiceToRoll = [...diceToRoll];
      newDiceToRoll[i] = !diceToRoll[i];
      setDiceToRoll(newDiceToRoll);
    }
  };

  const calculator = () => {
    // calculate all the scores using 5 dice
    let diceCount = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
      '6': 0
    };
    for (let i = 0; i < dice.length; i++) {
      diceCount[dice[i].toString()] += 1;
    }
    let diceSum = dice.reduce((acc, val) => {
      return acc + val;
    }, 0);

    let scoreUpperSec = {
      '1s': 0,
      '2s': 0,
      '3s': 0,
      '4s': 0,
      '5s': 0,
      '6s': 0
    };
    for (let num = 1; num < 7; num++) {
      scoreUpperSec[num.toString() + "s"] = num * diceCount[num.toString()];
    }

    let scoreLowerSec = {
      '3-of-a-kind': 0,
      '4-of-a-kind': 0,
      'full-house': 0,
      'small-straight': 0,
      'large-straight': 0,
      'yahtzee': 0,
      'chance': 0
    };

    // 3-of-a-kind, 4-of-a-kind, full-house, yahtzee
    for (let k in diceCount) {
      if (diceCount[k] === 3) {
        scoreLowerSec['3-of-a-kind'] = diceSum;
        for (let kPair in diceCount) {
          if (diceCount[kPair] === 2) {
            scoreLowerSec['full-house'] = 25;
          }
        }
      }
      else if (diceCount[k] === 4) {
        scoreLowerSec['3-of-a-kind'] = diceSum;
        scoreLowerSec['4-of-a-kind'] = diceSum;
      }
      else if (diceCount[k] === 5) {
        scoreLowerSec['3-of-a-kind'] = diceSum;
        scoreLowerSec['4-of-a-kind'] = diceSum;
        scoreLowerSec['yahtzee'] = 50;
      }
    }

    // small straight, large straight
    if ((diceCount['1'] >= 1) && (diceCount['2'] >= 1) && (diceCount['3'] >= 1) && (diceCount['4'] >= 1)) {
      scoreLowerSec['small-straight'] = 30;
    }
    if ((diceCount['2'] >= 1) && (diceCount['3'] >= 1) && (diceCount['4'] >= 1) && (diceCount['5'] >= 1)) {
      scoreLowerSec['small-straight'] = 30;
    }
    if ((diceCount['3'] >= 1) && (diceCount['4'] >= 1) && (diceCount['5'] >= 1) && (diceCount['6'] >= 1)) {
      scoreLowerSec['small-straight'] = 30;
    }
    if ((diceCount['1'] >= 1) && (diceCount['2'] >= 1) && (diceCount['3'] >= 1) && (diceCount['4'] >= 1) && (diceCount['5'] >= 1)) {
      scoreLowerSec['large-straight'] = 40;
    }
    if ((diceCount['2'] >= 1) && (diceCount['3'] >= 1) && (diceCount['4'] >= 1) && (diceCount['5'] >= 1) && (diceCount['6'] >= 1)) {
      scoreLowerSec['large-straight'] = 40;
    }

    // chance
    scoreLowerSec['chance'] = diceSum;

    return { ...scoreUpperSec, ...scoreLowerSec };
  }

  const [scoreSelf, setScoreSelf] = useState({
    '1s': -1,
    '2s': -1,
    '3s': -1,
    '4s': -1,
    '5s': -1,
    '6s': -1,
    '3-of-a-kind': -1,
    '4-of-a-kind': -1,
    'full-house': -1,
    'small-straight': -1,
    'large-straight': -1,
    'yahtzee': -1,
    'chance': -1
  });
  const [bonusSelf, setBonusSelf] = useState(false);

  const totalUpperSelf = () => {
    let total = 0;
    if (scoreSelf['1s'] !== -1) { total += scoreSelf['1s']; }
    if (scoreSelf['2s'] !== -1) { total += scoreSelf['2s']; }
    if (scoreSelf['3s'] !== -1) { total += scoreSelf['3s']; }
    if (scoreSelf['4s'] !== -1) { total += scoreSelf['4s']; }
    if (scoreSelf['5s'] !== -1) { total += scoreSelf['5s']; }
    if (scoreSelf['6s'] !== -1) { total += scoreSelf['6s']; }
    return total;
  };

  const updateBonusSelf = () => {
    if (totalUpperSelf() >= 63) {setBonusSelf(true);}
  };

  const totalSelf = () => {
    let total = 0;
    for (let k in scoreSelf) {
      if (scoreSelf[k] !== -1) { total += scoreSelf[k]; }
    }
    if (bonusSelf) {return total + 35;}
    else {return total;}
  };

  const [scoreOppo, setScoreOppo] = useState({
    '1s': -1,
    '2s': -1,
    '3s': -1,
    '4s': -1,
    '5s': -1,
    '6s': -1,
    '3-of-a-kind': -1,
    '4-of-a-kind': -1,
    'full-house': -1,
    'small-straight': -1,
    'large-straight': -1,
    'yahtzee': -1,
    'chance': -1
  });
  const [bonusOppo, setBonusOppo] = useState(false);

  const totalUpperOppo = () => {
    let total = 0;
    if (scoreOppo['1s'] !== -1) { total += scoreOppo['1s']; }
    if (scoreOppo['2s'] !== -1) { total += scoreOppo['2s']; }
    if (scoreOppo['3s'] !== -1) { total += scoreOppo['3s']; }
    if (scoreOppo['4s'] !== -1) { total += scoreOppo['4s']; }
    if (scoreOppo['5s'] !== -1) { total += scoreOppo['5s']; }
    if (scoreOppo['6s'] !== -1) { total += scoreOppo['6s']; }
    return total;
  };

  const updateBonusOppo = () => {
    if (totalUpperOppo() >= 63) {setBonusOppo(true);}
  };

  const totalOppo = () => {
    let total = 0;
    for (let k in scoreOppo) {
      if (scoreOppo[k] !== -1) { total += scoreOppo[k]; }
    }
    if (bonusOppo) {return total + 35;}
    else {return total;}
  };


  // style of dice
  const styleToRoll = {
    border: '2px solid black',
    color: 'black'
  }

  const styleNotToRoll = {
    border: '1px solid gray',
    color: 'gray'
  }

  // set to roll all dice
  useEffect(() => {
    if (iRoll === 0) {
      setDiceToRoll([true, true, true, true, true])
    }
  }, [iRoll]);

  // const startRoll = () => {
  //   // tell the server that the client start a roll.
  //   if (iRoll !== 0) {
  //     let idx = [];
  //     for (let i = 0; i < 5; i++) {
  //       if (diceToRoll[i]) { idx.push(i); }
  //     }
  //     props.socket.emit('start_roll', {'game_id': props.gameId, 'player_id': sessionStorage.getItem('playerId'), 'index': idx});
  //   }
  //   else if (iRoll === 0) {
  //     props.socket.emit('start_roll', {'game_id': props.gameId, 'player_id': sessionStorage.getItem('playerId'), 'index': [0, 1, 2, 3, 4]});
  //   }
  // }

  const roll = () => {
    // tell the server that the client start a roll.
    if (iRoll !== 0) {
      let idx = [];
      for (let i = 0; i < 5; i++) {
        if (diceToRoll[i]) { idx.push(i); }
      }
      props.socket.emit('roll', {'game_id': props.gameId, 'player_id': sessionStorage.getItem('playerId'), 'index': idx});
    }
    else if (iRoll === 0) {
      props.socket.emit('roll', {'game_id': props.gameId, 'player_id': sessionStorage.getItem('playerId'), 'index': [0, 1, 2, 3, 4]});
    }
  }

  // listen to the server if the oppo player is rolling
  const [oppoIsRolling, setOppoIsRolling] = useState(false);
  useEffect(() => {
    props.socket.on('oppoStartRoll', (message) => {
      // message: {'index': [int, ]}
      setOppoIsRolling(true);
    });
  }, [])


  // calculator to help decision
  const [calculatorHelper, setCalculatorHelper] = useState({});
  useEffect(() => {
    if (iRoll !== 0) {
      setCalculatorHelper(calculator());
    } else {
      setCalculatorHelper({});
    }
  }, [iRoll]);

  const styleOfCalculator = {
    'color': 'lightgray'
  }


  const [showAvailableKeys, setShowAvailableKeys] = useState(false);
  const fill = (key) => {
    // send a fill message to the server.
    props.socket.emit('fill', {'game_id': props.gameId, 'player_id': sessionStorage.getItem('playerId'), 'key': key});
  }


  // change the bonus
  useEffect(() => {
    updateBonusSelf();
  }, [scoreSelf])

  useEffect(() => {
    updateBonusOppo();
  }, [scoreOppo])

  useEffect(() => {
    props.socket.emit('game_initialize', {'game_id': props.gameId, 'player_id': sessionStorage.getItem('playerId')});
    props.socket.on('gameUpdate', (update) => {
      // Update for initialization, resume game states, or after a fill
      // {
      //   'i_roll': int,
      //   'round': int,
      //   'active_player': pid,
      //   'score_active': {'key': val},
      //   'score_inactive': {'key': val}
      // }
      //  Update after a roll:
      // { 
      //   'dice': [int, ],
      //   'i_roll': int
      // }
      if ('active_player' in update) {
        if (update['active_player'] === sessionStorage.getItem('playerId')) {
          setIsActive(true);
          setScoreSelf(update['score_active']);
          setScoreOppo(update['score_inactive']);
        }
        else {
          setIsActive(false);
          setScoreSelf(update['score_inactive']);
          setScoreOppo(update['score_active']);
        }
      }
      if ('i_roll' in update) {
        setIRoll(update['i_roll']);
      }
      if ('round' in update) {
        setRound(update['round']);
      }
      if ('dice' in update) {
        setDice(update['dice']);
      }
      setShowAvailableKeys(false);
    });

    return () => {
      props.socket.off('gameUpdate');
    }
  }, []);

  return (
    <div>
      <DiceRoller />
      {oppoIsRolling && 
      <div> The opponent is rolling...</div>}
      <div className='game-board'>
        <div className='game-board-left'>
          <div><span className='game-board-pname'>{props.selfName}</span></div>
          <div>
            <span className='game-board-scoring'>ONES</span>
            <span className='game-board-number'>{(scoreSelf['1s'] !== -1) ? scoreSelf['1s'].toString() : (isActive ? calculatorHelper['1s'] : "" )}</span>
            <span className='game-board-scoring'>THREE OF A KIND</span>
            <span className='game-board-number'>{(scoreSelf['3-of-a-kind'] !== -1) ? scoreSelf['3-of-a-kind'].toString() : (isActive ? calculatorHelper['3-of-a-kind'] : "" )}</span>
          </div>
          <div>
            <span className='game-board-scoring'>TWOS</span>
            <span className='game-board-number'>{(scoreSelf['2s'] !== -1) ? scoreSelf['2s'].toString() : (isActive ? calculatorHelper['2s'] : "" )}</span>
            <span className='game-board-scoring'>FOUR OF A KIND</span>
            <span className='game-board-number'>{(scoreSelf['4-of-a-kind'] !== -1) ? scoreSelf['4-of-a-kind'].toString() : (isActive ? calculatorHelper['4-of-a-kind'] : "" )}</span>
          </div>
          <div>
            <span className='game-board-scoring'>THREES</span>
            <span className='game-board-number'>{(scoreSelf['3s'] !== -1) ? scoreSelf['3s'].toString() : (isActive ? calculatorHelper['3s'] : "" )}</span>
            <span className='game-board-scoring'>FULL HOUSE</span>
            <span className='game-board-number'>{(scoreSelf['full-house'] !== -1) ? scoreSelf['full-house'].toString() : (isActive ? calculatorHelper['full-house'] : "" )}</span>
          </div>
          <div>
            <span className='game-board-scoring'>FOURS</span>
            <span className='game-board-number'>{(scoreSelf['4s'] !== -1) ? scoreSelf['4s'].toString() : (isActive ? calculatorHelper['4s'] : "" )}</span>
            <span className='game-board-scoring'>SMALL STRAIGHT</span>
            <span className='game-board-number'>{(scoreSelf['small-straight'] !== -1) ? scoreSelf['small-straight'].toString() : (isActive ? calculatorHelper['small-straight'] : "" )}</span>
          </div>
          <div>
            <span className='game-board-scoring'>FIVES</span>
            <span className='game-board-number'>{(scoreSelf['5s'] !== -1) ? scoreSelf['5s'].toString() : (isActive ? calculatorHelper['5s'] : "" )}</span>
            <span className='game-board-scoring'>LARGE STRAIGHT</span>
            <span className='game-board-number'>{(scoreSelf['large-straight'] !== -1) ? scoreSelf['large-straight'].toString() : (isActive ? calculatorHelper['large-straight'] : "" )}</span>
          </div>
          <div>
            <span className='game-board-scoring'>SIXES</span>
            <span className='game-board-number'>{(scoreSelf['6s'] !== -1) ? scoreSelf['6s'].toString() : (isActive ? calculatorHelper['6s'] : "" )}</span>
            <span className='game-board-scoring'>YAHTZEE</span>
            <span className='game-board-number'>{(scoreSelf['yahtzee'] !== -1) ? scoreSelf['yahtzee'].toString() : (isActive ? calculatorHelper['yahtzee'] : "" )}</span>
          </div>
          <div>
            <span className='game-board-scoring'>UPPER SECTION</span>
            <span className='game-board-number'>{totalUpperSelf().toString()}</span>
            <span className='game-board-scoring'>CHANCE</span>
            <span className='game-board-number'>{(scoreSelf['chance'] !== -1) ? scoreSelf['chance'].toString() : (isActive ? calculatorHelper['chance'] : "" )}</span>
          </div>
          <div>
            <span className='game-board-scoring'>BONUS</span>
            <span className='game-board-number'>{bonusSelf ? '35' : '0'}</span>
            <span className='game-board-scoring'>TOTAL</span>
            <span className='game-board-number'>{totalSelf().toString()}</span>
          </div>
        </div>
        <div className='game-board-middle'>
          <div>ROUND {round} / 13</div>
          <div>{isActive ? props.selfName : props.oppoName}'S TURN</div>
          <div>ROLL {3 - iRoll} / 3</div>
        </div>
        <div className='game-board-right'>
          <div>
            <div><span className='game-board-pname'>{props.oppoName}</span></div>
            <div>
              <span className='game-board-number'>{(scoreOppo['3-of-a-kind'] !== -1) ? scoreOppo['3-of-a-kind'].toString() : (isActive ? "" : calculatorHelper['3-of-a-kind'])}</span>
              <span className='game-board-scoring'>THREE OF A KIND</span>
              <span className='game-board-number'>{(scoreOppo['1s'] !== -1) ? scoreOppo['1s'].toString() : (isActive ? "" : calculatorHelper['1s'])}</span>
              <span className='game-board-scoring'>ONES</span>
            </div>
            <div>
              <span className='game-board-number'>{(scoreOppo['4-of-a-kind'] !== -1) ? scoreOppo['4-of-a-kind'].toString() : (isActive ? "" : calculatorHelper['4-of-a-kind'])}</span>
              <span className='game-board-scoring'>FOUR OF A KIND</span>
              <span className='game-board-number'>{(scoreOppo['2s'] !== -1) ? scoreOppo['2s'].toString() : (isActive ? "" : calculatorHelper['2s'])}</span>
              <span className='game-board-scoring'>TWOS</span>
            </div>
            <div>
              <span className='game-board-number'>{(scoreOppo['full-house'] !== -1) ? scoreOppo['full-house'].toString() : (isActive ? "" : calculatorHelper['full-house'])}</span>
              <span className='game-board-scoring'>FULL HOUSE</span>
              <span className='game-board-number'>{(scoreOppo['3s'] !== -1) ? scoreOppo['3s'].toString() : (isActive ? "" : calculatorHelper['3s'])}</span>
              <span className='game-board-scoring'>THREE</span>
            </div>
            <div>
              <span className='game-board-number'>{(scoreOppo['small-straight'] !== -1) ? scoreOppo['small-straight'].toString() : (isActive ? calculatorHelper['small-straight'] : "" )}</span>
              <span className='game-board-scoring'>SMALL STRAIGHT</span>
              <span className='game-board-number'>{(scoreOppo['4s'] !== -1) ? scoreOppo['4s'].toString() : (isActive ? "" : calculatorHelper['4s'])}</span>
              <span className='game-board-scoring'>FOUR</span>
            </div>
            <div>
              <span className='game-board-number'>{(scoreOppo['large-straight'] !== -1) ? scoreOppo['large-straight'].toString() : (isActive ? calculatorHelper['large-straight'] : "" )}</span>
              <span className='game-board-scoring'>LARGE STRAIGHT</span>
              <span className='game-board-number'>{(scoreOppo['5s'] !== -1) ? scoreOppo['5s'].toString() : (isActive ? "" : calculatorHelper['5s'])}</span>
              <span className='game-board-scoring'>FIVE</span>
            </div>
            <div>
              <span className='game-board-number'>{(scoreOppo['yahtzee'] !== -1) ? scoreOppo['yahtzee'].toString() : (isActive ? calculatorHelper['yahtzee'] : "" )}</span>
              <span className='game-board-scoring'>YAHTZEE</span>
              <span className='game-board-number'>{(scoreOppo['6s'] !== -1) ? scoreOppo['6s'].toString() : (isActive ? "" : calculatorHelper['6s'])}</span>
              <span className='game-board-scoring'>SIXES</span>
            </div>
            <div>
              <span className='game-board-number'>{(scoreOppo['chance'] !== -1) ? scoreOppo['chance'].toString() : (isActive ? calculatorHelper['chance'] : "" )}</span>
              <span className='game-board-scoring'>CHANCE</span>
              <span className='game-board-number'>{totalUpperOppo().toString()}</span>
              <span className='game-board-scoring'>UPPER SECTION</span>
            </div>
            <div>
              <span className='game-board-number'>{totalOppo().toString()}</span>
              <span className='game-board-scoring'>TOTAL</span>
              <span className='game-board-number'>{bonusOppo ? '35' : '0'}</span>
              <span className='game-board-scoring'>BONUS</span>
            </div>
          </div>
        </div>
      </div>
      <div>Round: {round} / 13</div>
      <div>This is the {isActive ? props.selfName : props.oppoName}'s turn.</div>
      <div>There are {3 - iRoll} chances of rolling left in this round.</div>
      <div>Dice (click to unhighlight and lock the dice, preventing them from being rolled): </div>
      <div className='diceList'>
        <div className='die' style={diceToRoll[0] ? styleToRoll : styleNotToRoll} onClick={() => toggleDie(0)}>
          {(iRoll === 0) ? " " : dice[0].toString()}
        </div>
        <div className='die' style={diceToRoll[1] ? styleToRoll : styleNotToRoll} onClick={() => toggleDie(1)}>
          {(iRoll === 0) ? " " : dice[1].toString()}
        </div>
        <div className='die' style={diceToRoll[2] ? styleToRoll : styleNotToRoll} onClick={() => toggleDie(2)}>
          {(iRoll === 0) ? " " : dice[2].toString()}
        </div>
        <div className='die' style={diceToRoll[3] ? styleToRoll : styleNotToRoll} onClick={() => toggleDie(3)}>
          {(iRoll === 0) ? " " : dice[3].toString()}
        </div>
        <div className='die' style={diceToRoll[4] ? styleToRoll : styleNotToRoll} onClick={() => toggleDie(4)}>
          {(iRoll === 0) ? " " : dice[4].toString()}
        </div>
      </div>

      <table border="1">
        <thead>
          <tr>
            <th></th>
            <th></th>
            <th>Ones</th>
            <th>Twos</th>
            <th>Threes</th>
            <th>Fours</th>
            <th>Fives</th>
            <th>Sixes</th>
            <th>Upper Section Total</th>
            <th>Bonus</th>
            <th>3 of a kind</th>
            <th>4 of a kind</th>
            <th>Full House</th>
            <th>Small Straight</th>
            <th>Large Straight</th>
            <th>Yahtzee</th>
            <th>Chance</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{props.selfName}</td>
            <td>{isActive ? "*" : ""}</td>
            <td style={(scoreSelf['1s'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['1s'] !== -1) ? scoreSelf['1s'].toString() : (isActive ? calculatorHelper['1s'] : "" )}
            </td>
            <td style={(scoreSelf['2s'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['2s'] !== -1) ? scoreSelf['2s'].toString() : (isActive ? calculatorHelper['2s'] : "" )}
            </td>
            <td style={(scoreSelf['3s'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['3s'] !== -1) ? scoreSelf['3s'].toString() : (isActive ? calculatorHelper['3s'] : "" )}
            </td>
            <td style={(scoreSelf['4s'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['4s'] !== -1) ? scoreSelf['4s'].toString() : (isActive ? calculatorHelper['4s'] : "" )}
            </td>
            <td style={(scoreSelf['5s'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['5s'] !== -1) ? scoreSelf['5s'].toString() : (isActive ? calculatorHelper['5s'] : "" )}
            </td>
            <td style={(scoreSelf['6s'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['6s'] !== -1) ? scoreSelf['6s'].toString() : (isActive ? calculatorHelper['6s'] : "" )}
            </td>
            <td>{totalUpperSelf().toString()}</td>
            <td>{bonusSelf ? '35' : '0'}</td>
            <td style={(scoreSelf['3-of-a-kind'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['3-of-a-kind'] !== -1) ? scoreSelf['3-of-a-kind'].toString() : (isActive ? calculatorHelper['3-of-a-kind'] : "" )}
            </td>
            <td style={(scoreSelf['4-of-a-kind'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['4-of-a-kind'] !== -1) ? scoreSelf['4-of-a-kind'].toString() : (isActive ? calculatorHelper['4-of-a-kind'] : "" )}
            </td>
            <td style={(scoreSelf['full-house'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['full-house'] !== -1) ? scoreSelf['full-house'].toString() : (isActive ? calculatorHelper['full-house'] : "" )}
            </td>
            <td style={(scoreSelf['small-straight'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['small-straight'] !== -1) ? scoreSelf['small-straight'].toString() : (isActive ? calculatorHelper['small-straight'] : "" )}
            </td>
            <td style={(scoreSelf['large-straight'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['large-straight'] !== -1) ? scoreSelf['large-straight'].toString() : (isActive ? calculatorHelper['large-straight'] : "" )}
            </td>
            <td style={(scoreSelf['yahtzee'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['yahtzee'] !== -1) ? scoreSelf['yahtzee'].toString() : (isActive ? calculatorHelper['yahtzee'] : "" )}
            </td>
            <td style={(scoreSelf['chance'] === -1) ? styleOfCalculator : null}>
              {(scoreSelf['chance'] !== -1) ? scoreSelf['chance'].toString() : (isActive ? calculatorHelper['chance'] : "" )}
            </td>
            <td>{totalSelf().toString()}</td>
          </tr>
          <tr>
            <td>{props.oppoName}</td>
            <td>{isActive ? "" : "*"}</td>
            <td style={(scoreOppo['1s'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['1s'] !== -1) ? scoreOppo['1s'].toString() : (isActive ? "" : calculatorHelper['1s'])}
            </td>
            <td style={(scoreOppo['2s'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['2s'] !== -1) ? scoreOppo['2s'].toString() : (isActive ? "" : calculatorHelper['2s'])}
            </td>
            <td style={(scoreOppo['3s'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['3s'] !== -1) ? scoreOppo['3s'].toString() : (isActive ? "" : calculatorHelper['3s'])}
            </td>
            <td style={(scoreOppo['4s'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['4s'] !== -1) ? scoreOppo['4s'].toString() : (isActive ? "" : calculatorHelper['4s'])}
            </td>
            <td style={(scoreOppo['5s'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['5s'] !== -1) ? scoreOppo['5s'].toString() : (isActive ? "" : calculatorHelper['5s'])}
            </td>
            <td style={(scoreOppo['6s'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['6s'] !== -1) ? scoreOppo['6s'].toString() : (isActive ? "" : calculatorHelper['6s'])}
            </td>
            <td>{totalUpperOppo().toString()}</td>
            <td>{bonusOppo ? '35' : '0'}</td>
            <td style={(scoreOppo['3-of-a-kind'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['3-of-a-kind'] !== -1) ? scoreOppo['3-of-a-kind'].toString() : (isActive ? "" : calculatorHelper['3-of-a-kind'])}
            </td>
            <td style={(scoreOppo['4-of-a-kind'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['4-of-a-kind'] !== -1) ? scoreOppo['4-of-a-kind'].toString() : (isActive ? "" : calculatorHelper['4-of-a-kind'])}
            </td>
            <td style={(scoreOppo['full-house'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['full-house'] !== -1) ? scoreOppo['full-house'].toString() : (isActive ? "" : calculatorHelper['full-house'])}
            </td>
            <td style={(scoreOppo['small-straight'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['small-straight'] !== -1) ? scoreOppo['small-straight'].toString() : (isActive ? "" : calculatorHelper['small-straight'])}
            </td>
            <td style={(scoreOppo['large-straight'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['large-straight'] !== -1) ? scoreOppo['large-straight'].toString() : (isActive ? "" : calculatorHelper['large-straight'])}
            </td>
            <td style={(scoreOppo['yahtzee'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['yahtzee'] !== -1) ? scoreOppo['yahtzee'].toString() : (isActive ? "" : calculatorHelper['yahtzee'])}
            </td>
            <td style={(scoreOppo['chance'] === -1) ? styleOfCalculator : null}>
              {(scoreOppo['chance'] !== -1) ? scoreOppo['chance'].toString() : (isActive ? "" : calculatorHelper['chance'])}
            </td>
            <td>{totalOppo().toString()}</td>
          </tr>
        </tbody>
      </table>
      <button disabled={!isActive || (iRoll > 2)} onClick={roll}>Roll</button>
      <button disabled={!isActive || (iRoll === 0)} onClick={() => setShowAvailableKeys(true)}>Select scoring to Fill</button>
      {showAvailableKeys && (
        <div className="available-keys">
          {(scoreSelf['1s'] === -1) && <button onClick={() => fill('1s')}>Ones</button>}
          {(scoreSelf['2s'] === -1) && <button onClick={() => fill('2s')}>Twos</button>}
          {(scoreSelf['3s'] === -1) && <button onClick={() => fill('3s')}>Threes</button>}
          {(scoreSelf['4s'] === -1) && <button onClick={() => fill('4s')}>Fours</button>}
          {(scoreSelf['5s'] === -1) && <button onClick={() => fill('5s')}>Fives</button>}
          {(scoreSelf['6s'] === -1) && <button onClick={() => fill('6s')}>Sixes</button>}
          {(scoreSelf['3-of-a-kind'] === -1) && <button onClick={() => fill('3-of-a-kind')}>3 of a kind</button>}
          {(scoreSelf['4-of-a-kind'] === -1) && <button onClick={() => fill('4-of-a-kind')}>4 of a kind</button>}
          {(scoreSelf['full-house'] === -1) && <button onClick={() => fill('full-house')}>Full House</button>}
          {(scoreSelf['small-straight'] === -1) && <button onClick={() => fill('small-straight')}>Small straight</button>}
          {(scoreSelf['large-straight'] === -1) && <button onClick={() => fill('large-straight')}>Large straight</button>}
          {(scoreSelf['yahtzee'] === -1) && <button onClick={() => fill('yahtzee')}>Yahtzee</button>}
          {(scoreSelf['chance'] === -1) && <button onClick={() => fill('chance')}>Chance</button>}
        </div>
      )}
    </div>
  );
}
