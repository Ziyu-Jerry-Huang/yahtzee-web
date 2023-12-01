from app.RandomName import get_random_name


class Player:
    def __init__(self, pid, sid=None, ip=None, username=None):
        self.pid = pid
        self.sid = sid
        self.ip = ip
        if username is None:
            self.username = get_random_name()
        else:
            self.username = username
        self.game_id = '-1'

    def __str__(self):
        return "Player:{pid:%s, sid:%s, ip:%s, username:%s, game_id:%s}" \
                % (self.pid, self.sid, self.ip, self.username, self.game_id)

    def set_sid(self, sid):
        self.sid = sid

    def set_username(self, username):
        self.username = username

    def set_ip(self, ip):
        self.ip = ip

    def set_game_id(self, game_id):
        self.game_id = game_id

    def to_dict(self):
        return {
            'pid': self.pid,
            'username': self.username
        }
