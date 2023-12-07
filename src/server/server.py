import random

from flask import Flask, request
from flask_socketio import SocketIO, emit

from app.Player import Player
from app.Game import Game


app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="http://localhost:3001")

# All online players in this dictionary
# key: pid
# value: A Player object
online_players = {}

# Map all current active sessions to the player
# key: sid
# value: pid
sid_to_pid = {}

# All available players in this dictionary
# key: pid
# value: A dict generate from Player.to_dict(), like {'pid': xxx, 'username':xxx}
available_players = {}

# All ongoing games in this dictionary
# key: game_id
# value: a Game object
ongoing_games = {}


@socketio.on('connect')
def handle_connect():
    print('NEW CONNECTION (SESSION ID: %s) FROM: %s' % (request.sid, request.remote_addr))


@socketio.on('register_player')
def handle_register_player(message):
    """
    The player send his pid to the server.
    Create a new Player object.
    Parameters:
        message: {'playerId': pid}
    """
    player_id = message['playerId']
    # check if the player have already registerd:
    if player_id in online_players:
        # update existing player
        # the player might refresh the browser or have encountered an Internet issue
        online_players[player_id].set_sid(request.sid)
        sid_to_pid[request.sid] = player_id
        online_players[player_id].set_ip(request.remote_addr)
        print('PLAYER RESTABLISH A CONNECTION: ' + str(online_players[player_id]))
        emit('registerSuccessResponse', online_players[player_id].to_dict())
        if online_players[player_id].game_id != '-1':
            # there is an ongoing game for the current player
            game_id = online_players[player_id].game_id
            game = ongoing_games[game_id]
            if game.p1.pid == player_id:
                emit('resumeGame', {'game_id': game_id, 'oppo_player': game.p2.to_dict()})
            elif game.p2.pid == player_id:
                emit('resumeGame', {'game_id': game_id, 'oppo_player': game.p1.to_dict()})
            else:
                raise ValueError("Cannot find player in this game!")
        else:
            # add the player to the available players
            available_players[player_id] = online_players[player_id].to_dict()
    else:
        # create new player
        new_player = Player(pid=player_id ,sid=request.sid, ip=request.remote_addr)
        sid_to_pid[request.sid] = player_id
        online_players[player_id] = new_player
        print('NEW PLAYER REGISTERED: ' + str(online_players[player_id]))
        available_players[player_id] = online_players[player_id].to_dict()
        emit('registerSuccessResponse', online_players[player_id].to_dict())


@socketio.on('disconnect')
def handle_disconnect():
    print('CONNECTION TERMINATED (SESSION ID: %s).' % request.sid)
    player_id = sid_to_pid[request.sid]
    # check if the player_id is connected through another session
    if not (player_id in online_players):
        print('UNKNOWN SESSION HAS BEEN DISCONNECTED. (SESSION ID: %s)' % request.sid)
        del sid_to_pid[request.sid]
    else: 
        if online_players[player_id].sid == request.sid:
            # the connection has been lost for a while, assume that the player has left
            # end if there is an ongoing game
            if online_players[player_id].game_id != '-1':
                try:
                    ended_game = ongoing_games[online_players[player_id].game_id]
                    if ended_game.p1.pid == player_id:
                        emit('opponentDisconnect', player_id, room=ended_game.p2.sid)
                        ended_game.p2.game_id = '-1'
                    elif ended_game.p2.pid == player_id:
                        emit('opponentDisconnect', player_id, room=ended_game.p1.sid)
                        ended_game.p1.game_id = '-1'
                    else:
                        raise ValueError('Cannot find the disconnected player in the game.')
                except ValueError as e:
                    print(e)
                del ongoing_games[online_players[player_id].game_id]

            # delete the player from available players
            if player_id in available_players:
                del available_players[player_id]

            del online_players[player_id]
            del sid_to_pid[request.sid]
        else:
            # the player is still connected through another session
            # the player possibly refresh the browser or have encountered an Internet issue
            del sid_to_pid[request.sid]


@socketio.on('play_bot')
def handle_play_bot():
    """
    One client requests to play with the bot.
    Start a bot on the server to play with the client.
    """
    pass


@socketio.on('get_players_online')
def handle_get_players_online():
    """
    One client requests info on all available players online.
    Return all available players to the client.
    """
    emit('getPlayersOnlineResponse', available_players)


@socketio.on('send_invite')
def handle_send_invite(message):
    """
    Inviter client sent an invitation to invitee client.
    Receive the invitation, and notify the invitee client.
    Parameters:
        message: {'inviter': pid, 'invitee': pid}
    """
    if message['invitee'] in available_players:
        emit('receiveInvitation', online_players[message['inviter']].to_dict(), room=online_players[message['invitee']].sid)
    else:
        emit('playerNoLongerAvailable', message['invitee'])


@socketio.on('accept_invite')
def handle_accept_invite(message):
    """
    Invitee client accept the invitation from inviter client.
    Send the accept info to the inviter.
    Start a new game and add both clients to the game.
    Parameters:
        message: { 'inviter': pid, 'invitee': pid }
    """
    if message['inviter'] in available_players:
        del available_players[message['inviter']]
        del available_players[message['invitee']]
        if random.randint(0, 1):
            new_game = Game(online_players[message['inviter']], online_players[message['invitee']])
        else:
            new_game = Game(online_players[message['invitee']], online_players[message['inviter']])
        ongoing_games[new_game.get_game_id()] = new_game
        online_players[message['inviter']].set_game_id(new_game.get_game_id())
        online_players[message['invitee']].set_game_id(new_game.get_game_id())
        emit(
            'enterNewGame', 
            {
               'game_id': new_game.get_game_id(),
               'oppo_player': online_players[message['invitee']].to_dict()
            }, 
            room=online_players[message['inviter']].sid
        )
        emit(
            'enterNewGame', 
            {
                'game_id': new_game.get_game_id(),
                'oppo_player': online_players[message['inviter']].to_dict()
            }, 
            room=online_players[message['invitee']].sid
        )
    else:
        emit('playerNoLongerAvailable', message['inviter'])


