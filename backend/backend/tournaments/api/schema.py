from ninja import Schema


class TournamentSchema(Schema):
    id: int
    title: str
    game_id: int
    game: str
    status: str
    prize_pool: str
    entry_fee: str
    starts_at: str | None = None
    format: str = ""
    total_slots: int = 0
    filled_slots: int = 0
    slot_unit: str = ""


class RegisterTeamSchema(Schema):
    team_name: str
    leader_game_id: str


class RegistrationSchema(Schema):
    id: int
    tournament: int
    team_name: str
    leader_game_id: str
    created_at: str
