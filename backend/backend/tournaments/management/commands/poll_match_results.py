"""Poll MLBB matchTools for room states and advance tournament brackets.

Run every minute from cron::

    * * * * * /path/to/venv/bin/python /path/to/manage.py poll_match_results

(Docker: ``docker compose exec -T django python manage.py poll_match_results``.)
Rooms polled within the last minute are skipped, so overlapping or manual
runs are cheap and idempotent.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.core.management.base import CommandError

from backend.tournaments.bracket import poll_match_results
from backend.tournaments.models import Tournament


class Command(BaseCommand):
    help = "Poll matchTools room states and auto-finish decided matches."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--tournament",
            type=int,
            default=None,
            help="Only poll rooms of this tournament ID.",
        )

    def handle(self, *args, **options) -> None:
        tournament = None
        if options["tournament"] is not None:
            try:
                tournament = Tournament.objects.get(pk=options["tournament"])
            except Tournament.DoesNotExist as exc:
                msg = f"Tournament {options['tournament']} does not exist."
                raise CommandError(msg) from exc
        summary = poll_match_results(tournament)
        self.stdout.write(
            "polled={polled} updated={updated} finished={finished} "
            "rooms={rooms} errors={errors}".format(
                polled=summary["polled"],
                updated=summary["updated"],
                finished=summary["finished"],
                rooms=summary["rooms"],
                errors=len(summary["errors"]),
            ),
        )
        for error in summary["errors"]:
            self.stdout.write(f"  - {error}")