@socketio.on('decline_invite')
def handle_decline_invite(message):
    """
    Invitee client decline the invitation from inviter client.
    Send the decline info to the inviter.
    Parameters:
        message: {'inviter': pid, 'invitee': pid}
    """
    emit('invitationDeclined', online_players[message['invitee']].to_dict(), room=online_players[message['inviter']].sid)


@socketio.on('game_initialize')
def handle_game_initialize(message):
    """
    One client request to get the initial state of the game.
    Send the info back to the client.
    Parameters:
        message: { 'game_id': uuid, 'player_id': pid }
    """
    # in case game_id is null
    if message['game_id'] is None:
        game = ongoing_games[online_players[message['player_id']].game_id()]
    else:
        game = ongoing_games[message['game_id']]
    if game.get_active_player() == 0:
        active_player = game.p1.pid
        score_active = game.get_score(0)
        score_inactive = game.get_score(1)
    else:
        active_player = game.p2.pid
        score_active = game.get_score(1)
        score_inactive = game.get_score(0) 
    emit('gameUpdate', {
            'dice': game.get_dice(),
            'i_roll': game.get_i_roll(), 
            'round': game.get_round(), 
            'active_player': active_player,
            'score_active': score_active,
            'score_inactive': score_inactive
        })


# @socketio.on('start_roll')
# def handle_start_roll(message):
#     """
#     One client start a physical simulation of rolling in three.js
#     Parameters:
#         message: {'game_id': uuid, 'player_id': pid, 'index': [int, ]}
#     """
#     game = ongoing_games[message['game_id']]
#     if message['player_id'] == game.p1.pid:
#         oppo_player_sid = game.p2.sid
#     elif message['player_id'] == game.p2.pid:
#         oppo_player_sid = game.p1.sid
#     emit('oppoStartRoll', {'index': message['index']}, room=oppo_player_sid)


@socketio.on('roll')
def handle_roll(message):
    """
    One client request to make a roll.
    Make a roll in the game. Once success, send the dice back to the client.
    Parameters:
        message: {'game_id': uuid, 'player_id': pid, 'index' : [int, ]}
    """
    # make a roll in this game
    game = ongoing_games[message['game_id']]
    if len(message['index']) == 0:
        # feed back to the front-end that an empty idx is sent
        # TO DO
        pass
    else:
        game.roll(message['index'])
        dice = game.get_dice()
        i_roll = game.get_i_roll()
        emit('gameUpdate', {'dice': dice, 'i_roll': i_roll}, room=game.p1.sid)
        emit('gameUpdate', {'dice': dice, 'i_roll': i_roll}, room=game.p2.sid)


@socketio.on('fill')
def handle_fill(message):
    """
    One client request to fill a scoring.
    Fill the score in the game, and send the succuss info back to the client.
    Paramters:
        message: {'game_id': uuid, 'player_id': pid, 'key': str}
    """
    game = ongoing_games[message['game_id']]
    game_not_over = game.fill(message['key'])
    if game.get_active_player() == 0:
        active_player = game.p1.pid
        score_active = game.get_score(0)
        score_inactive = game.get_score(1)
    else:
        active_player = game.p2.pid
        score_active = game.get_score(1)
        score_inactive = game.get_score(0)
    if game_not_over:
        emit('gameUpdate', {
                'i_roll': game.get_i_roll(), 
                'round': game.get_round(), 
                'active_player': active_player,
                'score_active': score_active,
                'score_inactive': score_inactive
            }, room=game.p1.sid)

        emit('gameUpdate', {
                'i_roll': game.get_i_roll(), 
                'round': game.get_round(), 
                'active_player': active_player,
                'score_active': score_active,
                'score_inactive': score_inactive
            }, room=game.p2.sid)

    else:
        emit('gameUpdate', {'active_player': active_player, 'score_active': score_active, 'score_inactive': score_inactive}, room=game.p1.sid)
        emit('gameUpdate', {'active_player': active_player, 'score_active': score_active, 'score_inactive': score_inactive}, room=game.p2.sid)
        winner = game.get_winner()
        if winner == 0:
            emit('gameOver', {'status' : 'tie'}, room=game.p1.sid)
            emit('gameOver', {'status' : 'tie'}, room=game.p2.sid)
        elif winner == 1:
            emit('gameOver', {'status' : 'win'}, room=game.p1.sid)
            emit('gameOver', {'status' : 'lose'}, room=game.p2.sid)
        elif winner == 2:
            emit('gameOver', {'status' : 'lose'}, room=game.p1.sid)
            emit('gameOver', {'status' : 'win'}, room=game.p2.sid)
        game.p1.set_game_id('-1')
        game.p2.set_game_id('-1')
        available_players[game.p1.pid] = game.p1.to_dict()
        available_players[game.p2.pid] = game.p2.to_dict()
        del ongoing_games[message['game_id']]


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
