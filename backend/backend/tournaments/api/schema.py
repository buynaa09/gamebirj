from ninja import Schema


class TournamentSchema(Schema):
    id: int
    title: str
    game_id: int
    game: str
    id_check_slug: str = ""
    status: str
    prize_pool: str
    entry_fee: str
    starts_at: str | None = None
    ends_at: str | None = None
    format: str = ""
    mode: str = ""
    team_size: int = 0
    rules: str = ""
    total_slots: int = 0
    filled_slots: int = 0
    slot_unit: str = ""
    is_registered: bool = False


class RegisterTeamSchema(Schema):
    team_id: int


class RegistrationSchema(Schema):
    id: int
    tournament: int
    team_id: int
    team_name: str
    leader_game_id: str
    leader_server_id: str = ""
    leader_nickname: str = ""
    created_at: str


class CreateTeamSchema(Schema):
    game_id: int
    name: str
    leader_game_id: str
    leader_server_id: str = ""
    leader_nickname: str = ""


class TournamentTeamSchema(Schema):
    id: int
    game_id: int
    game: str
    name: str
    leader_game_id: str
    leader_server_id: str = ""
    leader_nickname: str = ""
    created_at: str


class CheckIdSchema(Schema):
    tournament_id: int
    user_id: str
    server_id: str = ""


class CheckedAccountSchema(Schema):
    nickname: str
    region: str = ""


class RegisteredTeamSchema(Schema):
    team_name: str
    leader_nickname: str = ""
    created_at: str


class TournamentDetailSchema(TournamentSchema):
    registrations: list[RegisteredTeamSchema] = []
    # The viewer's own upcoming lobby link (an open match of their team).
    my_draft_url: str | None = None


class TournamentMatchSchema(Schema):
    id: int
    round_index: int
    position: int
    team_a: str | None = None
    team_b: str | None = None
    winner: str | None = None
    score_a: int | None = None
    score_b: int | None = None
    status: str = ""
    has_room: bool = False
    # Draft lobby link — only for the two playing teams (and staff).
    draft_url: str | None = None


class EnsureRoomsSchema(Schema):
    created: int = 0
    errors: list[str] = []
