"""
This code is for testing the Game.py file in the console.
"""

from Game import Game, UPPER_KEYS, LOWER_KEYS
from Player import Player


def input_roll():
    valid_idx = False
    idx = []
    while (not valid_idx):
        try:
            command = input("Type in a list of index to re-toss, seperate by comma: \n")
            nums = command.split(',')
            if len(nums) > 5:
                raise ValueError("Input list of index must be less than 5 dice")
            for i in nums:
                i = int(i.strip())
                if i < 0 or i > 4:
                    raise ValueError("Input index must be of 0 to 4")
                idx.append(i)
            valid_idx = True
        except:
            print("Invalid index input. Please re-type your command.")
    return idx


def fill_key(game):
    while True:
        key = input('Type in scoring: ')
        try:
            game_continue = game.fill(key)
            return game_continue
        except KeyError as e:
            print(e)
        except ValueError as e:
            print(e)


def number_to_string(num):
    if num == -1:
        return "  "
    elif num < 10:
        return " " + str(num)
    else:
        return str(num)


def print_all_scoring(game):
    print("+----+----+----+----+----+----+----+----+----+----+----+----+----+----+")
    print("|    | 1s | 2s | 3s | 4s | 5s | 6s | 3k | 4k | fh | ss | ls | yt | ch |")
    print("+----+----+----+----+----+----+----+----+----+----+----+----+----+----+")
    for i in range(2):
        scores = game.get_score(i)
        content_line = "| P%d | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |" % ( i + 1, \
            number_to_string(scores['1s']), \
            number_to_string(scores['2s']), \
            number_to_string(scores['3s']), \
            number_to_string(scores['4s']), \
            number_to_string(scores['5s']), \
            number_to_string(scores['6s']), \
            number_to_string(scores['3-of-a-kind']), \
            number_to_string(scores['4-of-a-kind']), \
            number_to_string(scores['full-house']), \
            number_to_string(scores['small-straight']), \
            number_to_string(scores['large-straight']), \
            number_to_string(scores['yahtzee']), \
            number_to_string(scores['chance'])
        )
        if i == game.active_player:
            content_line += " *"
        print(content_line)
        print("+----+----+----+----+----+----+----+----+----+----+----+----+----+----+")


def game_over(game):
    print("Game over. Total scores:")
    print("+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+")
    print("|    | 1s | 2s | 3s | 4s | 5s | 6s |    | bn | 3k | 4k | fh | ss | ls | yt | ch |    |")
    print("+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+")
    for i in range(2):
        scores = game.get_score(i)
        content_line = "| P%d | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s|" % ( i + 1, \
            number_to_string(scores['1s']), \
            number_to_string(scores['2s']), \
            number_to_string(scores['3s']), \
            number_to_string(scores['4s']), \
            number_to_string(scores['5s']), \
            number_to_string(scores['6s']), \
            number_to_string(game.upper_sec_total[i]), \
            number_to_string(game.bonus[i]), \
            number_to_string(scores['3-of-a-kind']), \
            number_to_string(scores['4-of-a-kind']), \
            number_to_string(scores['full-house']), \
            number_to_string(scores['small-straight']), \
            number_to_string(scores['large-straight']), \
            number_to_string(scores['yahtzee']), \
            number_to_string(scores['chance']), \
            str(game.total[i])
        )
        print(content_line)
        print("+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+----+")
    if (game.total[0] > game.total[1]):
        print('Player 1: %s win!' % game.p1.username)
    elif (game.total[0] < game.total[1]):
        print('Player 2: %s win!' % game.p2.username)
    else:
        print('Oh, Tie!')


def main():
    p1 = Player(cid='player1', ip='0.0.0.0')
    p2 = Player(cid='player2', ip='0.0.0.0')
    game = Game(p1, p2)

    game_continue = True
    while game_continue:
        print("Round %d / 13: Player %s's turn. Current scores: " % (game.get_round(), game.get_active_player().username))
        print_all_scoring(game)

        print("\nPlayer %s's First roll." % game.get_active_player().username)
        game.roll([0, 1, 2, 3, 4])
        print('Dice:', game.get_dice())

        fill_score = False
        while (game.get_i_roll() <= 2) and (not fill_score):
            print("Player %s have %d toss left in this round. Player %s can choose to retoss by typing 'roll'." \
                  % (game.get_active_player().username, 3 - game.get_i_roll(), game.get_active_player().username))
            print("Or player %s can choose to fill a score, by typing 'fill'." % game.get_active_player().username)
            command = input().strip()
            if command == 'roll':
                idx = input_roll()
                game.roll(idx)
                print('Dice:', game.get_dice())
            elif command == 'fill':
                print("Player %s choose to fill a scoring. Player %s can type in any one of the following scoring: " \
                      % (game.get_active_player().username, game.get_active_player().username))
                print(UPPER_KEYS)
                print(LOWER_KEYS)
                game_continue = fill_key(game)
                fill_score = True
            else:
                print("Invalid input command. Player can only type in 'roll' or 'fill'. Please re-type your command.")

        if not fill_score:
            print("Player %s have to choose to fill a score, by typing in any one of the following keys: " % game.active_player)
            print(UPPER_KEYS)
            print(LOWER_KEYS)
            game_continue = fill_key(game)
            fill_score = True

    game_over(game)


if __name__ == "__main__":
    main()
