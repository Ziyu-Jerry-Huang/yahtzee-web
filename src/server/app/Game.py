import random
import uuid
from app.Player import Player


UPPER_KEYS = {'1s', '2s', '3s', '4s', '5s', '6s'}
LOWER_KEYS = {'3-of-a-kind', '4-of-a-kind', 'full-house', 'small-straight', 'large-straight', 'yahtzee', 'chance'}


class Game:
    def __init__(self, player_1, player_2):
        # unique game_id
        self.game_id = str(uuid.uuid4())

        # initialize the players
        if isinstance(player_1, Player):
            self.p1 = player_1
        else:
            raise TypeError('TypeError: player 1 is not a Player object.')
        if isinstance(player_2, Player):
            self.p2 = player_2
        else:
            raise TypeError('TypeError: player 2 is not a Player object.')

        # initialize the score sheet
        # the score -1 means 'not filled yet'
        # the score 0 means 'filled with zero' 
        self.n_player = 2
        self.upper_sec = []
        for _ in range(self.n_player):
            self.upper_sec.append({
                '1s' : -1,
                '2s' : -1,
                '3s' : -1,
                '4s' : -1,
                '5s' : -1,
                '6s' : -1
            })
        self.upper_sec_total = self.n_player * [0]
        self.bonus = self.n_player * [0]

        self.lower_sec = []
        for _ in range(self.n_player):
            self.lower_sec.append({
                '3-of-a-kind': -1,
                '4-of-a-kind': -1,
                'full-house' : -1,
                'small-straight' : -1,
                'large-straight' : -1,
                'yahtzee' : -1,
                'chance' : -1
            })
        self.total = self.n_player * [0]

        # initialize the dice
        self.dice = 5 * [-1]
        self.dice_count = {
            '1': 0,
            '2': 0,
            '3': 0,
            '4': 0,
            '5': 0,
            '6': 0
        }
        self.dice_sum = 0
        self.calculators = {
            '1s': self.calculate_1s,
            '2s': self.calculate_2s,
            '3s': self.calculate_3s,
            '4s': self.calculate_4s,
            '5s': self.calculate_5s,
            '6s': self.calculate_6s,
            '3-of-a-kind': self.calculate_3_of_a_kind,
            '4-of-a-kind': self.calculate_4_of_a_kind,
            'full-house': self.calculate_full_house,
            'small-straight': self.calculate_small_straight,
            'large-straight': self.calculate_large_staright,
            'yahtzee': self.calculate_yahtzee,
            'chance': self.calculate_chance
        }

        # initialize the game info
        self.round = 1
        self.active_player = 0 # active player - 0 or 1
        self.i_roll = 0 # i_roll - 0, 1, or 2

    def get_game_id(self):
        return self.game_id

    def get_score(self, player_idx):
        """
        Return a dict with all 13 scorings and their values
        """
        return {**self.upper_sec[player_idx], **self.lower_sec[player_idx]}

    def get_active_player(self):
        return self.active_player

    def get_round(self):
        return self.round

    def get_i_roll(self):
        return self.i_roll
    
    def get_dice(self):
        return self.dice

    def roll(self, idx):
        """
        roll the dice at specific index
        idx - the list of dice to roll, from 0 to 4
        """
        for i in idx:
            if i < 0 or i > 4:
                raise ValueError("Invalid index for dice. Only index from 0 to 4 is allowed.")
            self.dice[i] = random.randint(1, 6)

        # update the i_roll
        self.i_roll += 1

        # update dice_count
        for k in self.dice_count.keys():
            self.dice_count[k] = 0

        for num in self.dice:
            self.dice_count[str(num)] += 1

        # update dice_sum
        self.dice_sum = sum(self.dice)

    def calculate_score(self, key):
        """
        Choose the correct function in "calculators" according to the key to calculate the score
        """
        return self.calculators[key]()

    def calculate_1s(self):
        return self.dice_count['1']

    def calculate_2s(self):
        return 2 * self.dice_count['2']

    def calculate_3s(self):
        return 3 * self.dice_count['3']

    def calculate_4s(self):
        return 4 * self.dice_count['4']

    def calculate_5s(self):
        return 5 * self.dice_count['5']

    def calculate_6s(self):
        return 6 * self.dice_count['6']

    def calculate_3_of_a_kind(self):
        for count in self.dice_count.values():
            if count >= 3:
                return self.dice_sum
        return 0

    def calculate_4_of_a_kind(self):
        for count in self.dice_count.values():
            if count >= 4:
                return self.dice_sum
        return 0

    def calculate_full_house(self):
        for count in self.dice_count.values():
            if count == 3:
                for pair_count in self.dice_count.values():
                    if pair_count == 2:
                        return 25
        return 0

    def calculate_small_straight(self):
        if (self.dice_count['1'] >= 1) and (self.dice_count['2'] >= 1) and (self.dice_count['3'] >= 1) and (self.dice_count['4'] >= 1):
            return 30
        elif (self.dice_count['2'] >= 1) and (self.dice_count['3'] >= 1) and (self.dice_count['4'] >= 1) and (self.dice_count['5'] >= 1):
            return 30
        elif (self.dice_count['3'] >= 1) and (self.dice_count['4'] >= 1) and (self.dice_count['5'] >= 1) and (self.dice_count['6'] >= 1):
            return 30
        else:
            return 0

    def calculate_large_staright(self):
        if (self.dice_count['1'] == 1) and (self.dice_count['2'] == 1) and (self.dice_count['3'] == 1) and (self.dice_count['4'] == 1) and (self.dice_count['5'] == 1):
            return 40
        elif (self.dice_count['2'] == 1) and (self.dice_count['3'] == 1) and (self.dice_count['4'] == 1) and (self.dice_count['5'] == 1) and (self.dice_count['6'] == 1):
            return 40
        else:
            return 0

    def calculate_yahtzee(self):
        for count in self.dice_count.values():
            if count == 5:
                return 50
        return 0

    def calculate_chance(self):
        return self.dice_sum

    def fill(self, key):
        if key in UPPER_KEYS:
            if self.upper_sec[self.active_player][key] == -1:
                self.upper_sec[self.active_player][key] = self.calculate_score(key)
            else:
                raise ValueError("This scoring has already been occupied. Client must choose available scoring.")
        elif key in LOWER_KEYS:
            if self.lower_sec[self.active_player][key] == -1:
                self.lower_sec[self.active_player][key] = self.calculate_score(key)
            else:
                raise ValueError("This scoring has already been occupied. You must choose another scoring.")
        else:
            raise KeyError('Invalid input key encountered.')

        # update the bonus and total score after update a term
        self.update_total()

        # hand over to the next player
        # return true - game continue; false - game over and ready to decide the winner
        return self.hand_over()
    
    def update_total(self):
        """
        update the bonus and total score after update a term
        """
        sum_upper_sec = 0
        for score_upper_sec in self.upper_sec[self.active_player].values():
            sum_upper_sec += score_upper_sec
        self.upper_sec_total[self.active_player] = sum_upper_sec
        if self.upper_sec_total[self.active_player] >= 63:
            self.bonus[self.active_player] = 35

        sum_lower_sec = 0
        for score_lower in self.lower_sec[self.active_player].values():
            sum_lower_sec += score_lower
        self.total[self.active_player] = sum_upper_sec + sum_lower_sec + self.bonus[self.active_player]

    def hand_over(self):
        """
        hand over the game to the next player
        return:
            boolean value of whether the game continue
            true - the game continues
            false - the game finishes
        """
        if self.active_player < self.n_player - 1:
            self.active_player += 1
            self.i_roll = 0
            return True
        else:
            if self.round < 13:
                self.round += 1
                self.active_player = 0
                self.i_roll = 0
                return True
            else:
                self.active_player = 0
                self.i_roll = 0
                return False

    def get_winner(self):
        """
        Return the winner of this game
        return:
            0 - tie
            1 - Player 1 wins
            2 - Player 2 wins
        """
        if self.total[0] > self.total[1]:
            return 1
        elif self.total[1] > self.total[0]:
            return 2
        else:
            return 0
