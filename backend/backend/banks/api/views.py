from ninja import Router

from backend.banks.api.schema import BankSchema
from backend.banks.models import Bank

router = Router(tags=["banks"])


@router.get("/", response=list[BankSchema])
def list_active_banks(request):
    return Bank.objects.filter(is_active=True)
